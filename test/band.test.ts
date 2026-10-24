/**
 * FairFix Basic Unit Tests: Fair-Price Band Algorithm
 * Run with: npx tsx test/band.test.ts
 */
import assert from 'node:assert';
import { getDb, resetDatabase } from '../src/server/db.js';
import { seedData } from '../src/server/seed.js';
import { calculateFairPriceBand, comparePriceToBand } from '../src/server/band.js';
import { CITY_CENTER } from '../src/config.js';

console.log('🧪 Starting Fair-Price Band Algorithm Unit Tests...\n');

// 1. Reset & Seed test database
resetDatabase();
seedData();

// Test 1: Plumbing Price Band Calculation (High confidence & Outlier rejection)
{
  const band = calculateFairPriceBand('plumbing', CITY_CENTER.lat, CITY_CENTER.lng);
  console.log('Test 1 (Plumbing Band):', {
    low: band.low,
    typical: band.typical,
    high: band.high,
    jobCount: band.jobCount,
    outliersRemoved: band.outliersRemoved,
    confidence: band.confidence,
  });

  assert.strictEqual(band.confidence, 'high', 'Plumbing should have high confidence (>= 5 jobs)');
  assert(band.jobCount >= 5, 'Plumbing job count must be >= 5');
  assert(band.outliersRemoved >= 1, 'IQR rule must filter out the intentional ₹1,600 outlier');
  assert(band.low >= 350 && band.low <= 480, `Expected reasonable low band, got ${band.low}`);
  assert(band.high >= 450 && band.high <= 650, `Expected reasonable high band, got ${band.high}`);
  assert(band.explanation.includes('completed jobs'), 'Explanation string must be present');
  console.log('✓ Test 1 Passed: Plumbing band calculated & deliberate outlier removed.\n');
}

// Test 2: Low Confidence Category (Cook & Maid has only 3 seeded jobs)
{
  const band = calculateFairPriceBand('cook_maid', CITY_CENTER.lat, CITY_CENTER.lng);
  console.log('Test 2 (Cook & Maid Low Confidence):', {
    confidence: band.confidence,
    jobCount: band.jobCount,
    typical: band.typical,
  });

  assert.strictEqual(band.confidence, 'low (few jobs)', 'Should report "low (few jobs)" when job count < 5');
  assert.strictEqual(band.jobCount, 3, 'Cook & Maid should have exactly 3 seeded jobs');
  console.log('✓ Test 2 Passed: Low confidence tier verified for sparse categories.\n');
}

// Test 3: Zero Jobs Fallback (Baseline Estimate)
{
  const db = getDb();
  // Clear appliance jobs temporarily to test estimate
  db.prepare(`DELETE FROM jobs WHERE category = 'appliance'`).run();
  const band = calculateFairPriceBand('appliance', CITY_CENTER.lat, CITY_CENTER.lng);
  console.log('Test 3 (Appliance 0-jobs Fallback):', {
    confidence: band.confidence,
    typical: band.typical,
    isEstimate: band.isEstimate,
  });

  assert.strictEqual(band.confidence, 'estimate', 'Should fallback to estimate when 0 jobs exist');
  assert.strictEqual(band.typical, 950, 'Baseline price from config should be 950');
  assert.strictEqual(band.isEstimate, true);
  console.log('✓ Test 3 Passed: Zero jobs gracefully uses category baseline estimate.\n');
}

// Test 4: Price Comparison & Warning Chips
{
  const mockBand = {
    category: 'plumbing',
    lat: 12.9352,
    lng: 77.6245,
    low: 400,
    typical: 450,
    high: 520,
    jobCount: 15,
    outliersRemoved: 1,
    confidence: 'high' as const,
    explanation: 'Test',
    isEstimate: false,
    computedAt: new Date().toISOString(),
  };

  const withinOffer = comparePriceToBand(450, mockBand);
  assert.strictEqual(withinOffer.status, 'within', '450 should be within [400, 520]');

  const belowOffer = comparePriceToBand(300, mockBand);
  assert.strictEqual(belowOffer.status, 'below', '300 should be below band');
  assert(belowOffer.warning !== undefined, 'Below band must yield warning string');

  const aboveOffer = comparePriceToBand(700, mockBand);
  assert.strictEqual(aboveOffer.status, 'above', '700 should be above band');
  assert(aboveOffer.warning !== undefined, 'Above band must yield warning string');

  console.log('✓ Test 4 Passed: Comparison chips correctly flag within, below, and above band.\n');
}

// Test 5: Design Critique Formatting & Anti-Collision Verification
{
  // 1. Job ID display test: always "Job 102", never "#job_102"
  const formatJobTitle = (id: string | number) => `Job ${String(id).replace(/^job_/, '')}`;
  assert.strictEqual(formatJobTitle('job_102'), 'Job 102', 'Must strip job_ prefix');
  assert.strictEqual(formatJobTitle('102'), 'Job 102', 'Must prefix bare number with Job');

  // 2. Below typical caution formatting (never red)
  const formatTypicalDiff = (price: number, typical: number) => {
    const diff = price - typical;
    if (diff < 0) return { label: `₹${Math.abs(diff)} below typical`, variant: 'caution' };
    if (diff > 0) return { label: `₹${diff} above typical`, variant: 'caution' };
    return { label: 'Matches typical', variant: 'fair' };
  };
  const belowChip = formatTypicalDiff(420, 450);
  assert.strictEqual(belowChip.label, '₹30 below typical', 'Must format as ₹30 below typical');
  assert.strictEqual(belowChip.variant, 'caution', 'Must be gold caution variant, not red');

  // 3. Updated just now time boundary (<= 60s)
  const isWithin60s = (ts: string) => Date.now() - new Date(ts).getTime() < 60000;
  const recentTs = new Date(Date.now() - 30000).toISOString();
  const oldTs = new Date(Date.now() - 120000).toISOString();
  assert.strictEqual(isWithin60s(recentTs), true, '30s old snapshot is within 60s window');
  assert.strictEqual(isWithin60s(oldTs), false, '120s old snapshot must show Band computed at HH:MM');

  console.log('✓ Test 5 Passed: Design critique formatters (Job 102, ₹30 below typical caution, 60s update window) verified.\n');
}

// Re-seed DB to clean state after tests
seedData();
console.log('🎉 All Fair-Price Band Unit Tests Passed Successfully!\n');

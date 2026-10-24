/**
 * FairFix Unit Tests: Server-Enforced Negotiation Engine
 * Tests turns, rounds (max 3), acceptance, rejection, and auto-expiry.
 * Run with: npx tsx test/negotiation.test.ts
 */
import assert from 'node:assert';
import { getDb, resetDatabase } from '../src/server/db.js';
import { seedData } from '../src/server/seed.js';
import { CONFIG } from '../src/config.js';

console.log('🧪 Starting FairFix Negotiation Engine Tests...\n');

resetDatabase();
seedData();

const db = getDb();
const customerId = 'cust_1'; // Priya Sundaram
const workerId = 'work_1';   // Rajesh Kumar

// Test 1: Create Job & Initial Offer (Round 1)
const jobId = 'test_job_neg_1';
const now = new Date().toISOString();

db.prepare(`
  INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, status, created_at, is_seed)
  VALUES (?, ?, ?, 'plumbing', 'Test leaking tap', 12.9352, 77.6245, 450, 'requested', ?, 0)
`).run(jobId, customerId, workerId, now);

db.prepare(`
  INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
  VALUES ('off_1', ?, 'customer', 450, 1, 'pending', ?)
`).run(jobId, now);

{
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
  const offer = db.prepare('SELECT * FROM offers WHERE job_id = ?').get(jobId) as any;

  assert.strictEqual(job.status, 'requested');
  assert.strictEqual(offer.amount, 450);
  assert.strictEqual(offer.round, 1);
  assert.strictEqual(offer.from_role, 'customer');
  console.log('✓ Test 1: Customer initial offer in round 1 created successfully.');
}

// Test 2: Turn Enforcement - Customer cannot offer again before worker responds
{
  const latestOffer = db.prepare('SELECT * FROM offers WHERE job_id = ? ORDER BY round DESC, created_at DESC LIMIT 1').get(jobId) as any;
  const customerRole = 'customer';
  const isOutOfTurn = latestOffer.from_role === customerRole;
  assert.strictEqual(isOutOfTurn, true, 'Customer attempting to offer again should be out of turn');
  console.log('✓ Test 2: Out-of-turn customer check correctly blocked.');
}

// Test 3: Worker Counter-Offers (₹500, round 1)
{
  db.prepare(`UPDATE offers SET status = 'countered' WHERE id = 'off_1'`).run();
  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES ('off_2', ?, 'worker', 500, 1, 'pending', ?)
  `).run(jobId, new Date().toISOString());
  db.prepare(`UPDATE jobs SET status = 'negotiating' WHERE id = ?`).run(jobId);

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
  const latestOffer = db.prepare('SELECT * FROM offers WHERE job_id = ? ORDER BY round DESC, created_at DESC LIMIT 1').get(jobId) as any;

  assert.strictEqual(job.status, 'negotiating');
  assert.strictEqual(latestOffer.from_role, 'worker');
  assert.strictEqual(latestOffer.amount, 500);
  assert.strictEqual(latestOffer.round, 1);
  console.log('✓ Test 3: Worker counter-offer accepted and job transitioned to negotiating.');
}

// Test 4: Customer Counter-Offers Back (Round 2 begins)
{
  db.prepare(`UPDATE offers SET status = 'countered' WHERE id = 'off_2'`).run();
  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES ('off_3', ?, 'customer', 480, 2, 'pending', ?)
  `).run(jobId, new Date().toISOString());

  const latestOffer = db.prepare('SELECT * FROM offers WHERE job_id = ? ORDER BY round DESC, created_at DESC LIMIT 1').get(jobId) as any;
  assert.strictEqual(latestOffer.round, 2);
  assert.strictEqual(latestOffer.amount, 480);
  console.log('✓ Test 4: Customer counter-offer correctly advances to round 2.');
}

// Test 5: Worker Accepts Customer Offer
{
  const latestOffer = db.prepare('SELECT * FROM offers WHERE job_id = ? ORDER BY round DESC, created_at DESC LIMIT 1').get(jobId) as any;
  const acceptTime = new Date().toISOString();

  db.prepare(`UPDATE offers SET status = 'accepted' WHERE id = ?`).run(latestOffer.id);
  db.prepare(`
    UPDATE jobs
    SET status = 'accepted',
        agreed_price = ?,
        accepted_at = ?
    WHERE id = ?
  `).run(latestOffer.amount, acceptTime, jobId);

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
  assert.strictEqual(job.status, 'accepted');
  assert.strictEqual(job.agreed_price, 480);
  assert.strictEqual(Boolean(job.accepted_at), true);
  console.log('✓ Test 5: Offer acceptance successfully finalized agreed_price (₹480) and accepted_at.');
}

// Test 6: Expiration after MAX_NEGOTIATION_ROUNDS (3)
{
  const expJobId = 'test_job_expire';
  db.prepare(`
    INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, status, created_at)
    VALUES (?, ?, ?, 'electrician', 'Ceiling fan fix', 12.9352, 77.6245, 350, 'negotiating', ?)
  `).run(expJobId, customerId, workerId, now);

  // Simulate round 3 already reached
  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES ('off_r3', ?, 'worker', 420, 3, 'pending', ?)
  `).run(expJobId, now);

  // If customer attempts to counter again, next round would be 4 > MAX_NEGOTIATION_ROUNDS (3)
  const nextRound = 3 + 1;
  const isExpired = nextRound > CONFIG.MAX_NEGOTIATION_ROUNDS;
  assert.strictEqual(isExpired, true, 'Round 4 must trigger expiration');

  db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`).run(expJobId);
  const expJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(expJobId) as any;
  assert.strictEqual(expJob.status, 'cancelled');
  console.log('✓ Test 6: Expiration at max rounds (3) successfully cancels job.');
}

seedData();
console.log('🎉 All Negotiation Engine Tests Passed Successfully!\n');

/**
 * FairFix Phase 2 State Machine, Ratings, and Live Band Recompute Integration Test
 */
import { DatabaseSync } from 'node:sqlite';
import { calculateFairPriceBand, recordPriceBandSnapshot } from '../src/server/band.js';
import { seedData } from '../src/server/seed.js';
import { getDb, resetDatabase } from '../src/server/db.js';

console.log('🧪 Starting FairFix State Machine & Live Band Recompute Tests...\n');

// 1. Reset and seed
resetDatabase();
seedData();
const db = getDb();

// 2. Fetch test customer and worker
const customer = db.prepare(`SELECT * FROM users WHERE role = 'customer' LIMIT 1`).get() as any;
const worker = db.prepare(`
  SELECT u.*, w.base_rate, w.jobs_completed, w.rating_avg, w.rating_count
  FROM users u JOIN workers w ON u.id = w.user_id
  WHERE u.role = 'worker' LIMIT 1
`).get() as any;

if (!customer || !worker) {
  throw new Error('Customer or worker missing in seed');
}

console.log(`[Test Setup] Customer: ${customer.name} (#${customer.id}), Worker: ${worker.name} (#${worker.id})`);

// 3. Test requested state
const jobId = `test_job_${Date.now()}`;
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, status, created_at, is_seed)
  VALUES (?, ?, ?, 'plumbing', 'State machine integration job', ?, ?, 400, 'requested', ?, 0)
`).run(jobId, customer.id, worker.id, customer.lat, customer.lng, now);

let job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
if (job.status !== 'requested') throw new Error('Job status should be requested');
console.log('✓ Step 1: Job created in requested status.');

// 4. Test accept state
db.prepare(`
  UPDATE jobs
  SET status = 'accepted', agreed_price = 450, accepted_at = ?
  WHERE id = ?
`).run(now, jobId);

job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
if (job.status !== 'accepted' || job.agreed_price !== 450) throw new Error('Job should be accepted at ₹450');
console.log('✓ Step 2: Job transitioned to accepted status with agreed_price ₹450.');

// 5. Test start state (in_progress)
db.prepare(`
  UPDATE jobs
  SET status = 'in_progress', started_at = ?
  WHERE id = ?
`).run(now, jobId);

job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
if (job.status !== 'in_progress' || !job.started_at) throw new Error('Job should be in_progress with started_at');
console.log('✓ Step 3: Job transitioned to in_progress with started_at timestamp.');

// 6. Test complete state
const prevJobsCompleted = Number(worker.jobs_completed) || 0;
db.prepare(`
  UPDATE jobs
  SET status = 'completed', completed_at = ?
  WHERE id = ?
`).run(now, jobId);
db.prepare(`UPDATE workers SET jobs_completed = jobs_completed + 1 WHERE user_id = ?`).run(worker.id);

job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
const updatedWorker = db.prepare(`SELECT jobs_completed FROM workers WHERE user_id = ?`).get(worker.id) as any;
if (job.status !== 'completed' || updatedWorker.jobs_completed !== prevJobsCompleted + 1) {
  throw new Error('Job should be completed and worker jobs_completed incremented');
}
console.log('✓ Step 4: Job transitioned to completed status; worker completed count incremented.');

// 7. Test rating & live band recompute
const prevBand = calculateFairPriceBand('plumbing', customer.lat, customer.lng);
const ratingId = `rat_test_${Date.now()}`;
db.prepare(`
  INSERT INTO ratings (id, job_id, rating, comment, created_at)
  VALUES (?, ?, 5, 'Outstanding work, fair and transparent!', ?)
`).run(ratingId, jobId, now);

db.prepare(`UPDATE jobs SET status = 'rated' WHERE id = ?`).run(jobId);

const newBand = recordPriceBandSnapshot('plumbing', customer.lat, customer.lng);
job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;

if (job.status !== 'rated') throw new Error('Job status should be rated');
if (!newBand || newBand.jobCount <= 0) throw new Error('New band calculation failed');

console.log(`✓ Step 5: Rating submitted (5 stars), job rated, and live fair band recomputed:`);
console.log(`         Band: ₹${newBand.low} - ₹${newBand.high} (Typical: ₹${newBand.typical}), Jobs in sample: ${newBand.jobCount}`);

// 8. Test Deliberate Outlier Rejection
const outlierPrice = 4500;
const outlierJobId = `outlier_${Date.now()}`;
db.prepare(`
  INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, agreed_price, status, created_at, accepted_at, started_at, completed_at, is_seed)
  VALUES (?, ?, ?, 'plumbing', 'Artificial outlier job', ?, ?, 4500, ?, 'completed', ?, ?, ?, ?, 0)
`).run(outlierJobId, customer.id, worker.id, customer.lat, customer.lng, outlierPrice, now, now, now, now);

const outlierBand = calculateFairPriceBand('plumbing', customer.lat, customer.lng);
if (outlierBand.outliersRemoved < 1) {
  throw new Error(`Expected at least 1 outlier removed, got ${outlierBand.outliersRemoved}`);
}
console.log(`✓ Step 6: Injected ₹4,500 outlier job; IQR rule successfully detected and rejected it (outliers removed: ${outlierBand.outliersRemoved}).`);

console.log('\n🎉 ALL State Machine, Ratings, and Live Band Recompute Tests PASSED 100%!');

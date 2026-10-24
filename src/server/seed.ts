/**
 * FairFix Seed Data Generator
 * Seeds users, workers with various verification states, customers, admin,
 * and ~60 completed historical jobs with realistic INR pricing and intentional outliers.
 */
import { getDb, resetDatabase } from './db.js';
import { NEIGHBORHOODS, SERVICE_CATEGORIES } from '../config.js';
import { recordPriceBandSnapshot } from './band.js';

export function seedData() {
  const db = getDb();

  // Clear existing records
  db.exec(`
    DELETE FROM tracking_points;
    DELETE FROM incidents;
    DELETE FROM reports;
    DELETE FROM ratings;
    DELETE FROM offers;
    DELETE FROM jobs;
    DELETE FROM workers;
    DELETE FROM users;
    DELETE FROM price_band_snapshots;
  `);

  const now = new Date();
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, role, phone, lat, lng, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWorker = db.prepare(`
    INSERT INTO workers (user_id, categories, base_rate, rate_unit, radius_km, available, verification_status, verification_doc_path, verification_reject_reason, is_flagged, is_suspended, rating_avg, rating_count, jobs_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Seed 8 Customers
  const customers = [
    { id: 'cust_1', name: 'Priya Sundaram', phone: '+91 98450 11223', n: NEIGHBORHOODS[0] }, // Koramangala
    { id: 'cust_2', name: 'Arvind Narayanan', phone: '+91 97401 33445', n: NEIGHBORHOODS[1] }, // HSR
    { id: 'cust_3', name: 'Divya Krishnan', phone: '+91 99002 55667', n: NEIGHBORHOODS[2] }, // Indiranagar
    { id: 'cust_4', name: 'Rohan Malhotra', phone: '+91 96113 77889', n: NEIGHBORHOODS[3] }, // Jayanagar
    { id: 'cust_5', name: 'Kavita Nair', phone: '+91 98864 99001', n: NEIGHBORHOODS[0] }, // Koramangala
    { id: 'cust_6', name: 'Karthik S.', phone: '+91 97315 22334', n: NEIGHBORHOODS[1] }, // HSR
    { id: 'cust_7', name: 'Meera Joshi', phone: '+91 99456 44556', n: NEIGHBORHOODS[2] }, // Indiranagar
    { id: 'cust_8', name: 'Nikhil Deshmukh', phone: '+91 96207 66778', n: NEIGHBORHOODS[4] }, // Whitefield
  ];

  for (const c of customers) {
    insertUser.run(c.id, c.name, 'customer', c.phone, c.n.lat, c.n.lng, now.toISOString());
  }

  // 2. Seed 1 Admin
  insertUser.run(
    'admin_1',
    'Vikram Sen (Operations)',
    'admin',
    '+91 98000 00001',
    NEIGHBORHOODS[0].lat,
    NEIGHBORHOODS[0].lng,
    now.toISOString()
  );

  // 3. Seed 12 Workers across 4 neighborhoods, 6 categories, and all 4 verification states
  const workersData = [
    {
      id: 'work_1',
      name: 'Rajesh Kumar',
      phone: '+91 98451 90111',
      n: NEIGHBORHOODS[0], // Koramangala
      cats: ['plumbing'],
      baseRate: 450,
      radius: 6.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 38,
      jobsCompleted: 42,
      doc: '/uploads/rajesh_aadhaar_verified.pdf',
    },
    {
      id: 'work_2',
      name: 'Ramesh Patel',
      phone: '+91 98452 90222',
      n: NEIGHBORHOODS[0], // Koramangala
      cats: ['electrician'],
      baseRate: 420,
      radius: 5.5,
      available: 1,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 45,
      jobsCompleted: 50,
      doc: '/uploads/ramesh_trade_cert.pdf',
    },
    {
      id: 'work_3',
      name: 'Suresh Naik',
      phone: '+91 98453 90333',
      n: NEIGHBORHOODS[1], // HSR Layout
      cats: ['cleaning'],
      baseRate: 750,
      radius: 7.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.7,
      ratingCount: 22,
      jobsCompleted: 26,
      doc: '/uploads/suresh_id.pdf',
    },
    {
      id: 'work_4',
      name: 'Anita Sharma',
      phone: '+91 98454 90444',
      n: NEIGHBORHOODS[0], // Koramangala
      cats: ['cook_maid'],
      baseRate: 500,
      radius: 4.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 15,
      jobsCompleted: 18,
      doc: '/uploads/anita_voter_card.pdf',
    },
    {
      id: 'work_5',
      name: 'Mohammad Arif',
      phone: '+91 98455 90555',
      n: NEIGHBORHOODS[2], // Indiranagar
      cats: ['appliance'],
      baseRate: 950,
      radius: 8.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 29,
      jobsCompleted: 33,
      doc: '/uploads/arif_hvac_cert.pdf',
    },
    {
      id: 'work_6',
      name: 'Manjunath Gowda',
      phone: '+91 98456 90666',
      n: NEIGHBORHOODS[3], // Jayanagar
      cats: ['carpentry'],
      baseRate: 650,
      radius: 6.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.6,
      ratingCount: 19,
      jobsCompleted: 21,
      doc: '/uploads/manjunath_kyc.pdf',
    },
    {
      id: 'work_7',
      name: 'Pradeep Reddy',
      phone: '+91 98457 90777',
      n: NEIGHBORHOODS[1], // HSR Layout
      cats: ['plumbing'],
      baseRate: 400,
      radius: 5.0,
      available: 1,
      status: 'pending', // Pending verification
      ratingAvg: 4.5,
      ratingCount: 8,
      jobsCompleted: 9,
      doc: '/uploads/pradeep_aadhaar_pending.pdf',
    },
    {
      id: 'work_8',
      name: 'Sunil Rao',
      phone: '+91 98458 90888',
      n: NEIGHBORHOODS[2], // Indiranagar
      cats: ['electrician'],
      baseRate: 380,
      radius: 4.5,
      available: 1,
      status: 'unverified', // Unverified
      ratingAvg: 4.2,
      ratingCount: 4,
      jobsCompleted: 4,
      doc: null,
    },
    {
      id: 'work_9',
      name: 'Imran Khan',
      phone: '+91 98459 90999',
      n: NEIGHBORHOODS[1], // HSR Layout
      cats: ['appliance'],
      baseRate: 1100,
      radius: 5.0,
      available: 1,
      status: 'rejected', // Rejected ID
      ratingAvg: 3.9,
      ratingCount: 5,
      jobsCompleted: 5,
      doc: '/uploads/imran_blurred_id.pdf',
    },
    {
      id: 'work_10',
      name: 'Lakshmi Bai',
      phone: '+91 98460 91000',
      n: NEIGHBORHOODS[3], // Jayanagar
      cats: ['cook_maid'],
      baseRate: 480,
      radius: 5.0,
      available: 1,
      status: 'verified',
      ratingAvg: 4.7,
      ratingCount: 12,
      jobsCompleted: 14,
      doc: '/uploads/lakshmi_doc.pdf',
    },
    {
      id: 'work_11',
      name: 'Vikas Verma',
      phone: '+91 98461 91111',
      n: NEIGHBORHOODS[2], // Indiranagar
      cats: ['carpentry'],
      baseRate: 600,
      radius: 5.5,
      available: 1,
      status: 'pending', // Pending
      ratingAvg: 4.4,
      ratingCount: 6,
      jobsCompleted: 7,
      doc: '/uploads/vikas_carpentry_diploma.pdf',
    },
    {
      id: 'work_12',
      name: 'Deepak Joshi',
      phone: '+91 98462 91222',
      n: NEIGHBORHOODS[0], // Koramangala
      cats: ['cleaning'],
      baseRate: 800,
      radius: 7.0,
      available: 0, // Currently toggleable offline to test availability filter
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 27,
      jobsCompleted: 31,
      doc: '/uploads/deepak_verified_badge.pdf',
    },
  ];

  for (const w of workersData) {
    insertUser.run(w.id, w.name, 'worker', w.phone, w.n.lat, w.n.lng, now.toISOString());
    const rejectReason = w.status === 'rejected' ? 'Document image blurred / unreadable credentials' : null;
    insertWorker.run(
      w.id,
      JSON.stringify(w.cats),
      w.baseRate,
      'per_job',
      w.radius,
      w.available,
      w.status,
      w.doc,
      rejectReason,
      0, // is_flagged
      0, // is_suspended
      w.ratingAvg,
      w.ratingCount,
      w.jobsCompleted
    );
  }

  // 4. Seed Historical Completed Jobs (~64 jobs across 90 days)
  const insertJob = db.prepare(`
    INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, agreed_price, status, created_at, accepted_at, started_at, completed_at, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, 1)
  `);

  const insertRating = db.prepare(`
    INSERT INTO ratings (id, job_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  let jobCounter = 100;

  interface HistoricalJobSpec {
    cat: string;
    prices: number[];
    deliberateOutliers?: number[];
  }

  const categoryJobSpecs: HistoricalJobSpec[] = [
    {
      cat: 'plumbing',
      // Typical: ~450 INR. Normal range: 380 - 540. Outlier: 1600.
      prices: [380, 400, 420, 420, 450, 450, 450, 460, 480, 490, 500, 520, 540, 550],
      deliberateOutliers: [1600],
    },
    {
      cat: 'electrician',
      // Typical: ~400 INR. Normal range: 350 - 480. Outlier: 1400.
      prices: [350, 360, 380, 400, 400, 420, 420, 430, 450, 450, 470, 480, 490],
      deliberateOutliers: [1400],
    },
    {
      cat: 'cleaning',
      // Typical: ~750 INR. Normal range: 680 - 850.
      prices: [680, 700, 720, 740, 750, 750, 780, 800, 820, 850, 860, 880],
      deliberateOutliers: [2400],
    },
    {
      cat: 'appliance',
      // Typical: ~950 INR. Normal range: 850 - 1100. Outlier: 3200.
      prices: [850, 880, 900, 920, 950, 950, 980, 1000, 1050, 1080, 1100],
      deliberateOutliers: [3200],
    },
    {
      cat: 'carpentry',
      // Typical: ~650 INR. Normal range: 550 - 750.
      prices: [550, 580, 600, 620, 650, 680, 700, 750],
      deliberateOutliers: [2100],
    },
    {
      cat: 'cook_maid',
      // Demontrates LOW CONFIDENCE (< 5 jobs): only 3 completed jobs!
      prices: [450, 480, 500],
    },
  ];

  const comments = [
    'Arrived on time and fixed cleanly!',
    'Great workmanship, very polite.',
    'Quick service and fair rates.',
    'Very satisfied with the repair.',
    'Cleaned up after finishing the job.',
  ];

  for (const spec of categoryJobSpecs) {
    const allPrices = [...spec.prices, ...(spec.deliberateOutliers || [])];
    const catWorkers = workersData.filter((w) => w.cats.includes(spec.cat));
    const fallbackWorker = catWorkers[0] || workersData[0];

    for (let i = 0; i < allPrices.length; i++) {
      jobCounter++;
      const jobId = `job_${jobCounter}`;
      const price = allPrices[i];
      const customer = customers[i % customers.length];
      const worker = catWorkers[i % catWorkers.length] || fallbackWorker;

      // Random days ago between 5 and 75 days
      const daysAgo = 5 + (i * 4) % 70;
      const jobTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const acceptedTime = new Date(jobTime.getTime() + 10 * 60 * 1000);
      const startedTime = new Date(acceptedTime.getTime() + 30 * 60 * 1000);
      const completedTime = new Date(startedTime.getTime() + 60 * 60 * 1000);

      // Jitter coordinates slightly around customer neighborhood
      const latJitter = (Math.random() - 0.5) * 0.015;
      const lngJitter = (Math.random() - 0.5) * 0.015;
      const jobLat = customer.n.lat + latJitter;
      const jobLng = customer.n.lng + lngJitter;

      insertJob.run(
        jobId,
        customer.id,
        worker.id,
        spec.cat,
        `Regular ${spec.cat} service request completed in ${customer.n.name}`,
        jobLat,
        jobLng,
        price,
        price,
        jobTime.toISOString(),
        acceptedTime.toISOString(),
        startedTime.toISOString(),
        completedTime.toISOString()
      );

      // Seed rating
      const ratingVal = 4 + (i % 2 === 0 ? 1 : 0);
      insertRating.run(
        `rat_${jobCounter}`,
        jobId,
        ratingVal,
        comments[i % comments.length],
        completedTime.toISOString()
      );
    }
  }

  // Pre-generate baseline snapshots for all categories
  for (const cat of SERVICE_CATEGORIES) {
    recordPriceBandSnapshot(cat.id, NEIGHBORHOODS[0].lat, NEIGHBORHOODS[0].lng);
  }

  // Seed sample report for demonstration
  db.prepare(`
    INSERT INTO reports (id, job_id, reporter_id, worker_id, reason, details, status, created_at)
    VALUES ('rep_demo_1', 'job_101', 'cust_1', 'work_7', 'overcharged', 'Demanded ₹200 extra above the agreed quote upon arrival.', 'pending', ?)
  `).run(now.toISOString());

  // Seed sample safety incident for demonstration
  db.prepare(`
    INSERT INTO incidents (id, job_id, reported_by, lat, lng, status, details, created_at)
    VALUES ('inc_demo_1', 'job_101', 'cust_1', ?, ?, 'active', 'Customer requested assistance with non-responsive worker.', ?)
  `).run(NEIGHBORHOODS[0].lat, NEIGHBORHOODS[0].lng, now.toISOString());

  console.log(`[Seed] Seeded 8 customers, 1 admin, 12 workers, and ${jobCounter - 100} historical completed jobs.`);
}

import express from 'express';
import { apiRouter } from '../src/server/routes.js';
import { getDb } from '../src/server/db.js';
import { seedData } from '../src/server/seed.js';

const app = express();
app.use(express.json());

// Auto-seed database if empty
try {
  const db = getDb();
  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any)?.count || 0;
  if (userCount === 0) {
    console.log('[Vercel Serverless] Initializing FairFix seed data...');
    seedData();
  }
} catch (err) {
  console.warn('[Vercel Serverless] Database init warning:', err);
}

// Mount router under /api as well as direct paths
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;

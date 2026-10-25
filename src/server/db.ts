/**
 * FairFix Database Layer
 * Uses Node 22 native SQLite (DatabaseSync) stored at fairfix.sqlite
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_FILE = path.resolve(process.cwd(), 'fairfix.sqlite');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('customer', 'worker', 'admin')) NOT NULL,
      phone TEXT,
      email TEXT,
      password_hash TEXT,
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      profile_picture_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workers (
      user_id TEXT PRIMARY KEY,
      categories TEXT NOT NULL, -- JSON array of strings
      base_rate INTEGER NOT NULL,
      rate_unit TEXT CHECK(rate_unit IN ('per_job', 'per_hour')) DEFAULT 'per_job',
      radius_km REAL NOT NULL DEFAULT 5.0,
      available INTEGER NOT NULL DEFAULT 1, -- 0 or 1
      verification_status TEXT CHECK(verification_status IN ('unverified', 'pending', 'verified', 'rejected')) DEFAULT 'unverified',
      verification_doc_path TEXT,
      verification_reject_reason TEXT,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0.0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      jobs_completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      worker_id TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      offered_price INTEGER NOT NULL,
      agreed_price INTEGER,
      status TEXT CHECK(status IN ('requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'rated', 'cancelled', 'disputed')) NOT NULL DEFAULT 'requested',
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      is_seed INTEGER NOT NULL DEFAULT 0,
      share_token TEXT UNIQUE,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (worker_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      from_role TEXT CHECK(from_role IN ('customer', 'worker')) NOT NULL,
      amount INTEGER NOT NULL,
      round INTEGER NOT NULL,
      status TEXT CHECK(status IN ('pending', 'accepted', 'declined', 'countered')) NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      job_id TEXT UNIQUE NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT CHECK(status IN ('pending', 'cleared', 'actioned')) NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      status TEXT CHECK(status IN ('active', 'resolved')) NOT NULL DEFAULT 'active',
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tracking_points (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL NOT NULL,
      speed REAL NOT NULL,
      ts TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_band_snapshots (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      area_key TEXT NOT NULL,
      low INTEGER NOT NULL,
      typical INTEGER NOT NULL,
      high INTEGER NOT NULL,
      job_count INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      computed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT,
      preferred_time TEXT,
      urgency TEXT DEFAULT 'normal',
      status TEXT CHECK(status IN ('open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_request_images (
      id TEXT PRIMARY KEY,
      service_request_id TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    );
  `);

  // Migration fallbacks for existing tables
  const addCol = (table: string, colDef: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    } catch {}
  };
  addCol('workers', 'verification_reject_reason TEXT');
  addCol('workers', 'is_flagged INTEGER NOT NULL DEFAULT 0');
  addCol('workers', 'is_suspended INTEGER NOT NULL DEFAULT 0');
  addCol('jobs', 'share_token TEXT');
  addCol('reports', 'worker_id TEXT');
  addCol('reports', 'details TEXT');
  addCol('users', 'email TEXT');
  addCol('users', 'password_hash TEXT');
  addCol('users', 'profile_picture_path TEXT');
  addCol('users', 'updated_at TEXT');
  addCol('users', 'is_active INTEGER NOT NULL DEFAULT 1');

  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id);`);
}

export function resetDatabase() {
  const db = getDb();
  try {
    db.exec(`
      DELETE FROM service_request_images;
      DELETE FROM service_requests;
      DELETE FROM sessions;
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
  } catch (err) {
    // If table doesn't exist yet, re-init schema
    initSchema(db);
  }
  return db;
}

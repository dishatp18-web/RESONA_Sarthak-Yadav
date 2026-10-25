/**
 * FairFix REST API Routes
 */
import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import { CONFIG, NEIGHBORHOODS, SERVICE_CATEGORIES } from '../config.js';
import { getDb, resetDatabase } from './db.js';
import { seedData } from './seed.js';
import { calculateFairPriceBand, comparePriceToBand, recordPriceBandSnapshot, getPriceBandAuditLog } from './band.js';
import { findMatchingWorkers } from './matching.js';

export const apiRouter = Router();

// Multer storage for worker verification documents (PDF, JPG, PNG <= 5MB)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const rand = Math.random().toString(36).substring(2, 8);
    cb(null, `doc_${Date.now()}_${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'));
    }
  },
});

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;
  const candidateHash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  if (candidateHash.length !== expectedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

function getRequestToken(req: any): string | null {
  const rawHeader = req.headers['x-session-token'] ?? req.headers.authorization ?? req.headers['Authorization'];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!value) return null;
  const headerValue = String(value).trim();
  return headerValue.startsWith('Bearer ') ? headerValue.slice(7).trim() : headerValue;
}

function createSessionToken(userId: string) {
  const token = randomBytes(24).toString('hex');
  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const hash = createHash('sha256').update(token).digest('hex');

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId, hash, now, expiresAt, now);

  return { token, expiresAt };
}

function getSessionUser(req: any): any | null {
  const token = getRequestToken(req);
  if (!token) {
    const demoUserId = (req.headers['x-demo-user-id'] || req.query?.userId || req.body?.user_id) as string | undefined;
    if (!demoUserId) return null;
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(demoUserId) as any;
    return user || null;
  }

  const hash = createHash('sha256').update(token).digest('hex');
  const db = getDb();
  const row = db.prepare(`
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hash, new Date().toISOString()) as any;

  if (!row) return null;
  db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`).run(new Date().toISOString(), hash);
  return row;
}

function sanitizeUser(row: any): any {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return {
    ...safe,
    email: row.email ?? null,
    profile_picture_path: row.profile_picture_path ?? null,
    is_active: Boolean(row.is_active ?? true),
  };
}

function requireAuth(req: any, res: any, next: () => void): void {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  (req as any).user = user;
  next();
}

function requireRole(req: any, res: any, next: () => void, roles: string[]) {
  const user = getSessionUser(req) || (req as any).user;
  if (!user || !roles.includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role permissions.' });
  }
  next();
}

// Demo Reset Endpoint
apiRouter.post('/reset', (_req, res) => {
  resetDatabase();
  seedData();
  res.json({ success: true, message: 'Database reset and re-seeded with demo data' });
});

apiRouter.post('/auth/register', (req, res) => {
  const { name, email, password, phone, role, categories, lat, lng, base_rate, radius_km } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const safeRole = String(role || 'customer');
  if (!['customer', 'worker'].includes(safeRole)) {
    return res.status(403).json({ error: 'Only customer and worker roles can self-register.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as any;
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const cleanPhone = String(phone ?? '').trim() || '';
  const safeLat = Number(lat ?? 0);
  const safeLng = Number(lng ?? 0);

  db.prepare(`
    INSERT INTO users (id, name, role, phone, email, password_hash, lat, lng, profile_picture_path, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1)
  `).run(userId, String(name).trim(), safeRole, cleanPhone, normalizedEmail, hashPassword(String(password)), safeLat, safeLng, now, now);

  if (safeRole === 'worker') {
    const parsedCategories = Array.isArray(categories) ? categories : typeof categories === 'string' ? [categories] : [];
    db.prepare(`
      INSERT INTO workers (user_id, categories, base_rate, rate_unit, radius_km, available, verification_status, verification_doc_path, verification_reject_reason, is_flagged, is_suspended, rating_avg, rating_count, jobs_completed)
      VALUES (?, ?, ?, 'per_job', ?, 1, 'pending', NULL, NULL, 0, 0, 0, 0, 0)
    `).run(userId, JSON.stringify(parsedCategories), Number(base_rate ?? 0) || 0, Number(radius_km ?? 5) || 5);
  }

  const session = createSessionToken(userId);
  const user = sanitizeUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as any);

  return res.status(201).json({
    success: true,
    token: session.token,
    expires_at: session.expiresAt,
    user,
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).get(normalizedEmail) as any;
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (!verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const session = createSessionToken(user.id);
  db.prepare(`UPDATE users SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), user.id);

  return res.json({
    success: true,
    token: session.token,
    expires_at: session.expiresAt,
    user: sanitizeUser(user),
  });
});

apiRouter.post('/auth/logout', (req, res) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(200).json({ success: true, message: 'No active session to end.' });
  }

  const db = getDb();
  const hash = createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  return res.json({ user: sanitizeUser(user) });
});

apiRouter.get('/profile', (req, res) => {
  const user = getSessionUser(req) || (
    req.headers['x-demo-user-id'] ? getDb().prepare('SELECT * FROM users WHERE id = ?').get(String(req.headers['x-demo-user-id'])) : null
  );

  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  return res.json({ user: sanitizeUser(user) });
});

apiRouter.patch('/profile', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { name, phone, lat, lng, profile_picture_path } = req.body ?? {};
  const db = getDb();
  const nextName = typeof name === 'string' && name.trim() ? name.trim() : user.name;
  const nextPhone = typeof phone === 'string' ? phone.trim() : user.phone ?? '';
  const nextLat = typeof lat === 'number' ? lat : Number(user.lat ?? 0);
  const nextLng = typeof lng === 'number' ? lng : Number(user.lng ?? 0);
  const nextProfilePicture = typeof profile_picture_path === 'string' ? profile_picture_path : user.profile_picture_path ?? null;

  db.prepare(`
    UPDATE users
    SET name = ?, phone = ?, lat = ?, lng = ?, profile_picture_path = ?, updated_at = ?
    WHERE id = ?
  `).run(nextName, nextPhone, nextLat, nextLng, nextProfilePicture, new Date().toISOString(), user.id);

  const updated = sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any);
  return res.json({ success: true, user: updated });
});

apiRouter.post('/profile/avatar', upload.single('avatar'), (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'An image upload is required.' });
  }

  const db = getDb();
  const relativePath = `/uploads/${req.file.filename}`;
  db.prepare(`UPDATE users SET profile_picture_path = ?, updated_at = ? WHERE id = ?`).run(relativePath, new Date().toISOString(), user.id);

  const updated = sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any);
  return res.json({ success: true, user: updated, profile_picture_path: relativePath });
});

apiRouter.post('/service-requests', (req, res) => {
  const { customer_id, category, title, description, lat, lng, address, preferred_time, urgency } = req.body ?? {};

  if (!customer_id || !category || !title || !description) {
    return res.status(400).json({ error: 'customer_id, category, title, and description are required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(customer_id) as any;
  if (!user || user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers can create service requests.' });
  }

  const requestId = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO service_requests (id, customer_id, category, title, description, lat, lng, address, preferred_time, urgency, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(requestId, customer_id, String(category), String(title), String(description), Number(lat ?? 0), Number(lng ?? 0), address ?? null, preferred_time ?? null, urgency ?? 'normal', now, now);

  return res.status(201).json({ success: true, request: { id: requestId, customer_id, category, title, description, lat: Number(lat ?? 0), lng: Number(lng ?? 0), address: address ?? null, preferred_time: preferred_time ?? null, urgency: urgency ?? 'normal', status: 'open', created_at: now } });
});

apiRouter.get('/service-requests', (req, res) => {
  const { customer_id } = req.query;
  const db = getDb();
  const query = customer_id
    ? 'SELECT * FROM service_requests WHERE customer_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM service_requests ORDER BY created_at DESC';
  const params = customer_id ? [String(customer_id)] : [];
  const rows = db.prepare(query).all(...params) as any[];
  return res.json(rows);
});

apiRouter.get('/service-requests/:id', (req, res) => {
  const db = getDb();
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id) as any;
  if (!request) {
    return res.status(404).json({ error: 'Service request not found.' });
  }

  const images = db.prepare('SELECT * FROM service_request_images WHERE service_request_id = ? ORDER BY created_at DESC').all(request.id) as any[];
  return res.json({ ...request, images });
});

apiRouter.post('/service-requests/:id/images', upload.single('image'), (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'An image upload is required.' });
  }

  const db = getDb();
  const request = db.prepare('SELECT id FROM service_requests WHERE id = ?').get(id) as any;
  if (!request) {
    return res.status(404).json({ error: 'Service request not found.' });
  }

  const now = new Date().toISOString();
  const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const relativePath = `/uploads/${req.file.filename}`;
  db.prepare(`
    INSERT INTO service_request_images (id, service_request_id, path, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(imageId, id, relativePath, req.file.mimetype || 'image/jpeg', now);

  return res.status(201).json({ success: true, image: { id: imageId, path: relativePath, mime_type: req.file.mimetype || 'image/jpeg', created_at: now } });
});

// 1. Config endpoint
apiRouter.get('/config', (_req, res) => {
  res.json({
    cityCenter: CONFIG.CITY_CENTER,
    neighborhoods: NEIGHBORHOODS,
    categories: SERVICE_CATEGORIES,
    constants: {
      defaultSearchRadiusKm: CONFIG.DEFAULT_SEARCH_RADIUS_KM,
      minJobsForConfidence: CONFIG.MIN_JOBS_FOR_CONFIDENCE,
      bandMaxWeeklyMove: CONFIG.BAND_MAX_WEEKLY_MOVE,
      avgTravelSpeedKmh: CONFIG.AVG_TRAVEL_SPEED_KMH,
      maxNegotiationRounds: CONFIG.MAX_NEGOTIATION_ROUNDS,
    },
  });
});

// 2. Users endpoint for Demo Mode switcher
apiRouter.get('/users', (_req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.name, u.role, u.phone, u.lat, u.lng, u.created_at,
           w.categories, w.base_rate, w.rate_unit, w.radius_km, w.available,
           w.verification_status, w.verification_doc_path, w.verification_reject_reason,
           w.is_flagged, w.is_suspended, w.rating_avg, w.rating_count, w.jobs_completed
    FROM users u
    LEFT JOIN workers w ON u.id = w.user_id
    ORDER BY u.role, u.name
  `).all() as any[];

  const parsed = users.map((u) => {
    let cats = [];
    if (u.categories) {
      try {
        cats = JSON.parse(u.categories);
      } catch {
        cats = [u.categories];
      }
    }
    return {
      ...u,
      available: u.available !== null ? Boolean(u.available) : undefined,
      is_flagged: Boolean(u.is_flagged),
      is_suspended: Boolean(u.is_suspended),
      categories: cats,
    };
  });

  res.json(parsed);
});

// 3. Single User Profile
apiRouter.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.role, u.phone, u.lat, u.lng, u.created_at,
           w.categories, w.base_rate, w.rate_unit, w.radius_km, w.available,
           w.verification_status, w.verification_doc_path, w.verification_reject_reason,
           w.is_flagged, w.is_suspended, w.rating_avg, w.rating_count, w.jobs_completed
    FROM users u
    LEFT JOIN workers w ON u.id = w.user_id
    WHERE u.id = ?
  `).get(req.params.id) as any;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let cats = [];
  if (user.categories) {
    try {
      cats = JSON.parse(user.categories);
    } catch {
      cats = [user.categories];
    }
  }

  res.json({
    ...user,
    available: user.available !== null ? Boolean(user.available) : undefined,
    categories: cats,
  });
});

// 4. Worker Availability Toggle
apiRouter.patch('/workers/:id/availability', (req, res) => {
  const { id } = req.params;
  const { available } = req.body;

  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'available must be a boolean' });
  }

  const db = getDb();
  const result = db.prepare(`
    UPDATE workers
    SET available = ?
    WHERE user_id = ?
  `).run(available ? 1 : 0, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json({ success: true, available });
});

// 5. Worker Rate Setup with band comparison
apiRouter.patch('/workers/:id/rate', (req, res) => {
  const { id } = req.params;
  const { base_rate } = req.body;

  if (!base_rate || isNaN(Number(base_rate)) || Number(base_rate) <= 0) {
    return res.status(400).json({ error: 'Invalid base rate' });
  }

  const db = getDb();
  const worker = db.prepare(`
    SELECT u.lat, u.lng, w.categories
    FROM workers w
    JOIN users u ON w.user_id = u.id
    WHERE w.user_id = ?
  `).get(id) as any;

  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  db.prepare(`UPDATE workers SET base_rate = ? WHERE user_id = ?`).run(Number(base_rate), id);

  // Compute comparison with primary category band
  let primaryCat = 'plumbing';
  try {
    const parsed = JSON.parse(worker.categories);
    if (parsed[0]) primaryCat = parsed[0];
  } catch {}

  const band = calculateFairPriceBand(primaryCat, worker.lat, worker.lng);
  const comparison = comparePriceToBand(Number(base_rate), band, 'worker');

  res.json({
    success: true,
    base_rate: Number(base_rate),
    band,
    comparison,
  });
});

// 5b. Worker Document Upload (Multipart)
apiRouter.post('/workers/:id/verification-document', upload.single('document'), (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const worker = db.prepare('SELECT user_id FROM workers WHERE user_id = ?').get(id);
  if (!worker) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Worker not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No document uploaded. Allowed formats: JPG, PNG, PDF (max 5 MB).' });
  }

  const relativePath = `/uploads/${req.file.filename}`;
  db.prepare(`
    UPDATE workers
    SET verification_status = 'pending',
        verification_doc_path = ?,
        verification_reject_reason = NULL
    WHERE user_id = ?
  `).run(relativePath, id);

  res.json({
    success: true,
    status: 'pending',
    doc_path: relativePath,
    message: 'Document uploaded successfully. Status transitioned to pending review.',
  });
});

// 5c. Worker Document Upload (Base64 JSON fallback)
apiRouter.post('/workers/:id/verification-document-base64', (req, res) => {
  const { id } = req.params;
  const { filename, fileBase64, mimeType } = req.body;

  if (!filename || !fileBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing document payload (filename, fileBase64, mimeType required).' });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid document type. Allowed formats: JPG, PNG, PDF.' });
  }

  const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds maximum allowed limit of 5 MB.' });
  }

  const db = getDb();
  const worker = db.prepare('SELECT user_id FROM workers WHERE user_id = ?').get(id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  const ext = path.extname(filename).toLowerCase() || (mimeType === 'application/pdf' ? '.pdf' : '.png');
  const storedFilename = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
  const filePath = path.join(uploadsDir, storedFilename);

  fs.writeFileSync(filePath, buffer);
  const relativePath = `/uploads/${storedFilename}`;

  db.prepare(`
    UPDATE workers
    SET verification_status = 'pending',
        verification_doc_path = ?,
        verification_reject_reason = NULL
    WHERE user_id = ?
  `).run(relativePath, id);

  res.json({
    success: true,
    status: 'pending',
    doc_path: relativePath,
    message: 'Document uploaded successfully. Status transitioned to pending review.',
  });
});

// 5d. Worker Verification Status Update (Admin Approve / Reject)
apiRouter.patch('/workers/:id/verification', (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['verified', 'pending', 'rejected', 'unverified'].includes(status)) {
    return res.status(400).json({ error: 'Invalid verification status' });
  }

  if (status === 'rejected' && (!reason || !reason.trim())) {
    return res.status(400).json({ error: 'Rejection reason is required when rejecting verification.' });
  }

  const db = getDb();
  const result = db.prepare(`
    UPDATE workers
    SET verification_status = ?,
        verification_reject_reason = ?
    WHERE user_id = ?
  `).run(status, status === 'rejected' ? reason.trim() : null, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json({
    success: true,
    status,
    reason: status === 'rejected' ? reason.trim() : null,
    message: `Worker verification status updated to ${status}.`,
  });
});

// 6. Live Fair-Price Band Endpoint
apiRouter.get('/price-band', (req, res) => {
  const category = (req.query.category as string) || 'plumbing';
  const lat = req.query.lat ? Number(req.query.lat) : CONFIG.CITY_CENTER.lat;
  const lng = req.query.lng ? Number(req.query.lng) : CONFIG.CITY_CENTER.lng;
  const price = req.query.price ? Number(req.query.price) : undefined;
  const perspective = (req.query.perspective as 'customer' | 'worker') || 'customer';

  const band = calculateFairPriceBand(category, lat, lng);
  let comparison = null;

  if (price !== undefined && !isNaN(price)) {
    comparison = comparePriceToBand(price, band, perspective);
  }

  res.json({ band, comparison });
});

// 7. Matching Workers Endpoint
apiRouter.get('/matching', (req, res) => {
  const category = (req.query.category as string) || 'plumbing';
  const lat = req.query.lat ? Number(req.query.lat) : CONFIG.CITY_CENTER.lat;
  const lng = req.query.lng ? Number(req.query.lng) : CONFIG.CITY_CENTER.lng;

  const workers = findMatchingWorkers(category, lat, lng, false);
  res.json(workers);
});

// 8. Create Job Request (Customer)
apiRouter.post('/jobs', (req, res) => {
  const { customer_id, category, description, lat, lng, offered_price, worker_id } = req.body;

  if (!customer_id || !category || !description || !lat || !lng || !offered_price) {
    return res.status(400).json({ error: 'Missing required job request fields' });
  }

  const db = getDb();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, status, created_at, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, 0)
  `).run(id, customer_id, worker_id || null, category, description, Number(lat), Number(lng), Number(offered_price), now);

  // Initial customer offer recorded (Round 1)
  const offerId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES (?, ?, 'customer', ?, 1, 'pending', ?)
  `).run(offerId, id, Number(offered_price), now);

  const newJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  res.status(201).json(newJob);
});

// 9. List Jobs (with role-aware phone masking and incoming radar support)
apiRouter.get('/jobs', (req, res) => {
  const { customerId, workerId, status, incoming } = req.query;
  const db = getDb();

  let query = `
    SELECT j.*, 
           c.name as customer_name, c.phone as customer_phone, c.lat as customer_lat, c.lng as customer_lng,
           w_u.name as worker_name, w_u.phone as worker_phone,
           w.verification_status as worker_verification_status,
           w.base_rate as worker_base_rate
    FROM jobs j
    JOIN users c ON j.customer_id = c.id
    LEFT JOIN users w_u ON j.worker_id = w_u.id
    LEFT JOIN workers w ON j.worker_id = w.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customerId) {
    query += ` AND j.customer_id = ?`;
    params.push(String(customerId));
  } else if (workerId && incoming === 'true') {
    // Incoming requests for worker: either assigned specifically to worker OR broadcast request matching worker trade & radius
    const worker = db.prepare(`
      SELECT u.lat, u.lng, w.categories, w.radius_km
      FROM workers w JOIN users u ON w.user_id = u.id
      WHERE w.user_id = ?
    `).get(String(workerId)) as any;

    if (worker) {
      let workerCats: string[] = [];
      try {
        workerCats = JSON.parse(worker.categories);
      } catch {
        workerCats = [worker.categories];
      }

      query += ` AND (j.worker_id = ? OR (j.worker_id IS NULL AND j.status IN ('requested', 'negotiating')))`;
      params.push(String(workerId));
    } else {
      query += ` AND j.worker_id = ?`;
      params.push(String(workerId));
    }
  } else if (workerId) {
    query += ` AND j.worker_id = ?`;
    params.push(String(workerId));
  }

  if (status) {
    query += ` AND j.status = ?`;
    params.push(String(status));
  }

  query += ` ORDER BY j.created_at DESC`;

  const rows = db.prepare(query).all(...params) as any[];

  // Attach latest offer & enforce privacy masking
  const unmaskedStatuses = ['accepted', 'in_progress', 'completed', 'rated'];

  const results = rows.map((job) => {
    const latestOffer = db.prepare(`
      SELECT * FROM offers
      WHERE job_id = ?
      ORDER BY round DESC, created_at DESC
      LIMIT 1
    `).get(job.id) as any;

    const offers = db.prepare(`
      SELECT * FROM offers
      WHERE job_id = ?
      ORDER BY round ASC, created_at ASC
    `).all(job.id) as any[];

    const isAccepted = unmaskedStatuses.includes(job.status);

    return {
      ...job,
      customer_phone: isAccepted ? job.customer_phone : '+91 ••••• •••••',
      worker_phone: job.worker_phone ? (isAccepted ? job.worker_phone : '+91 ••••• •••••') : null,
      latest_offer: latestOffer || null,
      offers: offers || [],
      offers_count: offers.length,
    };
  });

  res.json(results);
});

// 10. Single Job Details with All Offers
apiRouter.get('/jobs/:id', (req, res) => {
  const db = getDb();
  const job = db.prepare(`
    SELECT j.*, 
           c.name as customer_name, c.phone as customer_phone,
           w_u.name as worker_name, w_u.phone as worker_phone,
           w.verification_status as worker_verification_status,
           w.base_rate as worker_base_rate
    FROM jobs j
    JOIN users c ON j.customer_id = c.id
    LEFT JOIN users w_u ON j.worker_id = w_u.id
    LEFT JOIN workers w ON j.worker_id = w.user_id
    WHERE j.id = ?
  `).get(req.params.id) as any;

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const offers = db.prepare(`
    SELECT * FROM offers
    WHERE job_id = ?
    ORDER BY round ASC, created_at ASC
  `).all(job.id) as any[];

  const unmaskedStatuses = ['accepted', 'in_progress', 'completed', 'rated'];
  const isAccepted = unmaskedStatuses.includes(job.status);

  res.json({
    ...job,
    customer_phone: isAccepted ? job.customer_phone : '+91 ••••• •••••',
    worker_phone: job.worker_phone ? (isAccepted ? job.worker_phone : '+91 ••••• •••••') : null,
    offers,
    latest_offer: offers[offers.length - 1] || null,
  });
});

// 11. Negotiation: Counter-Offer Endpoint (Server-enforced turns and rounds)
apiRouter.post('/jobs/:id/offer', (req, res) => {
  const { id } = req.params;
  const { user_id, amount } = req.body;

  if (!user_id || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid user ID and offer amount are required.' });
  }

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  // State check: Only 'requested' or 'negotiating' can accept new offers
  if (job.status !== 'requested' && job.status !== 'negotiating') {
    return res.status(400).json({
      error: `Cannot negotiate on a job that is already ${job.status}.`,
    });
  }

  // Get user role
  const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(user_id) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const latestOffer = db.prepare(`
    SELECT * FROM offers
    WHERE job_id = ?
    ORDER BY round DESC, created_at DESC
    LIMIT 1
  `).get(id) as any;

  if (!latestOffer) {
    return res.status(400).json({ error: 'No initial offer found for this job.' });
  }

  // Turn enforcement
  if (latestOffer.from_role === user.role) {
    return res.status(400).json({
      error: `It is not your turn. Waiting for the ${user.role === 'customer' ? 'worker' : 'customer'} to respond.`,
    });
  }

  // If worker is responding to a broadcast job with no worker_id assigned, bind worker_id
  if (user.role === 'worker' && !job.worker_id) {
    db.prepare(`UPDATE jobs SET worker_id = ? WHERE id = ?`).run(user_id, id);
  }

  // Calculate new round
  let nextRound = latestOffer.round;
  if (latestOffer.from_role === 'worker' && user.role === 'customer') {
    nextRound = latestOffer.round + 1;
  }

  // Expiration check: MAX_NEGOTIATION_ROUNDS = 3
  if (nextRound > CONFIG.MAX_NEGOTIATION_ROUNDS) {
    db.prepare(`UPDATE offers SET status = 'declined' WHERE id = ?`).run(latestOffer.id);
    db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`).run(id);

    return res.status(400).json({
      error: `Negotiation limit reached (${CONFIG.MAX_NEGOTIATION_ROUNDS} rounds). Request has expired.`,
      expired: true,
    });
  }

  const now = new Date().toISOString();

  // Mark previous offer as 'countered'
  db.prepare(`UPDATE offers SET status = 'countered' WHERE id = ?`).run(latestOffer.id);

  // Insert new offer
  const newOfferId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(newOfferId, id, user.role, Number(amount), nextRound, now);

  // Transition job status to 'negotiating'
  db.prepare(`UPDATE jobs SET status = 'negotiating' WHERE id = ?`).run(id);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  const updatedOffers = db.prepare(`SELECT * FROM offers WHERE job_id = ? ORDER BY round ASC, created_at ASC`).all(id);

  res.json({
    success: true,
    job: updatedJob,
    offers: updatedOffers,
    round: nextRound,
  });
});

// 12. Negotiation: Accept Offer Endpoint
apiRouter.post('/jobs/:id/accept', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required to accept.' });
  }

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'requested' && job.status !== 'negotiating') {
    return res.status(400).json({ error: `Cannot accept a job in '${job.status}' status.` });
  }

  const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(user_id) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const latestOffer = db.prepare(`
    SELECT * FROM offers
    WHERE job_id = ?
    ORDER BY round DESC, created_at DESC
    LIMIT 1
  `).get(id) as any;

  if (!latestOffer) {
    return res.status(400).json({ error: 'No offer found to accept.' });
  }

  // Turn check: You cannot accept your own offer!
  if (latestOffer.from_role === user.role) {
    return res.status(400).json({ error: 'You cannot accept your own offer. Waiting for counterparty.' });
  }

  const now = new Date().toISOString();
  const workerIdToAssign = job.worker_id || (user.role === 'worker' ? user_id : null);

  // Mark offer accepted
  db.prepare(`UPDATE offers SET status = 'accepted' WHERE id = ?`).run(latestOffer.id);

  // Transition job to 'accepted' with agreed price and accepted_at
  db.prepare(`
    UPDATE jobs
    SET status = 'accepted',
        agreed_price = ?,
        accepted_at = ?,
        worker_id = ?
    WHERE id = ?
  `).run(latestOffer.amount, now, workerIdToAssign, id);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  const updatedOffers = db.prepare(`SELECT * FROM offers WHERE job_id = ? ORDER BY round ASC, created_at ASC`).all(id);

  res.json({
    success: true,
    job: updatedJob,
    offers: updatedOffers,
    agreed_price: latestOffer.amount,
  });
});

// 13. Negotiation: Decline Offer Endpoint
apiRouter.post('/jobs/:id/decline', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'requested' && job.status !== 'negotiating') {
    return res.status(400).json({ error: `Cannot decline a job in '${job.status}' status.` });
  }

  const latestOffer = db.prepare(`
    SELECT * FROM offers
    WHERE job_id = ?
    ORDER BY round DESC, created_at DESC
    LIMIT 1
  `).get(id) as any;

  if (latestOffer) {
    db.prepare(`UPDATE offers SET status = 'declined' WHERE id = ?`).run(latestOffer.id);
  }

  db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`).run(id);

  res.json({ success: true, message: 'Request was declined and closed.' });
});

// 14. Job State Machine: Start Job (Worker only)
apiRouter.post('/jobs/:id/start', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'accepted') {
    return res.status(400).json({ error: `Cannot start a job in '${job.status}' status. Job must be 'accepted'.` });
  }

  if (job.worker_id && user_id && job.worker_id !== user_id) {
    return res.status(403).json({ error: 'Only the assigned worker can start this job.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = 'in_progress',
        started_at = ?
    WHERE id = ?
  `).run(now, id);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  res.json({ success: true, job: updatedJob });
});

// 15. Job State Machine: Complete Job (Worker only)
apiRouter.post('/jobs/:id/complete', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'in_progress') {
    return res.status(400).json({ error: `Cannot complete a job in '${job.status}' status. Job must be 'in_progress'.` });
  }

  if (job.worker_id && user_id && job.worker_id !== user_id) {
    return res.status(403).json({ error: 'Only the assigned worker can complete this job.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = 'completed',
        completed_at = ?
    WHERE id = ?
  `).run(now, id);

  // Increment worker jobs_completed count
  if (job.worker_id) {
    db.prepare(`
      UPDATE workers
      SET jobs_completed = jobs_completed + 1
      WHERE user_id = ?
    `).run(job.worker_id);
  }

  // Delete all tracking points on completion for privacy
  db.prepare('DELETE FROM tracking_points WHERE job_id = ?').run(id);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  res.json({ success: true, job: updatedJob });
});

// 16. Job State Machine: Cancel Job (Customer or Worker)
apiRouter.post('/jobs/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { user_id, reason } = req.body;

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (['completed', 'rated', 'cancelled', 'disputed'].includes(job.status)) {
    return res.status(400).json({ error: `Cannot cancel a job in terminal '${job.status}' status.` });
  }

  db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`).run(id);

  // Delete all tracking points on cancellation for privacy
  db.prepare('DELETE FROM tracking_points WHERE job_id = ?').run(id);

  if (reason && user_id) {
    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO reports (id, job_id, reporter_id, reason, status, created_at)
      VALUES (?, ?, ?, ?, 'dismissed', ?)
    `).run(reportId, id, user_id, `Cancellation: ${reason}`, now);
  }

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  res.json({ success: true, job: updatedJob });
});

// 17. Job State Machine: Dispute / Report Job (Customer only)
apiRouter.post('/jobs/:id/dispute', (req, res) => {
  const { id } = req.params;
  const { user_id, reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'A valid dispute reason must be provided.' });
  }

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (!['accepted', 'in_progress'].includes(job.status)) {
    return res.status(400).json({ error: `Cannot dispute a job in '${job.status}' status.` });
  }

  if (job.customer_id !== user_id) {
    return res.status(403).json({ error: 'Only the customer can raise a dispute for this job.' });
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE jobs SET status = 'disputed' WHERE id = ?`).run(id);

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO reports (id, job_id, reporter_id, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(reportId, id, user_id, reason.trim(), now);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  res.json({ success: true, job: updatedJob, report_id: reportId });
});

// 18. Ratings & Live Band Recompute (Customer only)
apiRouter.post('/jobs/:id/rate', (req, res) => {
  const { id } = req.params;
  const { user_id, rating, comment } = req.body;

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars.' });
  }

  const db = getDb();
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: `Cannot rate a job in '${job.status}' status. Job must be 'completed'.` });
  }

  if (job.customer_id !== user_id) {
    return res.status(403).json({ error: 'Only the job customer can submit a rating.' });
  }

  const now = new Date().toISOString();
  const ratingId = `rat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Insert rating
  db.prepare(`
    INSERT INTO ratings (id, job_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(ratingId, id, numRating, comment ? comment.trim() : null, now);

  // Transition job status to 'rated'
  db.prepare(`UPDATE jobs SET status = 'rated' WHERE id = ?`).run(id);

  // Update worker's rating_avg and rating_count
  if (job.worker_id) {
    const worker = db.prepare(`SELECT rating_avg, rating_count FROM workers WHERE user_id = ?`).get(job.worker_id) as any;
    if (worker) {
      const currentAvg = Number(worker.rating_avg) || 0;
      const currentCount = Number(worker.rating_count) || 0;
      const newCount = currentCount + 1;
      const newAvg = Number(((currentAvg * currentCount + numRating) / newCount).toFixed(1));

      db.prepare(`
        UPDATE workers
        SET rating_avg = ?, rating_count = ?
        WHERE user_id = ?
      `).run(newAvg, newCount, job.worker_id);
    }
  }

  // Trigger live fair-price band recompute and store snapshot
  const newBand = recordPriceBandSnapshot(job.category, job.lat, job.lng);

  const updatedJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);

  res.json({
    success: true,
    job: updatedJob,
    rating: {
      id: ratingId,
      rating: numRating,
      comment: comment ? comment.trim() : null,
      created_at: now,
    },
    band_updated: true,
    new_band: newBand,
  });
});

// 19. Get Rating for Job
apiRouter.get('/jobs/:id/rating', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const rating = db.prepare(`SELECT * FROM ratings WHERE job_id = ?`).get(id);
  res.json(rating || null);
});

// 20. Demo Hook: Reset Database
apiRouter.post('/demo/reset', (_req, res) => {
  resetDatabase();
  seedData();
  res.json({ success: true, message: 'Database reset and re-seeded with pristine demo data.' });
});

// 21. Demo Hook: Simulate Worker Counter-Offer
apiRouter.post('/demo/simulate-counter', (req, res) => {
  const db = getDb();
  const job = db.prepare(`
    SELECT * FROM jobs
    WHERE status IN ('requested', 'negotiating')
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as any;

  if (!job) {
    return res.status(404).json({ error: 'No active job found to simulate counter-offer on.' });
  }

  const latestOffer = db.prepare(`
    SELECT * FROM offers
    WHERE job_id = ?
    ORDER BY round DESC, created_at DESC
    LIMIT 1
  `).get(job.id) as any;

  const currentRound = latestOffer ? latestOffer.round : 1;
  const fromRole = latestOffer?.from_role === 'customer' ? 'worker' : 'customer';
  const nextRound = fromRole === 'customer' ? currentRound + 1 : currentRound;

  if (nextRound > CONFIG.MAX_NEGOTIATION_ROUNDS) {
    return res.status(400).json({ error: 'Maximum rounds reached.' });
  }

  const baseAmt = latestOffer ? latestOffer.amount : job.offered_price;
  const counterAmount = fromRole === 'worker' ? Math.round(baseAmt * 1.15) : Math.round(baseAmt * 0.92);

  const now = new Date().toISOString();
  const offerId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  if (latestOffer) {
    db.prepare(`UPDATE offers SET status = 'countered' WHERE id = ?`).run(latestOffer.id);
  }

  db.prepare(`
    INSERT INTO offers (id, job_id, from_role, amount, round, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(offerId, job.id, fromRole, counterAmount, nextRound, now);

  db.prepare(`UPDATE jobs SET status = 'negotiating' WHERE id = ?`).run(job.id);

  res.json({
    success: true,
    job_id: job.id,
    from_role: fromRole,
    amount: counterAmount,
    round: nextRound,
  });
});

// 22. Demo Hook: Fast-Forward Job Flow
apiRouter.post('/demo/simulate-fast-forward', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const jobId = `job_ff_${Date.now()}`;
  const agreedPrice = 550;

  const customer = db.prepare(`SELECT id, lat, lng FROM users WHERE role = 'customer' LIMIT 1`).get() as any;
  const worker = db.prepare(`SELECT user_id FROM workers LIMIT 1`).get() as any;

  if (!customer || !worker) {
    return res.status(400).json({ error: 'Demo users not initialized.' });
  }

  db.prepare(`
    INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, agreed_price, status, created_at, accepted_at, started_at, completed_at, is_seed)
    VALUES (?, ?, ?, 'plumbing', 'Emergency drain clearance fast-forwarded demo flow', ?, ?, 500, ?, 'rated', ?, ?, ?, ?, 0)
  `).run(
    jobId,
    customer.id,
    worker.user_id,
    customer.lat,
    customer.lng,
    agreedPrice,
    now,
    now,
    now,
    now
  );

  const ratingId = `rat_ff_${Date.now()}`;
  db.prepare(`
    INSERT INTO ratings (id, job_id, rating, comment, created_at)
    VALUES (?, ?, 5, 'Flawless fast-forward simulation completed.', ?)
  `).run(ratingId, jobId, now);

  db.prepare(`UPDATE workers SET jobs_completed = jobs_completed + 1 WHERE user_id = ?`).run(worker.user_id);

  const newBand = recordPriceBandSnapshot('plumbing', customer.lat, customer.lng);

  res.json({
    success: true,
    job_id: jobId,
    agreed_price: agreedPrice,
    band_updated: true,
    new_band: newBand,
    message: 'Fast-forward simulation completed: job created, agreed, started, completed, and rated 5 stars!',
  });
});

// 23. Demo Hook: Trigger Outlier Job
apiRouter.post('/demo/trigger-outlier', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const outlierPrice = 3500;
  const jobId = `job_outlier_${Date.now()}`;

  const customer = db.prepare(`SELECT id, lat, lng FROM users WHERE role = 'customer' LIMIT 1`).get() as any;
  const worker = db.prepare(`SELECT user_id FROM workers LIMIT 1`).get() as any;

  db.prepare(`
    INSERT INTO jobs (id, customer_id, worker_id, category, description, lat, lng, offered_price, agreed_price, status, created_at, accepted_at, started_at, completed_at, is_seed)
    VALUES (?, ?, ?, 'plumbing', 'Deliberate ₹3,500 Outlier Test to demonstrate IQR rejection', ?, ?, 3500, ?, 'completed', ?, ?, ?, ?, 0)
  `).run(
    jobId,
    customer.id,
    worker.user_id,
    customer.lat,
    customer.lng,
    outlierPrice,
    now,
    now,
    now,
    now
  );

  const band = calculateFairPriceBand('plumbing', customer.lat, customer.lng);

  res.json({
    success: true,
    job_id: jobId,
    outlier_price: outlierPrice,
    outliers_removed: band.outliersRemoved,
    band_low: band.low,
    band_typical: band.typical,
    band_high: band.high,
    explanation: band.explanation,
    message: `Deliberate outlier job at ₹3,500 injected. IQR filter rejected it (outliers removed: ${band.outliersRemoved}). Band remains protected!`,
  });
});

// ==========================================
// STEP B: REPORTS, SAFETY, AND ADMIN ROUTES
// ==========================================

// 24. Submit Job Report (with 3-distinct-customers auto-flagging threshold)
apiRouter.post('/reports', (req, res) => {
  const { job_id, reporter_id, reason, details } = req.body;

  const validReasons = ['no-show', 'overcharged', 'unsafe behaviour', 'poor work', 'other'];
  if (!job_id || !reporter_id || !reason) {
    return res.status(400).json({ error: 'job_id, reporter_id, and reason are required.' });
  }

  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` });
  }

  const db = getDb();
  const job = db.prepare('SELECT id, customer_id, worker_id FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  const workerId = job.worker_id;
  if (!workerId) {
    return res.status(400).json({ error: 'Cannot report a job without an assigned worker.' });
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reports (id, job_id, reporter_id, worker_id, reason, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(reportId, job_id, reporter_id, workerId, reason, details ? details.trim() : null, now);

  // Auto-flag threshold: 3 reports from 3 DISTINCT customers who each had a job with this worker
  const countRow = db.prepare(`
    SELECT COUNT(DISTINCT r.reporter_id) as distinct_reporters
    FROM reports r
    WHERE r.worker_id = ?
  `).get(workerId) as any;

  const distinctReporters = countRow?.distinct_reporters || 0;
  let isFlagged = false;

  if (distinctReporters >= 3) {
    db.prepare('UPDATE workers SET is_flagged = 1 WHERE user_id = ?').run(workerId);
    isFlagged = true;
  }

  res.status(201).json({
    success: true,
    report_id: reportId,
    worker_id: workerId,
    distinct_reporters: distinctReporters,
    is_flagged: isFlagged,
    message: isFlagged
      ? 'Report logged. Worker has received 3 distinct customer reports and is now auto-flagged under review.'
      : 'Report logged successfully for administrative review.',
  });
});

// 25. List All Reports (Admin)
apiRouter.get('/admin/reports', (_req, res) => {
  const db = getDb();
  const reports = db.prepare(`
    SELECT r.id, r.job_id, r.reporter_id, r.worker_id, r.reason, r.details, r.status, r.created_at,
           c.name as reporter_name, w.name as worker_name, j.category
    FROM reports r
    LEFT JOIN users c ON r.reporter_id = c.id
    LEFT JOIN users w ON r.worker_id = w.id
    LEFT JOIN jobs j ON r.job_id = j.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(reports);
});

// 26. Admin Flag Action: Clear or Suspend Worker
apiRouter.post('/admin/workers/:id/flag-action', (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['clear', 'suspend'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "clear" or "suspend".' });
  }

  const db = getDb();
  const worker = db.prepare('SELECT user_id FROM workers WHERE user_id = ?').get(id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found.' });
  }

  if (action === 'clear') {
    db.prepare('UPDATE workers SET is_flagged = 0 WHERE user_id = ?').run(id);
    return res.json({ success: true, action: 'cleared', message: 'Worker review flag cleared.' });
  }

  if (action === 'suspend') {
    db.prepare('UPDATE workers SET is_suspended = 1, available = 0 WHERE user_id = ?').run(id);
    return res.json({ success: true, action: 'suspended', message: 'Worker account suspended from marketplace.' });
  }
});

// 27. Safety Button: Create Incident Record
apiRouter.post('/safety/incident', (req, res) => {
  const { job_id, reported_by, lat, lng, details } = req.body;

  if (!job_id || !reported_by) {
    return res.status(400).json({ error: 'job_id and reported_by are required.' });
  }

  const db = getDb();
  const job = db.prepare('SELECT id, status, lat, lng FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const incidentLat = lat !== undefined ? Number(lat) : job.lat;
  const incidentLng = lng !== undefined ? Number(lng) : job.lng;

  db.prepare(`
    INSERT INTO incidents (id, job_id, reported_by, lat, lng, status, details, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(incidentId, job_id, reported_by, incidentLat, incidentLng, details ? details.trim() : 'Safety assistance alerted by user.', now);

  res.status(201).json({
    success: true,
    incident_id: incidentId,
    disclaimer: 'This does not contact emergency services. In an emergency dial 112.',
    message: 'Safety incident flagged at highest priority for platform operations.',
  });
});

// 28. List Safety Incidents (Admin)
apiRouter.get('/admin/incidents', (_req, res) => {
  const db = getDb();
  const incidents = db.prepare(`
    SELECT i.id, i.job_id, i.reported_by, i.lat, i.lng, i.status, i.details, i.created_at,
           u.name as reporter_name, j.category, w.name as worker_name
    FROM incidents i
    LEFT JOIN users u ON i.reported_by = u.id
    LEFT JOIN jobs j ON i.job_id = j.id
    LEFT JOIN users w ON j.worker_id = w.id
    ORDER BY CASE WHEN i.status = 'active' THEN 0 ELSE 1 END, i.created_at DESC
  `).all();
  res.json(incidents);
});

// 29. Resolve Safety Incident (Admin)
apiRouter.patch('/admin/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare("UPDATE incidents SET status = 'resolved' WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Incident not found.' });
  }
  res.json({ success: true, message: 'Incident resolved.' });
});

// ==========================================
// STEP C: LIVE LOCATION TRACKING ROUTES
// ==========================================

// 29b. Broadcast Worker Live Location Fix (at most every 5 s)
apiRouter.post('/tracking/:jobId', (req, res) => {
  const { jobId } = req.params;
  const { lat, lng, accuracy, speed, timestamp, is_simulated } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat and lng coordinates are required.' });
  }

  const numLat = Number(lat);
  const numLng = Number(lng);
  const numAccuracy = accuracy !== undefined ? Number(accuracy) : 15;
  const numSpeed = speed !== undefined ? Number(speed) : 20;

  // Discard fixes with accuracy over 100 m unless simulated
  if (!is_simulated && numAccuracy > 100) {
    return res.status(200).json({
      discarded: true,
      reason: `Accuracy fix ±${Math.round(numAccuracy)}m exceeded 100m threshold; rejected to ensure precision.`,
    });
  }

  const db = getDb();
  const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(jobId) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  // Active status check: only track while accepted or in_progress
  if (!['accepted', 'in_progress'].includes(job.status)) {
    return res.status(200).json({
      stopped: true,
      message: `Job is in '${job.status}' status. Location tracking is only active during dispatch.`,
    });
  }

  const id = `trk_pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const ts = timestamp || new Date().toISOString();

  db.prepare(`
    INSERT INTO tracking_points (id, job_id, lat, lng, accuracy, speed, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, jobId, numLat, numLng, numAccuracy, numSpeed, ts);

  // Keep only the last 20 points per active job
  db.prepare(`
    DELETE FROM tracking_points
    WHERE job_id = ?
      AND id NOT IN (
        SELECT id FROM tracking_points
        WHERE job_id = ?
        ORDER BY ts DESC
        LIMIT 20
      )
  `).run(jobId, jobId);

  res.json({
    success: true,
    job_id: jobId,
    is_simulated: Boolean(is_simulated),
    point: { lat: numLat, lng: numLng, accuracy: numAccuracy, speed: numSpeed, ts },
  });
});

// 29c. Query Live Tracking Fixes for Job
apiRouter.get('/tracking/:jobId', (req, res) => {
  const { jobId } = req.params;
  const db = getDb();

  const job = db.prepare(`
    SELECT j.id, j.status, j.lat, j.lng, j.category, j.worker_id,
           w.name as worker_name, w.lat as worker_lat, w.lng as worker_lng
    FROM jobs j
    LEFT JOIN users w ON j.worker_id = w.id
    WHERE j.id = ?
  `).get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (['completed', 'rated', 'cancelled'].includes(job.status)) {
    return res.json({
      points: [],
      completed: true,
      status: job.status,
      message: 'Job concluded. Location fixes wiped from database.',
    });
  }

  // Before acceptance, customers only see coarse position (rounded to 500 m grid)
  const isCoarse = !['accepted', 'in_progress'].includes(job.status);

  const rawPoints = db.prepare(`
    SELECT lat, lng, accuracy, speed, ts
    FROM tracking_points
    WHERE job_id = ?
    ORDER BY ts ASC
    LIMIT 20
  `).all(jobId) as any[];

  const points = rawPoints.map((pt) => {
    if (isCoarse) {
      // 500m grid is ~0.0045 degrees
      return {
        ...pt,
        lat: Math.round(pt.lat / 0.0045) * 0.0045,
        lng: Math.round(pt.lng / 0.0045) * 0.0045,
        accuracy: 500,
        is_coarse: true,
      };
    }
    return pt;
  });

  res.json({
    job_id: jobId,
    status: job.status,
    is_coarse: isCoarse,
    job_destination: { lat: job.lat, lng: job.lng },
    worker_info: { name: job.worker_name, id: job.worker_id },
    points,
  });
});

// 30. Generate Read-Only Trip Share Token
apiRouter.post('/jobs/:id/share-trip', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const job = db.prepare('SELECT id, share_token, status FROM jobs WHERE id = ?').get(id) as any;
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  let token = job.share_token;
  if (!token) {
    token = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    db.prepare('UPDATE jobs SET share_token = ? WHERE id = ?').run(token, id);
  }

  res.json({
    success: true,
    token,
    share_url: `/track/${token}`,
  });
});

// 31. Public Read-Only Tracking Endpoint (/track/:token)
apiRouter.get('/track/:token', (req, res) => {
  const { token } = req.params;
  const db = getDb();

  const job = db.prepare(`
    SELECT j.id, j.category, j.description, j.lat, j.lng, j.status, j.created_at, j.accepted_at,
           c.name as customer_name, w.name as worker_name, w.phone as worker_phone
    FROM jobs j
    LEFT JOIN users c ON j.customer_id = c.id
    LEFT JOIN users w ON j.worker_id = w.id
    WHERE j.share_token = ?
  `).get(token) as any;

  if (!job) {
    return res.status(404).json({ error: 'Tracking link not found or invalid.' });
  }

  if (['completed', 'rated', 'cancelled'].includes(job.status)) {
    return res.json({
      expired: true,
      status: job.status,
      message: 'This tracking link has expired because the job has completed or was cancelled.',
    });
  }

  // Get recent tracking points (up to 20)
  const points = db.prepare(`
    SELECT lat, lng, accuracy, speed, ts
    FROM tracking_points
    WHERE job_id = ?
    ORDER BY ts DESC
    LIMIT 20
  `).all(job.id) as any[];

  res.json({
    expired: false,
    job: {
      id: job.id,
      category: job.category,
      description: job.description,
      status: job.status,
      customer_lat: job.lat,
      customer_lng: job.lng,
      customer_name: job.customer_name,
      worker_name: job.worker_name,
    },
    tracking_points: points.reverse(),
  });
});

// 32. Admin Operations Statistics
apiRouter.get('/admin/stats', (_req, res) => {
  const db = getDb();

  const verified = (db.prepare("SELECT COUNT(*) as count FROM workers WHERE verification_status = 'verified'").get() as any)?.count || 0;
  const pending = (db.prepare("SELECT COUNT(*) as count FROM workers WHERE verification_status = 'pending'").get() as any)?.count || 0;
  const unverified = (db.prepare("SELECT COUNT(*) as count FROM workers WHERE verification_status = 'unverified'").get() as any)?.count || 0;
  const rejected = (db.prepare("SELECT COUNT(*) as count FROM workers WHERE verification_status = 'rejected'").get() as any)?.count || 0;
  const flagged = (db.prepare("SELECT COUNT(*) as count FROM workers WHERE is_flagged = 1").get() as any)?.count || 0;
  const activeIncidents = (db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'active'").get() as any)?.count || 0;
  const pendingReports = (db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").get() as any)?.count || 0;
  const completedJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status IN ('completed', 'rated')").get() as any)?.count || 0;

  res.json({
    verified,
    pending,
    unverified,
    rejected,
    flagged,
    activeIncidents,
    pendingReports,
    completedJobs,
  });
});

// 33. Price Band Snapshots Monitor (Admin)
apiRouter.get('/admin/snapshots', (_req, res) => {
  const db = getDb();
  const snapshots = db.prepare(`
    SELECT id, category, area_key, low, typical, high, job_count, confidence, computed_at
    FROM price_band_snapshots
    ORDER BY computed_at DESC
    LIMIT 50
  `).all();
  res.json(snapshots);
});

// 34. Price Band Audit Log (Excluded jobs & movement dampening)
apiRouter.get('/admin/price-band-audit', (req, res) => {
  const category = req.query.category as string | undefined;
  const auditLog = getPriceBandAuditLog(category);
  res.json(auditLog);
});

// 35. Quantum-Inspired Batch Dispatch: Fetch Pending Batch
apiRouter.get('/dispatch/pending-batch', (req, res) => {
  const db = getDb();
  const preset = (req.query.preset as string) || '4x4';

  // 1. Fetch available workers from DB
  const workersRaw = db.prepare(`
    SELECT u.id, u.name, u.lat, u.lng, w.categories, w.base_rate, w.radius_km, 
           w.verification_status, w.rating_avg, w.available, w.is_flagged
    FROM workers w
    JOIN users u ON u.id = w.user_id
    WHERE w.is_suspended = 0
    ORDER BY w.verification_status = 'verified' DESC, w.rating_avg DESC
  `).all() as any[];

  const allWorkers: any[] = workersRaw.map((w) => ({
    id: w.id,
    name: w.name,
    lat: Number(w.lat),
    lng: Number(w.lng),
    categories: JSON.parse(w.categories || '[]'),
    base_rate: Number(w.base_rate),
    radius_km: Number(w.radius_km),
    verification_status: w.verification_status,
    rating_avg: Number(w.rating_avg),
    available: Boolean(w.available),
    is_flagged: Boolean(w.is_flagged),
  }));

  // 2. Curated standard pending requests across Bangalore neighborhoods
  const allRequests = [
    {
      id: 'req_101',
      customer_name: 'Priya S.',
      category: 'plumbing',
      description: 'Kitchen sink pipe blockage and valve leak',
      lat: 12.9352,
      lng: 77.6245, // Koramangala
      offered_price: 450,
    },
    {
      id: 'req_102',
      customer_name: 'Arvind N.',
      category: 'electrician',
      description: 'Tripping MCB breaker and sparks in bedroom outlet',
      lat: 12.9121,
      lng: 77.6446, // HSR Layout
      offered_price: 420,
    },
    {
      id: 'req_103',
      customer_name: 'Divya K.',
      category: 'carpentry',
      description: 'Balcony door hinge alignment and lock replacement',
      lat: 12.9784,
      lng: 77.6408, // Indiranagar
      offered_price: 500,
    },
    {
      id: 'req_104',
      customer_name: 'Rohan M.',
      category: 'appliance',
      description: 'Front load washing machine spin cycle noise',
      lat: 12.9304,
      lng: 77.5835, // Jayanagar
      offered_price: 650,
    },
    {
      id: 'req_105',
      customer_name: 'Kavita N.',
      category: 'painting',
      description: 'Living room damp patch sealing and touch-up',
      lat: 12.9385,
      lng: 77.6295, // Koramangala
      offered_price: 600,
    },
    {
      id: 'req_106',
      customer_name: 'Karthik S.',
      category: 'cleaning',
      description: 'Deep bathroom disinfection & tile grout cleaning',
      lat: 12.9155,
      lng: 77.6412, // HSR Layout
      offered_price: 480,
    },
    {
      id: 'req_107',
      customer_name: 'Meera J.',
      category: 'plumbing',
      description: 'Overhead tank float valve replacement',
      lat: 12.9745,
      lng: 77.6425, // Indiranagar
      offered_price: 470,
    },
    {
      id: 'req_108',
      customer_name: 'Nikhil D.',
      category: 'electrician',
      description: 'Inverter battery bypass switch wiring',
      lat: 12.9340,
      lng: 77.6210, // Koramangala
      offered_price: 440,
    },
  ];

  let requests: any[] = [];
  let workers: any[] = [];

  if (preset === '4x4') {
    requests = allRequests.slice(0, 4);
    workers = allWorkers.slice(0, 4);
  } else if (preset === '6x6') {
    requests = allRequests.slice(0, 6);
    workers = allWorkers.slice(0, 6);
  } else {
    requests = allRequests;
    workers = allWorkers.slice(0, 12);
  }

  res.json({
    preset,
    requests,
    workers,
    total_workers_available: allWorkers.length,
  });
});

// 36. Quantum-Inspired Batch Dispatch: Run QUBO Simulated Annealing
apiRouter.post('/dispatch/run', async (req, res) => {
  try {
    const { requests, workers, typicalPrice = 500 } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Requests array is required and must not be empty.' });
    }
    if (!workers || !Array.isArray(workers) || workers.length === 0) {
      return res.status(400).json({ error: 'Workers array is required and must not be empty.' });
    }

    const { computeCostMatrix, runBatchDispatch } = await import('./quantum_dispatch.js');
    const { matrix, breakdowns } = computeCostMatrix(requests, workers, typicalPrice);
    const result = runBatchDispatch(requests, workers, typicalPrice);

    res.json({
      success: true,
      ...result,
      costMatrix: matrix,
      costBreakdowns: breakdowns,
      disclaimer: 'Quantum-inspired: classical simulated annealing on a QUBO. Not run on quantum hardware.',
    });
  } catch (err: any) {
    console.error('[Dispatch Error]:', err);
    res.status(500).json({ error: err.message || 'Dispatch solver failed' });
  }
});


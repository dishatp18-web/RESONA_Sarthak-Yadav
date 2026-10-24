/**
 * FairFix Full-Stack Server
 * Runs Express backend with Vite middleware in development on port 3000.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb } from './src/server/db.js';
import { seedData } from './src/server/seed.js';
import { apiRouter } from './src/server/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Restricted document serving: only admin or the document owner can view uploaded documents
  app.get('/uploads/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const demoRole = (req.headers['x-demo-role'] || req.query.role || '') as string;
    const demoUserId = (req.headers['x-demo-user-id'] || req.query.userId || '') as string;

    // Admin has full review access
    if (demoRole === 'admin') {
      return res.sendFile(filePath);
    }

    // Owner worker has access to their own document
    if (demoUserId) {
      const db = getDb();
      const worker = db.prepare('SELECT user_id, verification_doc_path FROM workers WHERE user_id = ?').get(demoUserId) as any;
      if (worker && worker.verification_doc_path && worker.verification_doc_path.includes(filename)) {
        return res.sendFile(filePath);
      }
    }

    return res.status(403).json({
      error: 'Forbidden: Document access restricted to Admin or Document Owner. (Demo role switcher is not real authentication).'
    });
  });

  // Auto-seed database if empty on first run
  const db = getDb();
  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any)?.count || 0;
  if (userCount === 0) {
    console.log('[FairFix] Empty database detected. Auto-seeding initial users, workers, and jobs...');
    seedData();
  }

  // Mount API Router
  app.use('/api', apiRouter);

  // Development: Mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FairFix] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FairFix] Failed to start server:', err);
  process.exit(1);
});

import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpError } from './auth.js';
import { isEmpty, prisma } from './db.js';
import authRouter from './routes/auth.js';
import customersRouter from './routes/customers.js';
import notesRouter from './routes/notes.js';
import pipelinesRouter from './routes/pipelines.js';
import ordersRouter from './routes/orders.js';
import productsRouter from './routes/products.js';
import settingsRouter from './routes/settings.js';
import storesRouter from './routes/stores.js';
import usersRouter from './routes/users.js';
import conversationsRouter from './routes/conversations.js';
import integrationAccountsRouter from './routes/integration-accounts.js';
import { whatsappWebhookRouter } from './routes/webhook-whatsapp.js';
import { messengerWebhookRouter } from './routes/webhook-messenger.js';
import { seed } from './seed.js';
import { UPLOAD_ROOT } from './upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production: server/dist/index.js → ../../crm/dist
const FRONTEND_DIST = path.resolve(__dirname, '../../crm/dist');

// ── DB readiness state (updated after background init) ────────────────────────
let dbReady = false;
let dbError: string | null = null;

// ── Build Express app ─────────────────────────────────────────────────────────

const app = express();
app.disable('x-powered-by');

// CORS only needed in dev (different port). Same origin in production.
if (process.env.NODE_ENV !== 'production') {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? 'http://localhost:5173',
      credentials: false,
    }),
  );
}

app.use(express.json({ limit: '256kb' }));

// Uploaded files (product images, etc.)
app.use('/uploads', express.static(UPLOAD_ROOT, { fallthrough: true, maxAge: '1d' }));

// React static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(FRONTEND_DIST, { maxAge: '1h' }));
}

// Health check — always responds, reports DB state
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbReady, dbError, ts: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/customers/:customerId/notes', notesRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/integration-accounts', integrationAccountsRouter);
app.use('/api/webhook/whatsapp', whatsappWebhookRouter);
app.use('/api/webhook/messenger', messengerWebhookRouter);

// SPA catch-all in production; 404 JSON in dev
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.use((_req, res) => res.status(404).json({ error: 'পাওয়া যায়নি।' }));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[server] unhandled error:', err);
  const msg = err instanceof Error ? err.message : 'সার্ভার ত্রুটি।';
  res.status(500).json({ error: msg });
});

// ── Start HTTP server FIRST, then init DB in background ──────────────────────

const port = Number(process.env.PORT ?? 4000);

console.log(`[boot] Starting HTTP listener on port ${port}…`);
const server = app.listen(port, () => {
  console.log(`[boot] HTTP server listening on port ${port}`);
  console.log(`[boot] NODE_ENV=${process.env.NODE_ENV ?? 'development'}`);
  console.log(`[boot] DATABASE_URL=${(process.env.DATABASE_URL ?? '').replace(/:([^:@]+)@/, ':***@')}`);
  console.log('[boot] Starting database initialisation in background…');
  initDb().catch((err) => {
    console.error('[boot] DB init threw unexpectedly:', err);
  });
});

server.on('error', (err) => {
  console.error('[boot] HTTP server error:', err);
  process.exit(1);
});

// ── Database initialisation (runs AFTER server is already listening) ──────────

async function initDb() {
  // Test connectivity with a short timeout
  console.log('[db] Testing database connection…');
  try {
    await Promise.race([
      prisma.$connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB connect timeout after 10s')), 10_000),
      ),
    ]);
    console.log('[db] Database connected ✓');
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error('[db] Cannot connect to database:', dbError);
    console.error('[db] DATABASE_URL (masked):', (process.env.DATABASE_URL ?? '').replace(/:([^:@]+)@/, ':***@'));
    console.error('[db] App will serve HTTP but all API calls will fail until DB is reachable.');
    return; // Do NOT exit — let health check remain reachable for diagnosis
  }

  // Run migrations
  console.log('[db] Running migrations…');
  try {
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../server'),
      env: { ...process.env },
    });
    console.log('[db] Migrations complete ✓');
  } catch (err) {
    console.error('[db] Migration failed:', err);
    // Non-fatal — tables may already exist
  }

  // Seed if empty
  console.log('[db] Checking if seed is needed…');
  try {
    const empty = await isEmpty();
    if (empty && (process.env.SEED_ON_EMPTY ?? 'true') !== 'false') {
      console.log('[db] Empty database detected — seeding…');
      await seed();
      console.log('[db] Seed complete ✓');
    } else {
      console.log('[db] Seed not needed (data already exists or SEED_ON_EMPTY=false)');
    }
  } catch (err) {
    console.error('[db] Seed check/run failed:', err);
  }

  dbReady = true;
  console.log('[db] Database initialisation done ✓ — app fully ready');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async () => {
  console.log('[boot] Shutting down…');
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('[boot] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[boot] Unhandled rejection:', reason);
});

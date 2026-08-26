import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
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
import { whatsappWebhookRouter } from './routes/webhook-whatsapp.js';
import { messengerWebhookRouter } from './routes/webhook-messenger.js';
import { seed } from './seed.js';
import { UPLOAD_ROOT } from './upload.js';

async function boot() {
  if ((await isEmpty()) && (process.env.SEED_ON_EMPTY ?? 'true') !== 'false') {
    console.log('[seed] empty db detected — seeding demo data…');
    await seed();
    console.log('[seed] done.');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? '*',
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  // Serve uploaded files (product images, etc.) from disk.
  app.use('/uploads', express.static(UPLOAD_ROOT, { fallthrough: true, maxAge: '1d' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

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
  // Webhooks receive raw JSON from Meta — already parsed by express.json()
  app.use('/api/webhook/whatsapp', whatsappWebhookRouter);
  app.use('/api/webhook/messenger', messengerWebhookRouter);

  app.use((_req, res) => res.status(404).json({ error: 'পাওয়া যায়নি।' }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[server]', err);
    const msg = err instanceof Error ? err.message : 'সার্ভার ত্রুটি।';
    res.status(500).json({ error: msg });
  });

  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`[server] API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

boot().catch((err) => {
  console.error('[server] boot failed:', err);
  process.exit(1);
});

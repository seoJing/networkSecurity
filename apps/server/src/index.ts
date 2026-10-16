import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import { seedDemoData } from './seed';
import { requestLogger } from './middleware/requestLogger';
import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';

async function main(): Promise<void> {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must have at least 32 characters');
  }
  await seedDemoData();

  const app = express();
  // API reachable only via the single Nginx proxy, which overwrites X-Forwarded-For.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb', type: 'application/json' }));

  const PgSessionStore = connectPgSimple(session);
  app.use(session({
    name: 'mini-office.sid',
    store: new PgSessionStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 30 * 60 * 1000, path: '/' },
  }));
  app.use(requestLogger);

  app.get('/api/health', async (_req, res, next) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch (error) { next(error); }
  });
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Request failed', error instanceof Error ? error.message : 'Unknown error');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }) as express.ErrorRequestHandler);

  const port = Number(process.env.PORT || '3000');
  app.listen(port, '0.0.0.0', () => console.log(`Mini Office API listening on ${port}`));
}

main().catch((error) => {
  console.error('Server startup failed', error);
  process.exit(1);
});

import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Logs metadata only. Never raw Cookie, Authorization, or request bodies. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const sid = req.sessionID;
    const event = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      sourceIp: req.ip || 'unknown',
      userId: req.session?.userId ?? null,
      sessionRef: sid ? createHash('sha256').update(sid).digest('hex').slice(0, 12) : null,
    };
    console.log(JSON.stringify(event));
  });
  next();
};

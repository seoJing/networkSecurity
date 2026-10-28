import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    // Defender contract extension: baseline captured at login, used by session-anomaly policies.
    boundIp?: string;
    boundUa?: string;
  }
}

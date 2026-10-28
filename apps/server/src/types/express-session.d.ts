import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    // Defender contract extension: baseline captured at login, used by session-anomaly policies.
    boundIp?: string;
    boundUa?: string;
    // R6: rotating per-request token. `current` must match the client's cookie; `retired` holds
    // spent tokens so that a replay of a spent token (= a stolen copy) is detected.
    tokenState?: { current: string; retired: string[] };
  }
}

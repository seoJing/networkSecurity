# Session contract

- Mechanism: server-side `express-session` with PostgreSQL `connect-pg-simple`, cookie name `mini-office.sid`.
- Successful POST `/api/auth/login` **regenerates** the session ID and stores `userId`, then replies with a safe user DTO.
- Authenticated endpoints require an existing `userId` and acceptance by `activeSessionPolicy`; normal per-document `owner_id` checks remain in place.
- POST `/api/auth/logout` destroys the session in the store and clears the named cookie.
- Baseline cookie: `HttpOnly`, `SameSite=Lax`, path `/`, max age 30 minutes, and `Secure=true` for the HTTPS Compose deployment. `SESSION_COOKIE_SECURE` controls the flag and defaults to `true`; login and logout use shared cookie options. Do not remove owner checks or add an authentication bypass endpoint.
- The default policy accepts authenticated positive integer user IDs. Defender may replace the active policy under `apps/server/src/security/policies/` only.
- Client-IP observations pass through exactly one Nginx reverse proxy, which replaces forwarded address headers. They are signals, not proof of identity.
- Nginx owns external TLS termination while the backend remains private HTTP. Session anomaly detection and additional defense policies belong to the defender and require normal-user regression.

# Architecture

- VMware Host-only subnet (three separate VMs): Server, Victim, Attacker.
- Docker Compose only on the Server VM: Nginx+React → Express → PostgreSQL.
- Nginx serves static assets and `/api` reverse-proxies to Express. Express and PostgreSQL are private Docker services.
- Express uses `express-session` + `connect-pg-simple` with a PostgreSQL session table. The cookie is `HttpOnly`, `SameSite=Lax`, non-Secure only on isolated HTTP lab transport.
- Normal app access uses `req.session.userId` and SQL `owner_id` checks.
- `apps/server/src/security/policies/activePolicy.ts` is the explicit defender hook.
- Request logger outputs metadata only; no cookies, credentials or raw session IDs.

Do not conflate network-layer attacks with the Docker bridge. Lab ARP behavior must be confirmed on the VMware Host-only interface.

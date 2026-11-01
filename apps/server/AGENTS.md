# Server agent rules

Read the repository root `AGENTS.md` and `.harness/contracts/session.md` first.

- Preserve successful login, session regeneration, logout, and document ownership checks.
- `src/security/policies/activePolicy.ts` is the defender's intended extension point.
- The attacker must never modify this server tree.
- Keep API paths and response shapes consistent with `.harness/contracts/openapi.yaml`.
- No raw session IDs, cookies, password hashes, or HTTP request bodies in logs.
- External lab traffic terminates HTTPS at Nginx; only the private Nginx-to-Express hop may use HTTP. Do not publish the backend outside the Docker network.

# Server agent rules

Read the repository root `AGENTS.md` and `.harness/contracts/session.md` first.

- Preserve successful login, session regeneration, logout, and document ownership checks.
- `src/security/policies/activePolicy.ts` is the defender's intended extension point.
- The attacker must never modify this server tree.
- Keep API paths and response shapes consistent with `.harness/contracts/openapi.yaml`.
- No raw session IDs, cookies, password hashes, or HTTP request bodies in logs.
- The isolated lab transport may be HTTP; do not silently expose it outside the Host-only network.

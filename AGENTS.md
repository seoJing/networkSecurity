# Agent Operating Rules — Network Security Lab

## Intent
This is a course team project for **authorized, isolated VMware** exercises involving sniffing, spoofing, session hijacking, defense, and re-evaluation. The shared application must remain a small **normal functioning** web app. Never pre-implement offensive or defensive behavior in the platform baseline.

## Required context
Read `.harness/PROJECT.md`, `.harness/OWNERSHIP.md`, `.harness/INVARIANTS.md`, and the relevant `.harness/contracts/*` and `.harness/roles/*` before changing code. Nested `AGENTS.md` files add directory-specific guidance.

## Role separation
- **Platform**: owns normal React/Express/PostgreSQL, Docker, API contracts, and sanitized request logging. No attack scripts or defense policies beyond a baseline valid-session check.
- **Attacker**: owns `experiments/attacker/**` and permitted lab VM tools. NEVER edit server authentication, API, database, or defense logic to make an attack succeed.
- **Defender**: owns `apps/server/src/security/policies/**` and `experiments/defender/**`. Implement defense without changing attacker experiments, core auth, or the experiment's declared success criteria.

## Invariants
Normal login/logout, ownership checks, no raw secrets in logs, reproducible starting state, and isolated Host-only transport must remain true. Read `.harness/INVARIANTS.md` for testable criteria.

## Workflow
1. Name your role and task ID.
2. List affected files and check ownership.
3. Read relevant contracts. Propose cross-role contract edits for human review rather than silently changing them.
4. Implement minimal changes and add regression coverage.
5. Run build/tests where available; report exactly what was and was not run.
6. Provide a PR summary listing files, assumptions, checks, and evidence.

## Restrictions
- No testing against real or shared networks or systems; do not run live attack commands outside the explicitly authorized lab.
- No real user data or reusable credentials. Never commit `.env` files, session cookies, raw captured credentials, or raw packet captures containing secrets.
- Do not weaken source authentication to simulate session hijacking: the shared platform uses external HTTPS with normal authorization, not intentionally broken authentication or ownership checks.
- Do not bypass or delete tests to force a green result; do not merge directly into protected `main`.

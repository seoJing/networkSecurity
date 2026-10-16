# Network Security Lab — Mini Office

A deliberately **minimal normal web application** for an authorized, isolated VMware network-security class exercise. Attack and defense implementations are **not** included in this baseline.

Korean team setup guide: [`docs/SETUP.ko.md`](docs/SETUP.ko.md).

## Architecture

- **Web:** React + TypeScript + Vite, served by Nginx
- **API:** Node.js + Express + TypeScript; server-side sessions
- **Storage:** PostgreSQL for demo users, documents and `connect-pg-simple` sessions
- **Orchestration:** Docker Compose (web is the only published service)
- **Lab:** A separate VMware Host-only network with Server, Victim, Attacker VMs

Browser → `http://localhost:8080` → Nginx (`/api` → Express) → PostgreSQL.

## Quick start

Prerequisite: Docker Engine/Desktop with Docker Compose v2. On an Ubuntu Server VM, install Docker Engine and the Compose plugin first.

```sh
cp .env.example .env
# Generate a fresh secret and edit SESSION_SECRET in .env:
openssl rand -hex 32
docker compose up -d --build
docker compose ps
```

Visit **http://localhost:8080**. Test accounts: `alice` and `bob`, each with `SEED_PASSWORD` from `.env`. This is **synthetic lab data**. Do not reuse passwords or real accounts.

Run `set -a; source .env; set +a; bash scripts/smoke.sh` for the normal-user regression checks once containers are healthy. The script targets local/private-address endpoints only.

`docker compose logs -f backend` displays structured, sanitized request records. The logger never deliberately records cookies, raw session IDs, passwords or request bodies.

### VMware Host-only lab

1. Create a **dedicated isolated Host-only** VMware virtual network; verify the lab VMs share the same L2 segment for ARP-related exercises.
2. Configure the server VM with a static IP on that network (e.g., `192.168.56.10`). Address is illustrative; use the actual VMware subnet.
3. Copy the sample lab environment, then adjust `WEB_BIND_IP` to that server VM's **Host-only interface**:

```sh
cp .env.lab.example .env.lab
# Edit .env.lab: WEB_BIND_IP, POSTGRES_PASSWORD, SESSION_SECRET, SEED_PASSWORD
# Must be run from the Server VM:
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d --build
```

**Important: image downloads and npm installs require network access during initial preparation.** On the Server VM, while you still have a temporary controlled update connection, run:

```sh
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml pull db
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml build
```

Then remove/disconnect the temporary NAT/bridged adapter and verify the exercise network is isolated **before any offensive tests**. Start with cached images using `docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d --no-build --pull never` (Compose v2).

4. On the Victim VM, browse to `http://<server-host-only-ip>:80`. Do **not** connect the exercise VMs to production/shared networks. Do not publish the intentionally HTTP-only lab site to the internet. Disable extra bridged/NAT adapters while exercising network attacks as appropriate for the isolated lab design.

The API and database have **no host-published ports**. The frontend Nginx container forwards `/api/*` to the backend privately. Nginx **replaces** X-Forwarded-For with the directly observed client IP; Express trusts that single reverse proxy for logging. This is a controlled single-proxy arrangement, not a general multi-proxy configuration.

### Development

For the initial baseline the Docker setup deliberately favors deterministic builds over hot reload:

```sh
docker compose up -d --build
docker compose logs -f backend
# After code changes:
docker compose up -d --build frontend backend
# Stop without deleting DB:
docker compose down
```

To run local hot-reload later, introduce a separately reviewed development override. **Do not** expose the database or backend directly in the lab config. No `docker compose down -v` unless intentionally discarding lab data.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Basic database connectivity |
| POST | `/api/auth/login` | Login and rotate session ID |
| POST | `/api/auth/logout` | Destroy session and clear cookie |
| GET | `/api/auth/me` | Current authenticated user |
| GET | `/api/documents` | Current user's documents |
| GET | `/api/documents/:id` | Owner-only document |
| PATCH | `/api/documents/:id` | Owner-only title/content update |

The app uses `fetch(..., { credentials: 'same-origin' })`, an HTTP-only session cookie, no permissive CORS, parameterized SQL, and ownership checks. Login credentials, session state, and document contents are sample-only. `SameSite=Lax` and JSON-only mutation endpoints are baseline controls, **not a substitute for a complete CSRF strategy** in a real deployment.

### Team/AI harness

Read [`AGENTS.md`](AGENTS.md), [`.harness/PROJECT.md`](.harness/PROJECT.md), [`.harness/OWNERSHIP.md`](.harness/OWNERSHIP.md), and [`.harness/INVARIANTS.md`](.harness/INVARIANTS.md) before editing. The attacker works in `experiments/attacker/` and on a separate VM; defender policies live in `apps/server/src/security/policies/` and `experiments/defender/`. Do not alter core authentication logic to force either outcome.

Scope-check examples (run after checking out a feature branch and fetching `main`):

```sh
node scripts/check-scope.mjs attacker origin/main HEAD
node scripts/check-scope.mjs defender origin/main HEAD
```

GitHub Actions checks builds, unit tests, and a Docker-backed smoke test; branch protections and human review must be configured in repository settings to truly enforce approvals. Roles and paths declared in PRs are not a security boundary on their own.

**Experiment workflow:** freeze baseline commit → run authorized isolated attack → record sanitized evidence → apply defense policy → re-run normal-user regression → re-evaluate. See [`.harness/workflows/experiment.md`](.harness/workflows/experiment.md).

## Limitations

- Docker is not installed in every development environment. CI and a real VMware smoke test are needed to validate the full deployment.
- A proxy/IP session policy can be added by the defender, but IP alone is not a stable authentication factor.
- No offensive tooling, bypass implementation, or exploit triggers are supplied by the platform.
- HTTPS is omitted **only** on the isolated teaching lab interface so the security team can compare transport controls. The default local compose binds web to loopback. This is not suitable for production.

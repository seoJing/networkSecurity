# Network Security Lab — Mini Office

A deliberately **minimal normal web application** for an authorized, isolated VMware network-security class exercise. Attack and defense implementations are **not** included in this baseline.

Korean team setup guide: [`docs/SETUP.ko.md`](docs/SETUP.ko.md).

## Architecture

- **Web:** React + TypeScript + Vite, served by Nginx
- **API:** Node.js + Express + TypeScript; server-side sessions
- **Storage:** PostgreSQL for demo users, documents and `connect-pg-simple` sessions
- **Orchestration:** Docker Compose (web is the only published service)
- **Lab:** A separate VMware Host-only network with Server, Victim, Attacker VMs

Browser --HTTPS--> `https://localhost:8443` → Nginx --HTTP/private Docker network--> Express → PostgreSQL.

## Quick start

Prerequisites: Docker Engine/Desktop with Docker Compose v2, Bash, OpenSSL, and Python 3. On an Ubuntu Server VM, install Docker Engine and the Compose plugin first.

```sh
cp .env.example .env
bash scripts/generate-cert.sh local
# Generate a fresh secret and edit SESSION_SECRET in .env:
openssl rand -hex 32
docker compose up -d --build
docker compose ps
```

Visit **https://localhost:8443**. The generated certificate contains SANs for both `localhost` and `127.0.0.1`. Trust `certs/ca.crt` in the local browser/OS if browser access should show a trusted connection; never trust or distribute `ca.key` or `server.key`. Test accounts are `alice` and `bob`, each with `SEED_PASSWORD` from `.env`. This is **synthetic lab data**. Do not reuse passwords or real accounts.

Run `set -a; source .env; set +a; bash scripts/smoke.sh` once containers are healthy. The script accepts only HTTPS local/private-address endpoints and verifies the server with `TLS_CA_CERT_PATH` via `curl --cacert`; it never disables certificate verification. It checks health, login, the `Secure` session cookie, user-specific reads, allowed and denied document updates, logout, and post-logout rejection.

`scripts/generate-cert.sh` refuses to overwrite existing key material. Remove or archive an obsolete `certs/` directory deliberately before generating a replacement. Generated certificates and keys under `certs/` are ignored by Git. If certificate paths live elsewhere, set `TLS_CERT_PATH`, `TLS_KEY_PATH`, and `TLS_CA_CERT_PATH` in the environment file; quote values that contain spaces.

`docker compose logs -f backend` displays structured, sanitized request records. The logger never deliberately records cookies, raw session IDs, passwords or request bodies.

### VMware Host-only lab

1. Create a **dedicated isolated Host-only** VMware virtual network; verify the lab VMs share the same L2 segment for ARP-related exercises.
2. Configure the server VM with a static IP on that network (e.g., `192.168.56.10`). Address is illustrative; use the actual VMware subnet.
3. Copy the sample lab environment, adjust `WEB_BIND_IP` to that server VM's **Host-only interface**, and generate a certificate whose IP SAN matches it:

```sh
cp .env.lab.example .env.lab
# Edit .env.lab: WEB_BIND_IP, POSTGRES_PASSWORD, SESSION_SECRET, SEED_PASSWORD
WEB_BIND_IP=192.168.56.10 bash scripts/generate-cert.sh lab
# Must be run from the Server VM:
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d --build
```

Replace `192.168.56.10` with the exact `WEB_BIND_IP` from `.env.lab`. The lab certificate SAN must match the address Victim VMs use. Nginx receives `server.crt` and `server.key` as read-only mounts; neither is copied into the image.

**Important: image downloads and npm installs require network access during initial preparation.** On the Server VM, while you still have a temporary controlled update connection, run:

```sh
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml pull db
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml build
```

Then remove/disconnect the temporary NAT/bridged adapter and verify the exercise network is isolated **before any offensive tests**. Start with cached images using `docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d --no-build --pull never` (Compose v2).

4. Copy **only** `certs/ca.crt` to each Victim VM over the isolated lab channel and trust it as a lab root CA. On Ubuntu/Debian:

```sh
sudo install -m 0644 ca.crt /usr/local/share/ca-certificates/mini-office-lab-ca.crt
sudo update-ca-certificates
```

On Windows, from an elevated terminal, run `certutil -addstore -f Root ca.crt`. Firefox installations using a separate certificate store can instead import `ca.crt` under Settings → Privacy & Security → Certificates → Authorities and enable website trust. Restart the browser after changing trust. Never copy `ca.key` or `server.key` to a Victim VM.

5. On the Victim VM, browse to `https://<server-host-only-ip>/` (port 443). Do **not** connect the exercise VMs to production/shared networks or publish this lab service to the internet. Disable extra bridged/NAT adapters while exercising network attacks as appropriate for the isolated lab design.

6. From the Server VM, verify normal behavior with certificate validation enabled:

```sh
set -a; source .env.lab; set +a
BASE_URL="https://$WEB_BIND_IP" bash scripts/smoke.sh
```

The API and database have **no host-published ports**. Nginx has no plaintext application listener and forwards `/api/*` to `http://backend:3000` only on the private Docker network. Nginx **replaces** X-Forwarded-For with the directly observed client IP; Express trusts that single reverse proxy for logging. This is a controlled single-proxy arrangement, not a general multi-proxy configuration.

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

The app uses `fetch(..., { credentials: 'same-origin' })`, an `HttpOnly; Secure; SameSite=Lax` session cookie in the HTTPS Compose configuration, no permissive CORS, parameterized SQL, and ownership checks. Login credentials, session state, and document contents are sample-only. `SameSite=Lax` and JSON-only mutation endpoints are baseline controls, **not a substitute for a complete CSRF strategy** in a real deployment.

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
- TLS uses a project-local development CA and is intended only for the isolated course environment. The baseline does not add HSTS, mTLS, rate limiting, or defender session policies and is not a production deployment guide.

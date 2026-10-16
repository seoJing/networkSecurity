# Ownership and approval boundaries

| Role | May edit without cross-role approval | Read-only by default |
| --- | --- | --- |
| Platform | `apps/web/**`, normal `apps/server/**` except active defender policy once handed off, `infra/**`, Compose, project docs | attacker and defender experiment artifacts |
| Attacker | `experiments/attacker/**`, `tests/attack/**` | **all** runtime server code, shared contracts, defense implementation |
| Defender | `apps/server/src/security/policies/**`, `experiments/defender/**`, `tests/defense/**` | normal auth routes, data schema, attacker experiments, shared contracts |

The platform owner proposes and reviews shared files including `AGENTS.md`, `.harness/**`, `.github/**`, API contracts and baseline Docker/network configuration. After baseline freeze, changing these requires explicit human review. Filesystem paths are a coordination convention, NOT a permission boundary; configure protected branches and CODEOWNERS before depending on them.

All agent-generated PRs must identify role, task ID, allowed paths, affected contracts, and passed/failed/not-run checks.

# Defender role

Add security checks solely in `apps/server/src/security/policies/**`, with tests and documentation under `tests/defense/**` or `experiments/defender/**`. Preserve baseline login/logout/API and normal-user compatibility. Do not alter attacker evidence or redefine experiment success. IP/User-Agent changes may inform signals but should not be treated as robust identity proof without accounting for false positives.

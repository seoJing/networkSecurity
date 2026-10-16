# PR review rules

1. Verify role and affected paths (a branch name or PR description is not proof of authorization).
2. Check session and API contracts, sensitive logging, ownership checks, and network isolation.
3. Require builds/tests, but record explicit 'not run' for VMware-only tests.
4. Reject PRs that weaken authentication for attack convenience or invalidate attack conditions for defense convenience.
5. Have a human review cross-role changes. Protect `main` with required checks and reviews; CODEOWNERS alone is advisory until rules are enabled.

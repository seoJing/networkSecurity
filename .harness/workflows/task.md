# Task specification (copy per task)

```yaml
id: ROLE-001
role: platform | attacker | defender
objective: "..."
allowed_paths:
  - "..."
read_only:
  - "..."
contracts:
  - ".harness/contracts/session.md"
acceptance:
  - "..."
verification:
  - "..."
```

Agent instructions: read root `AGENTS.md` and role document, propose affected paths, do not broaden scope, implement, validate, then report changed paths and test evidence. Contract changes require a separate reviewed task.

# Experiment log template

```yaml
experiment_id: EXP-001
baseline_commit: <immutable SHA>
attack_commit: <immutable SHA>
defense_commit: <immutable SHA or none>
vm_network: <isolated VMware Host-only identifier>
scenario: <agreed scenario>
success_criteria: <agreed observable effect>
normal_user_regression: pending | pass | fail
attack_result: pending | success | failure | inconclusive
evidence: [sanitized-request-log, redacted-summary]
notes: <limitations, environment changes>
```

Freeze the baseline before starting, never change success criteria between rounds, and distinguish `inconclusive` from a measured failure. Redact captures and credentials before sharing. Offensive tests stay on the dedicated authorized segment only.

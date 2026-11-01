# Baseline invariants

1. `INV-01`: valid Alice/Bob credentials result in login and a server session; login regenerates session ID.
2. `INV-02`: logout destroys server session and clears the session cookie.
3. `INV-03`: unauthenticated document endpoints return 401.
4. `INV-04`: requesting another user's document cannot reveal or modify it (404 to avoid leaking existence).
5. `INV-05`: attack experiments do not modify server source, session configuration, or other roles' code.
6. `INV-06`: defense changes must pass the same normal-user regression scenarios.
7. `INV-07`: approved experiment baseline commit, network assumptions, and success criteria stay fixed while comparing outcomes.
8. `INV-08`: Docker restart maintains committed demo documents and unexpired server sessions where expected.
9. `INV-09`: logs never include raw Cookie, Authorization, session ID, password, password hash, or document content.
10. `INV-10`: the HTTPS frontend only binds to loopback (default `127.0.0.1:8443`) or to the configured isolated Host-only VM interface (lab port 443); backend and database ports remain unpublished.
11. `INV-11`: Compose HTTPS sessions set the `Secure` cookie attribute, and normal smoke tests validate certificates with the configured CA rather than disabling TLS verification.

Test automation covers a subset; full VM integration and negative authorization checks must be recorded before declaring an experiment validated. Do not represent unit tests as full attack/defense evidence.

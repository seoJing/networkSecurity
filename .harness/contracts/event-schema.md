# Request event schema v1

Logged to backend stdout as **one JSON record per completed HTTP request**. Required fields:

```json
{"timestamp":"2026-10-15T10:30:00.000Z","method":"GET","path":"/api/auth/me","statusCode":200,"durationMs":12,"sourceIp":"192.168.56.20","userId":1,"sessionRef":"abcdef123456"}
```

`sessionRef` is a truncated SHA-256 reference for correlating logs **within this teaching application**, not an authentication credential. Treat it as sensitive metadata and restrict log access. Never log raw cookies/session IDs, request bodies, password fields, or arbitrary headers. The log schema does not imply an attack-detection decision; that belongs to defenders.

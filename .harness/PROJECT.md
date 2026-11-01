# Project — purpose and boundaries

**Purpose:** a reproducible class lab for the sequence (1) authorized network sniffing, (2) spoofing, (3) session hijacking, (4) defense, (5) bypass/re-evaluation within **isolated VMware** infrastructure.

**Shared platform:** Mini Office with two synthetic users, normal login/logout, an authenticated dashboard, user-owned documents, server-stored cookie sessions, and sanitized request records. Platform developers do NOT implement attack or defense outcomes.

**Network boundary:** Host-only Server/Victim/Attacker VMs. Only the frontend HTTPS port is published on the server's Host-only interface during exercises. TLS terminates at Nginx; Nginx-to-Express and Express-to-PostgreSQL traffic remains on the private Docker network. Do not use bridging to shared LANs or production networks.

**Roles:** platform builds shared services; attacker runs the approved isolated experiment from a distinct VM; defender adds checks within a narrow server policy extension point. A human reviewer approves changes to shared contracts and success criteria.

**Non-goals:** XSS/SQLi/RCE training, realistic user data, polished admin panels, internet-hosted deployment, covert monitoring, and platform-supplied exploit or bypass tooling.

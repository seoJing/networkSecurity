# VMware environment contract

- Server / Victim / Attacker are **separate** VMware VMs on a dedicated Host-only segment; no bridging to a real classroom or campus LAN.
- Example IPs: Server `192.168.56.10`, Victim `192.168.56.20`, Attacker `192.168.56.30`. These are examples only: VMware Host-only subnets may differ.
- Server binds ONLY the HTTPS web port to the actual Host-only interface via `WEB_BIND_IP`; backend/DB have no published host ports.
- Validate network isolation, VM connectivity, and same-L2 ARP visibility before the class exercise. Do not assume Docker's bridge makes attacker and victim L2 peers.
- Default local developer mode binds to `127.0.0.1:8443`; lab mode uses `.env.lab` and port 443 on the selected isolated interface.
- Nginx reads a server certificate and private key from read-only mounts configured by `TLS_CERT_PATH` and `TLS_KEY_PATH`. Generated material under `certs/` is not committed.
- Local certificates include `localhost` and `127.0.0.1` SANs. Lab certificates include the actual `WEB_BIND_IP`; Victim VMs trust only the generated public `ca.crt`, never a private key.
- External Browser-to-Nginx traffic is HTTPS. `proxy_pass http://backend:3000`, backend health checks, and database traffic stay on the private Docker network.
- Do not commit `.env`, captures containing credentials, session cookies, host-machine private data, or external targets.
- Freeze an image/config/commit reference for reproducibility and record any manual changes.

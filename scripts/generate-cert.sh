#!/usr/bin/env bash
# Generate a private development CA and an HTTPS server certificate for this lab.
set -euo pipefail

MODE="${1:-local}"
OUTPUT_DIR="${2:-${TLS_OUTPUT_DIR:-certs}}"

if ! command -v openssl >/dev/null 2>&1; then
  echo 'OpenSSL is required to generate lab certificates.' >&2
  exit 1
fi

case "$MODE" in
  local)
    COMMON_NAME='localhost'
    SAN_LINES=$'DNS.1 = localhost\nIP.1 = 127.0.0.1'
    ;;
  lab)
    : "${WEB_BIND_IP:?Set WEB_BIND_IP to the Server VM Host-only IPv4 address}"
    if python3 -c 'import sys' >/dev/null 2>&1; then
      PYTHON=(python3)
    elif py -3 -c 'import sys' >/dev/null 2>&1; then
      PYTHON=(py -3)
    else
      echo 'Python 3 is required to validate WEB_BIND_IP.' >&2
      exit 1
    fi
    if ! WEB_BIND_IP="$WEB_BIND_IP" "${PYTHON[@]}" - <<'PY'
import ipaddress
import os
import sys

try:
    address = ipaddress.ip_address(os.environ['WEB_BIND_IP'])
except ValueError:
    sys.exit(1)
private_networks = (
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
)
if address.version != 4 or not any(address in network for network in private_networks):
    sys.exit(1)
PY
    then
      echo 'WEB_BIND_IP must be an RFC 1918 private IPv4 address.' >&2
      exit 2
    fi
    COMMON_NAME="$WEB_BIND_IP"
    SAN_LINES="IP.1 = $WEB_BIND_IP"
    ;;
  *)
    echo "Usage: $0 local|lab [output-directory]" >&2
    exit 2
    ;;
esac

umask 077
mkdir -p -- "$OUTPUT_DIR"

for name in ca.key ca.crt server.key server.crt; do
  if [[ -e "$OUTPUT_DIR/$name" ]]; then
    echo "Refusing to overwrite existing certificate material: $OUTPUT_DIR/$name" >&2
    exit 1
  fi
done

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/ca.cnf" <<'EOF'
[req]
distinguished_name = distinguished_name
prompt = no
x509_extensions = ca_extensions

[distinguished_name]
CN = Mini Office Development CA

[ca_extensions]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
EOF

cat > "$WORK_DIR/server.cnf" <<EOF
[req]
distinguished_name = distinguished_name
prompt = no

[distinguished_name]
CN = $COMMON_NAME
EOF

cat > "$WORK_DIR/server.ext" <<EOF
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
$SAN_LINES
EOF

run_openssl() {
  local log_file="$1"
  shift
  if ! openssl "$@" > "$log_file" 2>&1; then
    cat "$log_file" >&2
    return 1
  fi
}

run_openssl "$WORK_DIR/ca.log" req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -keyout "$OUTPUT_DIR/ca.key" \
  -out "$OUTPUT_DIR/ca.crt" \
  -config "$WORK_DIR/ca.cnf"

run_openssl "$WORK_DIR/server.log" req -newkey rsa:2048 -sha256 -nodes \
  -keyout "$OUTPUT_DIR/server.key" \
  -out "$WORK_DIR/server.csr" \
  -config "$WORK_DIR/server.cnf"

run_openssl "$WORK_DIR/sign.log" x509 -req -sha256 -days 825 \
  -in "$WORK_DIR/server.csr" \
  -CA "$OUTPUT_DIR/ca.crt" \
  -CAkey "$OUTPUT_DIR/ca.key" \
  -CAcreateserial \
  -CAserial "$WORK_DIR/ca.srl" \
  -extfile "$WORK_DIR/server.ext" \
  -out "$OUTPUT_DIR/server.crt"

chmod 600 "$OUTPUT_DIR/ca.key" "$OUTPUT_DIR/server.key"
chmod 644 "$OUTPUT_DIR/ca.crt" "$OUTPUT_DIR/server.crt"

echo "Created CA and $MODE server certificate in: $OUTPUT_DIR"
echo "Trust only $OUTPUT_DIR/ca.crt on lab clients; never distribute either .key file."

#!/usr/bin/env bash
# Normal-user regression. Only targets the configured local/isolated lab endpoint.
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8443}"
BASE_URL="${BASE_URL%/}"
TLS_CA_CERT_PATH="${TLS_CA_CERT_PATH:-certs/ca.crt}"
DEMO_PASSWORD="${SEED_PASSWORD:?Set SEED_PASSWORD to the lab seed password}"

if python3 -c 'import sys' >/dev/null 2>&1; then
  PYTHON=(python3)
elif py -3 -c 'import sys' >/dev/null 2>&1; then
  PYTHON=(py -3)
else
  echo 'Python 3 is required for the smoke test.' >&2
  exit 1
fi

if ! BASE_URL="$BASE_URL" "${PYTHON[@]}" - <<'PY'
import ipaddress
import os
import sys
from urllib.parse import urlsplit

try:
    parsed = urlsplit(os.environ['BASE_URL'])
    address = None if parsed.hostname == 'localhost' else ipaddress.ip_address(parsed.hostname or '')
    private_networks = (
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16'),
    )
    allowed_host = parsed.hostname == 'localhost' or (
        address is not None
        and address.version == 4
        and (address.is_loopback or any(address in network for network in private_networks))
    )
    valid = (
        parsed.scheme == 'https'
        and allowed_host
        and parsed.username is None
        and parsed.password is None
        and parsed.path in ('', '/')
        and not parsed.query
        and not parsed.fragment
    )
except ValueError:
    valid = False
sys.exit(0 if valid else 1)
PY
then
  echo "Refusing nonlocal or non-HTTPS BASE_URL: $BASE_URL" >&2
  exit 2
fi

if [[ ! -r "$TLS_CA_CERT_PATH" ]]; then
  echo "CA certificate is not readable: $TLS_CA_CERT_PATH" >&2
  exit 2
fi

CURL=(curl --cacert "$TLS_CA_CERT_PATH")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

login() {
  local user="$1" jar="$2"
  local body
  body=$(USER_NAME="$user" "${PYTHON[@]}" - <<'PY'
import json,os
print(json.dumps({'username':os.environ['USER_NAME'],'password':os.environ['SEED_PASSWORD']}))
PY
)
  "${CURL[@]}" -fsS -c "$jar" -b "$jar" -H 'Content-Type: application/json' \
    --data "$body" "$BASE_URL/api/auth/login" > /dev/null
}

assert_secure_cookie() {
  local jar="$1"
  if ! awk -F '\t' '$4 == "TRUE" && $6 == "mini-office.sid" { found=1 } END { exit !found }' "$jar"; then
    echo 'Session cookie is missing the Secure attribute.' >&2
    exit 1
  fi
}

expect_status() {
  local expected="$1"; shift
  local actual
  actual=$("${CURL[@]}" -sS -o /dev/null -w '%{http_code}' "$@")
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected HTTP $expected, got $actual for $*" >&2
    exit 1
  fi
}

"${CURL[@]}" -fsS "$BASE_URL/api/health" > /dev/null
expect_status 401 "$BASE_URL/api/documents"
login alice "$TMP/alice.cookies"
login bob "$TMP/bob.cookies"
assert_secure_cookie "$TMP/alice.cookies"
assert_secure_cookie "$TMP/bob.cookies"

"${CURL[@]}" -fsS -b "$TMP/alice.cookies" "$BASE_URL/api/documents" > "$TMP/alice-documents.json"
"${CURL[@]}" -fsS -b "$TMP/bob.cookies" "$BASE_URL/api/documents" > "$TMP/bob-documents.json"
ALICE_ID=$("${PYTHON[@]}" -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])' < "$TMP/alice-documents.json")
BOB_ID=$("${PYTHON[@]}" -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])' < "$TMP/bob-documents.json")

expect_status 200 -b "$TMP/alice.cookies" "$BASE_URL/api/documents/$ALICE_ID"
expect_status 404 -b "$TMP/alice.cookies" "$BASE_URL/api/documents/$BOB_ID"
expect_status 404 -b "$TMP/bob.cookies" "$BASE_URL/api/documents/$ALICE_ID"
expect_status 404 -X PATCH -b "$TMP/bob.cookies" -H 'Content-Type: application/json' --data '{"title":"blocked","content":"blocked"}' "$BASE_URL/api/documents/$ALICE_ID"

"${CURL[@]}" -fsS -b "$TMP/alice.cookies" "$BASE_URL/api/documents/$ALICE_ID" > "$TMP/alice-document.json"
"${PYTHON[@]}" - "$TMP/alice-document.json" > "$TMP/alice-patch.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    document = json.load(source)
print(json.dumps({'title': document['title'], 'content': document['content']}))
PY
"${CURL[@]}" -fsS -X PATCH -b "$TMP/alice.cookies" -H 'Content-Type: application/json' \
  --data-binary @"$TMP/alice-patch.json" "$BASE_URL/api/documents/$ALICE_ID" > "$TMP/alice-patched.json"
"${PYTHON[@]}" - "$TMP/alice-patch.json" "$TMP/alice-patched.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as expected_file:
    expected = json.load(expected_file)
with open(sys.argv[2], encoding='utf-8') as actual_file:
    actual = json.load(actual_file)
if actual.get('title') != expected['title'] or actual.get('content') != expected['content']:
    raise SystemExit('PATCH response did not preserve the requested document fields')
PY

expect_status 200 -b "$TMP/alice.cookies" "$BASE_URL/api/auth/me"
expect_status 204 -X POST -c "$TMP/alice.cookies" -b "$TMP/alice.cookies" "$BASE_URL/api/auth/logout"
if awk -F '\t' '$6 == "mini-office.sid" { found=1 } END { exit !found }' "$TMP/alice.cookies"; then
  echo 'Logout did not remove the session cookie.' >&2
  exit 1
fi
expect_status 401 -b "$TMP/alice.cookies" "$BASE_URL/api/documents"
echo 'PASS: HTTPS trust, Secure cookie, login, ownership, PATCH allow/deny, logout'

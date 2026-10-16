#!/usr/bin/env bash
# Normal-user regression. Only targets the configured local/isolated lab endpoint.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
DEMO_PASSWORD="${SEED_PASSWORD:?Set SEED_PASSWORD to the lab seed password}"
case "$BASE_URL" in
  http://127.0.0.1:*|http://localhost:*|http://192.168.*|http://10.*|http://172.16.*|http://172.17.*|http://172.18.*|http://172.19.*|http://172.2*|http://172.30.*|http://172.31.*) ;;
  *) echo "Refusing nonlocal BASE_URL: $BASE_URL" >&2; exit 2;;
esac

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

login() {
  local user="$1" jar="$2"
  local body
  body=$(USER_NAME="$user" python3 - <<'PY'
import json,os
print(json.dumps({'username':os.environ['USER_NAME'],'password':os.environ['SEED_PASSWORD']}))
PY
)
  curl -fsS -c "$jar" -b "$jar" -H 'Content-Type: application/json' \
    --data "$body" "$BASE_URL/api/auth/login" > /dev/null
}

expect_status() {
  local expected="$1"; shift
  local actual
  actual=$(curl -sS -o /dev/null -w '%{http_code}' "$@")
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected HTTP $expected, got $actual for $*" >&2
    exit 1
  fi
}

curl -fsS "$BASE_URL/api/health" > /dev/null
expect_status 401 "$BASE_URL/api/documents"
login alice "$TMP/alice.cookies"
login bob "$TMP/bob.cookies"

ALICE_ID=$(curl -fsS -b "$TMP/alice.cookies" "$BASE_URL/api/documents" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')
BOB_ID=$(curl -fsS -b "$TMP/bob.cookies" "$BASE_URL/api/documents" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')

expect_status 200 -b "$TMP/alice.cookies" "$BASE_URL/api/documents/$ALICE_ID"
expect_status 404 -b "$TMP/alice.cookies" "$BASE_URL/api/documents/$BOB_ID"
expect_status 404 -b "$TMP/bob.cookies" "$BASE_URL/api/documents/$ALICE_ID"
expect_status 404 -X PATCH -b "$TMP/bob.cookies" -H 'Content-Type: application/json' --data '{"title":"blocked","content":"blocked"}' "$BASE_URL/api/documents/$ALICE_ID"
expect_status 200 -b "$TMP/alice.cookies" "$BASE_URL/api/auth/me"
expect_status 204 -X POST -b "$TMP/alice.cookies" "$BASE_URL/api/auth/logout"
expect_status 401 -b "$TMP/alice.cookies" "$BASE_URL/api/documents"
echo 'PASS: login, session, ownership, PATCH denial, logout'

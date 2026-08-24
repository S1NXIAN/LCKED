#!/usr/bin/env bash
# Security-headers smoke: probes a RUNNING LCKED server over HTTP and asserts
# the exact header set required by ADR-0003 (issue #30).
#
# One job: exact-value header assertions on "/" plus CSP structure checks
# (per-request nonce, 'strict-dynamic'). Exits non-zero on any deviation.
#
# Usage: scripts/security-headers-smoke.sh [BASE_URL]
#        (default http://localhost:3000 — point it at `next start`)
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
FAILURES=0

fetch_headers() {
  curl -sIL "$BASE_URL/" | tr -d '\r'
}

assert_equal() { # <header-name> <expected> <actual>
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "ok       $name"
  else
    echo "FAIL     $name"
    echo "         expected: $expected"
    echo "         actual:   ${actual:-<missing>}"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_contains() { # <description> <needle> <haystack>
  local description="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "ok       $description"
  else
    echo "FAIL     $description"
    echo "         missing: $needle"
    echo "         actual:   $haystack"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_not_contains() { # <description> <needle> <haystack>
  local description="$1" needle="$2" haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "ok       $description"
  else
    echo "FAIL     $description"
    echo "         forbidden present: $needle"
    FAILURES=$((FAILURES + 1))
  fi
}

HEADERS="$(fetch_headers)"

get() { # <header-name>
  sed -n "s/^$1: //Ip" <<<"$HEADERS" | tail -n 1
}

echo "== static security headers on $BASE_URL/ =="

assert_equal "Strict-Transport-Security" \
  "max-age=63072000; includeSubDomains" "$(get Strict-Transport-Security)"
assert_equal "X-Frame-Options" "DENY" "$(get X-Frame-Options)"
assert_equal "X-Content-Type-Options" "nosniff" "$(get X-Content-Type-Options)"
assert_equal "Referrer-Policy" "no-referrer" "$(get Referrer-Policy)"
assert_equal "Permissions-Policy" \
  "camera=(), microphone=(), geolocation=(), payment=(), usb=()" \
  "$(get Permissions-Policy)"
assert_equal "Cross-Origin-Opener-Policy" "same-origin" \
  "$(get Cross-Origin-Opener-Policy)"
assert_equal "Cross-Origin-Resource-Policy" "same-origin" \
  "$(get Cross-Origin-Resource-Policy)"
CSP="$(get Content-Security-Policy)"
echo "== content-security-policy =="

if [[ -z "$CSP" ]]; then
  echo "FAIL     Content-Security-Policy missing entirely"
  exit 1
fi

assert_contains "default-src 'self'" "default-src 'self'" "$CSP"
assert_contains "img-src allows data:" "img-src 'self' data:" "$CSP"
assert_contains "img-src allows DuckDuckGo icon host" \
  "img-src 'self' data: https://icons.duckduckgo.com" "$CSP"
assert_contains "style-src allows inline styles" \
  "style-src 'self' 'unsafe-inline'" "$CSP"
assert_contains "connect-src 'self'" "connect-src 'self'" "$CSP"
assert_contains "object-src banned" "object-src 'none'" "$CSP"
assert_contains "base-uri locked to self" "base-uri 'self'" "$CSP"
assert_contains "form-action banned" "form-action 'none'" "$CSP"
assert_contains "frame-ancestors banned" "frame-ancestors 'none'" "$CSP"
assert_contains "upgrade-insecure-requests" "upgrade-insecure-requests" "$CSP"

assert_contains "script-src carries a nonce" "'nonce-" "$CSP"
assert_contains "script-src carries 'strict-dynamic'" "'strict-dynamic'" "$CSP"
assert_not_contains "script-src forbids inline" \
  "script-src 'self' 'unsafe-inline'" "$CSP"
assert_not_contains "no report-uri endpoint" "report-uri" "$CSP"
assert_not_contains "no report-to endpoint" "report-to" "$CSP"

NONCE_ONE="$(sed -n "s/.*'nonce-\([^']*\)'.*/\1/p" <<<"$CSP")"
if [[ -z "$NONCE_ONE" ]]; then
  echo "FAIL     nonce extraction"
  FAILURES=$((FAILURES + 1))
elif [[ "$HEADERS" != *"x-nonce: $NONCE_ONE"* ]] && [[ "$BASE_URL" != *https* ]]; then
  # x-nonce travels on the forwarded request headers, not the response; this
  # check only runs as an informational warning because Next strips it.
  echo "note     response x-nonce differs from CSP nonce (expected)"
fi

CSP_TWO="$(curl -sIL "$BASE_URL/" | tr -d '\r' | sed -n 's/^Content-Security-Policy: //Ip' | tail -n 1)"
NONCE_TWO="$(sed -n "s/.*'nonce-\([^']*\)'.*/\1/p" <<<"$CSP_TWO")"

if [[ -n "$NONCE_ONE" && "$NONCE_ONE" != "$NONCE_TWO" ]]; then
  echo "ok       nonce is fresh per request"
else
  echo "FAIL     nonce must differ across requests (got '$NONCE_ONE' twice)"
  FAILURES=$((FAILURES + 1))
fi

echo
if (( FAILURES > 0 )); then
  echo "$FAILURES assertion(s) failed against $BASE_URL"
  exit 1
fi
echo "all security-header assertions passed against $BASE_URL"

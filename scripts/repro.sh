#!/usr/bin/env bash
# Shows the homepage's revalidate value being overwritten by a 404 for /index.
# Start the app first (see README), then run: npm run repro
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
HOST="${HOST_HEADER:-beta.example.com}"
REVALIDATE="${NEXT_ISR_REVALIDATE_SECONDS:-20}"
WAIT=$((REVALIDATE + 2))

request() {
    local path="$1"
    local headers
    headers=$(curl -s -o /dev/null -D - -H "x-forwarded-host: ${HOST}" "${BASE}${path}")
    local status cache control
    status=$(printf '%s' "$headers" | awk 'toupper($1) ~ /^HTTP/ {print $2}' | tail -1)
    cache=$(printf '%s' "$headers" | awk -F': ' 'tolower($1)=="x-nextjs-cache" {print $2}' | tr -d '\r')
    control=$(printf '%s' "$headers" | awk -F': ' 'tolower($1)=="cache-control" {print $2}' | tr -d '\r')
    printf '  GET %-8s -> %s  x-nextjs-cache=%-6s cache-control: %s\n' "$path" "$status" "${cache:--}" "$control"
}

echo "1. Warm the homepage and a child page"
request /
request /
request /about

echo
echo "2. Wait ${WAIT}s. Both pages should go STALE and revalidate"
sleep "$WAIT"
request /
request /about
request /

echo
echo "3. Request /index. There's no CMS page at that path, so getStaticProps returns { notFound: true }"
request /index

echo
echo "4. Request the homepage again. Expect s-maxage=${REVALIDATE}"
request /

echo
echo "5. Wait ${WAIT}s. The homepage should go STALE, like /about"
sleep "$WAIT"
request /
request /about

#!/bin/sh
# Offline checks only; test values are not credentials.
set -eu
cd "$(dirname "$0")"
export SUPABASE_URL=https://example.invalid
export SUPABASE_SERVICE_ROLE_KEY=test-only-not-a-credential
export TELEMETRY_INGEST_TOKEN=test-only-not-a-credential
export TELEMETRY_ORGANIZATION_ID=00000000-0000-0000-0000-000000000001
vector validate --no-environment vector.toml
vector test vector.toml

#!/usr/bin/env bash
#
# Run the full test suite, including the integration tests that need a real
# Postgres and Valkey, against the local Docker Compose stack.
#
#   pnpm --filter web test:integration
#
# Credentials come from .env.compose (created from .env.compose.example on
# first run) so they are defined in exactly one place. Integration tests
# skip themselves when REDIS_URL/DATABASE_URL are absent, so plain
# `pnpm test` stays fast and dependency-free.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.compose ]; then
  echo "==> .env.compose not found, creating it from .env.compose.example"
  cp .env.compose.example .env.compose
fi

# shellcheck disable=SC1091
set -a
source .env.compose
set +a

echo "==> Starting Postgres and Valkey"
docker compose up -d --wait

# VALKEY_EXTRA_FLAGS looks like: --requirepass somepassword
VALKEY_PASSWORD="${VALKEY_EXTRA_FLAGS##*--requirepass }"
VALKEY_PASSWORD="${VALKEY_PASSWORD%\"}"
VALKEY_PASSWORD="${VALKEY_PASSWORD#\"}"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
export REDIS_URL="redis://default:${VALKEY_PASSWORD}@localhost:6379"

echo "==> Applying migrations"
pnpm run db:migrate

echo "==> Running tests (integration tests enabled)"
exec pnpm exec vitest run "$@"

#!/usr/bin/env bash
#
# Fail if the published template has drifted from apps/web on the files where
# divergence ships a broken or insecure app.
#
# examples/respondeo is what `npx create-respondeo-app` downloads, but it is not
# a pnpm workspace member, so CI never typechecks, lints or builds it. It had
# silently fallen a migration behind its own schema — every scaffolded app got
# an apikey table missing the columns schema.ts declares — and kept an
# `images.remotePatterns` entry of "*.*.*", an open image proxy, after apps/web
# had been hardened.
#
# This checks only the files where drift is a defect rather than a difference.
# Application source is deliberately not compared: the template legitimately
# lags on dependency majors, so the two trees are not expected to match there.
set -uo pipefail

cd "$(dirname "$0")/.."

WEB="apps/web"
TEMPLATE="examples/respondeo"

# Files that must be byte-identical between the app and the template.
SHARED_PATHS=(
  "lib/db/schema.ts"
  "lib/images/remote-hosts.ts"
  "next.config.ts"
  "compose.yaml"
  "drizzle/pg"
)

status=0

for path in "${SHARED_PATHS[@]}"; do
  if [ ! -e "$WEB/$path" ]; then
    echo "error: $WEB/$path does not exist"
    status=1
    continue
  fi

  if [ ! -e "$TEMPLATE/$path" ]; then
    echo "error: $TEMPLATE/$path is missing (present in $WEB)"
    status=1
    continue
  fi

  if ! diff -r -q "$WEB/$path" "$TEMPLATE/$path" >/dev/null 2>&1; then
    echo "error: $path differs between $WEB and $TEMPLATE"
    diff -r -u "$WEB/$path" "$TEMPLATE/$path" | head -40
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  cat <<'MSG'

The published template has drifted from apps/web.

examples/respondeo is downloaded verbatim by create-respondeo-app, so these
files must be kept in step. Copy the changed files across, e.g.:

  cp apps/web/lib/db/schema.ts examples/respondeo/lib/db/schema.ts
  cp -r apps/web/drizzle/pg/. examples/respondeo/drizzle/pg/

MSG
  exit 1
fi

echo "Template is in sync with apps/web on all shared paths."

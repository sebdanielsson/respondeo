#!/usr/bin/env bash
#
# Fail if the published template has drifted from apps/web.
#
# examples/respondeo is what `npx create-respondeo-app` downloads, but it is not
# a pnpm workspace member, so CI never typechecks, lints or builds it. Drift is
# therefore invisible until it reaches a user: the template had silently fallen
# a migration behind its own schema, kept an `images.remotePatterns` entry of
# "*.*.*" (an open image proxy) after apps/web was hardened, and shipped a whole
# major of the AI SDK behind the app along with the pre-hardening quiz player
# that sent the answer key to the client.
#
# The template is now kept as a full mirror of apps/web's application source and
# dependency set. Only the files listed under DIVERGENT_PATHS may differ, and
# each one differs because the template is standalone rather than a workspace
# member. Everything else must match byte for byte.
set -uo pipefail

cd "$(dirname "$0")/.."

WEB="apps/web"
TEMPLATE="examples/respondeo"

# Must be byte-identical between the app and the template. Directories are
# compared recursively, so a file added to apps/web but not the template fails
# here too.
SHARED_PATHS=(
  "app"
  "components"
  "lib"
  "drizzle"
  "public"
  ".env.compose.example"
  ".env.example"
  "components.json"
  "compose.yaml"
  "drizzle.config.ts"
  "next.config.ts"
  "scripts/test-integration.sh"
  "stylelint.config.ts"
  "vercel.json"
  "vitest.config.ts"
)

# Deliberately different, and why. Listed here so the divergence is a documented
# decision rather than an oversight:
#
#   package.json      name/scripts are the template's; deps are checked below.
#   tsconfig.json     inlines the root tsconfig instead of extending it.
#   .oxlintrc.json    inlines the root oxlint config instead of extending it.
#   eslint.config.ts  drops eslint-config-turbo, which needs a turbo.json.
#   README.md         template-only, documents scaffolding rather than the app.
#
# apps/web additionally keeps turbo.json, docs/ and tests/, which are monorepo
# infrastructure and are intentionally absent from the template.

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

# Dependency ranges must match so the template never ships a different major of
# a runtime dependency than the app it is a copy of. The two documented
# exceptions are tooling the workspace root supplies to apps/web but a
# standalone template has to declare (oxfmt), or that only makes sense inside
# the monorepo (eslint-config-turbo).
if ! node --input-type=module -e '
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const web = read("apps/web/package.json");
const template = read("examples/respondeo/package.json");

const WEB_ONLY = new Set(["eslint-config-turbo"]);
const TEMPLATE_ONLY = new Set(["oxfmt"]);

let ok = true;
for (const field of ["dependencies", "devDependencies"]) {
  const a = web[field] ?? {};
  const b = template[field] ?? {};
  for (const [name, range] of Object.entries(a)) {
    if (WEB_ONLY.has(name)) continue;
    if (!(name in b)) {
      console.error(`error: ${field}.${name} is in apps/web but not the template`);
      ok = false;
    } else if (b[name] !== range) {
      console.error(`error: ${field}.${name} is "${range}" in apps/web but "${b[name]}" in the template`);
      ok = false;
    }
  }
  for (const name of Object.keys(b)) {
    if (TEMPLATE_ONLY.has(name)) continue;
    if (!(name in a)) {
      console.error(`error: ${field}.${name} is in the template but not apps/web`);
      ok = false;
    }
  }
}
process.exit(ok ? 0 : 1);
'; then
  status=1
fi

if [ "$status" -ne 0 ]; then
  cat <<'MSG'

The published template has drifted from apps/web.

examples/respondeo is downloaded verbatim by create-respondeo-app, so it must
stay a mirror of the app. Copy the changed paths across, e.g.:

  rm -rf examples/respondeo/lib && cp -a apps/web/lib examples/respondeo/lib
  cp apps/web/next.config.ts examples/respondeo/next.config.ts

and mirror any dependency range you changed in apps/web/package.json into
examples/respondeo/package.json.

If a difference is deliberate, add the path to DIVERGENT_PATHS in this script
with a one-line reason instead of leaving it to be rediscovered later.

MSG
  exit 1
fi

echo "Template is in sync with apps/web on all shared paths and dependencies."

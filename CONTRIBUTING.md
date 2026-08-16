# Contributing

Thanks for your interest in improving Respondeo! This guide covers the local development setup, the repo layout, and how releases work. For installing and _using_ Respondeo, see the [README](README.md) and [docs.respondeo.app](https://docs.respondeo.app).

## Ways to contribute

- **Report bugs** or request features via an [issue](https://github.com/sebdanielsson/respondeo/issues).
- **Ask questions** in [Discussions](https://github.com/sebdanielsson/respondeo/discussions).
- **Submit changes** via a pull request from a topic branch (see [Pull requests](#pull-requests)).

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) — the version in `packageManager` is authoritative; `corepack enable` picks it up automatically
- Docker, for the local PostgreSQL container
- An OIDC provider (e.g. Keycloak, Auth0, Okta, Pocket ID)

## Development environment

```bash
# Clone and install
git clone https://github.com/sebdanielsson/respondeo.git
cd respondeo
pnpm install

# Start PostgreSQL (compose.yaml lives in apps/web)
pnpm --filter web docker:up

# Configure environment
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your settings

# Run migrations and start
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm --filter web docker:down` stops the database and removes its volume.

### Running the docs site

```bash
pnpm --filter docs dev
```

The docs app is plain `next dev`, so on its own it also takes port 3000. Running `pnpm dev` starts both apps through Turborepo and Next moves the second one to the next free port (3001).

Documentation source lives in `apps/docs/content/docs/` as MDX — not in a top-level `docs/` directory.

## Repo layout

```plaintext
respondeo/
├── apps/
│   ├── web/                      # The Next.js application
│   └── docs/                     # Fumadocs documentation site
│       └── content/docs/         # Documentation source (MDX)
├── examples/
│   └── respondeo/                # Published template — a mirror of apps/web
├── packages/
│   └── create-respondeo-app/     # The `pnpm create respondeo-app` CLI
├── scripts/
│   └── check-template-sync.sh    # Enforces the mirror (see below)
├── package.json                  # Workspace root
├── pnpm-workspace.yaml
└── turbo.json                    # Turborepo configuration
```

See the [Architecture Guide](https://docs.respondeo.app/docs/development/architecture) for the system design, and [AGENTS.md](AGENTS.md) for a dense tour of the codebase conventions.

## The template mirror

`examples/respondeo` is what `create-respondeo-app` downloads. It is **not** a pnpm workspace member, so CI never typechecks, lints, or builds it — drift there is invisible until it reaches a user, and historically it shipped a stale migration, an over-permissive `images.remotePatterns`, and a pre-hardening quiz player.

It is therefore kept as a full mirror of `apps/web`'s application source and dependency set. `scripts/check-template-sync.sh` runs in CI and fails if anything outside its allow-list of standalone-vs-workspace differences has diverged.

**If you change `apps/web`, mirror the change into `examples/respondeo`.** Run the check locally before pushing:

```bash
./scripts/check-template-sync.sh
```

## Scripts

Run from the repo root; each fans out through Turborepo. Target a single workspace with `pnpm --filter <web|docs|create-respondeo-app> <script>`.

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start the dev servers                        |
| `pnpm build`        | Build for production (runs migrations first) |
| `pnpm build:only`   | Build without running migrations             |
| `pnpm start`        | Start the production server                  |
| `pnpm tsc`          | TypeScript type checking                     |
| `pnpm lint`         | oxlint + ESLint                              |
| `pnpm format`       | Format with oxfmt                            |
| `pnpm format:check` | Check formatting (what CI runs)              |
| `pnpm stylelint`    | Lint CSS                                     |
| `pnpm test`         | Run Vitest                                   |
| `pnpm loadtest`     | k6 load test against `apps/web`              |
| `pnpm db:generate`  | Generate migration files from schema changes |
| `pnpm db:migrate`   | Apply migrations                             |
| `pnpm db:push`      | Push schema changes directly (dev only)      |
| `pnpm db:studio`    | Open Drizzle Studio                          |

Before opening a PR, run the checks CI runs: `pnpm format:check`, `pnpm tsc`, `pnpm lint`, `pnpm stylelint`, `pnpm test`, and `./scripts/check-template-sync.sh`.

## Commit messages

Commits on `main` must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — `create-respondeo-app`'s version and changelog are derived from them (see [Releases](#releases)). PRs are squash-merged, so it is the **PR title** that lands on `main` and has to conform. CI enforces this ([`Lint PR` workflow](.github/workflows/lint-pr.yaml)); edit the title and the check re-runs.

| Type                                           | Effect on the next release           |
| ---------------------------------------------- | ------------------------------------ |
| `feat: ...`                                    | minor bump, listed under _Features_  |
| `fix: ...`                                     | patch bump, listed under _Bug Fixes_ |
| `feat!: ...` or a `BREAKING CHANGE:` footer    | major bump                           |
| `docs:`, `chore:`, `ci:`, `test:`, `refactor:` | no release                           |

## Pull requests

1. Create a topic branch off `main` (e.g. `feat/...`, `fix/...`, `docs/...`).
2. Keep the change focused, and mirror any `apps/web` change into `examples/respondeo`.
3. Run the checks listed under [Scripts](#scripts).
4. Open a PR against `main`, titled as a conventional commit. CI must pass before merge.

## Releases

Only **`create-respondeo-app`** is versioned and published; the web app and docs deploy continuously from `main` via Vercel.

Releases are automated with [Release Please](https://github.com/googleapis/release-please) (`release-please-config.json`). Every push to `main` updates a standing **release PR** that bumps `packages/create-respondeo-app/package.json` and its `CHANGELOG.md`. Merging that PR tags `vX.Y.Z`, publishes the GitHub release, and publishes to npm with provenance — all in the [`Release Please` workflow](.github/workflows/release-please.yaml). Nobody creates tags by hand.

Two things worth knowing:

- **Only commits touching `packages/create-respondeo-app` trigger a release.** Changes to `apps/web`, `apps/docs`, or `examples/respondeo` never do.
- **The template is not part of the release.** The CLI fetches `examples/respondeo` from `#main` at runtime (`packages/create-respondeo-app/src/constants.ts`), so template changes reach users as soon as they land — no CLI release needed.

To force a specific version, add a `Release-As: 1.2.3` footer to a commit on `main`.

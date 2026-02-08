# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Monorepo Structure

This is a **Bun workspaces + Turborepo monorepo** with the following structure:

```
respondeo/
├── apps/
│   ├── web/              # Main Next.js quiz application
│   └── docs/             # Documentation app (to be created)
├── package.json          # Root workspace config
└── turbo.json            # Turborepo task orchestration
```

All commands should be run from the **repository root** using Turborepo.

## Commands

### Development

```bash
bun run dev                # Start development server for all apps (Turbopack)
bun run dev --filter=web   # Start only web app
bun run build              # Build all apps (runs migrations + Next.js build)
bun run build --filter=web # Build only web app
bun run start              # Start production server for all apps
```

### Type Checking and Linting

```bash
bun run tsc                # TypeScript type checking (all apps)
bun run lint               # Run ESLint (all apps)
bun run format             # Format code with oxfmt (all apps)
bun run format:check       # Check code formatting (all apps)
bun run stylelint          # Run Stylelint for CSS files (all apps)
bun test                   # Run tests (all apps)
```

### Database Operations

```bash
bun run db:migrate         # Run migrations (web app only)
bun run db:push            # Push schema changes to database (development)
bun run db:generate        # Generate migration files from schema changes
bun run db:studio          # Open Drizzle Studio for database inspection
```

**Note:** Database commands are scoped to the web app via `--filter=web` in root package.json.

## Architecture Overview

### Tech Stack

- **Monorepo**: Bun workspaces + Turborepo 2.4+
- **Runtime**: Bun (required >= 1.3.8)
- **Framework**: Next.js 16 with App Router and Turbopack
- **Database**: PostgreSQL via Bun's native SQL driver (`bun:sql`) with Drizzle ORM
- **Cache**: Optional Redis/Valkey using Bun's native client
- **Auth**: BetterAuth with OIDC plugin + API Key plugin
- **AI**: AI SDK with multi-provider support (OpenAI, Anthropic, Google)
- **UI**: shadcn/ui (Base UI - Nova), Tailwind CSS 4

### Database Architecture

The app uses Bun's native `bun:sql` driver for PostgreSQL, configured in `apps/web/lib/db/index.ts`:

```typescript
import { SQL } from "bun";
const client = new SQL(process.env.DATABASE_URL!);
export const db = drizzle({ client, schema });
```

**Schema** (`apps/web/lib/db/schema.ts`):

- **Users & Auth**: `user`, `session`, `account`, `verification`, `apikey` (BetterAuth tables)
- **Quizzes**: `quiz` → `question` → `answer` (cascade deletes)
- **Attempts**: `quizAttempt` → `attemptAnswer` (stores each answer for review)
- **Relations**: All foreign keys use cascade deletes for clean data management

**Migrations**: Use `bun run db:migrate` (runs `apps/web/lib/db/migrate.ts`). Production builds automatically run migrations via the `build` script.

### Authentication & Authorization

**BetterAuth** (`apps/web/lib/auth/server.ts`):

- **OIDC Plugin**: Generic OAuth provider with custom profile mapping for groups
- **API Key Plugin**: Rate-limited (100 req/min default), enables session mocking for permission checks
- **Session**: 7-day expiry, 1-day update age, 5-minute cookie cache

**RBAC System** (`apps/web/lib/rbac/`):

- **Stateless**: Roles resolved from OIDC groups at request time (no stored role data)
- **Flat Permissions**: Each role has explicit permissions (no inheritance)
- **Public Access**: Configurable via `RBAC_PUBLIC_*` env vars for guest access
- **Roles** (priority order): admin → moderator → creator → user → guest

- **Stateless**: Roles resolved from OIDC groups at request time (no stored role data)
- **Flat Permissions**: Each role has explicit permissions (no inheritance)
- **Public Access**: Configurable via `RBAC_PUBLIC_*` env vars for guest access
- **Roles** (priority order): admin → moderator → creator → user → guest
- **Permission Helpers**: Use `hasPermission()`, `canEditQuiz()`, `canDeleteQuiz()`, etc.
- **API Keys**: Inherit permissions from user's current role dynamically

**Key Concepts**:

- User groups from OIDC `groups` claim are matched against `RBAC_ROLE_<NAME>_GROUPS`
- First matching role wins (highest priority)
- Unauthenticated users get `guest` role
- Admin role has wildcard (`*`) permission
- See `docs/rbac.md` for detailed configuration

### Caching Layer

**Optional Redis/Valkey** (`lib/cache/`):

- **Pattern**: Cache-aside with TTL-based expiry
- **Cached Data**: Quiz list (5m), quiz details (10m), leaderboards (5m)
- **Graceful Degradation**: If no `REDIS_URL`/`VALKEY_URL`, queries hit database directly
- **Two-Layer**: Redis (cross-request) + React `cache()` (per-request deduplication)
- **Keys**: `quizzes:list:{admin|public}:{page}:{limit}`, `quizzes:detail:{id}`, `leaderboard:quiz:{id}:{page}:{limit}`, `leaderboard:global:{page}:{limit}`
- See `docs/caching.md` for architecture details

### AI Generation

**AI SDK Integration** (`lib/ai/`):

- **Multi-Provider**: OpenAI, Anthropic, Google, OpenRouter
- **Configuration**: `AI_PROVIDER` env var, model-specific via `AI_MODEL`
- **Web Search**: Optional tool integration via `AI_WEB_SEARCH_ENABLED`
- **Rate Limiting**: Per-user (4/day default) and global (10/hour default) limits
- **Usage**: `getModel()` for default, `getModelForProvider()` for specific provider
- See `apps/web/docs/ai-generation.md` for provider setup

### API Structure

**REST API** (`apps/web/app/api/`):

- **Authentication**: API key required via `x-api-key` header
- **Rate Limiting**: 100 requests/minute per key (configurable)
- **Scopes**: `quizzes:read`, `quizzes:write`, `attempts:read`, `attempts:write`
- **Documentation**: OpenAPI 3.1 spec in `apps/web/lib/openapi.ts`, Scalar UI at `/docs`
- **Endpoints**:
  - `/api/quizzes` - List, create quizzes
  - `/api/quizzes/[id]` - Get, update, delete quiz
  - `/api/quizzes/[id]/attempts` - Submit quiz attempts
  - `/api/quizzes/[id]/leaderboard` - Per-quiz leaderboard
  - `/api/leaderboard` - Global leaderboard

### Server Actions

**Actions** (`apps/web/app/actions/`):

- `quiz.ts` - Create, update, delete quizzes (checks RBAC permissions)
- `attempt.ts` - Submit quiz attempts (validates max attempts, time limits)
- `api-keys.ts` - Create, delete API keys (admin only)
- `generate-quiz.ts` - AI-powered quiz generation (rate limited)
- `search-images.ts` - Unsplash image search integration

**Pattern**: All actions use `auth.api.getSession()` for user context and RBAC checks

### Image Search

**Unsplash Integration** (`apps/web/lib/images/`):

- **Provider Pattern**: Abstracted via `ImageProvider` interface
- **Configuration**: `UNSPLASH_ACCESS_KEY` env var
- **Usage**: Server action `search-images.ts` with permission check
- See `apps/web/docs/image-search.md` for setup

### Validation

**Zod Schemas** (`apps/web/lib/validations/`):

- `quiz.ts` - Quiz creation/update, question/answer validation
- `ai-quiz.ts` - AI-generated quiz structure validation
- **Pattern**: All API routes and actions validate input with Zod schemas

### Route Groups

- `(auth)/` - Authentication pages (sign-in)
- `(dashboard)/` - Main app pages with nav header
  - `page.tsx` - Quiz list (home)
  - `leaderboard/` - Global leaderboard
  - `settings/` - Admin API key management
  - `quiz/new/` - Create quiz
  - `quiz/[id]/` - Quiz detail, edit, play, results

### Key Patterns

1. **Permission Checks**: Always use `hasPermission(user, PERMISSIONS.X)` or helper functions (`canEditQuiz`, etc.) before allowing actions
2. **Resource Ownership**: Use `canEditQuiz(user, quiz.authorId)` for resource-level checks (users can edit own, admins can edit any)
3. **Rate Limiting**: Guest plays use in-memory rate limiter (`apps/web/lib/rate-limit.ts`), AI generation has per-user and global limits
4. **Error Handling**: API routes return consistent `{ error: string }` JSON responses
5. **Randomization**: Questions and answers can be randomized per attempt (controlled by quiz settings)
6. **Time Limits**: Optional per-quiz time limits with timeout tracking in attempts

## Important Notes

- **Bun-Specific**: This project requires Bun runtime. Use `bun --bun run` prefix for scripts to avoid Node.js fallback.
- **Database Required**: `DATABASE_URL` must be set (except during production build phase).
- **OIDC Required**: `OIDC_PROVIDER_ID`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` required for authentication.
- **Migrations in Build**: Production builds run `db:migrate` automatically. Use `build:only` to skip migrations.
- **Cache Optional**: Redis/Valkey caching is opt-in. App works without it.
- **Environment Variables**: See `.env.example` for complete configuration. Most RBAC settings have sensible defaults.
- **Cascade Deletes**: Deleting a quiz deletes all questions, answers, attempts, and attempt answers.
- **API Key Permissions**: API keys dynamically inherit permissions from user's current role. No need to regenerate keys when permissions change.

## Extra Notes

- As a last step before completing a task, always run formatting, linting and type checking commands to ensure code quality.

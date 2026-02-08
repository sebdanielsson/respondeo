# Respondeo

A modern, full-stack quiz application built with Next.js 16, featuring OIDC authentication, real-time leaderboards, and a comprehensive REST API with API key authentication.

## Monorepo Structure

This is a **Bun workspaces + Turborepo monorepo** with:

- **apps/web** — Main Next.js application
- **apps/docs** — Documentation app (to be created)

All commands should be run from the repository root using Turborepo.

## Features

- 🎯 **Quiz Management** — Create, edit, and delete quizzes with multiple-choice questions
- ✨ **AI Generated Content** — Use AI to help generate questions and answers
- 🔎 **Image Browser** — Browse and select images via Unsplash API integration
- 🔐 **OIDC Authentication** — Secure sign-in via OpenID Connect (configurable provider)
- 👑 **Role-Based Access** — Admin permissions based on OIDC groups claim
- 🏆 **Leaderboards** — Per-quiz and global leaderboards with rankings
- ⏱️ **Timed Quizzes** — Optional time limits with timeout tracking
- 🔄 **Randomization** — Shuffle questions for each attempt
- 🔑 **API Keys** — Programmatic access with scoped permissions and rate limiting
- 📖 **OpenAPI Docs** — Interactive API documentation with Scalar
- 🌓 **Dark Mode** — System-aware theme switching

## Tech Stack

- **Monorepo**: Bun workspaces + Turborepo
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime**: Bun
- **Database**: PostgreSQL with Drizzle ORM (via bun:sql)
- **Cache**: Valkey/Redis (optional, via Bun native client)
- **Auth**: BetterAuth with OIDC + API Key plugins
- **UI**: shadcn/ui (Base UI - Nova), Lucide Icons
- **Validation**: Zod
- **AI**: AI SDK
- **Image browser**: Unsplash API integration

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3.8
- PostgreSQL database
- An OIDC provider (e.g., Keycloak, Auth0, Okta, Pocket ID)

### Installation

```bash
# Clone the repository
git clone https://github.com/sebdanielsson/respondeo.git
cd respondeo

# Install dependencies
bun install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OIDC Configuration
OIDC_PROVIDER_ID=your-oidc-provider-id
NEXT_PUBLIC_OIDC_PROVIDER_ID=your-oidc-provider-id # must match OIDC_PROVIDER_ID
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret

# Database (PostgreSQL required)
DATABASE_URL=postgresql://respondeo:securepassword@localhost:5432/respondeo
```

### RBAC Configuration

The app includes a flexible Role-Based Access Control system. See [docs/rbac.md](docs/rbac.md) for full documentation.

**Quick examples:**

```env
# Public quiz platform (guests can browse, must sign in to play)
RBAC_PUBLIC_BROWSE_QUIZZES=true
RBAC_PUBLIC_VIEW_QUIZ=true
RBAC_PUBLIC_LEADERBOARD=true

# Role mappings (OIDC groups → app roles)
RBAC_ROLE_ADMIN_GROUPS=admin,staff
RBAC_ROLE_CREATOR_GROUPS=teachers

# Default role for authenticated users without group mapping
RBAC_DEFAULT_ROLE=user
```

| Variable                     | Default   | Description                              |
| ---------------------------- | --------- | ---------------------------------------- |
| `RBAC_PUBLIC_BROWSE_QUIZZES` | `false`   | Allow guests to view quiz list           |
| `RBAC_PUBLIC_VIEW_QUIZ`      | `false`   | Allow guests to view quiz details        |
| `RBAC_PUBLIC_PLAY_QUIZ`      | `false`   | Allow guests to play (results not saved) |
| `RBAC_PUBLIC_LEADERBOARD`    | `false`   | Allow guests to view leaderboards        |
| `RBAC_DEFAULT_ROLE`          | `user`    | Default role for authenticated users     |
| `RBAC_ROLE_ADMIN_GROUPS`     | `admin`   | OIDC groups that map to admin role       |
| `RBAC_ROLE_MODERATOR_GROUPS` | _(empty)_ | OIDC groups that map to moderator role   |
| `RBAC_ROLE_CREATOR_GROUPS`   | _(empty)_ | OIDC groups that map to creator role     |

### Database Setup

The app uses PostgreSQL with Bun's native SQL driver (`bun:sql`).

```bash
# Start PostgreSQL (via Docker Compose)
docker compose up -d

# Run migrations
bun run db:migrate

# Or push schema directly (development)
bun run db:push
```

### Caching (Optional)

The app includes an optional Redis/Valkey caching layer to reduce database load for high-traffic deployments. See [docs/caching.md](docs/caching.md) for full documentation. Caching is **opt-in** — if no Redis URL is configured, all queries hit the database directly.

### Development

```bash
# Start development server
bun --bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
# Build for production
bun --bun run build

# Start production server
bun --bun run start
```

## Project Structure

```plaintext
respondeo/
├── app/
│   ├── (auth)/           # Authentication pages
│   │   └── sign-in/
│   ├── (dashboard)/      # Main app pages
│   │   ├── page.tsx      # Quiz list (home)
│   │   ├── leaderboard/  # Global leaderboard
│   │   ├── settings/     # Admin API key management
│   │   └── quiz/
│   │       ├── new/      # Create quiz
│   │       └── [id]/     # Quiz detail, edit, play, results
│   ├── actions/          # Server actions
│   ├── api/              # REST API endpoints
│   │   ├── auth/         # BetterAuth handler
│   │   ├── leaderboard/  # Global leaderboard
│   │   └── quizzes/      # Quiz CRUD + attempts + leaderboards
│   └── docs/             # OpenAPI documentation (Scalar)
├── components/
│   ├── auth/             # Auth components
│   ├── layout/           # Header, theme, pagination
│   ├── quiz/             # Quiz-related components
│   ├── settings/         # API key manager
│   └── ui/               # Reusable UI components
├── docs/
│   └── rbac.md           # RBAC configuration documentation
└── lib/
    ├── auth/             # Auth configuration & helpers
    ├── db/               # Database schema & queries
    ├── rbac/             # Role-based access control
    ├── openapi.ts        # OpenAPI 3.1 specification
    └── validations/      # Zod schemas
```

## REST API

The app provides a comprehensive REST API for programmatic access. All endpoints require authentication via API key.

### Authentication

Include your API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your_api_key_here" https://yourapp.com/api/quizzes
```

### API Key Management

Admins can create and manage API keys through the web UI at `/settings`. Each API key can have specific permission scopes:

| Scope            | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `quizzes:read`   | List and view quizzes, view leaderboards                 |
| `quizzes:write`  | Create, update, and delete quizzes (requires admin role) |
| `attempts:read`  | View quiz attempts                                       |
| `attempts:write` | Submit quiz attempts                                     |

### Rate Limiting

API keys are rate-limited to **100 requests per minute** by default. When rate-limited, the API returns a `429 Too Many Requests` response.

### API Documentation

Interactive API documentation is available at [`/docs`](/docs) powered by [Scalar](https://scalar.com/). The documentation includes:

- 📋 **Full endpoint reference** with request/response schemas
- 🧪 **"Try it" functionality** to test endpoints directly in the browser
- 📦 **Code snippets** in multiple languages (JavaScript, Python, cURL, etc.)
- 🔐 **Authentication setup** for API key configuration

---

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

| Status Code | Description                                  |
| ----------- | -------------------------------------------- |
| `400`       | Bad Request — Invalid input data             |
| `401`       | Unauthorized — Missing or invalid API key    |
| `403`       | Forbidden — Insufficient permissions         |
| `404`       | Not Found — Resource doesn't exist           |
| `429`       | Too Many Requests — Rate limit exceeded      |
| `500`       | Internal Server Error — Something went wrong |

---

## Scripts

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `bun --bun run dev`          | Start development server            |
| `bun --bun run build`        | Build for production                |
| `bun --bun run start`        | Start production server             |
| `bun --bun run tsc`          | TypeScript type checking            |
| `bun --bun run lint`         | Run ESLint                          |
| `bun --bun run format`       | Format code with Prettier           |
| `bun --bun run format:check` | Check code formatting with Prettier |
| `bun --bun run stylelint`    | Run Stylelint for CSS files         |
| `bun --bun run db:push`      | Push schema changes to database     |
| `bun --bun run db:generate`  | Generate migration files            |
| `bun --bun run db:migrate`   | Run migrations                      |
| `bun --bun run db:studio`    | Open Drizzle Studio                 |
| `bun test`                   | Run tests                           |

## License

MIT

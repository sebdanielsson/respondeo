# Respondeo

A modern, full-stack quiz application built with Next.js 16, featuring OIDC authentication, real-time leaderboards, and a comprehensive REST API with API key authentication.

## 📚 Documentation

**Complete documentation is available at:** [`/docs`](https://docs.respondeo.app/docs) or online at https://docs.respondeo.app

Quick links:

- [Getting Started](https://docs.respondeo.app/docs/installation)
- [Configuration](https://docs.respondeo.app/docs/configuration)
- [API Reference](https://docs.respondeo.app/docs/api-reference/overview)
- [RBAC Guide](https://docs.respondeo.app/docs/guides/rbac)
- [Troubleshooting](https://docs.respondeo.app/docs/troubleshooting)

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

- **Monorepo**: pnpm workspaces + Turborepo 2.4+
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime**: Node.js (>= 20)
- **Database**: PostgreSQL with Drizzle ORM (via postgres.js)
- **Cache**: Valkey/Redis (optional, via ioredis)
- **Auth**: BetterAuth with OIDC + API Key plugins
- **UI**: shadcn/ui (Base UI - Nova), Lucide Icons
- **Validation**: Zod
- **AI**: AI SDK with multi-provider support
- **Images**: Unsplash API integration

## Quick Start

### Create a New App (Recommended)

The fastest way to get started is using `create-respondeo-app`:

```bash
# Using pnpm (recommended)
pnpm create respondeo-app my-quiz-app

# Or with npm
npx create-respondeo-app my-quiz-app
```

This will:

- Download the latest template
- Install dependencies
- Set up environment files
- Show you the next steps

Then:

```bash
cd my-quiz-app
# Configure .env.local with your database and OIDC settings
pnpm db:migrate    # Run database migrations
pnpm dev           # Start development server
```

### Manual Setup

If you prefer to clone the repository directly:

#### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- PostgreSQL database
- An OIDC provider (e.g., Keycloak, Auth0, Okta, Pocket ID)

### Installation

```bash
# Clone and install
git clone https://github.com/sebdanielsson/respondeo.git
cd respondeo
pnpm install

# Start database
docker compose up -d

# Configure environment
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your settings

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

See [Installation Guide](https://docs.respondeo.app/docs/installation) for detailed setup instructions.

## Configuration

Minimum required environment variables:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Auth
BETTER_AUTH_SECRET=your-32-character-secret
BETTER_AUTH_URL=http://localhost:3000

# OIDC Provider
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quiz_app
```

See [Configuration Guide](https://docs.respondeo.app/docs/configuration) for all available options.

## Development

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm tsc          # Type checking
pnpm lint         # Run ESLint
pnpm format       # Format code
pnpm db:migrate   # Run database migrations
pnpm db:studio    # Open Drizzle Studio
pnpm test             # Run tests
```

See [Scripts Reference](https://docs.respondeo.app/docs/development/scripts) for all available commands.

## Project Structure

```plaintext
respondeo/
├── apps/
│   ├── web/              # Main Next.js application
│   └── docs/             # Fumadocs documentation site
├── docs/                 # Documentation source (MDX files)
├── package.json          # Workspace root
└── turbo.json            # Turborepo configuration
```

See [Architecture Guide](https://docs.respondeo.app/docs/development/architecture) for detailed system architecture.

## API

Respondeo provides a comprehensive REST API. Get started:

1. [Create an API key](https://docs.respondeo.app/docs/features/api-keys) at `/settings` (admin only)
2. Include it in the `x-api-key` header
3. Explore endpoints in the [API Reference](https://docs.respondeo.app/docs/api-reference/overview)

Interactive API documentation available at `/docs` when running the app.

## Deployment

The app can be deployed to:

- **Vercel** — Easiest, with Vercel Postgres
- **Docker** — Use included `compose.yaml`
- **VPS** — Any server with Node.js and PostgreSQL
- **Railway, Fly.io** — Docker-based platforms

See [Deployment Guide](https://docs.respondeo.app/docs/guides/deployment) for detailed instructions.

## Documentation

This repository includes a Fumadocs-powered documentation site in `apps/docs/`.

**To run the docs locally:**

```bash
pnpm --filter docs dev
```

Visit http://localhost:3001

All documentation source files are in the `/docs` directory at the repository root.

## License

MIT

## Support

- **Documentation**: [Complete docs](https://docs.respondeo.app/docs)
- **GitHub Issues**: [Report bugs](https://github.com/sebdanielsson/respondeo/issues)
- **Discussions**: [Ask questions](https://github.com/sebdanielsson/respondeo/discussions)
- **Troubleshooting**: [Common issues](https://docs.respondeo.app/docs/troubleshooting)

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

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Start development server            |
| `pnpm build`        | Build for production                |
| `pnpm start`        | Start production server             |
| `pnpm tsc`          | TypeScript type checking            |
| `pnpm lint`         | Run ESLint                          |
| `pnpm format`       | Format code with Prettier           |
| `pnpm format:check` | Check code formatting with Prettier |
| `pnpm stylelint`    | Run Stylelint for CSS files         |
| `pnpm db:push`      | Push schema changes to database     |
| `pnpm db:generate`  | Generate migration files            |
| `pnpm db:migrate`   | Run migrations                      |
| `pnpm db:studio`    | Open Drizzle Studio                 |
| `pnpm test`         | Run tests                           |

## License

MIT

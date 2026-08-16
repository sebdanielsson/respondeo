# Respondeo

A modern, full-stack quiz application built with Next.js 16, featuring OIDC authentication, real-time leaderboards, and a comprehensive REST API with API key authentication.

## 📚 Documentation

**Complete documentation is available at:** [docs.respondeo.app](https://docs.respondeo.app)

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

- **Monorepo**: pnpm workspaces + Turborepo
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime**: Node.js (>= 20)
- **Database**: PostgreSQL with Drizzle ORM (via postgres.js)
- **Cache**: Valkey/Redis (optional, via ioredis)
- **Auth**: BetterAuth with OIDC + API Key plugins
- **UI**: shadcn/ui (Base UI - Nova), Lucide Icons
- **Validation**: Zod
- **Tooling**: oxlint + ESLint, oxfmt, Stylelint, Vitest
- **AI**: AI SDK with multi-provider support
- **Images**: Unsplash API integration

## Quick Start

The fastest way to get started is `create-respondeo-app`:

```bash
# Using pnpm (recommended)
pnpm create respondeo-app my-quiz-app

# Or with npm
npx create-respondeo-app my-quiz-app
```

This downloads the latest template, installs dependencies, sets up environment files, and prints the next steps. Then:

```bash
cd my-quiz-app
# Configure .env.local with your database and OIDC settings
pnpm db:migrate    # Run database migrations
pnpm dev           # Start development server
```

Open [http://localhost:3000](http://localhost:3000).

To work on Respondeo itself rather than scaffold an app from it, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 11
- A PostgreSQL database
- An OIDC provider (e.g. Keycloak, Auth0, Okta, Pocket ID)

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

See the [Configuration Guide](https://docs.respondeo.app/docs/configuration) for all available options.

## API

Respondeo provides a REST API authenticated with API keys:

1. [Create an API key](https://docs.respondeo.app/docs/features/api-keys) at `/settings` (admin only)
2. Send it in the `x-api-key` header
3. Explore the endpoints in the [API Reference](https://docs.respondeo.app/docs/api-reference/overview)

Interactive API documentation is available at `/docs` when running the app, powered by [Scalar](https://scalar.com/) — full endpoint reference, "try it" requests, and code snippets.

### Scopes

| Scope            | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `quizzes:read`   | List and view quizzes, view leaderboards                 |
| `quizzes:write`  | Create, update, and delete quizzes (requires admin role) |
| `attempts:read`  | View quiz attempts                                       |
| `attempts:write` | Submit quiz attempts                                     |

### Rate limiting

API keys are rate-limited to **100 requests per minute** by default. When rate-limited, the API returns `429 Too Many Requests`.

### Error responses

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

## Deployment

The app can be deployed to:

- **Vercel** — Easiest, with a managed Postgres provider
- **Docker** — Use the `compose.yaml` in `apps/web/`
- **VPS** — Any server with Node.js and PostgreSQL
- **Railway, Fly.io** — Docker-based platforms

See the [Deployment Guide](https://docs.respondeo.app/docs/guides/deployment) for detailed instructions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, project structure, scripts, and release process.

## License

MIT

## Support

- **Documentation**: [Complete docs](https://docs.respondeo.app/docs)
- **GitHub Issues**: [Report bugs](https://github.com/sebdanielsson/respondeo/issues)
- **Discussions**: [Ask questions](https://github.com/sebdanielsson/respondeo/discussions)
- **Troubleshooting**: [Common issues](https://docs.respondeo.app/docs/troubleshooting)

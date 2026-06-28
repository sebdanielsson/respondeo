# create-respondeo-app

[![npm version](https://img.shields.io/npm/v/create-respondeo-app.svg)](https://www.npmjs.com/package/create-respondeo-app)
[![npm downloads](https://img.shields.io/npm/dm/create-respondeo-app.svg)](https://www.npmjs.com/package/create-respondeo-app)
[![License](https://img.shields.io/npm/l/create-respondeo-app.svg)](https://github.com/sebdanielsson/respondeo/blob/main/LICENSE)

Scaffolding tool for creating new [Respondeo](https://github.com/sebdanielsson/respondeo) quiz applications.

## Usage

### With pnpm (Recommended)

```bash
pnpm create respondeo-app my-quiz-app
```

### With npm/npx

```bash
npx create-respondeo-app my-quiz-app
```

### With pnpm

```bash
pnpm create respondeo-app my-quiz-app
```

### Interactive Mode

If you don't provide a project name, the CLI will prompt you:

```bash
pnpm create respondeo-app
```

## What It Does

The CLI will:

1. ✅ Download the latest Respondeo template from GitHub
2. ✅ Create your project directory
3. ✅ Copy `.env.example` to `.env.local` for easy configuration
4. ✅ Install dependencies using your preferred package manager
5. ✅ Display next steps for getting started

## Next Steps After Installation

Once the CLI completes, follow these steps:

### 1. Navigate to Your Project

```bash
cd my-quiz-app
```

### 2. Configure Environment Variables

Edit `.env.local` and configure the required settings:

**Required:**

- `DATABASE_URL` - PostgreSQL connection string
- `OIDC_PROVIDER_ID` - Your OIDC provider identifier
- `NEXT_PUBLIC_OIDC_PROVIDER_ID` - Must match `OIDC_PROVIDER_ID`
- `OIDC_ISSUER` - OIDC provider issuer URL
- `OIDC_CLIENT_ID` - OAuth client ID
- `OIDC_CLIENT_SECRET` - OAuth client secret

**Optional:**

- `REDIS_URL` or `VALKEY_URL` - For caching (improves performance)
- `UNSPLASH_ACCESS_KEY` - For image search integration
- `AI_PROVIDER` - AI provider (openai/anthropic/google)
- `AI_MODEL` - Specific model for AI provider
- `RBAC_PUBLIC_*` - Public access configuration
- See `.env.example` for all available options

### 3. Set Up Database

Run migrations to create the database schema:

```bash
pnpm db:migrate
```

### 4. Start Development Server

```bash
pnpm dev
```

Your app will be running at http://localhost:3000

## Features

Respondeo is a modern quiz application with:

- 🎯 **Quiz Management** - Create, edit, and delete quizzes with multiple-choice questions
- 🔐 **Authentication** - OIDC-based authentication with BetterAuth
- 🏆 **Leaderboards** - Track top performers globally and per-quiz
- 🤖 **AI Generation** - Generate quizzes using AI (OpenAI, Anthropic, Google)
- 🖼️ **Image Search** - Find images for questions using Unsplash
- 🎨 **Modern UI** - Built with Next.js 16, shadcn/ui, and Tailwind CSS 4
- 📊 **RBAC** - Role-based access control with multiple permission levels
- ⚡ **Fast** - Powered by Bun runtime and Turbopack
- 🗄️ **PostgreSQL** - Reliable data persistence with Drizzle ORM
- 🚀 **Deploy Ready** - Optimized for Vercel and Docker deployment

## Documentation

For detailed documentation, visit the [Respondeo repository](https://github.com/sebdanielsson/respondeo) or check the `/docs` folder in your project.

## Requirements

- **Node.js** >= 20 (with pnpm)
- **PostgreSQL** database
- **OIDC Provider** for authentication

## Troubleshooting

### Dependencies Installation Failed

If dependency installation fails, you can install them manually:

```bash
cd my-quiz-app
pnpm install
```

### Template Download Failed

Make sure you have a stable internet connection. If the problem persists, you can manually clone the template:

```bash
git clone https://github.com/sebdanielsson/respondeo.git temp-repo
cp -r temp-repo/examples/respondeo my-quiz-app
rm -rf temp-repo
cd my-quiz-app
pnpm install
```

### Database Connection Issues

Ensure your `DATABASE_URL` is correctly formatted:

```
postgresql://username:password@localhost:5432/database_name
```

For local development, you can use Docker to run PostgreSQL:

```bash
docker run -d \
  --name respondeo-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=respondeo \
  -p 5432:5432 \
  postgres:16
```

Then set:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/respondeo
```

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/sebdanielsson/respondeo.git
cd respondeo

# Install dependencies
pnpm install

# Navigate to the CLI package
cd packages/create-respondeo-app

# Run in development mode
pnpm dev my-test-app

# Build the package
pnpm build

# Test locally using the test script
./test-local.sh my-test-app
```

### Publishing

Publishing is automated via GitHub Actions. See [`.github/PUBLISHING.md`](../../.github/PUBLISHING.md) for details.

Manual publishing (if needed):

```bash
# Bump version
npm version patch|minor|major

# Build
pnpm build

# Publish to npm
npm publish --access public
```

## License

MIT

## Support

- 📖 [Documentation](https://github.com/sebdanielsson/respondeo)
- 🐛 [Report Issues](https://github.com/sebdanielsson/respondeo/issues)
- 💬 [Discussions](https://github.com/sebdanielsson/respondeo/discussions)

# Deployment

This guide covers deploying the Quiz App to various environments.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- A PostgreSQL database (or SQLite for simple deployments)
- An OIDC provider for authentication (see [authentication.md](authentication.md))

## Environment Variables

Copy `.env.example` to `.env.local` (development) or `.env` (production) and configure all required variables:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable              | Description                                        |
| --------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | Public URL where the app is hosted                 |
| `BETTER_AUTH_SECRET`  | Secret key for session encryption (min 32 chars)   |
| `BETTER_AUTH_URL`     | URL for the auth service (usually same as app URL) |
| `OIDC_CLIENT_ID`      | OAuth client ID from your identity provider        |
| `OIDC_CLIENT_SECRET`  | OAuth client secret                                |
| `OIDC_ISSUER`         | OIDC issuer URL (e.g., `https://auth.example.com`) |

### Optional Variables

| Variable       | Default   | Description                           |
| -------------- | --------- | ------------------------------------- |
| `DB_DIALECT`   | `sqlite`  | Database type: `sqlite` or `postgres` |
| `DATABASE_URL` | `quiz.db` | Database connection string            |
| `RBAC_*`       | See below | Role-based access control settings    |

See [database.md](database.md) for database setup and [rbac.md](rbac.md) for access control configuration.

## Local Development

```bash
# Install dependencies
bun install

# Set up database
bun run db:push

# Start development server
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
# Build the application
bun run build

# Start production server
bun run start
```

## Docker Deployment

### Using Docker Compose

The repository includes a `compose.yaml` for easy deployment with PostgreSQL:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Building the Docker Image

```bash
# Build the image
docker build -t quiz-app .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_APP_URL=https://quiz.example.com \
  -e BETTER_AUTH_SECRET=your-secret-key \
  -e BETTER_AUTH_URL=https://quiz.example.com \
  -e OIDC_CLIENT_ID=your-client-id \
  -e OIDC_CLIENT_SECRET=your-client-secret \
  -e OIDC_ISSUER=https://auth.example.com \
  -e DB_DIALECT=postgres \
  -e DATABASE_URL=postgresql://user:pass@db:5432/quiz \
  quiz-app
```

## Vercel Deployment

The app is optimized for Vercel deployment:

1. Push your repository to GitHub
2. Import the project in [Vercel Dashboard](https://vercel.com/new)
3. Configure environment variables in Vercel's project settings
4. Deploy

### Vercel Environment Variables

Set all required environment variables in **Settings → Environment Variables**:

- `NEXT_PUBLIC_APP_URL` - Your Vercel deployment URL
- `BETTER_AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL` - Same as `NEXT_PUBLIC_APP_URL`
- `OIDC_*` - Your OIDC provider credentials
- `DATABASE_URL` - PostgreSQL connection string (use Vercel Postgres or external)

### Database Options for Vercel

1. **Vercel Postgres** - Managed PostgreSQL, integrates automatically
2. **Neon** - Serverless Postgres with generous free tier
3. **Supabase** - PostgreSQL with additional features
4. **PlanetScale** - MySQL-compatible (requires schema changes)

## Health Checks

The app automatically checks database connectivity. If the database is unavailable, pages will display an error message rather than crashing.

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 80;
    server_name quiz.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddy
quiz.example.com {
    reverse_proxy localhost:3000
}
```

## Troubleshooting

### Application won't start

1. Check all required environment variables are set
2. Verify database connectivity with `bun run db:studio`
3. Check logs for specific error messages

### Authentication issues

1. Verify OIDC issuer URL is accessible
2. Check callback URL is configured in your identity provider
3. Ensure `BETTER_AUTH_URL` matches your deployment URL

### Database connection errors

1. Verify `DATABASE_URL` format is correct
2. Check database server is running and accessible
3. Ensure database user has proper permissions

See [database.md](database.md) for detailed database troubleshooting.

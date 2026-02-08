# Database Setup

Respondeo uses PostgreSQL with Bun's native SQL driver (`bun:sql`) and Drizzle ORM.

## Quick Start

Set the following environment variable:

```env
DATABASE_URL=postgresql://respondeo:password@localhost:5432/respondeo
```

Then run migrations:

```bash
# Start PostgreSQL (via Docker Compose)
docker compose up -d

# Run migrations
bun run db:migrate

# Or push schema directly (development)
bun run db:push
```

## Configuration

### Environment Variables

| Variable       | Required | Description                  |
| -------------- | -------- | ---------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string |

### Connection String Format

```env
DATABASE_URL=postgresql://user:password@localhost:5432/respondeo
DATABASE_URL=postgresql://user:password@localhost:5432/respondeo?sslmode=require
DATABASE_URL=postgres://user:password@db.example.com:5432/respondeo
```

## PostgreSQL Setup

### Local Installation

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb respondeo
```

**Ubuntu/Debian:**

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb respondeo
```

**Create a dedicated user:**

```sql
CREATE USER respondeo WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE respondeo TO respondeo;
```

### Docker

```bash
docker run -d \
  --name quiz-postgres \
  -e POSTGRES_DB=respondeo \
  -e POSTGRES_USER=respondeo \
  -e POSTGRES_PASSWORD=securepassword \
  -p 5432:5432 \
  -v quiz_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Docker Compose

The included `compose.yaml` sets up PostgreSQL automatically:

```bash
docker compose up -d db
```

## Database Management

### Drizzle Commands

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run db:push`     | Push schema changes directly (dev)   |
| `bun run db:generate` | Generate migration files             |
| `bun run db:migrate`  | Run pending migrations               |
| `bun run db:studio`   | Open Drizzle Studio (visual browser) |

### Development Workflow

For development, `db:push` is fastest:

```bash
# Make schema changes in lib/db/schema.ts
# Then push directly
bun run db:push
```

### Production Workflow

For production, use migrations for safety and reproducibility:

```bash
# 1. Generate migration from schema changes
bun run db:generate

# 2. Review generated SQL in drizzle/pg/
# 3. Apply migration
bun run db:migrate
```

## Schema Overview

The database schema includes the following tables:

| Table            | Description                        |
| ---------------- | ---------------------------------- |
| `user`           | User accounts (synced from OIDC)   |
| `session`        | Active user sessions               |
| `account`        | OAuth account links                |
| `apikey`         | API keys for programmatic access   |
| `quiz`           | Quiz definitions                   |
| `question`       | Questions belonging to quizzes     |
| `answer`         | Answer options for questions       |
| `quiz_attempt`   | User attempts at quizzes           |
| `attempt_answer` | Individual answers within attempts |

### Schema Files

- `lib/db/schema.ts` - Database schema definitions

## Migrations

### Migration Files Location

Migrations are stored in `drizzle/pg/`.

### Creating a Migration

```bash
# Generate migration from current schema
bun run db:generate

# This creates a new SQL file in drizzle/pg/
# Review the generated SQL before applying
```

### Rolling Back

Drizzle doesn't have built-in rollback. To revert:

1. Manually write a reverse migration SQL
2. Or restore from backup
3. Or reset the database (development only)

### Resetting Database (Development)

```bash
# Drop and recreate
dropdb respondeo
createdb respondeo
bun run db:migrate
```

## Backup and Restore

```bash
# Backup
pg_dump -U respondeo -h localhost respondeo > backup.sql

# Restore
psql -U respondeo -h localhost respondeo < backup.sql

# Compressed backup
pg_dump -U respondeo -h localhost -Fc respondeo > backup.dump

# Restore from compressed
pg_restore -U respondeo -h localhost -d respondeo backup.dump
```

## Performance Optimization

### PostgreSQL Indexes

The schema includes indexes on frequently queried columns. For high-traffic deployments, consider:

```sql
-- Additional indexes for leaderboard queries
CREATE INDEX idx_quiz_attempt_quiz_user ON quiz_attempt(quiz_id, user_id);
CREATE INDEX idx_quiz_attempt_correct_time ON quiz_attempt(correct_count DESC, total_time_ms ASC);
```

### Connection Pooling

For serverless deployments, use a connection pooler:

- **PgBouncer** - Lightweight connection pooler
- **Supabase** - Built-in pooling
- **Neon** - Serverless with automatic pooling

Example with pooler:

```env
DATABASE_URL=postgresql://user:pass@pooler.example.com:6543/respondeo?pgbouncer=true
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

- Check PostgreSQL is running: `pg_isready`
- Verify port is correct
- Check firewall settings

### Authentication Failed

```
Error: password authentication failed for user "respondeo"
```

- Verify username and password
- Check `pg_hba.conf` allows the connection method
- Ensure user has permissions on the database

### SSL Required

```
Error: SSL connection is required
```

Add SSL mode to connection string:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### Database Does Not Exist

```
Error: database "respondeo" does not exist
```

Create the database:

```bash
createdb respondeo
# or
psql -c "CREATE DATABASE respondeo;"
```

### Schema Mismatch

If the database schema doesn't match the app:

```bash
# Development - reset and push
bun run db:push

# Production - generate and apply migration
bun run db:generate
bun run db:migrate
```

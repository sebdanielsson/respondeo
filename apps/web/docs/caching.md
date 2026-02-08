# Caching

This document describes the optional Redis/Valkey caching layer for the app.

## Overview

The app uses a cache-aside pattern to reduce database load for frequently accessed, read-heavy data:

- **Quiz list** - paginated list of quizzes
- **Quiz details** - individual quiz with questions and answers
- **Leaderboards** - per-quiz and global rankings

Caching is **optional** and **graceful** - the app works without Redis, queries just hit the database directly.

## Quick Start

### Local Development with Docker

The `compose.yaml` includes a Valkey service:

```bash
docker compose up -d
```

Set the connection URL in your `.env.local`:

```env
REDIS_URL=redis://:strongvalkeypassword@localhost:6379
```

### Production

Set the `REDIS_URL` or `VALKEY_URL` environment variable to your Redis/Valkey instance:

```env
REDIS_URL=redis://username:password@your-redis-host:6379
```

The app checks for either variable. If neither is set, caching is disabled.

## Configuration

### Environment Variables

| Variable     | Description                            | Default |
| ------------ | -------------------------------------- | ------- |
| `REDIS_URL`  | Redis connection URL (checked first)   | -       |
| `VALKEY_URL` | Valkey connection URL (checked second) | -       |

If neither is set, caching is disabled and all queries hit the database.

### TTL (Time To Live)

Cache TTL values are configured in [lib/cache/config.ts](../lib/cache/config.ts):

| Data Type          | TTL        | Rationale                                     |
| ------------------ | ---------- | --------------------------------------------- |
| Quiz list          | 5 minutes  | New quizzes may be created frequently         |
| Quiz details       | 10 minutes | Quiz content rarely changes after creation    |
| Quiz leaderboard   | 5 minutes  | Keep rankings relatively fresh                |
| Global leaderboard | 5 minutes  | Most expensive query, aggregates all attempts |

Adjust these values based on your freshness requirements vs. performance needs.

## Architecture

### Cache-Aside Pattern

```plaintext
┌─────────────┐     cache hit     ┌───────────┐
│   Client    │ ───────────────── │   Redis   │
└─────────────┘                   └───────────┘
       │                                │
       │ cache miss                     │
       ▼                                │
┌─────────────┐                         │
│  Database   │ ◄───────────────────────┘
└─────────────┘     write to cache
```

1. Check Redis for cached data
2. If cache hit, return cached data
3. If cache miss, query database
4. Store result in Redis with TTL
5. Return data to client

### Cache Invalidation

Leaderboards use short TTL-based expiry rather than explicit invalidation. When a quiz attempt is submitted, the
updated scores will be reflected once the relevant leaderboard cache entries expire and are recomputed on the next
request.

Other cached data follows the standard cache-aside pattern and is refreshed on cache miss when the TTL has expired.

### Two-Layer Caching

The app uses two caching layers:

1. **Redis** - cross-request caching (configured here)
2. **React cache()** - per-request deduplication (for SSR/metadata)

React's `cache()` prevents duplicate database queries within the same request (e.g., between `generateMetadata` and page render). Redis provides caching across requests.

## Cache Keys

| Pattern                                       | Description                    |
| --------------------------------------------- | ------------------------------ |
| `quizzes:list:{admin\|public}:{page}:{limit}` | Paginated quiz list            |
| `quizzes:detail:{quizId}`                     | Individual quiz with questions |
| `leaderboard:quiz:{quizId}:{page}:{limit}`    | Per-quiz leaderboard           |
| `leaderboard:global:{page}:{limit}`           | Global aggregated leaderboard  |

## Monitoring

Cache operations are logged:

```plaintext
[cache] Connected to Redis/Valkey
[cache] Invalidated 5 keys matching "leaderboard:quiz:abc123:*"
[cache] Read error for key quizzes:list:public:1:30 ...
```

## Troubleshooting

### Caching not working

1. Check if `REDIS_URL` or `VALKEY_URL` is set
2. Verify Redis is reachable: `redis-cli ping`
3. Check logs for `[cache] Connected to Redis/Valkey`

### Stale data

If leaderboards show outdated rankings:

1. Lower TTL values in [lib/cache/config.ts](../lib/cache/config.ts)
2. Manually flush cache: `redis-cli FLUSHDB`

### High memory usage

Monitor Redis memory usage:

```bash
redis-cli INFO memory
```

Consider:

- Reducing TTL values
- Using Redis with persistence disabled (cache-only mode)
- Setting `maxmemory` and `maxmemory-policy` in Redis config

## Valkey vs Redis

This app supports both [Redis](https://redis.io) and [Valkey](https://valkey.io) (Redis fork). Bun's native client checks:

1. `REDIS_URL`
2. `VALKEY_URL`
3. Defaults to `redis://localhost:6379`

The Docker Compose setup uses the official `valkey/valkey:9.0-trixie` image for a lightweight, open-source option based on Debian (trixie).

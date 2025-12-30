# Quiz App

A modern, full-stack quiz application built with Next.js 16, featuring OIDC authentication, real-time leaderboards, and a comprehensive REST API with API key authentication.

## Features

- 🎯 **Quiz Management** — Create, edit, and delete quizzes with multiple-choice questions
- 🔐 **OIDC Authentication** — Secure sign-in via OpenID Connect (configurable provider)
- 👑 **Role-Based Access** — Admin permissions based on OIDC groups claim
- 🏆 **Leaderboards** — Per-quiz and global leaderboards with rankings
- ⏱️ **Timed Quizzes** — Optional time limits with timeout tracking
- 🔄 **Randomization** — Shuffle questions for each attempt
- 🔑 **API Keys** — Programmatic access with scoped permissions and rate limiting
- 🌓 **Dark Mode** — System-aware theme switching

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime**: Bun
- **Database**: SQLite with Drizzle ORM
- **Auth**: BetterAuth with OIDC + API Key plugins
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **Validation**: Zod

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/)
- An OIDC provider (e.g., Keycloak, Auth0, Okta, Pocket ID)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd quiz-app

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OIDC Configuration
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret

# Admin Group (users in this OIDC group can manage quizzes and API keys)
OIDC_ADMIN_GROUP=admin
```

### Database Setup

```bash
# Push schema to database (creates SQLite file)
bun run db:push

# Or generate and run migrations
bun run db:generate
bun run db:migrate
```

### Development

```bash
# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## Project Structure

```plaintext
quiz-app/
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
│   └── api/              # REST API endpoints
│       ├── auth/         # BetterAuth handler
│       ├── leaderboard/  # Global leaderboard
│       └── quizzes/      # Quiz CRUD + attempts + leaderboards
├── components/
│   ├── auth/             # Auth components
│   ├── layout/           # Header, theme, pagination
│   ├── quiz/             # Quiz-related components
│   ├── settings/         # API key manager
│   └── ui/               # Reusable UI components
└── lib/
    ├── auth/             # Auth configuration & helpers
    ├── db/               # Database schema & queries
    └── validations/      # Zod schemas
```

## REST API

The Quiz App provides a comprehensive REST API for programmatic access. All endpoints require authentication via API key.

### Authentication

Include your API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your_api_key_here" https://yourapp.com/api/quizzes
```

### API Key Management

Admins can create and manage API keys through the web UI at `/settings`. Each API key can have specific permission scopes:

| Scope | Description |
| ----- | ----------- |
| `quizzes:read` | List and view quizzes, view leaderboards |
| `quizzes:write` | Create, update, and delete quizzes (requires admin role) |
| `attempts:read` | View quiz attempts |
| `attempts:write` | Submit quiz attempts |

### Rate Limiting

API keys are rate-limited to **100 requests per minute** by default. When rate-limited, the API returns a `429 Too Many Requests` response.

---

### Endpoints

#### List Quizzes

```http
GET /api/quizzes
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `page` | number | 1 | Page number |
| `limit` | number | 30 | Items per page (max 100) |

**Required Permission:** `quizzes:read`

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Quiz Title",
      "description": "Quiz description",
      "heroImageUrl": "https://...",
      "authorId": "user-uuid",
      "maxAttempts": 3,
      "timeLimitSeconds": 300,
      "randomizeQuestions": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "questionCount": 10,
      "author": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "totalCount": 50,
  "totalPages": 2,
  "currentPage": 1,
  "hasMore": true
}
```

---

#### Get Quiz

```http
GET /api/quizzes/:id
```

**Required Permission:** `quizzes:read`

**Response:**

```json
{
  "id": "uuid",
  "title": "Quiz Title",
  "description": "Quiz description",
  "heroImageUrl": "https://...",
  "authorId": "user-uuid",
  "maxAttempts": 3,
  "timeLimitSeconds": 300,
  "randomizeQuestions": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "author": { ... },
  "questions": [
    {
      "id": "question-uuid",
      "text": "What is 2 + 2?",
      "imageUrl": null,
      "order": 0,
      "answers": [
        { "id": "answer-uuid", "text": "3", "isCorrect": false },
        { "id": "answer-uuid", "text": "4", "isCorrect": true },
        { "id": "answer-uuid", "text": "5", "isCorrect": false }
      ]
    }
  ]
}
```

---

#### Create Quiz

```http
POST /api/quizzes
```

**Required Permission:** `quizzes:write` + Admin role

**Request Body:**

```json
{
  "title": "My Quiz",
  "description": "A fun quiz about programming",
  "heroImageUrl": "https://example.com/image.jpg",
  "maxAttempts": 3,
  "timeLimitSeconds": 300,
  "randomizeQuestions": true,
  "questions": [
    {
      "text": "What does HTML stand for?",
      "imageUrl": null,
      "answers": [
        { "text": "Hyper Text Markup Language", "isCorrect": true },
        { "text": "High Tech Modern Language", "isCorrect": false },
        { "text": "Home Tool Markup Language", "isCorrect": false }
      ]
    }
  ]
}
```

**Response:** `201 Created` with the created quiz object

---

#### Update Quiz

```http
PUT /api/quizzes/:id
```

**Required Permission:** `quizzes:write` + (Author or Admin)

**Request Body:** Same as Create Quiz

**Response:** Updated quiz object

---

#### Delete Quiz

```http
DELETE /api/quizzes/:id
```

**Required Permission:** `quizzes:write` + (Author or Admin)

**Response:** `204 No Content`

---

#### List Quiz Attempts

```http
GET /api/quizzes/:id/attempts
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `page` | number | 1 | Page number |
| `limit` | number | 30 | Items per page (max 100) |
| `userId` | string | — | Filter by user ID |

**Required Permission:** `attempts:read`

**Response:**

```json
{
  "items": [
    {
      "id": "attempt-uuid",
      "quizId": "quiz-uuid",
      "userId": "user-uuid",
      "correctCount": 8,
      "totalQuestions": 10,
      "totalTimeMs": 120000,
      "timedOut": false,
      "completedAt": "2025-01-01T00:00:00.000Z",
      "user": { ... }
    }
  ],
  "totalCount": 25,
  "totalPages": 1,
  "currentPage": 1,
  "hasMore": false
}
```

---

#### Submit Quiz Attempt

```http
POST /api/quizzes/:id/attempts
```

**Required Permission:** `attempts:write`

**Request Body:**

```json
{
  "answers": [
    { "questionId": "question-uuid", "answerId": "answer-uuid", "displayOrder": 0 },
    { "questionId": "question-uuid", "answerId": "answer-uuid", "displayOrder": 1 }
  ],
  "totalTimeMs": 45000,
  "timedOut": false
}
```

**Response:** `201 Created` with the attempt object including `correctCount`

---

#### Get Quiz Leaderboard

```http
GET /api/quizzes/:id/leaderboard
```

**Query Parameters:**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `page` | number | 1 | Page number |
| `limit` | number | 30 | Items per page (max 100) |

**Required Permission:** `quizzes:read`

**Response:**

```json
{
  "items": [
    {
      "rank": 1,
      "id": "attempt-uuid",
      "quizId": "quiz-uuid",
      "userId": "user-uuid",
      "correctCount": 10,
      "totalQuestions": 10,
      "totalTimeMs": 45000,
      "timedOut": false,
      "completedAt": "2025-01-01T00:00:00.000Z",
      "user": { ... }
    }
  ],
  "totalCount": 100,
  "totalPages": 4,
  "currentPage": 1,
  "hasMore": true
}
```

---

#### Get Global Leaderboard

```http
GET /api/leaderboard
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 30 | Items per page (max 100) |

**Required Permission:** `quizzes:read`

**Response:**

```json
{
  "items": [
    {
      "rank": 1,
      "userId": "user-uuid",
      "totalCorrect": 150,
      "totalTimeMs": 3600000,
      "quizzesPlayed": 15,
      "user": { ... }
    }
  ],
  "totalCount": 500,
  "totalPages": 17,
  "currentPage": 1,
  "hasMore": true
}
```

---

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

| Status Code | Description |
| ----------- | ----------- |
| `400` | Bad Request — Invalid input data |
| `401` | Unauthorized — Missing or invalid API key |
| `403` | Forbidden — Insufficient permissions |
| `404` | Not Found — Resource doesn't exist |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error — Something went wrong |

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start development server with Turbopack |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun test` | Run tests |

## License

MIT

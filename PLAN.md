# Plan: Next.js 16 Quiz App with OIDC & Group-Based Permissions

A server-rendered Next.js 16 app with OIDC auth via BetterAuth's Generic OAuth plugin. SQLite with Drizzle ORM persists users, quizzes, questions, attempts with full answer history. Real-time answer feedback during play, optional time limits, per-quiz and global leaderboards with pagination, group-based permissions for quiz management.

## Steps

1. **Scaffold project & install dependencies**
   - Run `bun create next-app@latest respondeo` with App Router, TypeScript, Tailwind, ESLint
   - Install: `better-auth`, `drizzle-orm`, `next-themes`, `zod`, `lucide-react`
   - Dev deps: `drizzle-kit`, `@types/bun`
   - Run `bunx shadcn@latest init` (New York style, CSS variables)
   - Add components: `button`, `card`, `form`, `input`, `textarea`, `dialog`, `avatar`, `dropdown-menu`, `radio-group`, `progress`, `table`, `badge`, `tabs`, `separator`, `alert`, `skeleton`, `pagination`

2. **Create modular folder structure**

   ```plaintext
   app/
   ├── (auth)/sign-in/page.tsx
   ├── (dashboard)/
   │   ├── layout.tsx
   │   ├── page.tsx                # Quiz list (home)
   │   ├── quiz/
   │   │   ├── new/page.tsx
   │   │   └── [id]/
   │   │       ├── page.tsx        # Detail + leaderboard
   │   │       ├── edit/page.tsx
   │   │       ├── play/page.tsx
   │   │       └── results/page.tsx
   │   └── leaderboard/page.tsx
   ├── api/
   │   ├── auth/[...all]/route.ts
   │   └── quiz/...
   └── layout.tsx
   lib/
   ├── db/
   │   ├── index.ts
   │   ├── schema.ts
   │   └── queries/
   │       ├── quiz.ts             # getQuizzes, getQuizById, etc.
   │       ├── attempt.ts          # getAttempts, getLeaderboard
   │       └── user.ts
   ├── auth/
   │   ├── server.ts
   │   ├── client.ts
   │   └── permissions.ts
   ├── utils.ts
   └── validations/
       ├── quiz.ts
       └── attempt.ts
   app/actions/
   ├── quiz.ts
   └── attempt.ts
   components/
   ├── ui/
   ├── layout/
   │   ├── header.tsx
   │   ├── theme-toggle.tsx
   │   └── pagination-controls.tsx
   ├── auth/
   │   └── user-button.tsx
   └── quiz/
       ├── quiz-card.tsx
       ├── quiz-form.tsx
       ├── question-field.tsx
       ├── quiz-player.tsx
       ├── answer-feedback.tsx
       ├── timer-display.tsx
       ├── quiz-leaderboard.tsx
       └── global-leaderboard.tsx
   ```

3. **Define Drizzle schema with relations** — `lib/db/schema.ts`:
   - **user**: `id` (TEXT PK = OIDC `sub`), `email`, `emailVerified` (BOOLEAN), `displayName`, `givenName`, `familyName`, `preferredUsername`, `image`, `groups` (TEXT JSON array), `createdAt`, `updatedAt`
   - **quiz**: `id` (TEXT PK UUID), `title`, `description`, `heroImageUrl` (nullable), `authorId` FK→user, `maxAttempts` (INTEGER DEFAULT 1), `timeLimitSeconds` (INTEGER DEFAULT 0, 0=unlimited), `randomizeQuestions` (BOOLEAN DEFAULT true), `createdAt`, `updatedAt`
   - **question**: `id` (TEXT PK), `quizId` FK→quiz CASCADE, `text`, `imageUrl` (nullable), `order` (INTEGER)
   - **answer**: `id` (TEXT PK), `questionId` FK→question CASCADE, `text`, `isCorrect` (BOOLEAN)
   - **quiz_attempt**: `id` (TEXT PK), `quizId` FK→quiz, `userId` FK→user, `correctCount` (INTEGER), `totalQuestions` (INTEGER), `totalTimeMs` (INTEGER), `timedOut` (BOOLEAN DEFAULT false), `completedAt` (TIMESTAMP)
   - **attempt_answer**: `id`, `attemptId` FK→quiz_attempt CASCADE, `questionId` FK→question, `answerId` FK→answer (nullable, null if timed out before answering), `isCorrect` (BOOLEAN), `displayOrder` (INTEGER)
   - Define Drizzle `relations()` for all FK relationships

4. **Configure BetterAuth with Generic OAuth** — `lib/auth/server.ts`:

   ```ts
   import { betterAuth } from "better-auth";
   import { drizzleAdapter } from "better-auth/adapters/drizzle";
   import { genericOAuth } from "better-auth/plugins";
   import { db } from "@/lib/db";

   export const auth = betterAuth({
     database: drizzleAdapter(db, { provider: "sqlite" }),
     plugins: [
       genericOAuth({
         config: [
           {
             providerId: process.env.OIDC_PROVIDER_ID!,
             discoveryUrl: `${process.env.OIDC_ISSUER!}/.well-known/openid-configuration`,
             clientId: process.env.OIDC_CLIENT_ID!,
             clientSecret: process.env.OIDC_CLIENT_SECRET!,
             scopes: ["openid", "profile", "email", "groups"],
             pkce: true,
             mapProfileToUser: (profile) => ({
               displayName: profile.display_name,
               givenName: profile.given_name,
               familyName: profile.family_name,
               preferredUsername: profile.preferred_username,
               groups: JSON.stringify(profile.groups ?? []),
             }),
           },
         ],
       }),
     ],
     user: {
       additionalFields: {
         displayName: { type: "string", required: false },
         givenName: { type: "string", required: false },
         familyName: { type: "string", required: false },
         preferredUsername: { type: "string", required: false },
         groups: { type: "string", required: false },
       },
     },
   });
   ```

5. **Build auth utilities & middleware**:
   - `lib/auth/permissions.ts`:

     ```ts
     export function canManageQuizzes(user: { groups?: string | null }): boolean {
       if (!user.groups) return false;
       const groups: string[] = JSON.parse(user.groups);
       return groups.includes(process.env.OIDC_ADMIN_GROUP ?? "admin");
     }
     ```

   - `middleware.ts`: Protect `/(dashboard)/:path*`, call `auth.api.getSession({ headers })`, redirect to `/sign-in` if no session

6. **Implement pages & components**:
   - **Root layout**: `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`
   - **Dashboard layout**: Fetch session, render `Header` (logo, Home/Leaderboard nav, `ThemeToggle`, `UserButton`)
   - **Home page**: Server Component with `searchParams.page`, fetch 30 quizzes offset by page, render `QuizCard` grid + `PaginationControls`. Show "Create Quiz" button if `canManageQuizzes`.
   - **Quiz detail**: Fetch quiz + question count + top 30 leaderboard entries (correctCount DESC, totalTimeMs ASC) with pagination. Show user's attempt count vs maxAttempts. Display time limit if set. "Start Quiz" disabled if attempts exhausted. Edit/Delete for author/admin.
   - **Create/Edit quiz**: `QuizForm` client component — title, description, heroImageUrl (URL input), maxAttempts (number input), timeLimitSeconds (number input, 0=unlimited), randomizeQuestions (switch). Dynamic `QuestionField` array: question text, imageUrl, answers with isCorrect radio. Submit via Server Action.
   - **Play page**: Server Component checks attempts remaining, fetches questions (shuffle if enabled), assigns `displayOrder`. Renders `QuizPlayer` client component:
     - `TimerDisplay` counts up (or down if timeLimit > 0)
     - Shows one question at a time
     - User selects answer, clicks "Confirm" → `AnswerFeedback` shows immediately (correct/incorrect + right answer)
     - If timer hits limit → auto-submit with `timedOut: true`, unanswered questions marked null
     - On complete → `submitQuizAttempt` Server Action → redirect to results
   - **Results page**: Fetch attempt + attemptAnswers (ordered by displayOrder) with joined questions/answers. Show score, time, timedOut badge if applicable. List each question with user's answer, correct answer, ✓/✗ indicator.
   - **Global leaderboard**: Aggregate `SUM(correctCount)` as totalCorrect, `SUM(totalTimeMs)` as totalTime per user, ORDER BY totalCorrect DESC, totalTime ASC. Paginate 30 per page. Join user for displayName + image.

7. **Implement Server Actions**:
   - `app/actions/quiz.ts`:
     - `createQuiz(formData)`: Zod validate, check `canManageQuizzes`, transaction: insert quiz → questions → answers, revalidatePath, redirect
     - `updateQuiz(quizId, formData)`: Validate, check author or admin, transaction: update quiz, delete old questions (CASCADE), insert new, revalidate
     - `deleteQuiz(quizId)`: Check author or admin, delete quiz (CASCADE), revalidatePath("/"), redirect
   - `app/actions/attempt.ts`:
     - `submitQuizAttempt({ quizId, answers: {questionId, answerId, displayOrder}[], totalTimeMs, timedOut })`:
       - Validate attempt count < maxAttempts
       - Calculate correctCount by joining answerId with answer.isCorrect
       - Insert quiz_attempt + attempt_answer rows
       - revalidatePath(`/quiz/${quizId}`)
       - Return attemptId for redirect

8. **Implement pagination utility** — `lib/db/queries/`:
   - Reusable pattern: `getQuizzes(page, limit=30)` returns `{ items, totalCount, totalPages, currentPage }`
   - `PaginationControls` component accepts totalPages + currentPage, renders shadcn pagination with prev/next + page numbers, updates URL searchParams

## Environment Variables

```env
# Auth
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:3000
OIDC_PROVIDER_ID=provider-name
OIDC_CLIENT_ID=1d65d35e-2832-4778-a2be-18eb72ba8ee2
OIDC_CLIENT_SECRET=<your client secret>
OIDC_ADMIN_GROUP=admin

# Database
DATABASE_URL=./quiz.db
```

## Package.json Scripts

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "test": "bun test"
}
```

## drizzle.config.ts

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./quiz.db",
  },
});
```

---

This plan is ready for implementation. All requirements are addressed: OIDC authentication with groups, group-based quiz management permissions, configurable attempts and time limits, question randomization, immediate answer feedback, full attempt history with displayOrder, per-quiz and global leaderboards, and pagination (30 items). Shall I proceed to implementation mode?

# Drizzle ORM Nested Relational Query Bug

## Issue Summary

When using drizzle-orm v0.45.1 with PostgreSQL, nested relational queries (`with` inside `with`) generate invalid SQL syntax, causing a runtime error.

## Error Message

```plaintext
Error: Failed query: select ... from ("quiz_questions_answers") "quiz_questions_answers" ...
error: syntax error at or near ")"
```

The bug causes drizzle to generate `from ("table_alias")` instead of a proper subquery like `from (select * from "table" ...) "table_alias"`.

## Affected Code Pattern

This pattern triggers the bug:

```typescript
// ❌ This causes the bug in PostgreSQL
const quizData = await db.query.quiz.findFirst({
  where: eq(quiz.id, quizId),
  with: {
    author: true,
    questions: {
      with: {
        answers: true, // <-- Nested "with" causes invalid SQL
      },
    },
  },
});
```

## Workaround Applied

We rewrote the queries to avoid nested `with` by fetching data in multiple queries:

```typescript
// ✅ Workaround: Fetch in separate queries
const quizData = await db.query.quiz.findFirst({
  where: eq(quiz.id, quizId),
  with: {
    author: true,
  },
});

// Fetch questions separately
const questions = await db
  .select()
  .from(question)
  .where(eq(question.quizId, quizId))
  .orderBy(asc(question.order));

// Fetch answers and combine in JavaScript
const questionIds = questions.map((q) => q.id);
const answers = await db
  .select()
  .from(answer)
  .where(sql`${answer.questionId} IN ${questionIds}`);

// Group and combine results...
```

## Affected Files

The following files contain workarounds for this bug:

- `lib/db/queries/quiz.ts` - `getQuizById()` and `getAttemptById()`
- `app/actions/attempt.ts` - `submitQuizAttempt()`
- `app/api/quizzes/[id]/attempts/route.ts` - POST handler

Search for this comment to find all workarounds:

```plaintext
// Note: Uses multiple queries to work around drizzle-orm PostgreSQL syntax bug
```

## When to Fix

- **Current version**: drizzle-orm v0.45.1
- **Expected fix**: drizzle-orm v1.0.0 (RQBv2 - Relational Query Builder v2)

The 1.0.0-beta releases include a completely rewritten Relational Query Builder (RQBv2) that should resolve this issue.

## How to Fix

Once drizzle-orm 1.0.0 is released:

- [ ] Update drizzle-orm: `bun add drizzle-orm@latest`
- [ ] Follow the RQBv1 to RQBv2 migration guide: [https://orm.drizzle.team/docs/relations-v1-v2](https://orm.drizzle.team/docs/relations-v1-v2)
- [ ] Revert the workarounds to use nested `with` queries
- [ ] Test thoroughly with PostgreSQL
- [ ] Delete this file

## References

- drizzle-orm releases: [https://github.com/drizzle-team/drizzle-orm/releases](https://github.com/drizzle-team/drizzle-orm/releases)
- RQBv2 migration guide: [https://orm.drizzle.team/docs/relations-v1-v2](https://orm.drizzle.team/docs/relations-v1-v2)
- RQBv2 docs: [https://orm.drizzle.team/docs/rqb-v2](https://orm.drizzle.team/docs/rqb-v2)

## Date Discovered

December 30, 2025

import { cache } from "react";
import { db } from "@/lib/db";
import { quiz, quizAttempt, user, question, answer } from "@/lib/db/schema";
import type { Quiz, Question, Answer, User, QuizAttempt, AttemptAnswer } from "@/lib/db/schema";
import { eq, desc, count, sql, and, or, lte, isNull, asc } from "drizzle-orm";
import { cachedFetch, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export const ITEMS_PER_PAGE = 30;

// Type for quiz with nested relations
export type QuizWithRelations = Quiz & {
  author: User;
  questions: (Question & {
    answers: Answer[];
  })[];
};

// Type for quiz attempt with nested relations
export type AttemptWithRelations = QuizAttempt & {
  quiz: Quiz;
  user: User;
  answers: (AttemptAnswer & {
    question: Question & {
      answers: Answer[];
    };
    answer: Answer | null;
  })[];
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}

/**
 * Get paginated quizzes ordered by creation date (newest first)
 * If isAdmin is false, only shows quizzes where publishedAt is null or in the past
 * Results are cached in Redis for improved performance.
 */
export async function getQuizzes(
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
  isAdmin: boolean = false,
): Promise<
  PaginatedResult<
    typeof quiz.$inferSelect & { questionCount: number; author: typeof user.$inferSelect | null }
  >
> {
  const cacheKey = `${CACHE_KEYS.QUIZ_LIST}:${isAdmin ? "admin" : "public"}:${page}:${limit}`;

  return cachedFetch(cacheKey, CACHE_TTL.QUIZ_LIST, async () => {
    const offset = (page - 1) * limit;

    // Build where clause for non-admins: only show published quizzes
    const publishedFilter = isAdmin
      ? undefined
      : or(isNull(quiz.publishedAt), lte(quiz.publishedAt, new Date()));

    // Get total count
    const [{ total }] = await db.select({ total: count() }).from(quiz).where(publishedFilter);

    // Get quizzes with question count and author
    const quizzes = await db
      .select({
        quiz: quiz,
        questionCount: sql<number>`(SELECT COUNT(*) FROM question WHERE question.quiz_id = ${quiz.id})`,
        author: user,
      })
      .from(quiz)
      .leftJoin(user, eq(quiz.authorId, user.id))
      .where(publishedFilter)
      .orderBy(desc(quiz.createdAt))
      .limit(limit)
      .offset(offset);

    const items = quizzes.map((q) => ({
      ...q.quiz,
      questionCount: q.questionCount,
      author: q.author,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      totalCount: total,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    };
  });
}

/**
 * Get a single quiz by ID with all questions and answers
 * Note: Uses standard queries instead of nested relational queries
 * to work around a drizzle-orm bug with PostgreSQL (syntax error in lateral joins)
 * Results are cached in Redis for improved performance.
 */
export async function getQuizById(quizId: string): Promise<QuizWithRelations | undefined> {
  const cacheKey = `${CACHE_KEYS.QUIZ_DETAIL}:${quizId}`;

  return cachedFetch(cacheKey, CACHE_TTL.QUIZ_DETAIL, async () => {
    // Fetch quiz with author
    const quizData = await db.query.quiz.findFirst({
      where: eq(quiz.id, quizId),
      with: {
        author: true,
      },
    });

    if (!quizData) {
      return undefined;
    }

    // Fetch questions separately
    const questions = await db
      .select()
      .from(question)
      .where(eq(question.quizId, quizId))
      .orderBy(asc(question.order));

    // Fetch all answers for these questions in one query
    const questionIds = questions.map((q: Question) => q.id);
    const answers =
      questionIds.length > 0
        ? await db
            .select()
            .from(answer)
            .where(sql`${answer.questionId} IN ${questionIds}`)
        : [];

    // Group answers by question ID
    const answersByQuestionId = answers.reduce(
      (acc: Record<string, Answer[]>, a: Answer) => {
        if (!acc[a.questionId]) {
          acc[a.questionId] = [];
        }
        acc[a.questionId].push(a);
        return acc;
      },
      {} as Record<string, Answer[]>,
    );

    // Combine questions with their answers
    const questionsWithAnswers = questions.map((q: Question) => ({
      ...q,
      answers: answersByQuestionId[q.id] || [],
    }));

    return {
      ...quizData,
      questions: questionsWithAnswers,
    } as QuizWithRelations;
  });
}

/**
 * Get quiz leaderboard (per-quiz)
 * Results are cached in Redis for improved performance.
 */
export async function getQuizLeaderboard(
  quizId: string,
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
) {
  const cacheKey = `${CACHE_KEYS.LEADERBOARD}:${quizId}:${page}:${limit}`;

  return cachedFetch(cacheKey, CACHE_TTL.LEADERBOARD, async () => {
    const offset = (page - 1) * limit;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(quizAttempt)
      .where(eq(quizAttempt.quizId, quizId));

    // Get leaderboard entries
    const entries = await db
      .select({
        attempt: quizAttempt,
        user: user,
      })
      .from(quizAttempt)
      .innerJoin(user, eq(quizAttempt.userId, user.id))
      .where(eq(quizAttempt.quizId, quizId))
      .orderBy(desc(quizAttempt.correctCount), quizAttempt.totalTimeMs)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      items: entries.map((e: { attempt: QuizAttempt; user: User }, index: number) => ({
        rank: offset + index + 1,
        attemptId: e.attempt.id,
        ...e.attempt,
        user: e.user,
      })),
      totalCount: total,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    };
  });
}

/**
 * Get global leaderboard (sum of correct answers across all quizzes)
 * This is the most expensive query - aggregates across all attempts.
 * Results are cached in Redis for improved performance.
 */
export async function getGlobalLeaderboard(page: number = 1, limit: number = ITEMS_PER_PAGE) {
  const cacheKey = `${CACHE_KEYS.GLOBAL_LEADERBOARD}:${page}:${limit}`;

  return cachedFetch(cacheKey, CACHE_TTL.GLOBAL_LEADERBOARD, async () => {
    const offset = (page - 1) * limit;

    // Get total unique users with attempts
    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${quizAttempt.userId})` })
      .from(quizAttempt);

    // Get aggregated leaderboard
    const entries = await db
      .select({
        userId: quizAttempt.userId,
        totalCorrect: sql<number>`SUM(${quizAttempt.correctCount})`,
        totalTimeMs: sql<number>`SUM(${quizAttempt.totalTimeMs})`,
        quizzesPlayed: sql<number>`COUNT(DISTINCT ${quizAttempt.quizId})`,
        user: user,
      })
      .from(quizAttempt)
      .innerJoin(user, eq(quizAttempt.userId, user.id))
      .groupBy(quizAttempt.userId, user.id)
      .orderBy(sql`SUM(${quizAttempt.correctCount}) DESC`, sql`SUM(${quizAttempt.totalTimeMs}) ASC`)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      items: entries.map(
        (
          e: {
            userId: string;
            totalCorrect: number;
            totalTimeMs: number;
            quizzesPlayed: number;
            user: User;
          },
          index: number,
        ) => ({
          rank: offset + index + 1,
          userId: e.userId,
          totalCorrect: e.totalCorrect,
          totalTimeMs: e.totalTimeMs,
          quizzesPlayed: e.quizzesPlayed,
          user: e.user,
        }),
      ),
      totalCount: total,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    };
  });
}

/**
 * Get user's attempt count for a specific quiz
 */
export async function getUserAttemptCount(quizId: string, userId: string): Promise<number> {
  const [{ attemptCount }] = await db
    .select({ attemptCount: count() })
    .from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, quizId), eq(quizAttempt.userId, userId)));

  return attemptCount;
}

/**
 * Get a specific attempt with all answers
 * Note: Uses multiple queries to work around drizzle-orm PostgreSQL syntax bug
 */
export async function getAttemptById(attemptId: string): Promise<AttemptWithRelations | undefined> {
  // Fetch attempt with quiz, user, and attemptAnswers with their related answer
  const attempt = await db.query.quizAttempt.findFirst({
    where: eq(quizAttempt.id, attemptId),
    with: {
      quiz: true,
      user: true,
      answers: {
        with: {
          answer: true,
        },
        orderBy: (answers, { asc: ascFn }) => [ascFn(answers.displayOrder)],
      },
    },
  });

  if (!attempt) {
    return undefined;
  }

  // Fetch questions with answers separately
  const questionIds = attempt.answers.map((a: { questionId: string }) => a.questionId);
  const questions =
    questionIds.length > 0
      ? await db
          .select()
          .from(question)
          .where(sql`${question.id} IN ${questionIds}`)
      : [];

  // Fetch all answers for these questions
  const allAnswers =
    questionIds.length > 0
      ? await db
          .select()
          .from(answer)
          .where(sql`${answer.questionId} IN ${questionIds}`)
      : [];

  // Group answers by question ID
  const answersByQuestionId = allAnswers.reduce(
    (acc: Record<string, Answer[]>, a: Answer) => {
      if (!acc[a.questionId]) {
        acc[a.questionId] = [];
      }
      acc[a.questionId].push(a);
      return acc;
    },
    {} as Record<string, Answer[]>,
  );

  // Build questions with answers map
  const questionsWithAnswers = questions.reduce(
    (acc: Record<string, Question & { answers: Answer[] }>, q: Question) => {
      acc[q.id] = {
        ...q,
        answers: answersByQuestionId[q.id] || [],
      };
      return acc;
    },
    {} as Record<string, Question & { answers: Answer[] }>,
  );

  // Combine attempt answers with their questions
  const enrichedAnswers = attempt.answers.map(
    (a: { questionId: string; answer: Answer | null }) => ({
      ...a,
      question: questionsWithAnswers[a.questionId] || null,
    }),
  );

  return {
    ...attempt,
    answers: enrichedAnswers,
  } as AttemptWithRelations;
}

// ============================================================================
// Memoized Query Wrappers (for OG image generation + generateMetadata)
// These use React's cache() to deduplicate requests within the same render pass.
// They also catch errors during build phase (when database is unavailable).
// ============================================================================

// Check if we're in build phase (no database available)
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL;

/**
 * Memoized version of getQuizById - shares data between generateMetadata and OG image
 */
export const getCachedQuizById = cache(async (quizId: string) => {
  try {
    return await getQuizById(quizId);
  } catch (error) {
    if (isBuildPhase) return undefined;
    throw error;
  }
});

/**
 * Memoized version of getQuizLeaderboard - shares data between page and OG image
 */
export const getCachedQuizLeaderboard = cache(
  async (quizId: string, page: number = 1, limit: number = ITEMS_PER_PAGE) => {
    try {
      return await getQuizLeaderboard(quizId, page, limit);
    } catch (error) {
      if (isBuildPhase) return undefined;
      throw error;
    }
  },
);

/**
 * Memoized version of getGlobalLeaderboard - shares data between page and OG image
 */
export const getCachedGlobalLeaderboard = cache(
  async (page: number = 1, limit: number = ITEMS_PER_PAGE) => {
    try {
      return await getGlobalLeaderboard(page, limit);
    } catch (error) {
      if (isBuildPhase) return undefined;
      throw error;
    }
  },
);

/**
 * Memoized version of getAttemptById - shares data between page and OG image
 */
export const getCachedAttemptById = cache(async (attemptId: string) => {
  try {
    return await getAttemptById(attemptId);
  } catch (error) {
    if (isBuildPhase) return undefined;
    throw error;
  }
});

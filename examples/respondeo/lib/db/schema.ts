import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, asc, desc } from "drizzle-orm";

// ============================================================================
// User Table (extended by BetterAuth)
// ============================================================================
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  name: text("name"),
  image: text("image"),
  displayName: text("display_name"),
  givenName: text("given_name"),
  familyName: text("family_name"),
  preferredUsername: text("preferred_username"),
  groups: text("groups"), // JSON array string
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// BetterAuth Session Table
// ============================================================================
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

// ============================================================================
// BetterAuth Account Table
// ============================================================================
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // better-auth >= 1.7 keys an external identity on (issuer, accountId)
    // rather than (providerId, accountId), so a provider that changes its ID
    // keeps its users and two providers cannot claim the same subject.
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_issuer_account_id_idx").on(table.issuer, table.accountId),
  ],
);

// ============================================================================
// BetterAuth Verification Table
// ============================================================================
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// BetterAuth API Key Table
// ============================================================================
export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(60000),
    rateLimitMax: integer("rate_limit_max").default(100),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [index("apikey_reference_id_idx").on(table.referenceId)],
);

// ============================================================================
// Quiz Table
// ============================================================================
export const quiz = pgTable(
  "quiz",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    heroImageUrl: text("hero_image_url"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    language: text("language").notNull().default("en"), // ISO 639-1 code
    difficulty: text("difficulty").notNull().default("medium"), // easy, medium, hard
    maxAttempts: integer("max_attempts").notNull().default(1),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(0), // 0 = unlimited
    randomizeQuestions: boolean("randomize_questions").notNull().default(true),
    randomizeAnswers: boolean("randomize_answers").notNull().default(true),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // getQuizzes filters on publishedAt and orders by createdAt desc.
    index("quiz_author_id_idx").on(table.authorId),
    index("quiz_published_at_idx").on(table.publishedAt),
    index("quiz_created_at_idx").on(table.createdAt),
  ],
);

// ============================================================================
// Question Table
// ============================================================================
export const question = pgTable(
  "question",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    order: integer("order").notNull(),
  },
  (table) => [
    // Every quiz read fetches questions by quizId ordered by order.
    index("question_quiz_id_order_idx").on(table.quizId, table.order),
  ],
);

// ============================================================================
// Answer Table
// ============================================================================
export const answer = pgTable(
  "answer",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questionId: uuid("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (table) => [index("answer_question_id_idx").on(table.questionId)],
);

// ============================================================================
// Quiz Attempt Table
// ============================================================================
export const quizAttempt = pgTable(
  "quiz_attempt",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    correctCount: integer("correct_count").notNull().default(0),
    totalQuestions: integer("total_questions").notNull(),
    totalTimeMs: integer("total_time_ms").notNull(),
    timedOut: boolean("timed_out").notNull().default(false),
    completedAt: timestamp("completed_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // getUserAttemptCount is uncached and runs on the hottest path.
    index("quiz_attempt_quiz_id_user_id_idx").on(table.quizId, table.userId),
    index("quiz_attempt_user_id_idx").on(table.userId),
    // Matches getQuizLeaderboard's ORDER BY correct_count DESC, total_time_ms
    // ASC exactly, so the sort is served straight from the index rather than
    // needing a separate sort step.
    index("quiz_attempt_quiz_id_score_idx").on(
      table.quizId,
      desc(table.correctCount),
      asc(table.totalTimeMs),
    ),
    index("quiz_attempt_completed_at_idx").on(table.completedAt),
  ],
);

// ============================================================================
// Attempt Answer Table (stores each answer for results review)
// ============================================================================
export const attemptAnswer = pgTable(
  "attempt_answer",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempt.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id").references(() => answer.id, { onDelete: "set null" }), // null if timed out
    isCorrect: boolean("is_correct").notNull().default(false),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => [
    index("attempt_answer_attempt_id_idx").on(table.attemptId),
    // Also the index a future per-question analytics GROUP BY would need.
    index("attempt_answer_question_id_idx").on(table.questionId),
    index("attempt_answer_answer_id_idx").on(table.answerId),
  ],
);

// ============================================================================
// Relations
// ============================================================================
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  apikeys: many(apikey),
  quizzes: many(quiz),
  attempts: many(quizAttempt),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.referenceId],
    references: [user.id],
  }),
}));

export const quizRelations = relations(quiz, ({ one, many }) => ({
  author: one(user, {
    fields: [quiz.authorId],
    references: [user.id],
  }),
  questions: many(question),
  attempts: many(quizAttempt),
}));

export const questionRelations = relations(question, ({ one, many }) => ({
  quiz: one(quiz, {
    fields: [question.quizId],
    references: [quiz.id],
  }),
  answers: many(answer),
  attemptAnswers: many(attemptAnswer),
}));

export const answerRelations = relations(answer, ({ one }) => ({
  question: one(question, {
    fields: [answer.questionId],
    references: [question.id],
  }),
}));

export const quizAttemptRelations = relations(quizAttempt, ({ one, many }) => ({
  quiz: one(quiz, {
    fields: [quizAttempt.quizId],
    references: [quiz.id],
  }),
  user: one(user, {
    fields: [quizAttempt.userId],
    references: [user.id],
  }),
  answers: many(attemptAnswer),
}));

export const attemptAnswerRelations = relations(attemptAnswer, ({ one }) => ({
  attempt: one(quizAttempt, {
    fields: [attemptAnswer.attemptId],
    references: [quizAttempt.id],
  }),
  question: one(question, {
    fields: [attemptAnswer.questionId],
    references: [question.id],
  }),
  answer: one(answer, {
    fields: [attemptAnswer.answerId],
    references: [answer.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Quiz = typeof quiz.$inferSelect;
export type NewQuiz = typeof quiz.$inferInsert;
export type Question = typeof question.$inferSelect;
export type NewQuestion = typeof question.$inferInsert;
export type Answer = typeof answer.$inferSelect;
export type NewAnswer = typeof answer.$inferInsert;
export type QuizAttempt = typeof quizAttempt.$inferSelect;
export type NewQuizAttempt = typeof quizAttempt.$inferInsert;
export type AttemptAnswer = typeof attemptAnswer.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswer.$inferInsert;

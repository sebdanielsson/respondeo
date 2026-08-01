import { z } from "zod";
import { MAX_QUESTIONS_PER_QUIZ } from "./quiz";

/**
 * Validation for a submitted quiz attempt.
 *
 * Shared by both submission paths — the `submitQuizAttempt` server action and
 * `POST /api/quizzes/[id]/attempts`. The action previously took its input as a
 * bare TypeScript interface and parsed nothing, so a server action invoked with
 * a hand-built payload reached the database unvalidated; only the API route
 * checked anything. Types are erased at runtime and server actions are a public
 * HTTP surface, so both need the same runtime check.
 *
 * `quizId` is deliberately not part of this schema: the API route takes it from
 * the route parameter, and the action validates it separately.
 */
export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid("questionId must be a UUID"),
        answerId: z.union([z.uuid(), z.literal("")]),
        displayOrder: z.number().int().min(0),
      }),
    )
    // quizSchema caps a quiz at this many questions, so a larger submission is
    // never legitimate. Bounds the work grading does on untrusted input.
    .max(MAX_QUESTIONS_PER_QUIZ, "Too many answers submitted"),
  totalTimeMs: z.number().int().min(0),
  timedOut: z.boolean().default(false),
  /**
   * Server-issued start stamp. When present the server derives the duration
   * from it and ignores totalTimeMs/timedOut above; see lib/quiz/attempt-token.
   */
  startToken: z.string().max(512).optional(),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/** The same payload plus the quiz id, as the server action receives it. */
export const submitAttemptActionSchema = submitAttemptSchema.extend({
  quizId: z.uuid("quizId must be a UUID"),
});

export type SubmitAttemptActionInput = z.infer<typeof submitAttemptActionSchema>;

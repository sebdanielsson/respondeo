/**
 * AI Quiz Generation Validation
 *
 * Zod schemas for AI quiz generation input and output.
 * Used with AI SDK's generateObject for structured output.
 */

import { z } from "zod";
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS } from "./quiz";

// ============================================================================
// Input Schema (what the user provides)
// ============================================================================

export const aiQuizInputSchema = z.object({
  /** The theme/topic for the quiz */
  theme: z.string().min(1, "Theme is required").max(500, "Theme is too long"),
  /** Number of questions to generate (1-20) */
  questionCount: z.coerce.number().int().min(1).max(20).default(10),
  /** Number of answers per question (2-6) */
  answerCount: z.coerce.number().int().min(2).max(6).default(4),
  /** Difficulty level */
  difficulty: z.enum(DIFFICULTY_LEVELS).default("medium"),
  /** Language code (ISO 639-1) */
  language: z.string().min(2).max(10).default("en"),
});

export type AIQuizInput = z.infer<typeof aiQuizInputSchema>;

// ============================================================================
// Output Schema (what the AI generates)
// ============================================================================

/**
 * Schema for a single AI-generated answer.
 */
export const aiAnswerSchema = z.object({
  text: z.string().describe("The answer text"),
  isCorrect: z.boolean().describe("Whether this is the correct answer (exactly one per question)"),
});

/**
 * Schema for a single AI-generated question.
 */
export const aiQuestionSchema = z.object({
  text: z.string().describe("The question text"),
  answers: z.array(aiAnswerSchema).describe("The answer options for this question"),
});

/**
 * Schema for the complete AI-generated quiz.
 * This is what the AI returns via generateObject.
 */
export const aiQuizOutputSchema = z.object({
  title: z.string().max(200).describe("A catchy, descriptive title for the quiz (max 200 chars)"),
  description: z
    .string()
    .max(1000)
    .describe("A brief description of what the quiz covers (max 1000 chars)"),
  questions: z.array(aiQuestionSchema).describe("The quiz questions"),
});

export type AIQuizOutput = z.infer<typeof aiQuizOutputSchema>;

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Get the language name from ISO 639-1 code.
 */
function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return lang?.name ?? "English";
}

/**
 * Get difficulty-specific prompt guidance.
 */
function getDifficultyGuidance(difficulty: AIQuizInput["difficulty"]): string {
  switch (difficulty) {
    case "easy":
      return `
- Questions should be straightforward and factual
- Wrong answers should be clearly incorrect to someone with basic knowledge
- Avoid trick questions or nuanced distinctions
- Focus on well-known facts and common knowledge`;
    case "medium":
      return `
- Questions should require some knowledge of the subject
- Wrong answers should be plausible but distinguishable with moderate knowledge
- Include a mix of factual and application questions
- Test understanding rather than just recall`;
    case "hard":
      return `
- Questions should be challenging and require deep knowledge
- Wrong answers should be very plausible, requiring careful consideration
- Include nuanced distinctions and edge cases
- Test expert-level understanding and critical thinking`;
  }
}

/**
 * Generate the AI prompt for quiz generation.
 */
export function generateQuizPrompt(input: AIQuizInput): string {
  const languageName = getLanguageName(input.language);
  const difficultyGuidance = getDifficultyGuidance(input.difficulty);

  return `Generate a ${input.difficulty} difficulty quiz about: "${input.theme}"

Requirements:
- Generate exactly ${input.questionCount} questions
- Each question must have exactly ${input.answerCount} answer options
- Exactly ONE answer per question must be marked as correct (isCorrect: true)
- All content must be in ${languageName}
- You may use any characters required for ${languageName}, but avoid emojis, EM dashes, novelty symbols, and smart quotes; use plain text punctuation
- Title should be catchy and descriptive (max 200 characters)
- Description should summarize what the quiz covers (max 1000 characters)

Difficulty Guidelines (${input.difficulty}):${difficultyGuidance}

Important:
- Ensure factual accuracy
- Questions should be clear and unambiguous
- Answers should be distinct from each other
- Avoid overly long questions or answers`;
}

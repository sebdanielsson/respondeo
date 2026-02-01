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

export const aiQuizInputSchema = z
  .object({
    /** The theme/topic for the quiz */
    theme: z
      .string()
      .min(1, "Theme is required")
      .max(2000, "Theme is too long (max 2000 characters)"),
    /** Number of questions to generate (1-20) */
    questionCount: z.coerce.number().int().min(1).max(20).default(10),
    /** Number of answers per question (2-6) */
    answerCount: z.coerce.number().int().min(2).max(6).default(4),
    /** Difficulty level */
    difficulty: z.enum(DIFFICULTY_LEVELS).default("medium"),
    /** Language code (ISO 639-1) */
    language: z.string().min(2).max(10).default("en"),
    /** Whether to use web search for up-to-date information */
    useWebSearch: z.boolean().default(true),
    /** Optional base64-encoded images to include with the prompt (PNG, JPEG, WEBP) */
    images: z
      .array(
        z
          .string()
          .regex(/^[A-Za-z0-9+/]+=*$/, "Invalid base64 format")
          .max(
            Math.ceil(5 * 1024 * 1024 * (4 / 3)),
            "Image is too large (max ~6.67MB base64 ≈ 5MB raw)",
          ),
      )
      .max(4)
      .optional(),
    /** MIME types corresponding to images array */
    imageMimeTypes: z
      .array(z.enum(["image/png", "image/jpeg", "image/webp"]))
      .max(4)
      .optional(),
  })
  .refine(
    (data) => {
      // Both arrays must be provided together and have matching lengths
      const imagesLength = data.images?.length ?? 0;
      const mimeTypesLength = data.imageMimeTypes?.length ?? 0;
      return imagesLength === mimeTypesLength;
    },
    {
      message: "Number of images and MIME types must match",
      path: ["imageMimeTypes"],
    },
  );

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
  title: z.string().max(70).describe("A catchy, descriptive title for the quiz (max 70 chars)"),
  description: z
    .string()
    .max(120)
    .describe("A brief description of what the quiz covers (max 120 chars)"),
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
 * Generate the AI prompt for quiz generation.
 */
export function generateQuizPrompt(input: AIQuizInput, useWebSearch: boolean = false): string {
  const languageName = getLanguageName(input.language);
  const difficultyGuidance = getDifficultyGuidance(input.difficulty);
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const webSearchContext = useWebSearch
    ? `\n\nWeb Search Available:\n- Today's date is ${currentDate}\n- Use web search to find current and accurate information about the topic\n- For recent events, new releases, or topics after your knowledge cutoff, search for up-to-date information\n- Include recent developments or news when relevant to the theme`
    : `\n\nNote: Today's date is ${currentDate}. Base your questions on your training knowledge.`;

  const hasImages = input.images && input.images.length > 0;
  const imageCount = input.images?.length ?? 0;
  const imageContext = hasImages
    ? `\n\nImage Context:\n- ${imageCount} image(s) have been provided for reference and context only\n- Use the images to understand the theme, subject matter, and context better to generate more relevant questions\n- IMPORTANT: Distinguish between metadata/context (headers, titles, labels, dates, metadata) and actual content\n- Do NOT create questions about metadata, headers, or contextual information visible in the images (e.g., assignment labels, week numbers, administrative details)\n- Do NOT reference visual elements, specific visual layouts, or text that only appears in the images\n- Questions must be answerable using only the substantive text content - users will not have access to the images when taking the quiz`
    : "";

  return `Generate a ${input.difficulty} difficulty quiz about: "${input.theme}"${webSearchContext}${imageContext}

Requirements:
- Generate exactly ${input.questionCount} questions
- Each question must have exactly ${input.answerCount} answer options
- Exactly ONE answer per question must be marked as correct (isCorrect: true)
- All content must be in ${languageName}
- You may use any characters required for ${languageName}, but avoid emojis, EM dashes, novelty symbols, and smart quotes; use plain text punctuation
- Title should be catchy and descriptive (max 70 characters)
- Description should summarize what the quiz covers (max 120 characters)
- Do not include properties like "language" or "difficulty" in title or description, do not spoil answers there

Difficulty Guidelines (${input.difficulty}):${difficultyGuidance}

Important:
- Ensure factual accuracy
- Questions should be clear and unambiguous
- Answers should be distinct from each other
- Avoid overly long questions or answers
- Do not include the sources in the output`;
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

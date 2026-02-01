import { z } from "zod";

export const answerSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Answer text is required"),
  isCorrect: z.boolean().default(false),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Question text is required"),
  imageUrl: z.url().optional().or(z.literal("")).nullable(),
  answers: z
    .array(answerSchema)
    .min(2, "At least 2 answers are required")
    .max(6, "Maximum 6 answers allowed")
    .refine((answers) => answers.some((a) => a.isCorrect), {
      message: "At least one answer must be marked as correct",
    }),
});

// Supported languages (ISO 639-1 codes)
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "sv", name: "Swedish" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// Difficulty levels
export const DIFFICULTY_LEVELS = ["easy", "medium", "hard"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const quizSchema = z.object({
  title: z.string().min(1, "Title is required").max(70, "Title is too long"),
  description: z.string().min(1, "Description is required").max(120, "Description is too long"),
  heroImageUrl: z.url("Hero image URL is required"),
  language: z.string().min(2).max(10).default("en"),
  difficulty: z.enum(DIFFICULTY_LEVELS).default("medium"),
  maxAttempts: z.coerce.number().int().min(1, "At least 1 attempt required").default(1),
  timeLimitSeconds: z.coerce.number().int().min(0, "Time limit cannot be negative").default(0),
  randomizeQuestions: z.boolean().default(true),
  randomizeAnswers: z.boolean().default(true),
  publishedAt: z.coerce.date().optional().nullable(),
  questions: z.array(questionSchema).min(1, "At least 1 question is required"),
});

export type QuizFormData = z.infer<typeof quizSchema>;
export type QuestionFormData = z.infer<typeof questionSchema>;
export type AnswerFormData = z.infer<typeof answerSchema>;

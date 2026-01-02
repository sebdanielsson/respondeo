"use server";

/**
 * AI Quiz Generation Server Action
 *
 * Generates a quiz using AI based on a theme and configuration.
 * Protected by RBAC and rate limiting.
 */

import { generateObject } from "ai";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { getModel, aiConfig } from "@/lib/ai";
import { canGenerateAIQuiz } from "@/lib/rbac/permissions";
import { checkAIGenerationRateLimit, type AIRateLimitResult } from "@/lib/rate-limit";
import {
  aiQuizInputSchema,
  aiQuizOutputSchema,
  generateQuizPrompt,
  type AIQuizInput,
  type AIQuizOutput,
} from "@/lib/validations/ai-quiz";

// ============================================================================
// Types
// ============================================================================

export interface GenerateQuizResult {
  success: boolean;
  data?: AIQuizOutput & {
    language: string;
    difficulty: AIQuizInput["difficulty"];
  };
  error?: string;
  errorCode?:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "RATE_LIMITED"
    | "AI_DISABLED"
    | "VALIDATION"
    | "AI_ERROR";
  rateLimit?: AIRateLimitResult;
}

// ============================================================================
// Server Action
// ============================================================================

/**
 * Generate a quiz using AI.
 *
 * @param input - The quiz generation input (theme, options)
 * @returns The generated quiz data or an error
 */
export async function generateQuizWithAI(input: AIQuizInput): Promise<GenerateQuizResult> {
  try {
    // 1. Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be signed in to generate quizzes with AI.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    // 2. Check RBAC permission
    if (!canGenerateAIQuiz(session.user)) {
      return {
        success: false,
        error: "You don't have permission to generate quizzes with AI.",
        errorCode: "FORBIDDEN",
      };
    }

    // 3. Check if AI is enabled
    if (!aiConfig.enabled) {
      return {
        success: false,
        error: "AI features are not configured. Please contact an administrator.",
        errorCode: "AI_DISABLED",
      };
    }

    // 4. Validate input
    const validatedInput = aiQuizInputSchema.safeParse(input);
    if (!validatedInput.success) {
      return {
        success: false,
        error: validatedInput.error.issues[0]?.message ?? "Invalid input",
        errorCode: "VALIDATION",
      };
    }

    // 5. Check rate limits
    const rateLimitResult = checkAIGenerationRateLimit(session.user.id);
    if (!rateLimitResult.allowed) {
      const resetMinutes = Math.ceil(rateLimitResult.resetInMs / 60000);
      const limitTypeMessage =
        rateLimitResult.limitType === "global"
          ? "The system has reached its AI generation limit."
          : "You have reached your AI generation limit.";

      return {
        success: false,
        error: `${limitTypeMessage} Please try again in ${resetMinutes} minutes.`,
        errorCode: "RATE_LIMITED",
        rateLimit: rateLimitResult,
      };
    }

    // 6. Generate quiz with AI
    const prompt = generateQuizPrompt(validatedInput.data);
    const model = getModel();

    const result = await generateObject({
      model,
      schema: aiQuizOutputSchema,
      prompt,
    });

    // 7. Validate the generated output
    if (!result.object) {
      return {
        success: false,
        error: "AI failed to generate a valid quiz. Please try again.",
        errorCode: "AI_ERROR",
      };
    }

    // Validate question and answer counts
    const quiz = result.object;
    if (quiz.questions.length !== validatedInput.data.questionCount) {
      console.warn(
        `[AI] Generated ${quiz.questions.length} questions, expected ${validatedInput.data.questionCount}`,
      );
    }

    // Validate each question has exactly one correct answer
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const correctCount = question.answers.filter((a) => a.isCorrect).length;
      if (correctCount !== 1) {
        console.error(
          `[AI] Question ${i + 1} has ${correctCount} correct answers, expected exactly 1`,
        );
        return {
          success: false,
          error: `AI generated an invalid quiz (question ${i + 1} has ${correctCount} correct answers instead of 1). Please try again.`,
          errorCode: "AI_ERROR",
        };
      }
    }

    return {
      success: true,
      data: {
        ...quiz,
        language: validatedInput.data.language,
        difficulty: validatedInput.data.difficulty,
      },
      rateLimit: rateLimitResult,
    };
  } catch (error) {
    console.error("[AI] Quiz generation error:", error);

    // Handle specific AI SDK errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return {
          success: false,
          error: "AI service is not properly configured. Please contact an administrator.",
          errorCode: "AI_DISABLED",
        };
      }
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return {
          success: false,
          error:
            "AI service is temporarily unavailable due to rate limiting. Please try again later.",
          errorCode: "RATE_LIMITED",
        };
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred while generating the quiz. Please try again.",
      errorCode: "AI_ERROR",
    };
  }
}

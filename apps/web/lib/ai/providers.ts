/**
 * AI Provider Factory
 *
 * Returns the appropriate AI SDK model based on configuration.
 * Supports OpenAI, Anthropic, and Google providers with user tracking.
 *
 * See docs/ai-generation.md for full documentation.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { aiConfig, type AIProvider } from "./config";
import type { LanguageModel } from "ai";

/**
 * Get the AI model based on current configuration.
 *
 * @returns The configured AI model instance
 * @throws Error if the provider is not supported or not configured
 */
export function getModel(): LanguageModel {
  if (!aiConfig.enabled) {
    throw new Error(
      `AI features are disabled. Please set the API key for provider "${aiConfig.provider}".`,
    );
  }

  return getModelForProvider(aiConfig.provider, aiConfig.model);
}

/**
 * Get a model for a specific provider and model name.
 *
 * @param provider - The AI provider to use
 * @param model - The model name
 * @returns The AI model instance
 */
export function getModelForProvider(provider: AIProvider, model: string): LanguageModel {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(model);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(model);
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(model);
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Get a model with user tracking for cost monitoring.
 * User ID is passed via custom headers for Anthropic/Google,
 * and via providerOptions for OpenAI.
 *
 * @param provider - The AI provider to use
 * @param model - The model name
 * @param userId - The user ID for tracking
 * @returns The AI model instance with user tracking headers
 */
export function getModelWithTracking(
  provider: AIProvider,
  model: string,
  userId: string,
): LanguageModel {
  switch (provider) {
    case "openai": {
      // OpenAI uses providerOptions.openai.user at call time
      // Return standard model - user tracking is done via providerOptions in generateObject
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(model);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        headers: {
          "X-User-Id": userId,
        },
      });
      return anthropic(model);
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        headers: {
          "X-User-Id": userId,
        },
      });
      return google(model);
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * AI Provider Factory
 *
 * Returns the appropriate AI SDK model based on configuration.
 * Currently supports OpenAI. To add more providers:
 *
 * 1. Install the provider package: `bun add @ai-sdk/anthropic`
 * 2. Import the provider: `import { anthropic } from '@ai-sdk/anthropic'`
 * 3. Add a case to the switch in getModel()
 * 4. Set the API key environment variable
 *
 * See docs/ai-generation.md for full documentation.
 */

import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
    case "openai":
      return openai(model);

    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      return openrouter.chat(model);
    }

    case "anthropic":
      // To enable Anthropic support:
      // 1. Run: bun add @ai-sdk/anthropic
      // 2. Uncomment the following:
      // import { anthropic } from '@ai-sdk/anthropic';
      // return anthropic(model);
      throw new Error(
        'Anthropic provider is not installed. Run "bun add @ai-sdk/anthropic" to enable.',
      );

    case "google":
      // To enable Google support:
      // 1. Run: bun add @ai-sdk/google
      // 2. Uncomment the following:
      // import { google } from '@ai-sdk/google';
      // return google(model);
      throw new Error('Google provider is not installed. Run "bun add @ai-sdk/google" to enable.');

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

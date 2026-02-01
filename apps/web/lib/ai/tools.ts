/**
 * AI Tools
 *
 * Provider-specific tool configurations for AI SDK features like web search.
 * Each provider has its own web search implementation with different capabilities.
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { aiConfig, type AIProvider } from "./config";
import type { ToolSet } from "ai";

/**
 * Check if web search is available based on configuration.
 *
 * @returns Whether web search is enabled via environment variable
 */
export function isWebSearchAvailable(): boolean {
  return aiConfig.webSearchEnabled;
}

/**
 * Get web search tools for the specified provider.
 * Each provider has its own web search implementation:
 * - OpenAI: Uses the Responses API web search tool
 * - Anthropic: Uses the web_search_20250305 server tool
 * - Google: Uses Google Search grounding
 *
 * @param provider - The AI provider to get tools for (defaults to configured provider)
 * @returns ToolSet with the appropriate web search tool, or undefined if not available
 */
export function getWebSearchTools(provider: AIProvider = aiConfig.provider): ToolSet | undefined {
  if (!isWebSearchAvailable()) {
    return undefined;
  }

  switch (provider) {
    case "openai":
      return {
        web_search: openai.tools.webSearch({
          searchContextSize: "medium",
        }),
      } as ToolSet;

    case "anthropic":
      return {
        web_search: anthropic.tools.webSearch_20250305({
          maxUses: 3,
        }),
      } as ToolSet;

    case "google":
      return {
        google_search: google.tools.googleSearch({}),
      } as ToolSet;

    default:
      return undefined;
  }
}

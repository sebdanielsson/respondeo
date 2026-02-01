/**
 * AI Module
 *
 * Provides a unified interface for AI-powered features.
 * See docs/ai-generation.md for configuration and usage.
 */

export { aiConfig, getAIConfigSummary, AI_PROVIDERS, DEFAULT_MODELS } from "./config";
export type { AIConfig, AIProvider } from "./config";

export { getModel, getModelForProvider, getModelWithTracking } from "./providers";

export { getWebSearchTools, isWebSearchAvailable } from "./tools";

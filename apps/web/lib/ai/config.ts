/**
 * AI Configuration
 *
 * Centralizes AI provider configuration from environment variables.
 * Supports multiple providers with environment-based switching.
 */

// Supported AI providers
export const AI_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

// Default models for each provider
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3-flash-preview",
};

/**
 * AI configuration loaded from environment variables.
 */
export interface AIConfig {
  /** The AI provider to use */
  provider: AIProvider;
  /** The model to use (provider-specific) */
  model: string;
  /** Whether AI features are enabled (requires API key) */
  enabled: boolean;
  /** Whether web search is enabled for AI generation */
  webSearchEnabled: boolean;
}

/**
 * Parse and validate the AI provider from environment.
 */
function parseProvider(value: string | undefined): AIProvider {
  if (!value || value.trim() === "") return "openai";

  const normalized = value.toLowerCase().trim() as AIProvider;
  if (AI_PROVIDERS.includes(normalized)) {
    return normalized;
  }

  console.warn(`[AI] Unknown provider "${value}", using default "openai"`);
  return "openai";
}

/**
 * Check if the required API key is set for a provider.
 */
function hasApiKey(provider: AIProvider): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    default:
      return false;
  }
}

/**
 * Parse boolean environment variable.
 */
function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Load AI configuration from environment variables.
 */
function loadAIConfig(): AIConfig {
  const provider = parseProvider(process.env.AI_PROVIDER);
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const enabled = hasApiKey(provider);
  const webSearchEnabled = parseBoolEnv(process.env.AI_WEB_SEARCH_ENABLED, false);

  if (!enabled) {
    console.warn(`[AI] No API key found for provider "${provider}". AI features are disabled.`);
  }

  return {
    provider,
    model,
    enabled,
    webSearchEnabled,
  };
}

/**
 * AI configuration singleton.
 */
export const aiConfig: AIConfig = loadAIConfig();

/**
 * Get a summary of the current AI configuration for debugging.
 */
export function getAIConfigSummary(): Record<string, unknown> {
  return {
    provider: aiConfig.provider,
    model: aiConfig.model,
    enabled: aiConfig.enabled,
    webSearchEnabled: aiConfig.webSearchEnabled,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  };
}

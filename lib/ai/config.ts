/**
 * AI Configuration
 *
 * Centralizes AI provider configuration from environment variables.
 * Supports multiple providers with environment-based switching.
 */

// Supported AI providers
export const AI_PROVIDERS = ["openai", "openrouter", "anthropic", "google"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

// Default models for each provider
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-5-mini",
  openrouter: "openai/gpt-5-mini",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
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
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    default:
      return false;
  }
}

/**
 * Load AI configuration from environment variables.
 */
function loadAIConfig(): AIConfig {
  const provider = parseProvider(process.env.AI_PROVIDER);
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const enabled = hasApiKey(provider);

  if (!enabled) {
    console.warn(`[AI] No API key found for provider "${provider}". AI features are disabled.`);
  }

  return {
    provider,
    model,
    enabled,
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
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  };
}

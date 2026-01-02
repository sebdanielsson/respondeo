/**
 * Image Search Configuration
 *
 * Centralizes image provider configuration from environment variables.
 * Supports multiple providers with environment-based switching.
 */

import type { ImageSearchConfig } from "./types";

// ============================================================================
// Supported Providers
// ============================================================================

export const IMAGE_PROVIDERS = ["unsplash"] as const;
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];

// ============================================================================
// API Key Detection
// ============================================================================

/**
 * Check if the required API key is set for a provider.
 */
function hasApiKey(provider: ImageProviderName): boolean {
  switch (provider) {
    case "unsplash":
      return !!process.env.UNSPLASH_ACCESS_KEY;
    default:
      return false;
  }
}

/**
 * Get the API key for a provider.
 */
export function getApiKey(provider: ImageProviderName): string | undefined {
  switch (provider) {
    case "unsplash":
      return process.env.UNSPLASH_ACCESS_KEY;
    default:
      return undefined;
  }
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Determine which provider to use based on available API keys.
 * Returns the first provider with a valid API key.
 */
function detectProvider(): ImageProviderName | null {
  for (const provider of IMAGE_PROVIDERS) {
    if (hasApiKey(provider)) {
      return provider;
    }
  }
  return null;
}

// ============================================================================
// Configuration Export
// ============================================================================

/**
 * Image search configuration loaded from environment variables.
 */
export const imageSearchConfig: ImageSearchConfig = (() => {
  const provider = detectProvider();

  return {
    provider: provider ?? "unsplash",
    enabled: provider !== null,
  };
})();

/**
 * Check if image search is enabled.
 * Useful for conditionally rendering UI elements.
 */
export function isImageSearchEnabled(): boolean {
  return imageSearchConfig.enabled;
}

/**
 * Get a summary of the image search configuration for debugging.
 */
export function getImageSearchConfigSummary(): string {
  if (!imageSearchConfig.enabled) {
    return "Image search: disabled (no API key configured)";
  }
  return `Image search: enabled (provider: ${imageSearchConfig.provider})`;
}

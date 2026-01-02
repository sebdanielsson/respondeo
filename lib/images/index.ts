/**
 * Image Search Module
 *
 * Provides a unified interface for image search across providers.
 * Currently supports Unsplash, with architecture for future providers.
 */

// Re-export types
export type {
  ImageSearchResult,
  ImageSearchResponse,
  ImageProvider,
  ImageSearchOptions,
  ImageSearchConfig,
} from "./types";

// Re-export config
export {
  imageSearchConfig,
  isImageSearchEnabled,
  getImageSearchConfigSummary,
  IMAGE_PROVIDERS,
} from "./config";
export type { ImageProviderName } from "./config";

// Import providers
import { unsplashProvider } from "./providers/unsplash";
import { imageSearchConfig } from "./config";
import type { ImageProvider, ImageSearchResponse, ImageSearchOptions } from "./types";

// ============================================================================
// Provider Registry
// ============================================================================

const providers: Record<string, ImageProvider> = {
  unsplash: unsplashProvider,
};

/**
 * Get the currently active image provider.
 */
export function getImageProvider(): ImageProvider | null {
  if (!imageSearchConfig.enabled) {
    return null;
  }

  return providers[imageSearchConfig.provider] ?? null;
}

/**
 * Search for images using the active provider.
 */
export async function searchImages(
  query: string,
  options?: ImageSearchOptions,
): Promise<ImageSearchResponse> {
  const provider = getImageProvider();

  if (!provider) {
    return {
      success: false,
      error: "Image search is not configured. Please set an API key.",
    };
  }

  return provider.search(query, options);
}

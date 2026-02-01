/**
 * Image Search Types
 *
 * Shared types for image search providers.
 * Designed to be provider-agnostic for future extensibility.
 */

// ============================================================================
// Image Result Types
// ============================================================================

/**
 * A single image result from a search provider.
 */
export interface ImageSearchResult {
  /** Unique identifier from the provider */
  id: string;
  /** URL to the image (full size) */
  url: string;
  /** URL to a smaller thumbnail */
  thumbnailUrl: string;
  /** Alt text / description */
  description: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Attribution information */
  attribution: {
    /** Photographer/creator name */
    photographerName: string;
    /** Link to photographer's profile */
    photographerUrl: string;
    /** Link to the image page on the provider */
    imagePageUrl: string;
    /** Provider name (e.g., "Unsplash") */
    providerName: string;
    /** Provider homepage URL */
    providerUrl: string;
  };
  /** URL to trigger download tracking (required by some providers like Unsplash) */
  downloadTrackingUrl?: string;
}

/**
 * Response from an image search operation.
 */
export interface ImageSearchResponse {
  success: boolean;
  images?: ImageSearchResult[];
  error?: string;
  /** Total results available (for pagination) */
  totalResults?: number;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Image search provider interface.
 * Implement this interface to add support for new image providers.
 */
export interface ImageProvider {
  /** Provider identifier */
  name: string;
  /** Display name for the provider */
  displayName: string;
  /** Search for images */
  search(query: string, options?: ImageSearchOptions): Promise<ImageSearchResponse>;
}

/**
 * Options for image search.
 */
export interface ImageSearchOptions {
  /** Number of results per page */
  perPage?: number;
  /** Page number (1-indexed) */
  page?: number;
  /** Image orientation */
  orientation?: "landscape" | "portrait" | "squarish";
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Image search configuration.
 */
export interface ImageSearchConfig {
  /** The active provider name */
  provider: string;
  /** Whether image search is enabled (has valid API key) */
  enabled: boolean;
}

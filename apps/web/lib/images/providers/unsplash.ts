/**
 * Unsplash Image Provider
 *
 * Implements the ImageProvider interface for Unsplash API.
 * See: https://unsplash.com/documentation
 */

import type {
  ImageProvider,
  ImageSearchResponse,
  ImageSearchResult,
  ImageSearchOptions,
} from "../types";
import { getApiKey } from "../config";

// ============================================================================
// Unsplash API Types
// ============================================================================

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number;
  height: number;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
    download_location: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

interface UnsplashError {
  errors?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const UNSPLASH_API_BASE = "https://api.unsplash.com";
const DEFAULT_PER_PAGE = 12;

// App name for UTM tracking (required by Unsplash API guidelines)
const APP_NAME = "quiz_app";

/**
 * Build UTM parameters for Unsplash attribution links.
 * Required by Unsplash API guidelines for proper attribution.
 */
function buildUtmParams(): string {
  return `?utm_source=${APP_NAME}&utm_medium=referral`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform an Unsplash photo to our standard ImageSearchResult format.
 */
function transformPhoto(photo: UnsplashPhoto): ImageSearchResult {
  const utmParams = buildUtmParams();

  return {
    id: photo.id,
    url: photo.urls.regular,
    thumbnailUrl: photo.urls.small,
    description: photo.alt_description ?? photo.description ?? "Unsplash image",
    width: photo.width,
    height: photo.height,
    attribution: {
      photographerName: photo.user.name,
      photographerUrl: `https://unsplash.com/@${photo.user.username}${utmParams}`,
      imagePageUrl: `${photo.links.html}${utmParams}`,
      providerName: "Unsplash",
      providerUrl: `https://unsplash.com${utmParams}`,
    },
    downloadTrackingUrl: photo.links.download_location,
  };
}

/**
 * Parse error response from Unsplash API.
 */
function parseError(data: UnsplashError, status: number): string {
  if (data.errors && data.errors.length > 0) {
    return data.errors.join(", ");
  }

  switch (status) {
    case 401:
      return "Invalid or expired Unsplash API key";
    case 403:
      return "Access forbidden - check your Unsplash API permissions";
    case 429:
      return "Rate limit exceeded - please try again later";
    default:
      return `Unsplash API error (status ${status})`;
  }
}

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * Search for images using Unsplash API.
 */
async function search(
  query: string,
  options: ImageSearchOptions = {},
): Promise<ImageSearchResponse> {
  const apiKey = getApiKey("unsplash");

  if (!apiKey) {
    return {
      success: false,
      error: "Unsplash API key not configured",
    };
  }

  const perPage = options.perPage ?? DEFAULT_PER_PAGE;
  const page = options.page ?? 1;

  const params = new URLSearchParams({
    query,
    per_page: perPage.toString(),
    page: page.toString(),
  });

  if (options.orientation) {
    params.set("orientation", options.orientation);
  }

  try {
    const response = await fetch(`${UNSPLASH_API_BASE}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${apiKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as UnsplashError;
      return {
        success: false,
        error: parseError(errorData, response.status),
      };
    }

    const data = (await response.json()) as UnsplashSearchResponse;

    return {
      success: true,
      images: data.results.map(transformPhoto),
      totalResults: data.total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to search Unsplash: ${message}`,
    };
  }
}

/**
 * Trigger download tracking for an Unsplash photo.
 * Required by Unsplash API guidelines when a user uses/downloads a photo.
 * See: https://unsplash.com/documentation#track-a-photo-download
 *
 * @param downloadLocationUrl - The download_location URL from the photo
 */
/**
 * Regex to extract photo ID from Unsplash download_location URLs.
 * Valid format: https://api.unsplash.com/photos/{photoId}/download
 * Photo IDs are alphanumeric with hyphens and underscores, typically 11 chars.
 */
const DOWNLOAD_URL_PATTERN = /^https:\/\/api\.unsplash\.com\/photos\/([a-zA-Z0-9_-]+)\/download$/;

async function triggerDownload(downloadLocationUrl: string): Promise<void> {
  const apiKey = getApiKey("unsplash");

  if (!apiKey) {
    console.warn("[Unsplash] Cannot trigger download: API key not configured");
    return;
  }

  // Extract and validate the photo ID from the URL to prevent SSRF attacks
  // We only accept URLs matching the exact Unsplash download endpoint pattern
  const match = downloadLocationUrl.match(DOWNLOAD_URL_PATTERN);

  if (!match) {
    console.warn("[Unsplash] Invalid download tracking URL format:", downloadLocationUrl);
    return;
  }

  const photoId = match[1];

  // Construct a safe URL using only the validated photo ID and our trusted base
  const safeUrl = `${UNSPLASH_API_BASE}/photos/${photoId}/download`;

  try {
    await fetch(safeUrl, {
      headers: {
        Authorization: `Client-ID ${apiKey}`,
        "Accept-Version": "v1",
      },
    });
  } catch (error) {
    // Log but don't throw - download tracking is best-effort
    console.warn("[Unsplash] Failed to trigger download tracking:", error);
  }
}

// ============================================================================
// Provider Export
// ============================================================================

export const unsplashProvider: ImageProvider = {
  name: "unsplash",
  displayName: "Unsplash",
  search,
};

export { triggerDownload as triggerUnsplashDownload };

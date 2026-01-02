"use server";

/**
 * Image Search Server Action
 *
 * Provides image search functionality with authentication and rate limiting.
 */

import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import {
  searchImages,
  isImageSearchEnabled,
  type ImageSearchResult,
  type ImageSearchOptions,
} from "@/lib/images";
import { triggerUnsplashDownload } from "@/lib/images/providers/unsplash";

// ============================================================================
// Types
// ============================================================================

export interface SearchImagesResult {
  success: boolean;
  images?: ImageSearchResult[];
  error?: string;
  errorCode?: "UNAUTHENTICATED" | "DISABLED" | "API_ERROR";
  totalResults?: number;
}

export interface ImageSearchEnabledResult {
  enabled: boolean;
  reason?: string;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Check if image search is enabled.
 * Can be called from client to determine if the feature should be shown.
 */
export async function getImageSearchEnabled(): Promise<ImageSearchEnabledResult> {
  const enabled = isImageSearchEnabled();

  if (!enabled) {
    return {
      enabled: false,
      reason: "No image search API key configured",
    };
  }

  return { enabled: true };
}

/**
 * Search for images.
 *
 * @param query - The search query
 * @param options - Search options (pagination, orientation)
 * @returns Search results or error
 */
export async function searchImagesAction(
  query: string,
  options?: ImageSearchOptions,
): Promise<SearchImagesResult> {
  try {
    // 1. Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be signed in to search for images.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    // 2. Check if image search is enabled
    if (!isImageSearchEnabled()) {
      return {
        success: false,
        error: "Image search is not available. Please contact an administrator.",
        errorCode: "DISABLED",
      };
    }

    // 3. Validate query
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        success: false,
        error: "Please enter a search query",
        errorCode: "API_ERROR",
      };
    }

    // 4. Search for images
    const result = await searchImages(trimmedQuery, options);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Failed to search for images",
        errorCode: "API_ERROR",
      };
    }

    return {
      success: true,
      images: result.images,
      totalResults: result.totalResults,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Image search failed: ${message}`,
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Trigger download tracking when a user selects an image.
 * Required by Unsplash API guidelines.
 *
 * @param downloadTrackingUrl - The download tracking URL from the image result
 */
export async function triggerImageDownload(downloadTrackingUrl: string): Promise<void> {
  // Currently only Unsplash requires download tracking
  // The URL format tells us which provider it's from
  if (downloadTrackingUrl.includes("unsplash.com")) {
    await triggerUnsplashDownload(downloadTrackingUrl);
  }
}

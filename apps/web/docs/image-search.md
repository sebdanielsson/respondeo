# Image Search

The app includes an image picker that allows users to search and select images from web providers when creating quizzes. This feature makes it easy to add high-quality images to quiz questions and hero images.

## Overview

- **Modular Provider System**: Designed to support multiple image providers (currently Unsplash)
- **In-App Search**: Search and preview images without leaving the quiz editor
- **Proper Attribution**: Displays photographer credits as required by providers
- **Graceful Degradation**: Feature is disabled with helpful tooltip when no API key is configured

## Quick Start

### 1. Get an Unsplash API Key

1. Create an account at [Unsplash Developers](https://unsplash.com/developers)
2. Create a new application
3. Copy your **Access Key**

### 2. Set Environment Variable

Add your Unsplash access key to `.env.local`:

```env
UNSPLASH_ACCESS_KEY="your-access-key-here"
```

### 3. Use the Image Picker

The image picker is automatically available on:

- **Quiz Hero Image**: In the quiz creation/edit form
- **Question Images**: For each question in the quiz

Click the search icon next to any image URL input to open the picker dialog.

## Environment Variables

| Variable              | Type   | Required | Description             |
| --------------------- | ------ | -------- | ----------------------- |
| `UNSPLASH_ACCESS_KEY` | string | Yes      | Unsplash API access key |

## Features

### Image Search Dialog

The image picker dialog provides:

- **Search Input**: Enter keywords to find relevant images
- **Image Grid**: Browse results with thumbnails
- **Selection Highlighting**: Visual feedback for selected image
- **Attribution**: "Photo by [Name] on Unsplash" with links to photographer and image page
- **Loading States**: Skeleton placeholders while images load

### Image URL Input Component

The `ImageUrlInput` component combines:

- **Text Input**: Manual URL entry for any image source
- **Picker Button**: Opens the search dialog (disabled with tooltip if no API key)
- **Image Preview**: Shows a thumbnail of the current image with loading skeleton

## Architecture

The image search system is designed for extensibility:

```
lib/images/
├── types.ts           # Shared types (ImageSearchResult, ImageProvider interface)
├── config.ts          # Provider detection and configuration
├── index.ts           # Main entry point
└── providers/
    └── unsplash.ts    # Unsplash API implementation
```

### Adding a New Provider

To add support for a new image provider (e.g., Pexels):

1. **Create the provider file** at `lib/images/providers/pexels.ts`:

   ```typescript
   import type { ImageProvider, ImageSearchResponse, ImageSearchOptions } from "../types";
   import { getApiKey } from "../config";

   async function search(
     query: string,
     options?: ImageSearchOptions,
   ): Promise<ImageSearchResponse> {
     const apiKey = getApiKey("pexels");
     if (!apiKey) {
       return { success: false, error: "Pexels API key not configured" };
     }

     // Implement Pexels API call here
     // Transform results to ImageSearchResult format
   }

   export const pexelsProvider: ImageProvider = {
     name: "pexels",
     displayName: "Pexels",
     search,
   };
   ```

2. **Update config.ts** to detect the new provider:

   ```typescript
   export const IMAGE_PROVIDERS = ["unsplash", "pexels"] as const;

   function hasApiKey(provider: ImageProviderName): boolean {
     switch (provider) {
       case "unsplash":
         return !!process.env.UNSPLASH_ACCESS_KEY;
       case "pexels":
         return !!process.env.PEXELS_API_KEY;
       default:
         return false;
     }
   }

   export function getApiKey(provider: ImageProviderName): string | undefined {
     switch (provider) {
       case "unsplash":
         return process.env.UNSPLASH_ACCESS_KEY;
       case "pexels":
         return process.env.PEXELS_API_KEY;
       default:
         return undefined;
     }
   }
   ```

3. **Register the provider** in `lib/images/index.ts`:

   ```typescript
   import { pexelsProvider } from "./providers/pexels";

   const providers: Record<string, ImageProvider> = {
     unsplash: unsplashProvider,
     pexels: pexelsProvider,
   };
   ```

The system automatically detects which provider to use based on available API keys.

## API Reference

### Types

```typescript
interface ImageSearchResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  width: number;
  height: number;
  attribution: {
    photographerName: string;
    photographerUrl: string;
    imagePageUrl: string;
    providerName: string;
    providerUrl: string;
  };
  downloadTrackingUrl?: string;
}

interface ImageSearchOptions {
  perPage?: number;
  page?: number;
  orientation?: "landscape" | "portrait" | "squarish";
}
```

### Server Actions

#### `getImageSearchEnabled()`

Check if image search is available (API key configured).

```typescript
const { enabled, reason } = await getImageSearchEnabled();
// enabled: boolean
// reason: string | undefined (explanation if disabled)
```

#### `searchImagesAction(query, options?)`

Search for images using the configured provider.

```typescript
const result = await searchImagesAction("nature", { perPage: 12 });
if (result.success) {
  console.log(result.images); // ImageSearchResult[]
} else {
  console.error(result.error);
}
```

#### `triggerImageDownload(downloadTrackingUrl)`

Trigger download tracking when a user selects an image. Required by Unsplash API guidelines.

```typescript
if (image.downloadTrackingUrl) {
  await triggerImageDownload(image.downloadTrackingUrl);
}
```

## Unsplash API Guidelines Compliance

The implementation follows Unsplash's [API Guidelines](https://unsplash.com/documentation#guidelines--crediting):

### 1. Hotlinking

Photos are hotlinked directly from Unsplash CDN URLs (`images.unsplash.com`). The `url` field contains the original Unsplash image URL.

### 2. Download Tracking

When a user selects an image, the `triggerImageDownload()` function calls the Unsplash download endpoint. This is handled automatically by the image picker dialog.

### 3. Attribution

Proper attribution is displayed as:

```
Photo by [Photographer Name] on [Unsplash]
```

With links including UTM parameters:

- Photographer link: `https://unsplash.com/@username?utm_source=respondeo&utm_medium=referral`
- Unsplash link: `https://unsplash.com/?utm_source=respondeo&utm_medium=referral`

## Troubleshooting

### Image picker button is disabled

**Cause**: No `UNSPLASH_ACCESS_KEY` environment variable is set.

**Solution**: Add your Unsplash access key to `.env.local` and restart the development server.

### "Invalid or expired Unsplash API key" error

**Cause**: The API key is incorrect or has been revoked.

**Solution**: Verify your access key in the [Unsplash Developer Dashboard](https://unsplash.com/oauth/applications) and update `.env.local`.

### "Rate limit exceeded" error

**Cause**: Too many requests to the Unsplash API.

**Solution**: Unsplash allows 50 requests per hour for demo apps. Wait for the rate limit to reset, or apply for production access for higher limits.

### Images not loading in preview

**Cause**: Next.js image optimization may block external domains.

**Solution**: Ensure remote patterns are configured in `next.config.ts` to explicitly allow only the trusted image domains you use (for example Unsplash):

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
  ],
},
```

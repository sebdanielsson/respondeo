# Open Graph Images

This document explains the Open Graph (OG) image system in the Quiz App, including how images are generated, cached, and how to customize them.

## Overview

Open Graph images are the preview images shown when links are shared on social media platforms (Facebook, Twitter/X, LinkedIn, Discord, Slack, etc.). This app generates dynamic OG images using Next.js's built-in `ImageResponse` API from `next/og`.

## Route Coverage

| Route                            | OG Image Content                               | File Location                                                       |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `/` (root)                       | App name + tagline + gradient                  | `app/opengraph-image.tsx`                                           |
| `/quiz/[id]`                     | Quiz hero image/gradient + title + description | `app/(dashboard)/quiz/[id]/opengraph-image.tsx`                     |
| `/leaderboard`                   | Global top 3 players podium                    | `app/(dashboard)/leaderboard/opengraph-image.tsx`                   |
| `/quiz/[id]/results`             | Quiz-specific top 3 leaderboard                | `app/(dashboard)/quiz/[id]/results/opengraph-image.tsx`             |
| `/quiz/[id]/results/[attemptId]` | Individual score card (shareable)              | `app/(dashboard)/quiz/[id]/results/[attemptId]/opengraph-image.tsx` |

## Configuration

### Revalidation (Caching)

OG images are cached to reduce compute and bandwidth usage. The cache duration is set to **15 minutes (900 seconds)** by default.

**Important**: Next.js requires `revalidate` to be a literal value that can be statically analyzed at build time. It cannot be imported from a config file.

To change the revalidation interval, update the `revalidate` export in each OG image file:

```typescript
// In each opengraph-image.tsx and twitter-image.tsx file
export const revalidate = 900; // 15 minutes
```

Common values:

- **15 minutes (900s)**: Good balance between freshness and performance (default)
- **1 hour (3600s)**: Lower compute costs, good for stable content
- **0**: No caching, always fresh (higher compute costs)

### Image Dimensions

All OG images use the recommended dimensions:

- **Width**: 1200px
- **Height**: 630px
- **Format**: PNG

These dimensions are optimal for most social platforms.

## Data Memoization

To avoid duplicate database queries when both `generateMetadata` and the OG image need the same data, we use React's `cache()` function:

```typescript
// lib/db/queries/quiz.ts
import { cache } from "react";

export const getCachedQuizById = cache(async (quizId: string) => {
  return getQuizById(quizId);
});
```

This ensures that within a single request, the data is fetched only once even if called from multiple places.

## Customization

### Changing Colors

The default gradient uses a purple theme. To change it, modify the `background` property in the OG image files:

```tsx
// Example: Change to blue gradient
background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)";
```

### Changing the App Icon/Emoji

The OG images use 🎯 as a placeholder icon. To use a custom logo:

1. Add your logo to the `public/` folder (e.g., `public/logo.png`)
2. Read it in the OG image file:

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={
        {
          /* ... */
        }
      }
    >
      <img src={logoSrc} width={100} height={100} />
      {/* ... */}
    </div>,
    { ...size },
  );
}
```

## Using Custom Fonts

By default, OG images use system fonts. To use custom fonts like Geist (the app's main font):

### 1. Download the Font

Place the font file in your project (e.g., `assets/fonts/Geist-SemiBold.ttf`).

### 2. Load the Font in OG Images

```tsx
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export default async function Image() {
  // Load font file
  const geistSemiBold = await readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf"));

  return new ImageResponse(
    <div
      style={{
        fontFamily: "Geist",
        // ... rest of styles
      }}
    >
      Your Content
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geistSemiBold,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
```

### 3. Loading Multiple Weights

```tsx
const [geistRegular, geistBold] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
]);

// In ImageResponse options:
{
  fonts: [
    { name: "Geist", data: geistRegular, weight: 400 },
    { name: "Geist", data: geistBold, weight: 700 },
  ],
}
```

## Testing OG Images

### Local Development

Visit the OG image URL directly in your browser:

- Generic: `http://localhost:3000/opengraph-image`
- Quiz: `http://localhost:3000/quiz/[id]/opengraph-image`
- Leaderboard: `http://localhost:3000/leaderboard/opengraph-image`

### Social Media Debuggers

Use these tools to preview how your OG images appear:

- **Facebook**: [Sharing Debugger](https://developers.facebook.com/tools/debug/)
- **Twitter/X**: [Card Validator](https://cards-dev.twitter.com/validator)
- **LinkedIn**: [Post Inspector](https://www.linkedin.com/post-inspector/)
- **General**: [OpenGraph.xyz](https://www.opengraph.xyz/)

## Limitations

The `ImageResponse` API (powered by Satori) has some limitations:

1. **Flexbox only**: Only `display: flex` is supported (no grid)
2. **Limited CSS**: Not all CSS properties work. See [supported CSS](https://github.com/vercel/satori#css)
3. **No client-side features**: Images are generated on the server
4. **External images**: Must be absolute URLs with HTTPS in production

## File Structure

```
app/
  opengraph-image.tsx          # Generic fallback
  twitter-image.tsx            # Re-exports opengraph-image
  (dashboard)/
    leaderboard/
      opengraph-image.tsx      # Global top 3
      twitter-image.tsx
    quiz/[id]/
      opengraph-image.tsx      # Quiz detail
      twitter-image.tsx
      results/
        opengraph-image.tsx    # Quiz top 3
        twitter-image.tsx
        [attemptId]/
          opengraph-image.tsx  # Individual score card
          twitter-image.tsx
```

## Related Resources

- [Next.js OG Image Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [Satori (underlying library)](https://github.com/vercel/satori)
- [Vercel OG Playground](https://og-playground.vercel.app/)

# Open Graph Images Documentation

This document describes the Open Graph (OG) image implementation for the Quiz App, which enables rich social media previews when links are shared on platforms like Twitter, Facebook, LinkedIn, and Discord.

## Overview

The implementation includes three types of OG images:

1. **Static Default OG Image** - For the homepage and general pages
2. **Dynamic Quiz OG Images** - For individual quiz pages
3. **Dynamic Leaderboard OG Image** - For the leaderboard page

## Files Structure

```
app/
├── opengraph-image.tsx                    # Static default OG image (1200x630)
├── layout.tsx                             # Root layout with OG metadata
├── (dashboard)/
│   ├── quiz/
│   │   └── [id]/
│   │       └── page.tsx                   # Quiz page with generateMetadata()
│   └── leaderboard/
│       └── page.tsx                       # Leaderboard page with generateMetadata()
└── api/
    └── og/
        ├── quiz/
        │   └── route.tsx                  # Dynamic quiz OG image API
        └── leaderboard/
            └── route.tsx                  # Leaderboard OG image API
```

## Implementation Details

### 1. Static Default OG Image (`app/opengraph-image.tsx`)

- **Route:** `GET /opengraph-image`
- **Dimensions:** 1200x630 pixels
- **Content:**
  - Site name: "Quiz App"
  - Site description: "Test your knowledge with interactive quizzes"
  - Brain icon (quiz app logo)
  - Purple gradient background
- **Runtime:** Edge
- **Caching:** Static, generated at build time

### 2. Dynamic Quiz OG Images (`app/api/og/quiz/route.tsx`)

- **Route:** `GET /api/og/quiz?id={quizId}`
- **Dimensions:** 1200x630 pixels
- **Content:**
  - Quiz App branding
  - Quiz title (max 2 lines)
  - Quiz description (max 3 lines)
  - Quiz stats (question count, time limit)
  - Purple gradient background
- **Runtime:** Node.js (requires database access)
- **Rendering:** Dynamic (force-dynamic to prevent static rendering)
- **Caching:** Revalidates every 3600 seconds (1 hour)
- **Authentication:** Bypasses authentication (accessible to crawlers)

**Usage in pages:**
The quiz detail page (`app/(dashboard)/quiz/[id]/page.tsx`) exports a `generateMetadata()` function that:
- Fetches quiz data
- Returns metadata with `openGraph` and `twitter` card properties
- Points to `/api/og/quiz?id={quizId}` for the OG image

### 3. Dynamic Leaderboard OG Image (`app/api/og/leaderboard/route.tsx`)

- **Route:** `GET /api/og/leaderboard`
- **Dimensions:** 1200x630 pixels
- **Content:**
  - Quiz App branding
  - "Leaderboard" title with trophy emoji
  - Top 3 players (medal emojis: 🥇 🥈 🥉)
  - Player names, correct answers, and quizzes played
  - Purple gradient background
- **Runtime:** Node.js (requires database access)
- **Rendering:** Dynamic (force-dynamic to prevent static rendering)
- **Caching:** Revalidates every 3600 seconds (1 hour)
- **Authentication:** Bypasses authentication (accessible to crawlers)

**Usage in pages:**
The leaderboard page (`app/(dashboard)/leaderboard/page.tsx`) exports a `generateMetadata()` function that:
- Returns metadata with `openGraph` and `twitter` card properties
- Points to `/api/og/leaderboard` for the OG image

## Authentication Bypass

The OG image API routes are placed outside the `(dashboard)` route group to bypass the authentication layer. This is crucial because:

1. Social media crawlers (Twitter, Facebook, LinkedIn, Discord) are not authenticated users
2. Crawlers need to fetch OG images to generate link previews
3. The API routes at `/api/og/*` are accessible without authentication
4. The routes only expose public information (quiz titles, leaderboard data)

## Environment Variables

The implementation requires the following environment variable:

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

This is used in `generateMetadata()` functions to construct absolute URLs for OG images. For local development, use:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Caching Strategy

All dynamic OG images use the following caching strategy:

```typescript
export const revalidate = 3600; // Revalidate every hour
```

This means:
- Images are generated on first request
- Cached for 1 hour
- Regenerated after cache expiry
- Reduces load on the database
- Provides fresh content hourly

## Design System

All OG images use:
- **Color Scheme:** Purple gradient (`#667eea` to `#764ba2`)
- **Fonts:** System sans-serif fonts
- **Dimensions:** 1200x630 pixels (recommended OG image size)
- **Format:** PNG

## Testing

To test the OG images:

1. **Local Testing:**
   ```bash
   # Start the dev server
   npm run dev
   
   # Access OG images:
   # - Default: http://localhost:3000/opengraph-image
   # - Quiz: http://localhost:3000/api/og/quiz?id={quizId}
   # - Leaderboard: http://localhost:3000/api/og/leaderboard
   ```

2. **Social Media Validators:**
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
   - Discord: Paste link directly in a Discord channel

3. **Browser Testing:**
   - Open the OG image URLs directly in a browser
   - Verify dimensions (1200x630)
   - Check content renders correctly

## Troubleshooting

### OG Images Not Showing

1. **Verify Environment Variable:**
   - Ensure `NEXT_PUBLIC_APP_URL` is set correctly
   - Use absolute URLs (include protocol: `https://`)

2. **Check Social Media Cache:**
   - Use the respective platform's debugger tool to clear cache
   - Facebook and LinkedIn cache aggressively - use their debugger tools to force refresh

3. **Database Connection:**
   - Dynamic OG images require database access
   - Ensure database is running and accessible
   - Check quiz/leaderboard data exists

### Images Not Generating

1. **Check Logs:**
   - Look for errors in the server logs
   - Edge runtime errors will appear in the console

2. **Verify Quiz/Leaderboard Data:**
   - Ensure quiz with the given ID exists
   - Ensure leaderboard has at least one player for testing

## Future Enhancements

Potential improvements:
- Add quiz hero images to the OG image background
- Support for custom color schemes per quiz
- Add quiz category/tags to OG image
- Include difficulty level indicator
- Add attempt count and average score to quiz OG image

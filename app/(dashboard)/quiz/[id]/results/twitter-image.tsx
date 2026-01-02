// Re-export the OpenGraph image for Twitter
export { default, size, contentType, generateImageMetadata } from "./opengraph-image";

// Revalidation must be defined directly (can't be re-exported)
// Cache for 15 minutes (see docs/development/og-images.md)
export const revalidate = 900;

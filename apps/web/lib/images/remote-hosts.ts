/**
 * Allowed Remote Image Hosts
 *
 * Next.js Image Optimization will fetch and re-serve any URL whose host matches
 * `images.remotePatterns`. A permissive pattern turns `/_next/image` into an
 * open image proxy that anyone can point at arbitrary hosts, burning the
 * optimization quota and using the deployment as an egress relay.
 *
 * The allowlist therefore defaults to the hosts the built-in image picker can
 * actually return (Unsplash). Deployments that let authors paste image URLs
 * from elsewhere opt those hosts in explicitly via `IMAGE_ALLOWED_HOSTS`.
 *
 * NOTE: this is read by `next.config.ts` and is therefore a **build-time**
 * setting. Changing `IMAGE_ALLOWED_HOSTS` requires a rebuild to take effect.
 */

import type { RemotePattern } from "next/dist/shared/lib/image-config";

/** Hosts serving images returned by the Unsplash provider. */
const DEFAULT_IMAGE_HOSTS = ["images.unsplash.com", "plus.unsplash.com"] as const;

/**
 * Additional hosts allowed for remote images, from `IMAGE_ALLOWED_HOSTS`.
 *
 * Comma-separated. Entries may use the Next.js hostname wildcards: `*` matches
 * a single subdomain segment, `**` matches any number of leading segments.
 *
 * @example IMAGE_ALLOWED_HOSTS="cdn.example.com,**.wikimedia.org"
 */
function getExtraImageHosts(): string[] {
  return (process.env.IMAGE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

/**
 * The full list of hostnames allowed for remote image optimization.
 */
export function getAllowedImageHosts(): string[] {
  return [...new Set<string>([...DEFAULT_IMAGE_HOSTS, ...getExtraImageHosts()])];
}

/**
 * Build the `images.remotePatterns` value for `next.config.ts`.
 *
 * HTTPS only — plain HTTP image sources are not optimized.
 */
export function getImageRemotePatterns(): RemotePattern[] {
  return getAllowedImageHosts().map((hostname) => ({
    protocol: "https" as const,
    hostname,
  }));
}

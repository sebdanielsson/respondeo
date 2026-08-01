import type { NextConfig } from "next";
import { getImageRemotePatterns } from "./lib/images/remote-hosts";

/**
 * Baseline security headers.
 *
 * These are the ones that are safe to apply unconditionally — none of them
 * depend on how the page is built, so they cannot break rendering.
 *
 * A Content-Security-Policy is deliberately *not* set here. Next.js inlines
 * bootstrap scripts and styles, so a useful policy needs per-request nonces
 * threaded through middleware, and a policy written without verifying it
 * against the running app fails closed: the page silently stops working.
 * Adding one is worth doing, but it needs to be developed against a running
 * instance rather than declared blind.
 */
const securityHeaders = [
  // Stop the browser second-guessing declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No framing: the app has no embeddable surface, so clickjacking has no
  // legitimate use case to preserve here.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Send the origin cross-site, the full path same-site. Keeps quiz ids and
  // attempt ids out of third-party referrer logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses these; deny them rather than inherit permissive defaults.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Ignored over plain HTTP, so it is safe for local development.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Allowlisted hosts only — see lib/images/remote-hosts.ts. Add your own
    // with the IMAGE_ALLOWED_HOSTS env var at build time.
    remotePatterns: getImageRemotePatterns(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/webpack"],
      },
    },
  },
};

export default nextConfig;

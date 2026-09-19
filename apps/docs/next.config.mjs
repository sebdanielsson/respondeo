import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep sharp out of the server functions: Next's image optimizer pulls it
  // (and libvips, ~19 MB) into every function's file trace, but on Vercel
  // /_next/image is served by the platform. See apps/web/next.config.ts. pnpm
  // hoists node_modules to the workspace root two levels up, and the globs
  // don't match leading ../ segments, so the path is spelled out.
  outputFileTracingExcludes: {
    "**": ["../../node_modules/sharp/**", "../../node_modules/@img/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/webpack"],
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
};

export default withMDX(config);

import type { NextConfig } from "next";
import { getImageRemotePatterns } from "./lib/images/remote-hosts";

const nextConfig: NextConfig = {
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

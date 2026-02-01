import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";

// Image metadata
export const alt = siteConfig.name;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Cache for 15 minutes (see docs/development/og-images.md)
export const revalidate = 900;

// Image generation
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 64,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        padding: 48,
      }}
    >
      {/* Logo/Icon area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 24,
            background: "rgba(255, 255, 255, 0.2)",
            fontSize: 64,
          }}
        >
          🎯
        </div>
      </div>

      {/* App name */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        {siteConfig.name}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 32,
          opacity: 0.9,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        {siteConfig.description}
      </div>
    </div>,
    {
      ...size,
    },
  );
}

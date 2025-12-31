import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";

// Route segment config
export const runtime = "edge";

// Image metadata
export const alt = siteConfig.name;
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          {/* Brain Icon - simplified SVG path */}
          <svg
            width="200"
            height="200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 18V5"></path>
            <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"></path>
            <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"></path>
            <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"></path>
            <path d="M18 18a4 4 0 0 0 2-7.464"></path>
            <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"></path>
            <path d="M6 18a4 4 0 0 1-2-7.464"></path>
            <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"></path>
          </svg>
          <div
            style={{
              fontSize: 72,
              fontWeight: "bold",
              marginTop: "20px",
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: "normal",
              opacity: 0.9,
            }}
          >
            {siteConfig.description}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

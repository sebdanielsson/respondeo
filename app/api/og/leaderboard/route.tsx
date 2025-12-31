import { ImageResponse } from "next/og";
import { getGlobalLeaderboard } from "@/lib/db/queries/quiz";

// Route segment config
export const runtime = "edge";

// Revalidate every hour
export const revalidate = 3600;

// Image generation for leaderboard OG image
export async function GET() {
  try {
    // Fetch top 3 players
    const leaderboard = await getGlobalLeaderboard(1, 3);

    // Generate OG image
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "sans-serif",
            padding: "60px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: "20px",
              padding: "60px",
              width: "100%",
              height: "100%",
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 28,
                fontWeight: "normal",
                opacity: 0.9,
                marginBottom: "10px",
              }}
            >
              Quiz App
            </div>

            <div
              style={{
                fontSize: 72,
                fontWeight: "bold",
                marginBottom: "40px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </div>

            {/* Top 3 players */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                width: "100%",
                maxWidth: "800px",
              }}
            >
              {leaderboard.items.map((entry: any, index: number) => (
                <div
                  key={entry.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "20px 40px",
                    fontSize: index === 0 ? 36 : 32,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <span style={{ fontSize: 40, fontWeight: "bold" }}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </span>
                    <span style={{ fontWeight: index === 0 ? "bold" : "normal" }}>
                      {entry.user.name || "Anonymous"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span>✅</span>
                      <span>{entry.totalCorrect}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        opacity: 0.8,
                      }}
                    >
                      <span>📝</span>
                      <span>{entry.quizzesPlayed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {leaderboard.items.length === 0 && (
              <div
                style={{
                  fontSize: 32,
                  opacity: 0.8,
                  textAlign: "center",
                }}
              >
                No players yet. Be the first to take a quiz!
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error("Failed to generate leaderboard OG image:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}

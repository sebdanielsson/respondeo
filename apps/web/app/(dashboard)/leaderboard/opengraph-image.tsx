import { ImageResponse } from "next/og";
import { getCachedGlobalLeaderboard } from "@/lib/db/queries/quiz";
import { siteConfig } from "@/lib/config";

// Image metadata
export const alt = `Global Leaderboard - ${siteConfig.name}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Cache for 15 minutes (see docs/development/og-images.md)
export const revalidate = 900;

// Image generation
export default async function Image() {
  const leaderboard = await getCachedGlobalLeaderboard(1, 3);
  const top3 = leaderboard?.items.slice(0, 3) ?? [];

  // Podium order: 2nd, 1st, 3rd (visually)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "white",
        padding: 48,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginBottom: 48,
        }}
      >
        <div style={{ fontSize: 48, display: "flex" }}>🏆</div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            display: "flex",
          }}
        >
          Global Leaderboard
        </div>
      </div>

      {/* Podium */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 24,
          flex: 1,
        }}
      >
        {top3.length === 0 ? (
          <div
            style={{
              fontSize: 32,
              opacity: 0.7,
              display: "flex",
            }}
          >
            No players yet - be the first!
          </div>
        ) : (
          podiumOrder.map((player) => {
            if (!player) return null;
            const rank = player.rank;
            const isFirst = rank === 1;
            const isSecond = rank === 2;

            const podiumHeight = isFirst ? 200 : isSecond ? 160 : 120;
            const medalEmoji = isFirst ? "🥇" : isSecond ? "🥈" : "🥉";
            const bgColor = isFirst
              ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
              : isSecond
                ? "linear-gradient(180deg, #C0C0C0 0%, #A0A0A0 100%)"
                : "linear-gradient(180deg, #CD7F32 0%, #8B4513 100%)";

            return (
              <div
                key={player.userId}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 280,
                }}
              >
                {/* Avatar and name */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  {player.user?.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={player.user.image}
                      alt=""
                      width={isFirst ? 96 : 72}
                      height={isFirst ? 96 : 72}
                      style={{
                        borderRadius: "50%",
                        border: `4px solid ${isFirst ? "#FFD700" : isSecond ? "#C0C0C0" : "#CD7F32"}`,
                        marginBottom: 12,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: isFirst ? 96 : 72,
                        height: isFirst ? 96 : 72,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isFirst ? 40 : 32,
                        marginBottom: 12,
                        border: `4px solid ${isFirst ? "#FFD700" : isSecond ? "#C0C0C0" : "#CD7F32"}`,
                      }}
                    >
                      👤
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: isFirst ? 28 : 24,
                      fontWeight: 600,
                      textAlign: "center",
                      display: "flex",
                    }}
                  >
                    {(player.user?.displayName || player.user?.name || "Anonymous").slice(0, 15)}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      opacity: 0.8,
                      display: "flex",
                      marginTop: 4,
                    }}
                  >
                    {player.totalCorrect} correct • {player.quizzesPlayed} quizzes
                  </div>
                </div>

                {/* Podium block */}
                <div
                  style={{
                    width: "100%",
                    height: podiumHeight,
                    background: bgColor,
                    borderRadius: "16px 16px 0 0",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 48, display: "flex" }}>{medalEmoji}</div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: isFirst ? "#1a1a2e" : "white",
                      display: "flex",
                    }}
                  >
                    #{rank}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* App branding */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 48,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 24,
          opacity: 0.7,
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            padding: 8,
            borderRadius: 8,
            display: "flex",
          }}
        >
          🎯
        </div>
        {siteConfig.name}
      </div>
    </div>,
    {
      ...size,
    },
  );
}

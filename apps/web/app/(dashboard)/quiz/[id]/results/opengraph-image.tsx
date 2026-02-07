import { ImageResponse } from "next/og";
import { getCachedQuizById, getCachedQuizLeaderboard } from "@/lib/db/queries/quiz";
import { siteConfig } from "@/lib/config";
import type { QuizAttempt, User } from "@/lib/db/schema";

// Leaderboard entry type
type LeaderboardEntry = QuizAttempt & { rank: number; user: User };

// Image metadata
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Cache for 15 minutes (see docs/development/og-images.md)
export const revalidate = 900;

// Generate alt text dynamically
export async function generateImageMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = await getCachedQuizById(id);

  return [
    {
      id: "og",
      alt: quiz ? `${quiz.title} - Leaderboard` : "Quiz Leaderboard",
    },
  ];
}

// Image generation
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quiz, leaderboard] = await Promise.all([
    getCachedQuizById(id),
    getCachedQuizLeaderboard(id, 1, 3),
  ]);

  if (!quiz) {
    return new ImageResponse(
      <div
        style={{
          fontSize: 48,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Quiz not found
      </div>,
      { ...size },
    );
  }

  const top3 = leaderboard?.items.slice(0, 3) ?? [];

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
      {/* Header with quiz title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 40, display: "flex" }}>🏆</div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              display: "flex",
            }}
          >
            Quiz Leaderboard
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.8,
            display: "flex",
            textAlign: "center",
          }}
        >
          {quiz.title.length > 60 ? quiz.title.slice(0, 60) + "..." : quiz.title}
        </div>
      </div>

      {/* Top 3 leaderboard */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
          justifyContent: "center",
        }}
      >
        {top3.length === 0 ? (
          <div
            style={{
              fontSize: 32,
              opacity: 0.7,
              display: "flex",
              justifyContent: "center",
            }}
          >
            No attempts yet - be the first!
          </div>
        ) : (
          top3.map((entry: LeaderboardEntry) => {
            const rank = entry.rank;
            const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const bgOpacity = rank === 1 ? 0.3 : rank === 2 ? 0.2 : 0.15;
            const percentage = Math.round((entry.correctCount / entry.totalQuestions) * 100);

            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  background: `rgba(255, 255, 255, ${bgOpacity})`,
                  padding: "16px 24px",
                  borderRadius: 16,
                }}
              >
                {/* Medal */}
                <div style={{ fontSize: 40, display: "flex" }}>{medalEmoji}</div>

                {/* Avatar */}
                {entry.user?.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.user.image}
                    alt=""
                    width={56}
                    height={56}
                    style={{
                      borderRadius: "50%",
                      border: "3px solid rgba(255,255,255,0.3)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                    }}
                  >
                    👤
                  </div>
                )}

                {/* Name */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 28,
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  {(entry.user?.displayName || entry.user?.name || "Anonymous").slice(0, 20)}
                </div>

                {/* Score */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      display: "flex",
                    }}
                  >
                    {entry.correctCount}/{entry.totalQuestions}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      opacity: 0.7,
                      display: "flex",
                    }}
                  >
                    {percentage}%
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

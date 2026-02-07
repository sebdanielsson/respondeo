import { ImageResponse } from "next/og";
import { getCachedAttemptById } from "@/lib/db/queries/quiz";
import { siteConfig } from "@/lib/config";

// Image metadata
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Cache for 15 minutes (see docs/development/og-images.md)
export const revalidate = 900;

// Generate alt text dynamically
export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await getCachedAttemptById(attemptId);

  if (!attempt) {
    return [{ id: "og", alt: "Quiz Result" }];
  }

  const userName = attempt.user?.displayName || attempt.user?.name || "Someone";
  const percentage = Math.round((attempt.correctCount / attempt.totalQuestions) * 100);

  return [
    {
      id: "og",
      alt: `${userName} scored ${percentage}% on ${attempt.quiz.title}`,
    },
  ];
}

// Image generation
export default async function Image({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await getCachedAttemptById(attemptId);

  if (!attempt) {
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
        Result not found
      </div>,
      { ...size },
    );
  }

  const percentage = Math.round((attempt.correctCount / attempt.totalQuestions) * 100);
  const userName = attempt.user?.displayName || attempt.user?.name || "Anonymous";

  // Determine color based on score
  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "#22c55e"; // green
    if (pct >= 60) return "#eab308"; // yellow
    if (pct >= 40) return "#f97316"; // orange
    return "#ef4444"; // red
  };

  const getScoreEmoji = (pct: number) => {
    if (pct === 100) return "🏆";
    if (pct >= 80) return "🌟";
    if (pct >= 60) return "👍";
    if (pct >= 40) return "📚";
    return "💪";
  };

  const scoreColor = getScoreColor(percentage);
  const scoreEmoji = getScoreEmoji(percentage);

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
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 32, display: "flex" }}>🎯</div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.8,
            display: "flex",
          }}
        >
          Quiz Result
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Score circle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: "50%",
              border: `12px solid ${scoreColor}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ fontSize: 64, display: "flex" }}>{scoreEmoji}</div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: scoreColor,
                display: "flex",
              }}
            >
              {percentage}%
            </div>
          </div>
          <div
            style={{
              fontSize: 32,
              display: "flex",
            }}
          >
            {attempt.correctCount} / {attempt.totalQuestions} correct
          </div>
        </div>

        {/* Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 500,
          }}
        >
          {/* User info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {attempt.user?.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={attempt.user.image}
                alt=""
                width={72}
                height={72}
                style={{
                  borderRadius: "50%",
                  border: "4px solid rgba(255,255,255,0.3)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                👤
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {userName.slice(0, 25)}
              </div>
              <div
                style={{
                  fontSize: 20,
                  opacity: 0.7,
                  display: "flex",
                }}
              >
                completed this quiz
              </div>
            </div>
          </div>

          {/* Quiz title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 18,
                opacity: 0.6,
                display: "flex",
              }}
            >
              QUIZ
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              {attempt.quiz.title.length > 50
                ? attempt.quiz.title.slice(0, 50) + "..."
                : attempt.quiz.title}
            </div>
          </div>
        </div>
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

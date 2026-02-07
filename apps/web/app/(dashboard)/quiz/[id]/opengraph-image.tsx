import { ImageResponse } from "next/og";
import { getCachedQuizById } from "@/lib/db/queries/quiz";
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
export async function generateImageMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = await getCachedQuizById(id);

  return [
    {
      id: "og",
      alt: quiz?.title ?? siteConfig.name,
    },
  ];
}

// Image generation
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = await getCachedQuizById(id);

  if (!quiz) {
    // Fallback for missing quiz
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

  const questionCount = quiz.questions.length;
  const hasHeroImage = !!quiz.heroImageUrl;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Background - hero image or gradient */}
      {hasHeroImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={quiz.heroImageUrl!}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}

      {/* Overlay gradient for readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: hasHeroImage
            ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)"
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 48,
          height: "100%",
          color: "white",
        }}
      >
        {/* Quiz badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              padding: "8px 16px",
              borderRadius: 9999,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🎯 Quiz
          </div>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              padding: "8px 16px",
              borderRadius: 9999,
              fontSize: 20,
              display: "flex",
            }}
          >
            {questionCount} {questionCount === 1 ? "question" : "questions"}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.2,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {quiz.title.length > 50 ? quiz.title.slice(0, 50) + "..." : quiz.title}
        </div>

        {/* Description */}
        {quiz.description && (
          <div
            style={{
              fontSize: 28,
              opacity: 0.9,
              display: "flex",
              flexWrap: "wrap",
              maxWidth: 900,
            }}
          >
            {quiz.description.length > 120
              ? quiz.description.slice(0, 120) + "..."
              : quiz.description}
          </div>
        )}

        {/* App branding */}
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 48,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            opacity: 0.8,
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
      </div>
    </div>,
    {
      ...size,
    },
  );
}

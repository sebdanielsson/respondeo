import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getQuizById } from "@/lib/db/queries/quiz";

// Route segment config
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Revalidate every hour
export const revalidate = 3600;

// Image generation for quiz OG images
export async function GET(request: NextRequest) {
  try {
    // Get quiz ID from search params
    const searchParams = request.nextUrl.searchParams;
    const quizId = searchParams.get("id");

    if (!quizId) {
      return new Response("Missing quiz ID", { status: 400 });
    }

    // Fetch quiz data
    const quiz = await getQuizById(quizId);

    if (!quiz) {
      return new Response("Quiz not found", { status: 404 });
    }

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
            {/* Quiz App branding */}
            <div
              style={{
                fontSize: 28,
                fontWeight: "normal",
                opacity: 0.9,
                marginBottom: "20px",
              }}
            >
              Quiz App
            </div>

            {/* Quiz title */}
            <div
              style={{
                fontSize: 64,
                fontWeight: "bold",
                marginBottom: "30px",
                textAlign: "center",
                maxWidth: "900px",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {quiz.title}
            </div>

            {/* Quiz description */}
            {quiz.description && (
              <div
                style={{
                  fontSize: 32,
                  fontWeight: "normal",
                  opacity: 0.9,
                  textAlign: "center",
                  maxWidth: "800px",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {quiz.description}
              </div>
            )}

            {/* Quiz stats */}
            <div
              style={{
                display: "flex",
                gap: "40px",
                marginTop: "40px",
                fontSize: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span>📝</span>
                <span>{quiz.questions.length} questions</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span>⏱️</span>
                <span>
                  {quiz.timeLimitSeconds === 0
                    ? "No time limit"
                    : quiz.timeLimitSeconds < 60
                      ? `${quiz.timeLimitSeconds}s`
                      : `${Math.floor(quiz.timeLimitSeconds / 60)}m`}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error("Failed to generate quiz OG image:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}

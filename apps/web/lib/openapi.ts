import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS } from "@/lib/validations/quiz";

// Extract language codes for OpenAPI enum
const languageCodes = SUPPORTED_LANGUAGES.map((l) => l.code);

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Respondeo API",
    description:
      "REST API for Respondeo. Create and manage quizzes, submit attempts, and view leaderboards.",
    version: "1.0.0",
    contact: {
      name: "Respondeo",
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      description: "API Server",
    },
  ],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "API key for authentication. Create keys in Settings.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
        },
        required: ["error"],
      },
      PaginationMeta: {
        type: "object",
        properties: {
          totalCount: { type: "integer", description: "Total number of items" },
          totalPages: { type: "integer", description: "Total number of pages" },
          currentPage: { type: "integer", description: "Current page number" },
          hasMore: { type: "boolean", description: "Whether there are more pages" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          image: { type: "string", nullable: true },
        },
      },
      Answer: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          text: { type: "string" },
          isCorrect: { type: "boolean" },
        },
        required: ["text", "isCorrect"],
      },
      AnswerInput: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1 },
          isCorrect: { type: "boolean", default: false },
        },
        required: ["text"],
      },
      Question: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          text: { type: "string" },
          imageUrl: { type: "string", nullable: true },
          order: { type: "integer" },
          answers: {
            type: "array",
            items: { $ref: "#/components/schemas/Answer" },
          },
        },
      },
      QuestionInput: {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1 },
          imageUrl: { type: "string", format: "uri", nullable: true },
          answers: {
            type: "array",
            items: { $ref: "#/components/schemas/AnswerInput" },
            minItems: 2,
            maxItems: 6,
          },
        },
        required: ["text", "answers"],
      },
      Quiz: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string" },
          heroImageUrl: { type: "string" },
          authorId: { type: "string", format: "uuid" },
          language: {
            type: "string",
            enum: languageCodes,
            description: "Quiz language (ISO 639-1 code)",
          },
          difficulty: {
            type: "string",
            enum: DIFFICULTY_LEVELS,
            description: "Quiz difficulty level",
          },
          maxAttempts: { type: "integer", minimum: 1 },
          timeLimitSeconds: { type: "integer", minimum: 0, description: "0 = unlimited" },
          randomizeQuestions: { type: "boolean" },
          randomizeAnswers: { type: "boolean" },
          publishedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Publication date. If in the future, won't be displayed to users.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      QuizWithDetails: {
        allOf: [
          { $ref: "#/components/schemas/Quiz" },
          {
            type: "object",
            properties: {
              author: { $ref: "#/components/schemas/User" },
              questions: {
                type: "array",
                items: { $ref: "#/components/schemas/Question" },
              },
            },
          },
        ],
      },
      QuizListItem: {
        allOf: [
          { $ref: "#/components/schemas/Quiz" },
          {
            type: "object",
            properties: {
              questionCount: { type: "integer" },
              author: { $ref: "#/components/schemas/User" },
            },
          },
        ],
      },
      QuizInput: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 1000 },
          heroImageUrl: { type: "string", format: "uri" },
          language: {
            type: "string",
            enum: languageCodes,
            description: "Quiz language (ISO 639-1 code)",
          },
          difficulty: {
            type: "string",
            enum: DIFFICULTY_LEVELS,
            description: "Quiz difficulty level",
          },
          maxAttempts: { type: "integer", minimum: 1, default: 1 },
          timeLimitSeconds: { type: "integer", minimum: 0, default: 0 },
          randomizeQuestions: { type: "boolean", default: true },
          randomizeAnswers: { type: "boolean", default: true },
          publishedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Publication date. If in the future, won't be displayed to users.",
          },
          questions: {
            type: "array",
            items: { $ref: "#/components/schemas/QuestionInput" },
            minItems: 1,
          },
        },
        required: ["title", "description", "heroImageUrl", "language", "difficulty", "questions"],
      },
      Attempt: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          quizId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          correctCount: { type: "integer" },
          totalQuestions: { type: "integer" },
          totalTimeMs: { type: "integer" },
          timedOut: { type: "boolean" },
          completedAt: { type: "string", format: "date-time" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      AttemptInput: {
        type: "object",
        properties: {
          answers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionId: { type: "string", format: "uuid" },
                answerId: { type: "string", format: "uuid" },
                displayOrder: { type: "integer" },
              },
              required: ["questionId", "answerId", "displayOrder"],
            },
          },
          totalTimeMs: { type: "integer", minimum: 0 },
          timedOut: { type: "boolean", default: false },
        },
        required: ["answers", "totalTimeMs"],
      },
      LeaderboardEntry: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          id: { type: "string", format: "uuid" },
          quizId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          correctCount: { type: "integer" },
          totalQuestions: { type: "integer" },
          totalTimeMs: { type: "integer" },
          timedOut: { type: "boolean" },
          completedAt: { type: "string", format: "date-time" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      GlobalLeaderboardEntry: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          userId: { type: "string", format: "uuid" },
          totalCorrect: { type: "integer" },
          totalTimeMs: { type: "integer" },
          quizzesPlayed: { type: "integer" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
    },
    parameters: {
      PageParam: {
        name: "page",
        in: "query",
        description: "Page number (1-indexed)",
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      LimitParam: {
        name: "limit",
        in: "query",
        description: "Items per page (max 100)",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      },
      QuizIdParam: {
        name: "id",
        in: "path",
        required: true,
        description: "Quiz ID",
        schema: { type: "string", format: "uuid" },
      },
    },
    responses: {
      Unauthorized: {
        description: "Unauthorized - Missing or invalid API key",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Unauthorized" },
          },
        },
      },
      Forbidden: {
        description: "Forbidden - Insufficient permissions",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Missing required permission: quizzes:write" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Quiz not found" },
          },
        },
      },
      BadRequest: {
        description: "Bad request - Invalid input",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Title is required" },
          },
        },
      },
      RateLimited: {
        description: "Too many requests - Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Rate limit exceeded" },
          },
        },
      },
    },
  },
  tags: [
    { name: "Quizzes", description: "Quiz CRUD operations" },
    { name: "Attempts", description: "Quiz attempt submission and retrieval" },
    { name: "Leaderboards", description: "Quiz and global leaderboards" },
  ],
  paths: {
    "/api/quizzes": {
      get: {
        tags: ["Quizzes"],
        summary: "List quizzes",
        description: "Get a paginated list of all quizzes",
        operationId: "listQuizzes",
        parameters: [
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          "200": {
            description: "Paginated list of quizzes",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/PaginationMeta" },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/QuizListItem" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
      post: {
        tags: ["Quizzes"],
        summary: "Create a quiz",
        description: "Create a new quiz with questions and answers. Requires admin role.",
        operationId: "createQuiz",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QuizInput" },
              example: {
                title: "Programming Basics",
                description: "Test your programming knowledge",
                maxAttempts: 3,
                timeLimitSeconds: 300,
                randomizeQuestions: true,
                randomizeAnswers: true,
                questions: [
                  {
                    text: "What does HTML stand for?",
                    answers: [
                      { text: "Hyper Text Markup Language", isCorrect: true },
                      { text: "High Tech Modern Language", isCorrect: false },
                      { text: "Home Tool Markup Language", isCorrect: false },
                    ],
                  },
                ],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Quiz created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quiz" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/quizzes/{id}": {
      get: {
        tags: ["Quizzes"],
        summary: "Get a quiz",
        description: "Get a single quiz with all questions and answers",
        operationId: "getQuiz",
        parameters: [{ $ref: "#/components/parameters/QuizIdParam" }],
        responses: {
          "200": {
            description: "Quiz details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuizWithDetails" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
      put: {
        tags: ["Quizzes"],
        summary: "Update a quiz",
        description: "Update an existing quiz. Requires author or admin role.",
        operationId: "updateQuiz",
        parameters: [{ $ref: "#/components/parameters/QuizIdParam" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QuizInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Quiz updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quiz" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
      delete: {
        tags: ["Quizzes"],
        summary: "Delete a quiz",
        description: "Delete a quiz. Requires author or admin role.",
        operationId: "deleteQuiz",
        parameters: [{ $ref: "#/components/parameters/QuizIdParam" }],
        responses: {
          "204": { description: "Quiz deleted successfully" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/quizzes/{id}/attempts": {
      get: {
        tags: ["Attempts"],
        summary: "List quiz attempts",
        description: "Get a paginated list of attempts for a quiz",
        operationId: "listAttempts",
        parameters: [
          { $ref: "#/components/parameters/QuizIdParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            name: "userId",
            in: "query",
            description: "Filter by user ID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of attempts",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/PaginationMeta" },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Attempt" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
      post: {
        tags: ["Attempts"],
        summary: "Submit a quiz attempt",
        description: "Submit answers for a quiz attempt",
        operationId: "submitAttempt",
        parameters: [{ $ref: "#/components/parameters/QuizIdParam" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AttemptInput" },
              example: {
                answers: [
                  {
                    questionId: "question-uuid",
                    answerId: "answer-uuid",
                    displayOrder: 0,
                  },
                ],
                totalTimeMs: 45000,
                timedOut: false,
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Attempt submitted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Attempt" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/quizzes/{id}/leaderboard": {
      get: {
        tags: ["Leaderboards"],
        summary: "Get quiz leaderboard",
        description: "Get the leaderboard for a specific quiz",
        operationId: "getQuizLeaderboard",
        parameters: [
          { $ref: "#/components/parameters/QuizIdParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          "200": {
            description: "Quiz leaderboard",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/PaginationMeta" },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/LeaderboardEntry" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/leaderboard": {
      get: {
        tags: ["Leaderboards"],
        summary: "Get global leaderboard",
        description: "Get the aggregated leaderboard across all quizzes",
        operationId: "getGlobalLeaderboard",
        parameters: [
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          "200": {
            description: "Global leaderboard",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/PaginationMeta" },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/GlobalLeaderboardEntry" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
  },
};

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter } from "k6/metrics";

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SESSION_TOKEN = __ENV.SESSION_TOKEN;

if (!SESSION_TOKEN) {
  throw new Error(
    "SESSION_TOKEN environment variable is required.\n" +
      "Extract it from browser DevTools: Application > Cookies > better-auth.session_token\n" +
      "Usage: k6 run -e SESSION_TOKEN=your-token-here tests/loadtest.js",
  );
}

// =============================================================================
// Custom Metrics
// =============================================================================

// Duration metrics per endpoint
const quizListDuration = new Trend("quiz_list_duration", true);
const quizFetchDuration = new Trend("quiz_fetch_duration", true);
const attemptSubmitDuration = new Trend("attempt_submit_duration", true);
const leaderboardGlobalDuration = new Trend("leaderboard_global_duration", true);
const leaderboardQuizDuration = new Trend("leaderboard_quiz_duration", true);

// Error counters per endpoint
const quizListErrors = new Counter("quiz_list_errors");
const quizFetchErrors = new Counter("quiz_fetch_errors");
const attemptSubmitErrors = new Counter("attempt_submit_errors");
const leaderboardErrors = new Counter("leaderboard_errors");

// =============================================================================
// k6 Options
// =============================================================================

export const options = {
  scenarios: {
    // Browsers: Users who browse quiz lists (60% of traffic)
    browsers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 400 }, // Warm-up
        { duration: "1m", target: 800 }, // Ramp to normal load
        { duration: "4m", target: 1200 }, // Sustained peak (13x original)
        { duration: "30s", target: 0 }, // Cool down
      ],
      exec: "browserScenario",
      gracefulRampDown: "10s",
    },
    // Players: Users who play quizzes and submit attempts (30% of traffic)
    players: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 200 }, // Warm-up
        { duration: "1m", target: 400 }, // Ramp to normal load
        { duration: "4m", target: 600 }, // Sustained peak (13x original)
        { duration: "30s", target: 0 }, // Cool down
      ],
      exec: "playerScenario",
      gracefulRampDown: "30s", // Longer grace for in-flight attempts
    },
    // Spectators: Users who view leaderboards (10% of traffic)
    spectators: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 67 }, // Warm-up
        { duration: "1m", target: 133 }, // Ramp to normal load
        { duration: "4m", target: 200 }, // Sustained peak (13x original)
        { duration: "30s", target: 0 }, // Cool down
      ],
      exec: "spectatorScenario",
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // Global thresholds
    http_req_failed: ["rate<0.01"], // <1% errors overall
    http_req_duration: ["p(95)<1000"], // 95% under 1s

    // Read endpoint thresholds (should be fast)
    quiz_list_duration: ["p(95)<500", "p(99)<1000"],
    quiz_fetch_duration: ["p(95)<500", "p(99)<1000"],
    leaderboard_global_duration: ["p(95)<500", "p(99)<1000"],
    leaderboard_quiz_duration: ["p(95)<500", "p(99)<1000"],

    // Write endpoint thresholds (can be slower)
    attempt_submit_duration: ["p(95)<1000", "p(99)<2000"],
  },
};

// =============================================================================
// Shared Headers
// =============================================================================

function getHeaders() {
  return {
    Cookie: `better-auth.session_token=${SESSION_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// =============================================================================
// Setup: Validate session and fetch available quizzes
// =============================================================================

export function setup() {
  console.log(`🚀 Starting load test against ${BASE_URL}`);

  // Validate session token
  const sessionRes = http.get(`${BASE_URL}/api/auth/get-session`, {
    headers: getHeaders(),
  });

  const sessionValid = check(sessionRes, {
    "session is valid": (r) => r.status === 200,
    "session has user": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.user && body.user.id;
      } catch {
        return false;
      }
    },
  });

  if (!sessionValid) {
    throw new Error(
      `Invalid session token. Status: ${sessionRes.status}, Body: ${sessionRes.body}`,
    );
  }

  const sessionData = JSON.parse(sessionRes.body);
  console.log(`✅ Authenticated as: ${sessionData.user.email || sessionData.user.name}`);

  // Fetch available quizzes for the test
  const quizzesRes = http.get(`${BASE_URL}/api/quizzes?limit=50`, {
    headers: getHeaders(),
  });

  const quizzesValid = check(quizzesRes, {
    "quizzes fetch succeeded": (r) => r.status === 200,
    "quizzes response has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.items) && body.items.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!quizzesValid) {
    throw new Error(
      `Failed to fetch quizzes for test. Status: ${quizzesRes.status}. ` +
        `Make sure there are quizzes in the database.`,
    );
  }

  const quizzesData = JSON.parse(quizzesRes.body);
  const quizIds = quizzesData.items.map((q) => q.id);

  console.log(`📚 Found ${quizIds.length} quizzes available for testing`);

  return {
    quizIds,
    userId: sessionData.user.id,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// =============================================================================
// User Flows
// =============================================================================

/**
 * Browse quizzes - simulates a user browsing the quiz list
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function browseQuizzes(data) {
  group("Browse Quizzes", () => {
    const page = randomInt(1, 3);
    const limit = randomElement([10, 20, 50]);

    const res = http.get(`${BASE_URL}/api/quizzes?page=${page}&limit=${limit}`, {
      headers: getHeaders(),
      tags: { name: "GET /api/quizzes" },
    });

    quizListDuration.add(res.timings.duration);

    const success = check(res, {
      "quiz list: status 200": (r) => r.status === 200,
      "quiz list: has items array": (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items);
        } catch {
          return false;
        }
      },
      "quiz list: has pagination": (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.totalCount === "number" && typeof body.currentPage === "number";
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      quizListErrors.add(1);
    }

    // Think time: user reads the quiz list
    sleep(randomInt(2, 5));
  });
}

/**
 * View a single quiz - simulates viewing quiz details before playing
 */
function viewQuiz(data) {
  const quizId = randomElement(data.quizIds);

  let quizData = null;

  group("View Quiz", () => {
    const res = http.get(`${BASE_URL}/api/quizzes/${quizId}`, {
      headers: getHeaders(),
      tags: { name: "GET /api/quizzes/:id" },
    });

    quizFetchDuration.add(res.timings.duration);

    const success = check(res, {
      "quiz fetch: status 200": (r) => r.status === 200,
      "quiz fetch: has questions": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id && Array.isArray(body.questions);
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      quizFetchErrors.add(1);
    } else {
      try {
        quizData = JSON.parse(res.body);
      } catch {
        // Failed to parse, quizData remains null
      }
    }

    // Think time: user reads quiz details
    sleep(randomInt(2, 4));
  });

  return quizData;
}

/**
 * Play and submit a quiz attempt
 */
function playQuiz(data) {
  const quizData = viewQuiz(data);

  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    console.log("⚠️ No quiz data available, skipping attempt submission");
    return;
  }

  group("Play Quiz", () => {
    // Simulate time spent answering questions (20-60 seconds)
    const playTimeMs = randomInt(20000, 60000);
    const playTimeSec = playTimeMs / 1000;

    // Simulate playing by waiting proportionally (scaled down for load test)
    sleep(Math.min(playTimeSec / 10, 6)); // Max 6 seconds actual wait

    // Build answers payload - randomly select answers for each question
    const answers = quizData.questions.map((question, index) => {
      const randomAnswer = randomElement(question.answers);
      return {
        questionId: question.id,
        answerId: randomAnswer ? randomAnswer.id : null,
        displayOrder: index + 1,
      };
    });

    const payload = JSON.stringify({
      answers,
      totalTimeMs: playTimeMs,
      timedOut: false,
    });

    const res = http.post(`${BASE_URL}/api/quizzes/${quizData.id}/attempts`, payload, {
      headers: getHeaders(),
      tags: { name: "POST /api/quizzes/:id/attempts" },
    });

    attemptSubmitDuration.add(res.timings.duration);

    const success = check(res, {
      "attempt submit: status 200 or 201": (r) => r.status === 200 || r.status === 201,
      "attempt submit: has attempt data": (r) => {
        try {
          const body = JSON.parse(r.body);
          // Attempt is returned directly at root level with correctCount field
          return body.id && typeof body.correctCount === "number";
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      attemptSubmitErrors.add(1);
      if (res.status !== 200 && res.status !== 201) {
        console.log(`❌ Attempt failed: ${res.status} - ${res.body}`);
      }
    }

    // Think time: user views their results
    sleep(randomInt(3, 6));
  });
}

/**
 * View global leaderboard
 */
function viewGlobalLeaderboard() {
  group("View Global Leaderboard", () => {
    const limit = randomElement([10, 25, 50]);

    const res = http.get(`${BASE_URL}/api/leaderboard?limit=${limit}`, {
      headers: getHeaders(),
      tags: { name: "GET /api/leaderboard" },
    });

    leaderboardGlobalDuration.add(res.timings.duration);

    const success = check(res, {
      "global leaderboard: status 200": (r) => r.status === 200,
      "global leaderboard: has entries": (r) => {
        try {
          const body = JSON.parse(r.body);
          // Leaderboard uses 'items' array, same as other paginated endpoints
          return Array.isArray(body.items);
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      leaderboardErrors.add(1);
    }

    // Think time: user browses leaderboard
    sleep(randomInt(3, 8));
  });
}

/**
 * View quiz-specific leaderboard
 */
function viewQuizLeaderboard(data) {
  group("View Quiz Leaderboard", () => {
    const quizId = randomElement(data.quizIds);

    const res = http.get(`${BASE_URL}/api/quizzes/${quizId}/leaderboard`, {
      headers: getHeaders(),
      tags: { name: "GET /api/quizzes/:id/leaderboard" },
    });

    leaderboardQuizDuration.add(res.timings.duration);

    const success = check(res, {
      "quiz leaderboard: status 200": (r) => r.status === 200,
      "quiz leaderboard: has entries": (r) => {
        try {
          const body = JSON.parse(r.body);
          // Leaderboard uses 'items' array, same as other paginated endpoints
          return Array.isArray(body.items);
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      leaderboardErrors.add(1);
    }

    // Think time: user browses leaderboard
    sleep(randomInt(3, 8));
  });
}

// =============================================================================
// Scenarios
// =============================================================================

/**
 * Browser scenario: Users who browse and view quizzes but don't play
 */
export function browserScenario(data) {
  browseQuizzes(data);

  // 70% chance to view a specific quiz after browsing
  if (Math.random() < 0.7) {
    viewQuiz(data);
  }
}

/**
 * Player scenario: Users who browse, play quizzes, and submit attempts
 */
export function playerScenario(data) {
  browseQuizzes(data);
  playQuiz(data);

  // 50% chance to check leaderboard after playing
  if (Math.random() < 0.5) {
    viewQuizLeaderboard(data);
  }
}

/**
 * Spectator scenario: Users who mainly view leaderboards
 */
export function spectatorScenario(data) {
  // 60% global leaderboard, 40% quiz-specific
  if (Math.random() < 0.6) {
    viewGlobalLeaderboard();
  } else {
    viewQuizLeaderboard(data);
  }

  // Sometimes browse quizzes too
  if (Math.random() < 0.3) {
    browseQuizzes(data);
  }
}

// =============================================================================
// Teardown
// =============================================================================

export function teardown(data) {
  console.log(`\n📊 Load test completed`);
  console.log(`   Tested ${data.quizIds.length} quizzes`);
  console.log(`   Check the summary above for detailed metrics`);
}

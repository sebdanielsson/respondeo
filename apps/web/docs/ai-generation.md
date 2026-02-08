# AI Quiz Generation

The app supports AI-powered quiz generation using the [Vercel AI SDK](https://ai-sdk.dev/). Users with the appropriate permissions can generate complete quizzes from a simple theme or topic description.

## Overview

- **Multi-Provider Support**: Built-in support for OpenAI, Anthropic, and Google AI
- **Web Search**: Optional web search for up-to-date information about recent topics
- **Structured Output**: Uses Zod schemas to ensure consistent, validated quiz output
- **User Tracking**: Per-user cost tracking via provider dashboards
- **Rate Limiting**: Dual-layer rate limiting (per-user and global) to control costs
- **RBAC Protected**: Only users with `ai:quiz-generate` permission can access

## Quick Start

### 1. Install Dependencies

The AI SDK and OpenAI provider are already included. No additional installation needed.

### 2. Set Environment Variables

Add your API key to `.env.local`:

```env
AI_PROVIDER="openai"
AI_MODEL="gpt-5-mini"
OPENAI_API_KEY="sk-your-api-key-here"

# Optional: Enable web search for up-to-date quizzes
AI_WEB_SEARCH_ENABLED="true"
```

### 3. Configure Rate Limits (Optional)

```env
RATE_LIMIT_AI_USER="4"           # Per user per day
RATE_LIMIT_AI_USER_WINDOW_MS="86400000"
RATE_LIMIT_AI_GLOBAL="10"        # Total per hour
RATE_LIMIT_AI_GLOBAL_WINDOW_MS="3600000"
```

### 4. Ensure User Has Permission

By default, `admin`, `moderator`, and `creator` roles have the `ai:quiz-generate` permission.

## Environment Variables

### AI Configuration

| Variable                       | Type    | Default           | Description                                           |
| ------------------------------ | ------- | ----------------- | ----------------------------------------------------- |
| `AI_PROVIDER`                  | string  | `openai`          | AI provider: `openai`, `anthropic`, `google`          |
| `AI_MODEL`                     | string  | Provider-specific | Model to use (e.g., `gpt-5-mini`, `claude-haiku-4-5`) |
| `AI_WEB_SEARCH_ENABLED`        | boolean | `false`           | Enable web search for up-to-date quiz content         |
| `OPENAI_API_KEY`               | string  | -                 | OpenAI API key (required for OpenAI)                  |
| `ANTHROPIC_API_KEY`            | string  | -                 | Anthropic API key (required for Anthropic)            |
| `GOOGLE_GENERATIVE_AI_API_KEY` | string  | -                 | Google API key (required for Google)                  |

### Rate Limiting

| Variable                         | Type   | Default    | Description                           |
| -------------------------------- | ------ | ---------- | ------------------------------------- |
| `RATE_LIMIT_AI_USER`             | number | `4`        | AI generations per user per window    |
| `RATE_LIMIT_AI_USER_WINDOW_MS`   | number | `86400000` | Per-user window in ms (default: 24h)  |
| `RATE_LIMIT_AI_GLOBAL`           | number | `10`       | Total AI generations across all users |
| `RATE_LIMIT_AI_GLOBAL_WINDOW_MS` | number | `3600000`  | Global window in ms (default: 1h)     |

## Supported Providers

### OpenAI (Default)

```env
AI_PROVIDER="openai"
AI_MODEL="gpt-5-mini"
OPENAI_API_KEY="sk-..."
```

Default model: `gpt-5-mini`

**Web Search**: Uses OpenAI's Responses API web search tool with configurable context size.

### Anthropic

```env
AI_PROVIDER="anthropic"
AI_MODEL="claude-haiku-4-5"
ANTHROPIC_API_KEY="sk-ant-..."
```

Default model: `claude-haiku-4-5`
**Web Search**: Uses Anthropic's `web_search_20250305` server tool.

### Google

```env
AI_PROVIDER="google"
AI_MODEL="gemini-3-flash-preview"
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

Default model: `gemini-3-flash-preview`

**Web Search**: Uses Google Search grounding for real-time information.

## Web Search

Web search allows the AI to look up current information when generating quizzes. This is especially useful for:

- Recent movies, games, or music releases
- Current events and news topics
- Up-to-date sports statistics
- Latest technology and science discoveries

### Enabling Web Search

Set the environment variable:

```env
AI_WEB_SEARCH_ENABLED="true"
```

When enabled, users will see a toggle in the AI Quiz Generator dialog to enable/disable web search per generation. The toggle defaults to ON.

### Provider-Specific Implementation

| Provider  | Web Search Tool       | Features                                    |
| --------- | --------------------- | ------------------------------------------- |
| OpenAI    | `webSearch`           | Medium context size, integrated results     |
| Anthropic | `web_search_20250305` | Up to 3 searches per request                |
| Google    | `googleSearch`        | Google Search grounding with real-time data |

### Cost Considerations

Web search may incur additional costs depending on your provider. Check your provider's pricing for web search/grounding features.

## RBAC Permission

The `ai:quiz-generate` permission controls access to AI quiz generation.

### Default Role Access

| Role        | Has Permission |
| ----------- | -------------- |
| `admin`     | ✅             |
| `moderator` | ✅             |
| `creator`   | ✅             |
| `user`      | ❌             |
| `guest`     | ❌             |

### Granting to Additional Roles

To grant AI generation to all users:

```env
RBAC_ROLE_USER_PERMISSIONS="quiz:browse,quiz:view,quiz:play,leaderboard:view,leaderboard:submit,ai:quiz-generate"
```

Or override the default role to `creator`:

```env
RBAC_DEFAULT_ROLE="creator"
```

## Generation Options

When generating a quiz, users can configure:

| Option         | Range            | Default  | Description                                     |
| -------------- | ---------------- | -------- | ----------------------------------------------- |
| Theme          | 1-500            | Required | Topic/subject for the quiz                      |
| Question Count | 1-20             | 10       | Number of questions to generate                 |
| Answer Count   | 2-6              | 4        | Answers per question                            |
| Difficulty     | easy/medium/hard | medium   | Question complexity level                       |
| Language       | ISO 639-1        | en       | Language for all content                        |
| Web Search     | true/false       | true     | Use web search for up-to-date info (if enabled) |

### Difficulty Levels

- **Easy**: Straightforward factual questions with obviously wrong answers
- **Medium**: Requires subject knowledge with plausible distractors
- **Hard**: Nuanced questions requiring deep knowledge and careful distinction

### Supported Languages

| Code | Language   |
| ---- | ---------- |
| en   | English    |
| es   | Spanish    |
| fr   | French     |
| de   | German     |
| sv   | Swedish    |
| pt   | Portuguese |
| it   | Italian    |
| nl   | Dutch      |
| pl   | Polish     |
| ja   | Japanese   |
| zh   | Chinese    |
| ko   | Korean     |

## Usage in Code

### Server Action

```typescript
import { generateQuizWithAI } from "@/app/actions/generate-quiz";

const result = await generateQuizWithAI({
  theme: "World Geography",
  questionCount: 10,
  answerCount: 4,
  difficulty: "medium",
  language: "en",
  useWebSearch: true, // Optional: enable web search for current info
});

if (result.success) {
  // result.data contains: title, description, questions, language, difficulty
  console.log(result.data.title);
} else {
  // result.error contains error message
  // result.errorCode: UNAUTHENTICATED | FORBIDDEN | RATE_LIMITED | AI_DISABLED | VALIDATION | AI_ERROR
  console.error(result.error);
}
```

### Permission Check

```typescript
import { canGenerateAIQuiz } from "@/lib/rbac";

if (canGenerateAIQuiz(session.user)) {
  // Show AI generation button
}
```

### Rate Limit Status

```typescript
import { getAIRateLimitStatus } from "@/lib/rate-limit";

const status = getAIRateLimitStatus(userId);
// {
//   userCount: 2,
//   userRemaining: 2,
//   userResetInMs: 43200000,
//   globalCount: 5,
//   globalRemaining: 5,
//   globalResetInMs: 1800000
// }
```

## Cost Considerations

AI quiz generation uses external APIs that charge per request/token. To manage costs:

1. **Set appropriate rate limits**: Start conservative and increase as needed
2. **Monitor usage**: Check your AI provider's dashboard regularly
3. **Track per-user costs**: User IDs are sent with each request for cost attribution
4. **Use smaller models**: `gpt-5-mini` is significantly cheaper than `gpt-5`
5. **Limit question count**: More questions = more tokens = higher cost
6. **Disable web search**: If not needed, disable `AI_WEB_SEARCH_ENABLED` to reduce costs

_Actual costs vary based on prompt length, response size, and web search usage._

## Troubleshooting

### "AI features are not configured"

The API key is missing or invalid:

1. Check that `OPENAI_API_KEY` is set in `.env.local`
2. Verify the key is valid at [OpenAI Platform](https://platform.openai.com/api-keys)
3. Restart the development server after adding the key

### "You don't have permission"

User lacks the `ai:quiz-generate` permission:

1. Check user's role: `getUserRole(session.user)`
2. Verify role has the permission (admin/moderator/creator by default)
3. Override permissions if needed via environment variables

### "Rate limit exceeded"

User or system has hit rate limits:

1. Check current status with `getAIRateLimitStatus(userId)`
2. Wait for the reset window
3. Adjust limits in environment variables if needed

### "AI failed to generate a valid quiz"

The AI response didn't match the expected schema:

1. Try again - AI responses can be inconsistent
2. Simplify the theme/topic
3. Try a different difficulty level
4. Check API status at your provider's status page

## Security Notes

1. **API Key Protection**: Never expose API keys in client-side code. The generation action runs server-side only.

2. **Rate Limiting**: Dual-layer limits (per-user + global) prevent both individual abuse and runaway costs.

3. **Input Validation**: All user input is validated before being sent to the AI.

4. **Output Validation**: AI responses are validated against Zod schemas before use.

5. **RBAC Enforcement**: Permission checks happen server-side and cannot be bypassed.

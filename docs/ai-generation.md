# AI Quiz Generation

The Quiz App supports AI-powered quiz generation using the [Vercel AI SDK](https://ai-sdk.dev/). Users with the appropriate permissions can generate complete quizzes from a simple theme or topic description.

## Overview

- **Modular Provider System**: Supports multiple AI providers (OpenAI, OpenRouter, with extensibility to Anthropic, Google)
- **Structured Output**: Uses Zod schemas to ensure consistent, validated quiz output
- **Rate Limiting**: Dual-layer rate limiting (per-user and global) to control costs
- **RBAC Protected**: Only users with `ai:quiz-generate` permission can access

## Quick Start

### 1. Install Dependencies

The AI SDK and OpenAI provider are already included. No additional installation needed.

### 2. Set Environment Variables

Add your OpenAI API key to `.env.local`:

```env
AI_PROVIDER="openai"
AI_MODEL="gpt-5-mini"
OPENAI_API_KEY="sk-your-api-key-here"
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

| Variable                       | Type   | Default           | Description                                                |
| ------------------------------ | ------ | ----------------- | ---------------------------------------------------------- |
| `AI_PROVIDER`                  | string | `openai`          | AI provider: `openai`, `openrouter`, `anthropic`, `google` |
| `AI_MODEL`                     | string | Provider-specific | Model to use (e.g., `gpt-5-mini`, `openai/gpt-5-mini`)     |
| `OPENAI_API_KEY`               | string | -                 | OpenAI API key (required for OpenAI)                       |
| `OPENROUTER_API_KEY`           | string | -                 | OpenRouter API key (required for OpenRouter)               |
| `ANTHROPIC_API_KEY`            | string | -                 | Anthropic API key (for Anthropic)                          |
| `GOOGLE_GENERATIVE_AI_API_KEY` | string | -                 | Google API key (for Google)                                |

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
AI_MODEL="gpt-5-mini"  # or gpt-4o, gpt-4-turbo, etc.
OPENAI_API_KEY="sk-..."
```

Default model: `gpt-5-mini`

### OpenRouter

[OpenRouter](https://openrouter.ai/) provides access to hundreds of AI models from multiple providers with a single API key.

```env
AI_PROVIDER="openrouter"
AI_MODEL="openai/gpt-5-mini"  # or anthropic/claude-3.5-sonnet, meta-llama/llama-3.1-405b-instruct, etc.
OPENROUTER_API_KEY="sk-or-..."
```

Default model: `openai/gpt-5-mini`
Get your API key from the [OpenRouter Dashboard](https://openrouter.ai/keys). See available models at [OpenRouter Models](https://openrouter.ai/docs#models).

### Adding Anthropic Support

1. Install the provider:

   ```bash
   bun add @ai-sdk/anthropic
   ```

2. Update `lib/ai/providers.ts`:

   ```typescript
   import { anthropic } from '@ai-sdk/anthropic';

   // In getModelForProvider():
   case "anthropic":
     return anthropic(model);
   ```

3. Set environment variables:

   ```env
   AI_PROVIDER="anthropic"
   AI_MODEL="claude-sonnet-4-20250514"
   ANTHROPIC_API_KEY="sk-ant-..."
   ```

### Adding Google Support

1. Install the provider:

   ```bash
   bun add @ai-sdk/google
   ```

2. Update `lib/ai/providers.ts`:

   ```typescript
   import { google } from '@ai-sdk/google';

   // In getModelForProvider():
   case "google":
     return google(model);
   ```

3. Set environment variables:

   ```env
   AI_PROVIDER="google"
   AI_MODEL="gemini-2.0-flash"
   GOOGLE_GENERATIVE_AI_API_KEY="..."
   ```

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

| Option         | Range            | Default  | Description                     |
| -------------- | ---------------- | -------- | ------------------------------- |
| Theme          | 1-500            | Required | Topic/subject for the quiz      |
| Question Count | 1-20             | 10       | Number of questions to generate |
| Answer Count   | 2-6              | 4        | Answers per question            |
| Difficulty     | easy/medium/hard | medium   | Question complexity level       |
| Language       | ISO 639-1        | en       | Language for all content        |

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
3. **Use smaller models**: `gpt-5-mini` is significantly cheaper than `gpt-4`
4. **Limit question count**: More questions = more tokens = higher cost

### Estimated Costs (OpenAI)

| Model       | ~Cost per Quiz (10 questions) |
| ----------- | ----------------------------- |
| gpt-5-mini  | ~$0.002                       |
| gpt-4o      | ~$0.02                        |
| gpt-4-turbo | ~$0.04                        |

_Actual costs vary based on prompt length and response size._

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

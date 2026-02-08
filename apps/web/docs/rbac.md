# Role-Based Access Control (RBAC)

The app includes a flexible, environment-variable-driven RBAC system that allows you to configure authentication requirements, roles, and permissions for your specific use case.

## Overview

The RBAC system follows enterprise best practices:

- **Stateless**: Roles are resolved from OIDC groups at request time
- **Flat permissions**: Each role has an explicit list of permissions (no hidden inheritance)
- **Configurable via environment variables**: No code changes needed for different deployments
- **Public access support**: Optionally allow unauthenticated access to certain features

## Quick Start

### Default Configuration (Private App)

By default, the app requires authentication for all features:

```env
# No RBAC_ variables needed - defaults to private, authenticated access
OIDC_PROVIDER_ID=your-idp
NEXT_PUBLIC_OIDC_PROVIDER_ID=your-idp
OIDC_ISSUER=https://your-idp.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-secret
```

### Public Quiz Platform

Allow guests to browse and view quizzes, but require sign-in to play:

```env
RBAC_PUBLIC_BROWSE_QUIZZES=true
RBAC_PUBLIC_VIEW_QUIZ=true
RBAC_PUBLIC_LEADERBOARD=true
RBAC_PUBLIC_PLAY_QUIZ=false
RBAC_DEFAULT_ROLE=user
```

### Internal Team (Everyone Can Create)

All authenticated users can create quizzes:

```env
RBAC_DEFAULT_ROLE=creator
RBAC_ROLE_ADMIN_GROUPS=it-admins
```

### Classroom Setup

Teachers can create quizzes, students can only play:

```env
RBAC_DEFAULT_ROLE=user
RBAC_ROLE_CREATOR_GROUPS=teachers,instructors
RBAC_ROLE_ADMIN_GROUPS=staff
```

## Environment Variables

### Public Access Settings

| Variable                     | Type    | Default | Description                                                |
| ---------------------------- | ------- | ------- | ---------------------------------------------------------- |
| `RBAC_PUBLIC_BROWSE_QUIZZES` | boolean | `false` | Allow unauthenticated users to view the quiz list          |
| `RBAC_PUBLIC_VIEW_QUIZ`      | boolean | `false` | Allow unauthenticated users to view quiz details           |
| `RBAC_PUBLIC_PLAY_QUIZ`      | boolean | `false` | Allow unauthenticated users to play quizzes (not recorded) |
| `RBAC_PUBLIC_LEADERBOARD`    | boolean | `false` | Allow unauthenticated users to view the global leaderboard |

### Rate Limiting (Guest Plays)

When `RBAC_PUBLIC_PLAY_QUIZ=true`, guests can play quizzes without signing in. To prevent abuse, rate limiting is applied per IP address:

| Variable                 | Type   | Default | Description                             |
| ------------------------ | ------ | ------- | --------------------------------------- |
| `RATE_LIMIT_GUEST_PLAYS` | number | `5`     | Maximum quiz plays per IP in the window |
| `RATE_LIMIT_WINDOW_MS`   | number | `60000` | Rate limit window in milliseconds (1m)  |

Example configurations:

```env
# Strict: 3 plays per minute
RATE_LIMIT_GUEST_PLAYS=3
RATE_LIMIT_WINDOW_MS=60000

# Relaxed: 10 plays per 5 minutes
RATE_LIMIT_GUEST_PLAYS=10
RATE_LIMIT_WINDOW_MS=300000
```

> **Note**: Rate limiting uses in-memory storage, which means:
>
> - Limits reset when the server restarts
> - In multi-instance deployments, each instance tracks limits independently
> - For production scaling, consider implementing Redis-based rate limiting (e.g., `@upstash/ratelimit`)

When a guest exceeds the rate limit, they are redirected to the quiz page with an error message indicating when they can try again.

### Rate Limiting (AI Generation)

AI quiz generation is rate limited at two levels to control costs and prevent abuse:

| Variable                         | Type   | Default    | Description                           |
| -------------------------------- | ------ | ---------- | ------------------------------------- |
| `RATE_LIMIT_AI_USER`             | number | `4`        | AI generations per user per window    |
| `RATE_LIMIT_AI_USER_WINDOW_MS`   | number | `86400000` | Per-user window in milliseconds (24h) |
| `RATE_LIMIT_AI_GLOBAL`           | number | `10`       | Total AI generations across all users |
| `RATE_LIMIT_AI_GLOBAL_WINDOW_MS` | number | `3600000`  | Global window in milliseconds (1h)    |

Example configurations:

```env
# Conservative: 2 per user per day, 5 globally per hour
RATE_LIMIT_AI_USER=2
RATE_LIMIT_AI_USER_WINDOW_MS=86400000
RATE_LIMIT_AI_GLOBAL=5
RATE_LIMIT_AI_GLOBAL_WINDOW_MS=3600000

# Liberal: 10 per user per day, 50 globally per hour
RATE_LIMIT_AI_USER=10
RATE_LIMIT_AI_USER_WINDOW_MS=86400000
RATE_LIMIT_AI_GLOBAL=50
RATE_LIMIT_AI_GLOBAL_WINDOW_MS=3600000
```

For more details on AI configuration, see [AI Generation](./ai-generation.md).

### Role Assignment

| Variable                     | Type   | Default   | Description                                                |
| ---------------------------- | ------ | --------- | ---------------------------------------------------------- |
| `RBAC_DEFAULT_ROLE`          | string | `user`    | Role assigned to authenticated users without group mapping |
| `RBAC_ROLE_ADMIN_GROUPS`     | string | `admin`   | Comma-separated OIDC groups that map to admin role         |
| `RBAC_ROLE_MODERATOR_GROUPS` | string | _(empty)_ | Comma-separated OIDC groups that map to moderator role     |
| `RBAC_ROLE_CREATOR_GROUPS`   | string | _(empty)_ | Comma-separated OIDC groups that map to creator role       |
| `RBAC_ROLE_USER_GROUPS`      | string | _(empty)_ | Comma-separated OIDC groups that map to user role          |

### Permission Overrides

Override the default permissions for any role. Use comma-separated permission strings.

| Variable                          | Type   | Description                    |
| --------------------------------- | ------ | ------------------------------ |
| `RBAC_ROLE_ADMIN_PERMISSIONS`     | string | Override admin permissions     |
| `RBAC_ROLE_MODERATOR_PERMISSIONS` | string | Override moderator permissions |
| `RBAC_ROLE_CREATOR_PERMISSIONS`   | string | Override creator permissions   |
| `RBAC_ROLE_USER_PERMISSIONS`      | string | Override user permissions      |
| `RBAC_ROLE_GUEST_PERMISSIONS`     | string | Override guest permissions     |

Use `*` to grant all permissions (admin wildcard).

## Roles

The app defines five roles, listed in priority order (highest first):

| Role        | Description                                      |
| ----------- | ------------------------------------------------ |
| `admin`     | Full system access, can manage API keys          |
| `moderator` | Can edit/delete any quiz, publish quizzes        |
| `creator`   | Can create quizzes and manage their own          |
| `user`      | Can play quizzes and view leaderboards           |
| `guest`     | Unauthenticated users (if public access enabled) |

### Role Resolution

When a user authenticates, their role is determined by:

1. **OIDC Group Matching**: Check user's groups against `RBAC_ROLE_<NAME>_GROUPS` in priority order
2. **Default Role**: If no group matches, assign `RBAC_DEFAULT_ROLE`
3. **Guest**: Unauthenticated users are assigned the `guest` role

```
User groups: ["engineering", "teachers"]

RBAC_ROLE_ADMIN_GROUPS=it-admins        → No match
RBAC_ROLE_MODERATOR_GROUPS=             → No groups configured
RBAC_ROLE_CREATOR_GROUPS=teachers       → Match! User gets "creator" role
```

## Permissions

### Available Permissions

| Permission           | Description                       |
| -------------------- | --------------------------------- |
| `quiz:browse`        | View the quiz list                |
| `quiz:view`          | View quiz details                 |
| `quiz:play`          | Play/attempt quizzes              |
| `quiz:create`        | Create new quizzes                |
| `quiz:edit-own`      | Edit quizzes you created          |
| `quiz:edit-any`      | Edit any quiz                     |
| `quiz:delete-own`    | Delete quizzes you created        |
| `quiz:delete-any`    | Delete any quiz                   |
| `quiz:publish`       | Publish/unpublish quizzes         |
| `ai:quiz-generate`   | Generate quizzes using AI         |
| `leaderboard:view`   | View leaderboards                 |
| `leaderboard:submit` | Submit scores to leaderboard      |
| `api-key:manage`     | Create and delete API keys        |
| `settings:manage`    | Access settings page              |
| `admin:*`            | Wildcard - grants all permissions |

### Default Role Permissions

| Role        | Default Permissions                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| `guest`     | `quiz:browse`, `quiz:view`, `leaderboard:view`                                        |
| `user`      | `quiz:browse`, `quiz:view`, `quiz:play`, `leaderboard:view`, `leaderboard:submit`     |
| `creator`   | All of `user` + `quiz:create`, `quiz:edit-own`, `quiz:delete-own`, `ai:quiz-generate` |
| `moderator` | All of `creator` + `quiz:edit-any`, `quiz:delete-any`, `quiz:publish`                 |
| `admin`     | `*` (all permissions)                                                                 |

> **Note**: Permissions are explicit per role. The table above shows logical groupings, but each role has its full list defined independently.

## API Keys

API keys inherit permissions dynamically from the user's current role:

- When a user creates an API key, it's associated with their user account
- At request time, the API key user's role is resolved using the current RBAC configuration
- If an admin removes the `quiz:create` permission from a role, all API keys for users with that role lose that permission immediately

This ensures configuration changes take effect immediately without regenerating API keys.

## Usage in Code

### Checking Permissions

```typescript
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

// In a server component or action
if (hasPermission(session.user, PERMISSIONS.QUIZ_CREATE)) {
  // User can create quizzes
}
```

### Resource-Level Checks

```typescript
import { canEditQuiz, canDeleteQuiz } from "@/lib/rbac";

// Check if user can edit a specific quiz
if (canEditQuiz(session.user, quiz.authorId)) {
  // Show edit button
}
```

### Getting User Role

```typescript
import { getUserRole, resolveRole } from "@/lib/rbac";

// Simple role string
const role = getUserRole(session.user); // "admin" | "moderator" | "creator" | "user" | "guest"

// Detailed resolution info
const { role, source, matchedGroup } = resolveRole(session.user);
// { role: "creator", source: "oidc-group", matchedGroup: "teachers" }
```

### Public Access Checks

```typescript
import { canAccess, isPublicAccessEnabled } from "@/lib/rbac";

// Check if user (or guest) can access a feature
if (canAccess(session?.user, "browseQuizzes")) {
  // Show quiz list
}

// Check configuration directly
if (isPublicAccessEnabled("playQuiz")) {
  // Public play is enabled
}
```

## Security Considerations

1. **OIDC Groups Source of Truth**: Roles come from your identity provider. Ensure your IDP is properly secured.

2. **Stateless by Design**: No role data is stored locally. Changes to OIDC groups take effect on next login.

3. **Permission Validation**: All permission strings are validated at startup. Invalid permissions in env vars are logged and ignored.

4. **Public Access Implications**: Enabling `RBAC_PUBLIC_PLAY_QUIZ=true` means quiz results for guests won't be saved (no user ID to associate).

5. **API Key Scope**: API keys can only perform actions the associated user is authorized for. There's no way to grant an API key more permissions than the user has.

## Troubleshooting

### Debug Configuration

Enable debug logging to see RBAC resolution:

```typescript
import { getRbacConfigSummary } from "@/lib/rbac";

console.log(getRbacConfigSummary());
// {
//   publicAccess: { browseQuizzes: true, viewQuiz: true, playQuiz: false, leaderboard: true },
//   defaultRole: "user",
//   roleGroups: { admin: ["admin"], creator: ["teachers"] },
//   rolePermissionCounts: { admin: 14, moderator: 11, creator: 8, user: 5, guest: 3 }
// }
```

### Common Issues

**User has wrong role:**

- Check OIDC groups in user's token (inspect `groups` claim)
- Verify `RBAC_ROLE_<NAME>_GROUPS` contains the correct group names
- Remember: first matching role wins (admin checked before creator)

**Permission denied unexpectedly:**

- Check if user's role has the required permission
- Use `hasPermission(user, PERMISSIONS.XXX)` to debug
- Verify `RBAC_ROLE_<NAME>_PERMISSIONS` isn't overriding defaults incorrectly

**Public access not working:**

- Ensure `RBAC_PUBLIC_*` env vars are set to `true` (not `"true"` or `1`)
- Check that guest role has the corresponding permission

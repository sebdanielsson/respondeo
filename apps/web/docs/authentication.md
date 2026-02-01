# Authentication

The Quiz App uses OpenID Connect (OIDC) for authentication, allowing integration with any standards-compliant identity provider.

## Overview

Authentication is handled by [BetterAuth](https://better-auth.com/) with the following features:

- **OIDC/OAuth 2.0** - Secure authentication via your identity provider
- **API Keys** - Programmatic access for integrations
- **Session Management** - Secure, encrypted sessions
- **Role-Based Access** - Permissions based on OIDC groups (see [rbac.md](rbac.md))

## Configuration

### Required Environment Variables

```env
# BetterAuth Configuration
BETTER_AUTH_SECRET="your-super-secret-key-at-least-32-characters"
BETTER_AUTH_URL="https://quiz.example.com"

# OIDC Provider
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
OIDC_ISSUER="https://auth.example.com"
```

### Generating the Auth Secret

The `BETTER_AUTH_SECRET` must be at least 32 characters. Generate a secure value:

```bash
openssl rand -base64 32
```

## OIDC Provider Setup

### Required OIDC Configuration

Your identity provider must support:

- **OpenID Connect Discovery** - `/.well-known/openid-configuration` endpoint
- **Authorization Code Flow** with PKCE
- **Scopes**: `openid`, `profile`, `email`, `groups`

### Callback URL

Configure your identity provider with the callback URL:

```
https://your-app-url.com/api/auth/callback/hogwarts
```

> **Note**: The provider ID is `hogwarts` by default. This can be seen in `lib/auth/server.ts`.

### Required Claims

The app expects the following claims in the ID token:

| Claim                | Required | Description                         |
| -------------------- | -------- | ----------------------------------- |
| `sub`                | Yes      | Unique user identifier              |
| `email`              | Yes      | User's email address                |
| `name`               | No       | Display name                        |
| `display_name`       | No       | Alternative display name            |
| `given_name`         | No       | First name                          |
| `family_name`        | No       | Last name                           |
| `preferred_username` | No       | Username                            |
| `picture`            | No       | Profile image URL                   |
| `groups`             | No       | Array of group memberships for RBAC |

## Provider-Specific Setup

### Keycloak

1. Create a new client in your realm
2. Set client authentication to **On**
3. Configure valid redirect URIs: `https://quiz.example.com/api/auth/callback/hogwarts`
4. Create a client scope for groups:
   - Add a mapper of type "Group Membership"
   - Set token claim name to `groups`
   - Enable "Add to ID token"

```env
OIDC_ISSUER=https://keycloak.example.com/realms/your-realm
OIDC_CLIENT_ID=quiz-app
OIDC_CLIENT_SECRET=your-client-secret
```

### Auth0

1. Create a new Regular Web Application
2. Configure allowed callback URLs: `https://quiz.example.com/api/auth/callback/hogwarts`
3. Enable OIDC Conformant mode
4. Create a Rule to add groups to tokens:

```javascript
function addGroupsToToken(user, context, callback) {
  const namespace = "https://quiz.example.com/";
  context.idToken[namespace + "groups"] = user.groups || [];
  callback(null, user, context);
}
```

```env
OIDC_ISSUER=https://your-tenant.auth0.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

### Okta

1. Create a new OIDC Web Application
2. Set sign-in redirect URI: `https://quiz.example.com/api/auth/callback/hogwarts`
3. Assign users/groups to the application
4. Add a groups claim to the ID token:
   - Go to Security → API → Authorization Servers
   - Edit the default server
   - Add a claim named `groups` with value type "Groups"

```env
OIDC_ISSUER=https://your-org.okta.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

### Authentik

1. Create a new OAuth2/OpenID Provider
2. Set redirect URI: `https://quiz.example.com/api/auth/callback/hogwarts`
3. Enable the `groups` scope
4. Create an Application and link the provider

```env
OIDC_ISSUER=https://authentik.example.com/application/o/quiz-app
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

### Pocket ID

1. Create a new OIDC client
2. Configure callback URL: `https://quiz.example.com/api/auth/callback/hogwarts`
3. Enable required scopes

```env
OIDC_ISSUER=https://pocket-id.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

### Google Workspace

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://quiz.example.com/api/auth/callback/hogwarts`

```env
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=your-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your-client-secret
```

> **Note**: Google doesn't provide groups in the standard OIDC flow. You'll need to use the Admin SDK or configure all users as the default role.

### Microsoft Entra ID (Azure AD)

1. Register a new application in Azure Portal
2. Add a redirect URI: `https://quiz.example.com/api/auth/callback/hogwarts`
3. Create a client secret
4. Configure token claims to include groups

```env
OIDC_ISSUER=https://login.microsoftonline.com/your-tenant-id/v2.0
OIDC_CLIENT_ID=your-application-id
OIDC_CLIENT_SECRET=your-client-secret
```

## API Keys

API keys provide programmatic access to the Quiz App API.

### Creating API Keys

1. Sign in as an admin user
2. Navigate to Settings (`/settings`)
3. Click "Create API Key"
4. Select permissions and set expiration
5. Copy the key (it won't be shown again)

### Using API Keys

Include the API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" \
  https://quiz.example.com/api/quizzes
```

### API Key Permissions

API keys inherit permissions from the user's role. If a user's role permissions change, their API keys' effective permissions change too.

Available scopes:

- `quizzes:read` - List and view quizzes
- `quizzes:write` - Create, update, delete quizzes
- `attempts:read` - View quiz attempts and leaderboards
- `attempts:write` - Submit quiz attempts

### Rate Limiting

API keys are rate-limited to **100 requests per minute** by default. Exceeding this limit returns a `429 Too Many Requests` response.

## Session Management

### Session Duration

Sessions are valid until the browser is closed or the user signs out. Session data is encrypted using `BETTER_AUTH_SECRET`.

### Signing Out

Users can sign out via the user menu in the header. This invalidates the session server-side.

## Security Best Practices

1. **Use HTTPS** - Always deploy with TLS/SSL
2. **Secure the auth secret** - Never commit `BETTER_AUTH_SECRET` to version control
3. **Rotate secrets** - Periodically rotate API keys and auth secrets
4. **Limit API key scope** - Only grant necessary permissions
5. **Set expiration** - Use short-lived API keys when possible
6. **Monitor access** - Review API key usage regularly

## Troubleshooting

### "Invalid callback URL"

The callback URL doesn't match what's configured in your identity provider:

- Expected: `https://your-app/api/auth/callback/hogwarts`
- Check for trailing slashes
- Ensure protocol matches (http vs https)

### "Discovery failed"

The OIDC issuer URL is incorrect or unreachable:

- Verify `OIDC_ISSUER` is accessible
- Check `/.well-known/openid-configuration` endpoint works
- Ensure no firewall blocking

### "Invalid client credentials"

Client ID or secret is incorrect:

- Double-check `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`
- Regenerate the secret if unsure
- Check for extra whitespace

### "Groups not appearing"

Users don't have expected roles:

- Verify your IdP is sending `groups` in the ID token
- Check the groups claim format (should be an array)
- Use a JWT debugger to inspect the token
- See [rbac.md](rbac.md) for role mapping configuration

### Session Issues

If sessions aren't persisting:

- Ensure `BETTER_AUTH_URL` matches your deployment URL
- Check `BETTER_AUTH_SECRET` is set and consistent
- Verify cookies are being set (check browser dev tools)

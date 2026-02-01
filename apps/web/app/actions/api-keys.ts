"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { canManageApiKeys, hasPermission, ALL_PERMISSIONS, type Permission } from "@/lib/rbac";

interface CreateApiKeyInput {
  name: string;
  expiresInSeconds?: number;
  permissions: Permission[];
}

interface CreateApiKeyResult {
  success: boolean;
  key?: string;
  error?: string;
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!canManageApiKeys(session.user)) {
    return { success: false, error: "You don't have permission to create API keys" };
  }

  if (!input.name.trim()) {
    return { success: false, error: "Key name is required" };
  }

  // Validate permissions
  if (input.permissions.length === 0) {
    return { success: false, error: "At least one permission is required" };
  }

  // Validate all permissions are valid
  for (const permission of input.permissions) {
    if (!ALL_PERMISSIONS.includes(permission)) {
      return { success: false, error: `Invalid permission: ${permission}` };
    }
  }

  // Security check: user can only grant permissions they themselves have
  for (const permission of input.permissions) {
    if (!hasPermission(session.user, permission)) {
      return {
        success: false,
        error: `You cannot grant the '${permission}' permission because you don't have it`,
      };
    }
  }

  try {
    // Convert Permission[] to BetterAuth format: { resource: [action, action], ... }
    const permissionsRecord: Record<string, string[]> = {};
    for (const permission of input.permissions) {
      const [resource, action] = permission.split(":");
      if (!permissionsRecord[resource]) {
        permissionsRecord[resource] = [];
      }
      permissionsRecord[resource].push(action);
    }

    // Call without headers and pass userId directly - this makes it a true server call
    // which allows setting server-only properties like permissions
    const result = await auth.api.createApiKey({
      body: {
        name: input.name.trim(),
        expiresIn: input.expiresInSeconds,
        permissions: permissionsRecord,
        userId: session.user.id,
      },
    });

    if (!result?.key) {
      return { success: false, error: "Failed to create API key" };
    }

    return { success: true, key: result.key };
  } catch (error) {
    console.error("Failed to create API key:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create API key",
    };
  }
}

interface DeleteApiKeyResult {
  success: boolean;
  error?: string;
}

export async function deleteApiKey(keyId: string): Promise<DeleteApiKeyResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!canManageApiKeys(session.user)) {
    return { success: false, error: "You don't have permission to delete API keys" };
  }

  try {
    await auth.api.deleteApiKey({
      body: { keyId },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete API key",
    };
  }
}

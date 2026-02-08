import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Validates a project name/path
 */
export function validateProjectName(input: string | undefined): string | undefined {
  if (!input || input.trim().length === 0) {
    return "Project name cannot be empty";
  }

  const trimmed = input.trim();

  // Check for invalid characters in the final directory name
  const dirName = trimmed.split("/").pop() || "";

  if (dirName.startsWith(".")) {
    return "Project name cannot start with a dot";
  }

  if (dirName.startsWith("-")) {
    return "Project name cannot start with a hyphen";
  }

  // Allow alphanumeric, hyphens, underscores, and forward slashes for paths
  if (!/^[a-zA-Z0-9\-_/.]+$/.test(trimmed)) {
    return "Project name can only contain letters, numbers, hyphens, underscores, and forward slashes";
  }

  return undefined;
}

/**
 * Checks if a directory exists
 */
export function directoryExists(path: string): boolean {
  const fullPath = resolve(process.cwd(), path);
  return existsSync(fullPath);
}

/**
 * Resolves the project path from input
 */
export function resolveProjectPath(input: string): string {
  return resolve(process.cwd(), input);
}

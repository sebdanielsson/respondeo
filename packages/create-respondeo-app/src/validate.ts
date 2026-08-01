import { existsSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

/**
 * Validates a project name/path.
 *
 * The result of this is passed to `resolveProjectPath` and then, if the user
 * confirms an overwrite, to `rmSync(..., { recursive: true, force: true })`.
 * Validation therefore has to constrain the *whole resolved path*, not just its
 * last segment: checking only `input.split("/").pop()` accepted `../../foo`,
 * whose final segment is a perfectly ordinary `foo`, and the recursive delete
 * then landed outside the directory the user ran the command in.
 *
 * @param input Raw project name or relative path from the prompt or argv
 * @returns An error message, or undefined when the input is acceptable
 */
export function validateProjectName(input: string | undefined): string | undefined {
  if (!input || input.trim().length === 0) {
    return "Project name cannot be empty";
  }

  const trimmed = input.trim();

  if (isAbsolute(trimmed)) {
    return "Project name must be a relative path, not an absolute one";
  }

  // Allow alphanumeric, hyphens, underscores, dots and forward slashes for paths
  if (!/^[a-zA-Z0-9\-_/.]+$/.test(trimmed)) {
    return "Project name can only contain letters, numbers, hyphens, underscores, and forward slashes";
  }

  const segments = trimmed.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "Project name cannot be empty";
  }

  for (const segment of segments) {
    if (segment === "..") {
      return "Project name cannot navigate outside the current directory";
    }

    if (segment.startsWith(".")) {
      return "Project name cannot start with a dot";
    }

    if (segment.startsWith("-")) {
      return "Project name cannot start with a hyphen";
    }
  }

  // Belt and braces: confirm the resolved path really is inside the working
  // directory, so anything the segment checks miss (symlink-ish inputs,
  // platform-specific separators) still cannot escape.
  const cwd = process.cwd();
  const resolved = resolve(cwd, trimmed);

  if (resolved === cwd || !resolved.startsWith(cwd + sep)) {
    return "Project name must resolve to a new directory inside the current one";
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

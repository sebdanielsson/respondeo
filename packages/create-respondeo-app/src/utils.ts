import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PACKAGE_MANAGERS, type PackageManager } from "./constants";

/**
 * Detects the package manager to use based on lockfiles
 */
export function detectPackageManager(projectPath: string): PackageManager {
  // Check for lockfiles in the project directory
  for (const [pm, config] of Object.entries(PACKAGE_MANAGERS)) {
    const lockfilePath = resolve(projectPath, config.lockfile);
    if (existsSync(lockfilePath)) {
      return pm as PackageManager;
    }
  }

  // Default to pnpm since this is a pnpm-first project
  return "pnpm";
}

/**
 * Runs a shell command and returns the result
 */
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolvePromise({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolvePromise({ success: false, error: stderr });
      } else {
        resolvePromise({ success: true });
      }
    });
  });
}

/**
 * Copies a file from source to destination
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  const content = await readFile(source, "utf8");
  await writeFile(destination, content);
}

/**
 * Checks if running in CI environment
 */
export function isCI(): boolean {
  return Boolean(process.env.CI);
}

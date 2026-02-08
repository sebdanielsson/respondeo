import { existsSync } from "node:fs";
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

  // Default to bun since this is a Bun-first project
  return "bun";
}

/**
 * Runs a shell command and returns the result
 */
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const errorOutput = await new Response(proc.stderr).text();
      return { success: false, error: errorOutput };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Copies a file from source to destination
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  const file = Bun.file(source);
  const content = await file.text();
  await Bun.write(destination, content);
}

/**
 * Checks if running in CI environment
 */
export function isCI(): boolean {
  return Boolean(process.env.CI);
}

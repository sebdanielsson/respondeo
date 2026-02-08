#!/usr/bin/env bun

import { intro, text, confirm, spinner, outro, isCancel, cancel } from "@clack/prompts";
import { downloadTemplate } from "giget";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";
import { MESSAGES, TEMPLATE_SOURCE } from "./constants";
import { validateProjectName, directoryExists, resolveProjectPath } from "./validate";
import { detectPackageManager, runCommand, copyFile } from "./utils";

async function main() {
  console.clear();

  intro(MESSAGES.INTRO);

  // Get project name from args or prompt
  let projectName = process.argv[2];

  if (!projectName) {
    const projectNameInput = await text({
      message: MESSAGES.PROJECT_NAME_PROMPT,
      placeholder: MESSAGES.PROJECT_NAME_PLACEHOLDER,
      validate: validateProjectName,
    });

    if (isCancel(projectNameInput)) {
      cancel(MESSAGES.OUTRO_CANCELLED);
      process.exit(0);
    }

    projectName = projectNameInput as string;
  } else {
    // Validate the provided project name
    const validation = validateProjectName(projectName);
    if (validation) {
      console.error(`Error: ${validation}`);
      process.exit(1);
    }
  }

  const projectPath = resolveProjectPath(projectName);

  // Check if directory exists
  if (directoryExists(projectName)) {
    const shouldOverwrite = await confirm({
      message: MESSAGES.OVERWRITE_PROMPT,
      initialValue: false,
    });

    if (isCancel(shouldOverwrite)) {
      cancel(MESSAGES.OUTRO_CANCELLED);
      process.exit(0);
    }

    if (!shouldOverwrite) {
      cancel(MESSAGES.OUTRO_CANCELLED);
      process.exit(0);
    }

    // Remove existing directory
    rmSync(projectPath, { recursive: true, force: true });
  }

  // Download template
  const s = spinner();
  s.start(MESSAGES.DOWNLOADING);

  try {
    await downloadTemplate(TEMPLATE_SOURCE, {
      dir: projectPath,
      offline: false,
      force: true,
    });
    s.stop("Template downloaded");
  } catch (error) {
    s.stop("Failed to download template");
    console.error(
      `\nError downloading template: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("\nPlease check your internet connection and try again.");
    process.exit(1);
  }

  // Copy .env.example to .env.local
  const envExamplePath = join(projectPath, ".env.example");
  const envLocalPath = join(projectPath, ".env.local");

  if (existsSync(envExamplePath)) {
    try {
      await copyFile(envExamplePath, envLocalPath);
    } catch (error) {
      console.warn(
        `\nWarning: Could not copy .env.example to .env.local: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Detect and install dependencies
  const packageManager = detectPackageManager(projectPath);
  s.start(MESSAGES.INSTALLING);

  const [pmCommand, ...pmArgs] =
    packageManager === "bun"
      ? ["bun", "install"]
      : packageManager === "pnpm"
        ? ["pnpm", "install"]
        : packageManager === "yarn"
          ? ["yarn", "install"]
          : ["npm", "install"];

  const installResult = await runCommand(pmCommand, pmArgs, projectPath);

  if (!installResult.success) {
    s.stop("Failed to install dependencies");
    console.error(`\nError installing dependencies: ${installResult.error}`);
    console.error(`\nYou can install them manually by running:`);
    console.error(`  cd ${projectName}`);
    console.error(`  ${pmCommand} ${pmArgs.join(" ")}`);
  } else {
    s.stop(`Dependencies installed with ${packageManager}`);
  }

  // Success message
  outro(MESSAGES.OUTRO_SUCCESS);
  console.log(MESSAGES.NEXT_STEPS);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

export const TEMPLATE_SOURCE =
  process.env.TEMPLATE_SOURCE || "github:sebdanielsson/respondeo/examples/respondeo#main";

export const MESSAGES = {
  INTRO: "create-respondeo-app",
  OUTRO_SUCCESS: "Your Respondeo app is ready!",
  OUTRO_CANCELLED: "Setup cancelled.",
  PROJECT_NAME_PROMPT: "Where should we create your project?",
  PROJECT_NAME_PLACEHOLDER: "./my-quiz-app",
  OVERWRITE_PROMPT: "Directory already exists. Overwrite?",
  DOWNLOADING: "Downloading template...",
  INSTALLING: "Installing dependencies...",
  NEXT_STEPS: `Next steps:
  1. cd into your project directory
  2. Copy .env.example to .env.local and configure:
     - DATABASE_URL (PostgreSQL connection string)
     - OIDC authentication settings
     - Optional: Redis, AI, Unsplash API keys
  3. Run database migrations: pnpm run db:migrate
  4. Start the development server: pnpm run dev

For detailed setup instructions, see the README.md in your project.`,
} as const;

export const PACKAGE_MANAGERS = {
  pnpm: {
    lockfile: "pnpm-lock.yaml",
    install: "pnpm install",
  },
  bun: {
    lockfile: "bun.lock",
    install: "bun install",
  },
  yarn: {
    lockfile: "yarn.lock",
    install: "yarn install",
  },
  npm: {
    lockfile: "package-lock.json",
    install: "npm install",
  },
} as const;

export type PackageManager = keyof typeof PACKAGE_MANAGERS;

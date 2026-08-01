import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import oxlint from "eslint-plugin-oxlint";

// Mirrors apps/web/eslint.config.ts minus eslint-config-turbo: its
// no-undeclared-env-vars rule resolves env declarations out of a turbo.json,
// which a standalone scaffolded app does not have.

const eslintConfig = defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  ...nextVitals,
  ...nextTs,
  ...oxlint.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    settings: {
      react: { version: "19" }, // Avoids auto-detection crash
    },
  },
]);

export default eslintConfig;

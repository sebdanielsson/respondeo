import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import turbo from "eslint-config-turbo/flat";
import oxlint from "eslint-plugin-oxlint";

const eslintConfig = defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  ...nextVitals,
  ...nextTs,
  ...turbo,
  ...oxlint.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

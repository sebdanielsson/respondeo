import type { Config } from "stylelint";

export default {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-html/html",
    "@dreamsicle.io/stylelint-config-tailwindcss",
  ],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["tailwind"],
      },
    ],
    "color-hex-length": null,
  },
} satisfies Config;

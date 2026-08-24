import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@hugeicons/core-free-icons",
              message:
                "Import icons from @/lib/icons instead — this barrel re-exports ~6,000 modules and inflates dev memory.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/icons.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;

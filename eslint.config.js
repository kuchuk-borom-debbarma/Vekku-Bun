import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/bun.lock"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      "boundaries/include": ["src/be/**/*"],
      "boundaries/elements": [
        {
          type: "util",
          pattern: "src/be/util",
          mode: "folder",
        },
        {
          type: "infra",
          pattern: "src/be/infra",
          mode: "folder",
        },
        {
          type: "domain",
          pattern: "src/be/*", 
          mode: "folder",
          capture: ["domain"],
        },
      ],
    },
    rules: {
      "boundaries/entry-point": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              target: "domain",
              allow: "index.ts", 
            },
            {
               target: "domain",
               allow: "api.ts" 
            },
            {
               target: "util",
               allow: "*.(ts|js)"
            },
            {
               target: "infra",
               allow: "*.(ts|js)"
            }
          ],
        },
      ],
    },
  },
  {
      files: ["**/*.test.ts"],
      rules: {
          "@typescript-eslint/no-explicit-any": "off"
      }
  }
);
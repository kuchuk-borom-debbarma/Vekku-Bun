import js from "@eslint/js";
import tseslint from "typescript-eslint";
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
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
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
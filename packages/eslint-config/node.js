import { defineConfig } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import turbo from "eslint-plugin-turbo";
import jest from "eslint-plugin-jest";

export default defineConfig([
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["tsconfig.json"],
      },
      globals: {
        ...require("eslint/conf/globals").es6,
        node: true,
        jest: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier,
      turbo,
      jest,
    },
    rules: {
      semi: ["error", "never"],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-console": "off",
      "import/prefer-default-export": "off",
      "import/no-extraneous-dependencies": "off",
      "import/extensions": "off",
      "class-methods-use-this": "off",
      "no-underscore-dangle": "warn",
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "turbo/no-undeclared-env-vars": "off",
    },
    ignores: [
      "node_modules",
      "dist",
      "lib",
      "coverage",
      "*test.ts",
      "*spec.ts",
      "jest.config.ts",
      "knexfile.ts",
    ],
  },
  {
    files: ["*test.ts", "*spec.ts"],
    languageOptions: {
      globals: {
        jest: true,
      },
    },
  },
]);

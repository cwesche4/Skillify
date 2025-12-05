// ===============================================
// ESLint Flat Config – Skillify Enterprise Standard
// ===============================================

import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tailwind from "eslint-plugin-tailwindcss";

export default [

  // ------------------------------------------------
  // GLOBAL IGNORE – do not lint build artifacts
  // ------------------------------------------------
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "public/**",
      "prisma/migrations/**",
      "*.config.js",
      "*.config.cjs",
      "*.config.ts",
    ],
  },

  // ------------------------------------------------
  // BASE JS RULESET
  // ------------------------------------------------
  js.configs.recommended,

  // ------------------------------------------------
  // MAIN PROJECT LINTING (Type-aware)
  // ------------------------------------------------
  {
    files: ["**/*.{ts,tsx,js,jsx}"],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",    // ✅ FIX: includes tests
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },

      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",

        // Browser APIs
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        crypto: "readonly",

        // Web/Node timers
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",

        // Web fetch (Next.js supports globally)
        fetch: "readonly",

        // Node-specific globals
        NodeJS: "readonly",
        global: "readonly",

        // React globals
        React: "readonly",
        JSX: "readonly",

        // Runtime globals
        process: "readonly",
        module: "readonly",
        console: "readonly",
      },
    },

    plugins: {
      "@typescript-eslint": ts,
      react,
      "react-hooks": reactHooks,
      prettier,
      tailwind,
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      //----------------------------------------------
      // TypeScript
      //----------------------------------------------
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "off",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      //----------------------------------------------
      // React
      //----------------------------------------------
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      //----------------------------------------------
      // General Rules
      //----------------------------------------------
      "no-empty": "off",
      "tailwindcss/no-custom-classname": "off",

      //----------------------------------------------
      // Prettier
      //----------------------------------------------
      "prettier/prettier": "warn",
    },
  },
  // ------------------------------------------------
  // per-folder override for scripts/
  // ------------------------------------------------
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
      },
      parserOptions: { project: null },
    },
    rules: {
      "no-undef": "off",
    },
  },
  // ------------------------------------------------
  // CONFIG FILES (NO type-aware linting)
  // ------------------------------------------------
  {
    files: [
      "tailwind.config.ts",
      "postcss.config.js",
      "prettier.config.cjs",
      "tsconfig.json",
      "tsconfig.app.json",
      "tsconfig.tests.json",
      "tsconfig.shared.json",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: null }, // Important!
    },
  },
];
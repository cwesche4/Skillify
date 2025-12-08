/* ============================================================
   SKILLIFY — Stable ESLint Config for Next.js 14 + TS 5.6
   ============================================================ */

require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,

  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],

  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'tailwindcss',
    'prettier',
  ],

  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  rules: {
    // Prettier formatting
    'prettier/prettier': 'warn',

    // React rules
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'off',

    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    // Imports
    'import/no-unresolved': 'off',

    // Next.js specificity
    '@next/next/no-html-link-for-pages': 'off',

    // Tailwind
    'tailwindcss/no-custom-classname': 'off',
  },

  settings: {
    tailwindcss: {
      config: 'tailwind.config.ts',
    },
  },
}

import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    include: [
      'lib/ai/**/__tests__/**/*.test.ts',
      'lib/analytics/**/__tests__/**/*.test.ts',
      'lib/bulk/**/__tests__/**/*.test.ts',
      'lib/commerce/**/__tests__/**/*.test.tsx',
      'components/settings/**/__tests__/**/*.test.tsx',
      'lib/commerce/**/__tests__/**/*.test.ts',
      'lib/crm/**/__tests__/**/*.test.ts',
      'lib/dashboard/**/__tests__/**/*.test.ts',
      'lib/decisions/**/__tests__/**/*.test.ts',
      'lib/intelligence/**/__tests__/**/*.test.ts',
      'lib/marketing/**/__tests__/**/*.test.tsx',
      'lib/scheduling/**/__tests__/**/*.test.ts',
      'lib/sales/**/__tests__/**/*.test.ts',
      'lib/workflows/**/__tests__/**/*.test.ts',
      'lib/workspaces/**/__tests__/**/*.test.ts',
    ],
    exclude: ['node_modules/**', 'tests/**', 'app/**'],
    sequence: {
      shuffle: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})

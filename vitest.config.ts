import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    include: [
      '__tests__/executor/**/*.test.ts',
      '__tests__/webhooks/**/*.test.ts',
      'lib/ai/**/__tests__/**/*.test.ts',
      'lib/analytics/**/__tests__/**/*.test.ts',
      'lib/automations/**/__tests__/**/*.test.ts',
      'lib/bulk/**/__tests__/**/*.test.ts',
      'lib/commerce/**/__tests__/**/*.test.tsx',
      'components/settings/**/__tests__/**/*.test.tsx',
      'lib/commerce/**/__tests__/**/*.test.ts',
      'lib/crm/**/__tests__/**/*.test.ts',
      'lib/customers/**/__tests__/**/*.test.ts',
      'lib/customers/**/__tests__/**/*.test.tsx',
      'lib/dashboard/**/__tests__/**/*.test.ts',
      'lib/decisions/**/__tests__/**/*.test.ts',
      'lib/domain-events/**/__tests__/**/*.test.ts',
      'lib/intelligence/**/__tests__/**/*.test.ts',
      'lib/jobs/**/__tests__/**/*.test.ts',
      'lib/jobs/**/__tests__/**/*.test.tsx',
      'lib/leads/**/__tests__/**/*.test.ts',
      'lib/leads/**/__tests__/**/*.test.tsx',
      'lib/marketing/**/__tests__/**/*.test.tsx',
      'lib/operations/**/__tests__/**/*.test.ts',
      'lib/recurring-services/**/__tests__/**/*.test.ts',
      'lib/recurring-services/**/__tests__/**/*.test.tsx',
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

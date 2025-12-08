// tests/setup/test-env.ts

// 1. Extend expect with jest-dom matchers
import '@testing-library/jest-dom/vitest'

// 2. React Testing Library utilities
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Automatically unmount React trees after each test
afterEach(() => {
  cleanup()
})

// 3. Basic global mocks (optional but helpful)

// If any code uses `window.matchMedia` (common for UI libs)
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// If some code uses `ResizeObserver`
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver as any

import { describe, expect, it } from 'vitest'

describe('DashboardPage module', () => {
  it('exports a component', () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/skillify'
    return import('@/app/dashboard/page').then((mod) => {
      expect(mod.default).toBeDefined()
      expect(typeof mod.default).toBe('function')
    })
  })
})

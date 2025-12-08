import { describe, expect, it } from 'vitest'

describe('Skillify test infra', () => {
  it('math still works', () => {
    expect(1 + 1).toBe(2)
  })

  it('JSDOM is available', () => {
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })
})

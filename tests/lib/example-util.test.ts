import { describe, expect, it } from 'vitest'

// simple dummy function
const add = (a: number, b: number) => a + b

describe('Example util', () => {
  it('adds numbers', () => {
    expect(add(2, 3)).toBe(5)
  })
})

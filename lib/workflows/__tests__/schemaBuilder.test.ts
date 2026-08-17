import { describe, expect, it } from 'vitest'

import {
  applySchemaPreset,
  parseSchemaObject,
  toggleSchemaChip,
} from '@/lib/workflows/schemaBuilder'

describe('schema builder helpers', () => {
  it('toggles schema chips without replacing malformed user JSON', () => {
    expect(
      toggleSchemaChip('{}', { label: 'Email', key: 'email', type: 'string' })
        .value,
    ).toBe('{\n  "email": "string"\n}')
    expect(
      toggleSchemaChip('{ "email": "string" }', {
        label: 'Email',
        key: 'email',
        type: 'string',
      }).value,
    ).toBe('{}')
    const malformed = toggleSchemaChip('{ nope', {
      label: 'Email',
      key: 'email',
      type: 'string',
    })
    expect(malformed.value).toBe('{ nope')
    expect(malformed.error).toBeTruthy()
  })

  it('applies readable presets and detects invalid JSON', () => {
    expect(
      applySchemaPreset({
        label: 'Contact Details',
        schema: { name: 'string', email: 'string' },
      }),
    ).toBe('{\n  "name": "string",\n  "email": "string"\n}')
    expect(parseSchemaObject('{ nope').schema).toBeNull()
    expect(parseSchemaObject('{ "name": "string" }').schema).toEqual({
      name: 'string',
    })
  })
})

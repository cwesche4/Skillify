export type SchemaChip = {
  label: string
  key: string
  type: string
}

export type SchemaPreset = {
  label: string
  schema: Record<string, string>
}

export const DEFAULT_SCHEMA_CHIPS: SchemaChip[] = [
  { label: 'Name', key: 'name', type: 'string' },
  { label: 'Email', key: 'email', type: 'string' },
  { label: 'Phone', key: 'phone', type: 'string' },
  { label: 'Company', key: 'company', type: 'string' },
]

export const DEFAULT_SCHEMA_PRESETS: SchemaPreset[] = [
  {
    label: 'Contact Details',
    schema: {
      name: 'string',
      email: 'string',
      phone: 'string',
      company: 'string',
    },
  },
  {
    label: 'Follow-up Details',
    schema: {
      summary: 'string',
      priority: 'string',
      nextAction: 'string',
    },
  },
]

export function parseSchemaObject(value: unknown): {
  schema: Record<string, string> | null
  error?: string
} {
  if (!String(value ?? '').trim()) return { schema: {} }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { schema: null, error: 'Schema must be a JSON object.' }
    }
    const schema: Record<string, string> = {}
    for (const [key, type] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      schema[key] = String(type)
    }
    return { schema }
  } catch {
    return {
      schema: null,
      error: 'Enter valid JSON, or use a preset to rebuild the schema.',
    }
  }
}

export function formatSchemaObject(schema: Record<string, string>) {
  return JSON.stringify(schema, null, 2)
}

export function toggleSchemaChip(
  value: unknown,
  chip: SchemaChip,
): { value: string; error?: string } {
  const parsed = parseSchemaObject(value)
  if (!parsed.schema) {
    return { value: String(value ?? ''), error: parsed.error }
  }
  const next = { ...parsed.schema }
  if (Object.prototype.hasOwnProperty.call(next, chip.key)) {
    delete next[chip.key]
  } else {
    next[chip.key] = chip.type
  }
  return { value: formatSchemaObject(next) }
}

export function applySchemaPreset(preset: SchemaPreset) {
  return formatSchemaObject(preset.schema)
}

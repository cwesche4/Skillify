'use client'

import { z } from 'zod'

import type { BuilderNodeType, NodeData } from './node-types'

const urlSchema = z.string().url('Must be a valid URL').trim()

const baseLabel = z.string().trim().min(1, 'Label is required')

// 🔼 ADDITION: runtime registry for experimental/draft nodes
const schemaRegistry: Record<string, z.ZodSchema<any>> = {}

export function registerNodeSchema(type: string, schema: z.ZodSchema<any>) {
  schemaRegistry[type] = schema
}

export function getNodeSchema(type: string) {
  return (
    schemaRegistry[type] ??
    NODE_SCHEMA_MAP[type as BuilderNodeType] ??
    UnknownNodeSchema
  )
}

export const UnknownNodeSchema = z.object({}).passthrough()

export const NODE_SCHEMA_MAP: Record<BuilderNodeType, z.ZodSchema<NodeData>> = {
  trigger: z.object({
    label: baseLabel.default('Trigger'),
    event: z.string().trim().default('manual'),
    source: z.string().trim().default('internal'),
  }),
  delay: z.object({
    label: baseLabel.default('Delay'),
    duration: z
      .number()
      .positive('Duration must be greater than 0')
      .default(30),
    unit: z.enum(['seconds', 'minutes', 'hours', 'days']).default('minutes'),
  }),
  webhook: z.object({
    label: baseLabel.default('Webhook'),
    url: urlSchema.default('https://example.com/webhook'),
    method: z.string().trim().default('POST'),
    auth: z.string().trim().default('none'),
  }),
  'crm-trigger': z.object({
    label: baseLabel.default('CRM Trigger'),
    provider: z.string().trim().default('hubspot'),
    objectType: z.string().trim().default('contact'),
    event: z.string().trim().default('contact.created'),
    integrationId: z.string().trim().default(''),
  }),
  'crm-action': z.object({
    label: baseLabel.default('CRM Action'),
    provider: z.string().trim().default('hubspot'),
    objectType: z.string().trim().default('contact'),
    action: z.string().trim().default('contact.update'),
    integrationId: z.string().trim().default(''),
    payload: z.record(z.any()).default({}),
  }),
  'ai-llm': z.object({
    label: baseLabel.default('AI LLM'),
    model: z.string().trim().default('gpt-4.1-mini'),
    temperature: z.number().min(0).max(2).default(0.2),
    prompt: z.string().trim().default(''),
  }),
  'ai-classifier': z.object({
    label: baseLabel.default('AI Classifier'),
    categories: z
      .array(z.string().trim())
      .default(['lead', 'customer', 'spam']),
    fallback: z.string().trim().default('fallback'),
  }),
  'ai-transform': z.object({
    label: baseLabel.default('AI Transform'),
    schema: z
      .array(
        z.object({
          key: z.string().trim().min(1, 'Field key required'),
          type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
        }),
      )
      .min(1, 'At least one field is required')
      .default([{ key: 'field', type: 'string' }]),
    note: z
      .string()
      .trim()
      .default(
        'Transforms JSON input into validated, schema-bound JSON output.',
      ),
  }),
  'ai-decision': z.object({
    label: baseLabel.default('AI Decision'),
    branches: z
      .array(
        z.object({
          key: z.string().trim().min(1, 'Branch key required'),
          label: z.string().trim().default(''),
        }),
      )
      .min(2, 'At least two branches required')
      .default([
        { key: 'option_a', label: 'Option A' },
        { key: 'option_b', label: 'Option B' },
      ]),
    confidenceThreshold: z
      .number()
      .min(0, 'Threshold must be between 0 and 1')
      .max(1, 'Threshold must be between 0 and 1')
      .default(0.5),
    fallbackKey: z.string().trim().default('option_a'),
    note: z
      .string()
      .trim()
      .default('Deterministic AI decision across predefined branches.'),
  }),
  'ai-splitter': z.object({
    label: baseLabel.default('AI Splitter'),
    mode: z.string().trim().default('json'),
    schemaHint: z.string().trim().default('{ "name": "string" }'),
  }),
  'or-path': z.object({
    label: baseLabel.default('OR Path'),
    conditions: z.array(z.any()).default([]),
  }),
  group: z.object({
    label: baseLabel.default('Group'),
    count: z.number().int().nonnegative().default(0),
    note: z.string().trim().default(''),
    collapsed: z.boolean().default(false),
  }),
  unknown: UnknownNodeSchema,
}

export function getDefaultNodeData(type: BuilderNodeType): NodeData {
  const schema = getNodeSchema(type)

  if (schema === UnknownNodeSchema && process.env.NODE_ENV !== 'production') {
    const stub = `// Stub schema for ${type}
export const ${type.replace(/[-]/g, '_')}Schema = z.object({
  label: z.string().trim().default('${type}'),
  // description?: z.string().optional(),
  // config?: z.record(z.any()).default({}),
})
// Paste into lib/builder/node-schemas.ts and NODE_SCHEMA_MAP`
    console.warn(
      `[Builder] Missing schema for node type: ${type}. Using UnknownNodeSchema fallback.`,
    )
    console.info(stub)
  }

  const parsed = schema.safeParse({})
  return (parsed.success ? parsed.data : {}) as NodeData
}

export function validateNodeData(type: BuilderNodeType, data: NodeData) {
  const schema = getNodeSchema(type)
  if (!schema) return { ok: true, errors: [], parsed: data }
  const parsed = schema.safeParse(data)
  if (parsed.success) return { ok: true, errors: [], parsed: parsed.data }
  return {
    ok: false,
    errors: parsed.error.errors.map((e) => e.message),
    parsed: data,
  }
}

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type {
  NodeConfig,
  NodeConfigField,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'

export type NodeValidationSeverity = 'warning' | 'error'
export type NodeValidationStatus = 'ready' | 'warning' | 'error'

export type NodeValidationMessage = {
  field?: string
  severity: NodeValidationSeverity
  message: string
}

export type NodeValidationResult = {
  status: NodeValidationStatus
  messages: NodeValidationMessage[]
}

function fieldKey(field: NodeConfigField) {
  return field.key ?? field.id
}

function isFieldVisible(
  field: NodeConfigField,
  config: NodeConfig,
  fields: NodeConfigField[] = [],
) {
  if (!field.showWhen) return true
  const controllingField = fields.find(
    (candidate) => fieldKey(candidate) === field.showWhen?.field,
  )
  const current =
    config[field.showWhen.field] ?? controllingField?.defaultValue ?? ''
  return current === field.showWhen.equals
}

function normalizedConfig(config: NodeConfig): NodeConfig {
  const nested =
    config.config &&
    typeof config.config === 'object' &&
    !Array.isArray(config.config)
      ? (config.config as NodeConfig)
      : {}
  return { ...nested, ...config }
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => {
      if (typeof item === 'object' && item !== null) {
        const values = Object.values(item)
        return values.length > 0 && values.every(hasValue)
      }
      return hasValue(item)
    })
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0
  }
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function valueForField(field: NodeConfigField, config: NodeConfig) {
  const source = normalizedConfig(config)
  return source[fieldKey(field)] ?? field.defaultValue
}

function requiredMessageForField(field: NodeConfigField) {
  if (
    field.mappingLabel &&
    field.requiredMessage === `${field.label} is empty.`
  ) {
    return `${field.mappingLabel} is empty.`
  }
  if (field.requiredMessage) return field.requiredMessage
  const label = field.mappingLabel ?? field.label
  if (field.type === 'select') return `Select ${label.toLowerCase()}.`
  if (field.type === 'multi-select')
    return `Add at least one ${field.label.toLowerCase()} value.`
  if (field.type === 'key-value')
    return `Add at least one complete ${field.label.toLowerCase()} row.`
  if (field.type === 'number') return `Choose a ${label.toLowerCase()}.`
  if (field.type === 'json' || field.type === 'code')
    return `${label} is empty.`
  return `${label} is empty.`
}

function containsVariableToken(value: unknown) {
  return typeof value === 'string' && /\{\{[^}]+\}\}/.test(value)
}

function normalizedOptionValue(
  value: unknown,
  options?: Array<{ value: string }>,
) {
  if (!options?.length) return String(value)
  const raw = String(value ?? '').trim()
  const exact = options.find((option) => option.value === raw)
  if (exact) return exact.value
  const lower = raw.toLowerCase()
  return (
    options.find((option) => option.value.toLowerCase() === lower)?.value ?? raw
  )
}

const SIMPLE_VARIABLE_ALIASES: Array<{
  aliases: string[]
  variable: string
  label: string
}> = [
  {
    aliases: ['email', 'client email', 'customer email'],
    variable: '{{client.email}}',
    label: 'Customer Email',
  },
  { aliases: ['lead email'], variable: '{{lead.email}}', label: 'Lead Email' },
  {
    aliases: ['name', 'client name', 'customer name'],
    variable: '{{client.name}}',
    label: 'Customer Name',
  },
  { aliases: ['lead name'], variable: '{{lead.name}}', label: 'Lead Name' },
  {
    aliases: ['contact name'],
    variable: '{{contact.name}}',
    label: 'Contact Name',
  },
  {
    aliases: ['phone', 'client phone', 'customer phone'],
    variable: '{{client.phone}}',
    label: 'Customer Phone',
  },
  { aliases: ['lead phone'], variable: '{{lead.phone}}', label: 'Lead Phone' },
  {
    aliases: ['contact phone'],
    variable: '{{contact.phone}}',
    label: 'Contact Phone',
  },
]

function simpleVariableSuggestionForField(
  field: NodeConfigField,
  value: unknown,
) {
  if (typeof value !== 'string') return null
  const key = fieldKey(field).toLowerCase()
  const label = field.label.toLowerCase()
  const acceptsRecordData =
    key.includes('recipient') ||
    key.includes('phone') ||
    key.includes('email') ||
    key.includes('name') ||
    key === 'cc' ||
    label.includes('recipient') ||
    label.includes('phone') ||
    label.includes('email') ||
    label.includes('name')
  if (!acceptsRecordData) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized.includes('{{')) return null
  return (
    SIMPLE_VARIABLE_ALIASES.find((entry) =>
      entry.aliases.includes(normalized),
    ) ?? null
  )
}

export function validateNodeConfigFromDefinition(
  definition: WorkflowNodeDefinition,
  config: NodeConfig,
): NodeValidationResult {
  const messages: NodeValidationMessage[] = []
  const effectiveConfig = normalizedConfig(config)

  for (const field of definition.configFields) {
    if (!isFieldVisible(field, effectiveConfig, definition.configFields))
      continue
    const key = fieldKey(field)
    const fieldValue = valueForField(field, effectiveConfig)
    if (field.required && !hasValue(fieldValue)) {
      messages.push({
        field: key,
        severity: 'error',
        message: requiredMessageForField(field),
      })
    }

    const suggestedVariable = simpleVariableSuggestionForField(
      field,
      fieldValue,
    )
    if (suggestedVariable) {
      messages.push({
        field: key,
        severity: 'warning',
        message: `Use ${suggestedVariable.label} to map this value from workflow data.`,
      })
    }

    if (
      field.type === 'number' &&
      hasValue(fieldValue) &&
      !containsVariableToken(fieldValue)
    ) {
      const value = Number(fieldValue)
      if (Number.isNaN(value)) {
        messages.push({
          field: key,
          severity: 'error',
          message: `${field.label} must be a number.`,
        })
        continue
      }
      if (typeof field.min === 'number' && value < field.min) {
        messages.push({
          field: key,
          severity: 'error',
          message: `${field.label} must be at least ${field.min}.`,
        })
      }
      if (typeof field.max === 'number' && value > field.max) {
        messages.push({
          field: key,
          severity: 'error',
          message: `${field.label} must be less than or equal to ${field.max}.`,
        })
      }
    }

    if (
      field.type === 'select' &&
      hasValue(fieldValue) &&
      !containsVariableToken(fieldValue)
    ) {
      const allowedValues = new Set(
        (field.options ?? []).map((option) => option.value),
      )
      const comparableValue = normalizedOptionValue(fieldValue, field.options)
      if (allowedValues.size > 0 && !allowedValues.has(comparableValue)) {
        messages.push({
          field: key,
          severity: 'error',
          message:
            field.requiredMessage ??
            `${field.label} must be one of ${Array.from(allowedValues).join(', ')}.`,
        })
      }
    }

    if (
      field.type === 'json' &&
      hasValue(fieldValue) &&
      typeof fieldValue === 'string'
    ) {
      try {
        JSON.parse(fieldValue)
      } catch {
        messages.push({
          field: key,
          severity: 'error',
          message: `${field.label} must be valid JSON. Fix the JSON or choose a preset.`,
        })
      }
    }
  }

  const custom = definition.validate?.(effectiveConfig)
  if (custom?.messages?.length) {
    messages.push(...custom.messages)
  }

  const status: NodeValidationStatus = messages.some(
    (message) => message.severity === 'error',
  )
    ? 'error'
    : messages.some((message) => message.severity === 'warning')
      ? 'warning'
      : 'ready'

  return { status, messages }
}

export function validateWorkflowNodeConfig(
  nodeType: string | undefined,
  config: NodeConfig,
): NodeValidationResult {
  if (!nodeType) return { status: 'ready', messages: [] }
  const definition = getWorkflowNodeDefinition(nodeType)
  if (!definition) {
    return {
      status: 'warning',
      messages: [
        {
          severity: 'warning',
          message: 'This node does not have a registry definition yet.',
        },
      ],
    }
  }
  return validateNodeConfigFromDefinition(definition, config)
}

export function getNodeFieldValidation(
  result: NodeValidationResult,
  field: string,
) {
  return result.messages.find((message) => message.field === field)
}

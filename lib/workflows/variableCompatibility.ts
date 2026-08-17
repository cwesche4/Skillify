import type { WorkflowVariableType } from '@/lib/workflows/variableRegistry'

export type VariableCompatibilityStatus =
  | 'compatible'
  | 'warning'
  | 'incompatible'

export type VariableCompatibilityResult = {
  status: VariableCompatibilityStatus
  message: string
}

const SCALAR_TYPES: WorkflowVariableType[] = [
  'string',
  'email',
  'phone',
  'url',
  'date',
  'datetime',
  'number',
  'boolean',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,}$/

function articleFor(value: string) {
  return /^[aeiou]/i.test(value) ? 'an' : 'a'
}

export function labelForVariableType(type: WorkflowVariableType) {
  if (type === 'email') return 'email'
  if (type === 'phone') return 'phone number'
  if (type === 'url') return 'URL'
  if (type === 'datetime') return 'date/time'
  return type
}

function primaryType(types?: WorkflowVariableType[]) {
  return (
    types?.find((type) => type !== 'unknown' && type !== 'string') ??
    types?.[0] ??
    'unknown'
  )
}

export function checkVariableCompatibility({
  sourceType,
  acceptedTypes,
  allowsMixedText = false,
}: {
  sourceType: WorkflowVariableType
  acceptedTypes?: WorkflowVariableType[]
  allowsMixedText?: boolean
}): VariableCompatibilityResult {
  const accepted: WorkflowVariableType[] = acceptedTypes?.length
    ? acceptedTypes
    : ['unknown']
  const targetType = primaryType(accepted)

  if (sourceType === 'unknown' || accepted.includes('unknown')) {
    return {
      status: 'warning',
      message:
        'Variable type is unknown. Confirm this value matches the field.',
    }
  }

  if (accepted.includes(sourceType)) {
    return { status: 'compatible', message: 'Compatible' }
  }

  if (targetType === 'date' && sourceType === 'datetime') {
    return { status: 'compatible', message: 'Compatible date/time value' }
  }

  if (
    allowsMixedText &&
    accepted.includes('string') &&
    SCALAR_TYPES.includes(sourceType)
  ) {
    return { status: 'compatible', message: 'Compatible in mixed text' }
  }

  if (sourceType === 'string' && targetType === 'string') {
    return { status: 'compatible', message: 'Compatible' }
  }

  if (sourceType === 'string' && targetType === 'unknown') {
    return {
      status: 'warning',
      message: 'Text type is unknown. Confirm this value matches the field.',
    }
  }

  if (
    targetType === 'email' ||
    targetType === 'phone' ||
    targetType === 'url'
  ) {
    return {
      status: 'incompatible',
      message: `Expected ${labelForVariableType(targetType)}, but received ${labelForVariableType(sourceType)}.`,
    }
  }

  if (allowsMixedText && SCALAR_TYPES.includes(sourceType)) {
    return { status: 'compatible', message: 'Compatible in mixed text' }
  }

  if (
    (sourceType === 'object' || sourceType === 'array') &&
    !accepted.includes(sourceType)
  ) {
    return {
      status: 'incompatible',
      message: `${labelForVariableType(sourceType)} values cannot be used in this field.`,
    }
  }

  return {
    status: 'incompatible',
    message: `Expected ${labelForVariableType(targetType)}, but received ${labelForVariableType(sourceType)}.`,
  }
}

export function validateLiteralValueShape({
  value,
  acceptedTypes,
  fieldLabel = 'Field',
  allowsMixedText = false,
}: {
  value: unknown
  acceptedTypes?: WorkflowVariableType[]
  fieldLabel?: string
  allowsMixedText?: boolean
}): VariableCompatibilityResult {
  if (value === undefined || value === null || typeof value !== 'string') {
    return { status: 'compatible', message: 'Compatible' }
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('{{') || allowsMixedText) {
    return { status: 'compatible', message: 'Compatible' }
  }
  const targetType = primaryType(acceptedTypes)
  if (targetType !== 'number' && acceptedTypes?.includes('string')) {
    return { status: 'compatible', message: 'Compatible text' }
  }
  if (targetType === 'email' && !EMAIL_PATTERN.test(trimmed)) {
    return {
      status: 'incompatible',
      message: `${fieldLabel} is not a valid email address.`,
    }
  }
  if (targetType === 'phone' && !PHONE_PATTERN.test(trimmed)) {
    return {
      status: 'incompatible',
      message: `${fieldLabel} is not a valid phone number.`,
    }
  }
  if (targetType === 'url') {
    try {
      const parsed = new URL(trimmed)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Unsupported URL protocol')
      }
    } catch {
      return {
        status: 'incompatible',
        message: `${fieldLabel} is not a valid URL.`,
      }
    }
  }
  if (
    (targetType === 'date' || targetType === 'datetime') &&
    Number.isNaN(Date.parse(trimmed))
  ) {
    return {
      status: 'incompatible',
      message: `${fieldLabel} is not a valid ${labelForVariableType(targetType)}.`,
    }
  }
  if (
    (targetType === 'email' ||
      targetType === 'phone' ||
      targetType === 'url') &&
    acceptedTypes?.includes('string')
  ) {
    return {
      status: 'compatible',
      message: `Valid ${labelForVariableType(targetType)}`,
    }
  }
  if (targetType === 'number' && Number.isNaN(Number(trimmed))) {
    return {
      status: 'incompatible',
      message: `${fieldLabel} is not a valid number.`,
    }
  }
  if (
    targetType === 'number' &&
    /\b(duration|delay|wait)\b/i.test(fieldLabel) &&
    Number(trimmed) <= 0
  ) {
    return {
      status: 'incompatible',
      message: `${fieldLabel} must be greater than 0.`,
    }
  }
  if (
    targetType === 'boolean' &&
    !['true', 'false'].includes(trimmed.toLowerCase())
  ) {
    return {
      status: 'warning',
      message: `${fieldLabel} should be ${articleFor('boolean')} boolean value.`,
    }
  }
  return { status: 'compatible', message: 'Compatible' }
}

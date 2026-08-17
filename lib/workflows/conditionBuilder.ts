import type {
  WorkflowFieldSemanticRole,
  WorkflowValueType,
} from '@/lib/workflows/types'
import type { WorkflowVariableDefinition } from '@/lib/workflows/variableRegistry'

export type ConditionOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'exists'
  | 'not_exists'
  | 'is_empty'
  | 'is_not_empty'
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  | 'any_of'
  | 'none_of'
  | 'true'
  | 'false'

export type ConditionRule = {
  fieldToken: string
  fieldLabel: string
  fieldType: WorkflowValueType
  fieldSemanticRole?: WorkflowFieldSemanticRole
  operator: ConditionOperator
  value?: string
}

export type ConditionFieldCandidate = {
  token: string
  label: string
  type: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
  sample?: unknown
  category: string
  priority: number
  advanced?: boolean
}

export type ConditionValueOption = {
  id: string
  label: string
  value: string
}

const OPERATORS: Record<
  string,
  Array<{ value: ConditionOperator; label: string; needsValue?: boolean }>
> = {
  string: [
    { value: 'is', label: 'is', needsValue: true },
    { value: 'is_not', label: 'is not', needsValue: true },
    { value: 'contains', label: 'contains', needsValue: true },
    { value: 'not_contains', label: 'does not contain', needsValue: true },
    { value: 'starts_with', label: 'starts with', needsValue: true },
    { value: 'ends_with', label: 'ends with', needsValue: true },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
  emailPhone: [
    { value: 'is', label: 'is', needsValue: true },
    { value: 'is_not', label: 'is not', needsValue: true },
    { value: 'contains', label: 'contains', needsValue: true },
    { value: 'exists', label: 'is not empty' },
    { value: 'not_exists', label: 'is empty' },
  ],
  number: [
    { value: 'equals', label: 'equals', needsValue: true },
    { value: 'not_equals', label: 'does not equal', needsValue: true },
    { value: 'greater_than', label: 'greater than', needsValue: true },
    { value: 'less_than', label: 'less than', needsValue: true },
    {
      value: 'greater_or_equal',
      label: 'greater than or equal',
      needsValue: true,
    },
    { value: 'less_or_equal', label: 'less than or equal', needsValue: true },
    { value: 'exists', label: 'is not empty' },
    { value: 'not_exists', label: 'is empty' },
  ],
  date: [
    { value: 'is', label: 'is', needsValue: true },
    { value: 'before', label: 'is before', needsValue: true },
    { value: 'after', label: 'is after', needsValue: true },
    { value: 'on_or_before', label: 'is on or before', needsValue: true },
    { value: 'on_or_after', label: 'is on or after', needsValue: true },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
  boolean: [
    { value: 'true', label: 'is true' },
    { value: 'false', label: 'is false' },
  ],
  enum: [
    { value: 'is', label: 'is', needsValue: true },
    { value: 'is_not', label: 'is not', needsValue: true },
    { value: 'any_of', label: 'is any of', needsValue: true },
    { value: 'none_of', label: 'is none of', needsValue: true },
    { value: 'exists', label: 'is not empty' },
    { value: 'not_exists', label: 'is empty' },
  ],
}

export function conditionOperatorsForType(
  type: WorkflowValueType,
  semanticRole?: WorkflowFieldSemanticRole,
) {
  if (
    [
      'stage',
      'status',
      'priority',
      'owner',
      'assignee',
      'team',
      'enum',
    ].includes(semanticRole ?? '')
  ) {
    return OPERATORS.enum
  }
  if (type === 'email' || type === 'phone') return OPERATORS.emailPhone
  if (type === 'number' || type === 'duration') return OPERATORS.number
  if (type === 'date' || type === 'datetime') return OPERATORS.date
  if (type === 'boolean') return OPERATORS.boolean
  return OPERATORS.string
}

export function conditionOperatorNeedsValue(
  type: WorkflowValueType,
  operator: ConditionOperator,
  semanticRole?: WorkflowFieldSemanticRole,
) {
  return Boolean(
    conditionOperatorsForType(type, semanticRole).find(
      (item) => item.value === operator,
    )?.needsValue,
  )
}

export function conditionValuePresetsForField({
  fieldLabel,
  fieldType,
  semanticRole,
}: {
  fieldLabel: string
  fieldType: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
}) {
  return conditionValueOptionsForField({
    fieldLabel,
    fieldType,
    semanticRole,
  }).map((option) => option.label)
}

export function conditionValueOptionsForField({
  fieldLabel,
  fieldType,
  semanticRole,
}: {
  fieldLabel: string
  fieldType: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
}): ConditionValueOption[] {
  const label = fieldLabel.toLowerCase()
  const literal = (values: string[]) =>
    values.map((value) => ({
      id: value.toLowerCase().replace(/\s+/g, '-'),
      label: value,
      value,
    }))
  if (fieldType === 'boolean') return literal(['true', 'false'])
  if (fieldType === 'number' || fieldType === 'duration')
    return literal(['1', '7', '30', '60'])
  if (
    semanticRole === 'status' ||
    label.includes('health') ||
    label.includes('status')
  ) {
    return literal(['Healthy', 'Needs Attention', 'At Risk'])
  }
  if (semanticRole === 'priority' || label.includes('priority'))
    return literal(['Low', 'Medium', 'High', 'Urgent'])
  if (
    semanticRole === 'owner' ||
    semanticRole === 'assignee' ||
    semanticRole === 'team' ||
    label.includes('owner') ||
    label.includes('assignee') ||
    label.includes('team')
  ) {
    return [
      { id: 'owner', label: 'Owner', value: '{{owner.id}}' },
      { id: 'team-ops', label: 'Ops Team', value: '{{team.ops}}' },
      { id: 'team-support', label: 'Support Team', value: '{{team.support}}' },
      { id: 'skillify-ai', label: 'Skillify AI', value: '{{skillify.ai}}' },
    ]
  }
  if (semanticRole === 'stage' || label.includes('stage'))
    return literal(['New', 'Qualified', 'Proposal', 'Won', 'Lost'])
  if (label.includes('email')) return []
  if (label.includes('company'))
    return literal(['Electric', 'NorthStar Electric'])
  return []
}

export function normalizeConditionValue({
  fieldLabel,
  fieldType,
  semanticRole,
  value,
}: {
  fieldLabel: string
  fieldType: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
  value?: string
}) {
  const raw = value ?? ''
  const options = conditionValueOptionsForField({
    fieldLabel,
    fieldType,
    semanticRole,
  })
  const match = options.find(
    (option) =>
      option.value === raw ||
      option.id === raw ||
      option.label.toLowerCase() === raw.toLowerCase(),
  )
  return match?.value ?? raw
}

export function conditionValueLabel({
  fieldLabel,
  fieldType,
  semanticRole,
  value,
}: {
  fieldLabel: string
  fieldType: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
  value?: string
}) {
  const raw = value ?? ''
  const options = conditionValueOptionsForField({
    fieldLabel,
    fieldType,
    semanticRole,
  })
  return (
    options.find((option) => option.value === raw || option.label === raw)
      ?.label ?? raw
  )
}

export function isConditionValueCompatible({
  fieldLabel,
  fieldType,
  semanticRole,
  operator,
  value,
}: {
  fieldLabel: string
  fieldType: WorkflowValueType
  semanticRole?: WorkflowFieldSemanticRole
  operator: ConditionOperator
  value?: string
}) {
  if (!conditionOperatorNeedsValue(fieldType, operator, semanticRole))
    return true
  if (!value?.trim()) return false
  if (fieldType === 'number' || fieldType === 'duration')
    return !Number.isNaN(Number(value))
  if (fieldType === 'boolean')
    return ['true', 'false'].includes(value.toLowerCase())
  if (fieldType === 'email')
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || value.includes('{{')
    )
  if (fieldType === 'phone')
    return (
      /^\+?[0-9][0-9\s().-]{6,}$/.test(value.trim()) || value.includes('{{')
    )
  const options = conditionValueOptionsForField({
    fieldLabel,
    fieldType,
    semanticRole,
  })
  if (!options.length) return true
  const normalized = normalizeConditionValue({
    fieldLabel,
    fieldType,
    semanticRole,
    value,
  })
  return options.some((option) => option.value === normalized)
}

function variableText(variable: WorkflowVariableDefinition) {
  return [
    variable.key,
    variable.path,
    variable.label,
    variable.category,
    variable.group,
    variable.sourceNodeLabel,
    variable.origin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function semanticRoleForConditionVariable(
  variable: WorkflowVariableDefinition,
): WorkflowFieldSemanticRole {
  const text = variableText(variable)
  if (variable.type === 'email') return 'email'
  if (variable.type === 'phone') return 'phone'
  if (variable.type === 'number' || variable.type === 'duration')
    return 'number'
  if (variable.type === 'date') return 'date'
  if (variable.type === 'datetime') return 'datetime'
  if (variable.type === 'boolean') return 'boolean'
  if (/\b(owner|assignee|assigned|account manager)\b/.test(text)) return 'owner'
  if (/\b(team|department)\b/.test(text)) return 'team'
  if (/\bstage\b/.test(text)) return 'stage'
  if (/\b(status|health|delivery)\b/.test(text)) return 'status'
  if (/\bpriority\b/.test(text)) return 'priority'
  if (/\b(id|uuid|run|token|slug)\b/.test(text)) return 'technical'
  if (/\b(company)\b/.test(text)) return 'companyName'
  if (/\b(name|contact|customer|client|lead)\b/.test(text)) return 'personName'
  return 'genericText'
}

function isTechnicalConditionVariable(variable: WorkflowVariableDefinition) {
  const key = `${variable.key} ${variable.path}`.toLowerCase()
  if (variable.sourceNodeId) {
    return /\b(id|uuid|token|slug|run_id|message_id|send_id|internal|metadata)\b/.test(
      key,
    )
  }
  if (variable.category === 'Automation') return true
  if (variable.category === 'Workspace Variables') {
    return /\b(slug|timezone|address|website)\b/.test(key)
  }
  return /\b(id|uuid|token|slug|run_id|internal)\b/.test(key)
}

export function isConditionFieldCandidate(
  variable: WorkflowVariableDefinition,
) {
  const role = semanticRoleForConditionVariable(variable)
  if (role === 'technical') return true
  if (['object', 'array', 'unknown'].includes(variable.type)) return false
  return [
    'string',
    'number',
    'boolean',
    'date',
    'datetime',
    'email',
    'phone',
    'url',
    'duration',
  ].includes(variable.type)
}

export function conditionFieldCategory(variable: WorkflowVariableDefinition) {
  const role = semanticRoleForConditionVariable(variable)
  if (role === 'technical' || isTechnicalConditionVariable(variable))
    return 'Advanced fields'
  if (variable.sourceNodeId) return 'Workflow Data'
  if (
    variable.category === 'Lead' ||
    variable.category === 'Client' ||
    variable.category === 'CRM' ||
    variable.category === 'Opportunity'
  ) {
    return 'Customer and CRM'
  }
  if (variable.category === 'Task') return 'Tasks and Operations'
  if (variable.category === 'Service Request') return 'Tasks and Operations'
  if (role === 'email' || role === 'phone' || role === 'status')
    return 'Communication'
  if (role === 'date' || role === 'datetime') return 'Dates and Timing'
  if (variable.category === 'Workspace Variables') {
    return role === 'owner' || role === 'team'
      ? 'Customer and CRM'
      : 'Advanced fields'
  }
  return 'Workflow Data'
}

function conditionFieldPriority(variable: WorkflowVariableDefinition) {
  const role = semanticRoleForConditionVariable(variable)
  const category = conditionFieldCategory(variable)
  if (category === 'Customer and CRM') {
    if (['status', 'stage', 'owner', 'assignee', 'team'].includes(role))
      return 10
    if (variable.type === 'number') return 20
    if (role === 'email' || role === 'phone') return 35
    return 30
  }
  if (category === 'Tasks and Operations') {
    if (role === 'priority' || role === 'status' || role === 'assignee')
      return 15
    return 35
  }
  if (category === 'Communication') return 40
  if (category === 'Dates and Timing') return 45
  if (category === 'Workflow Data') return variable.sourceNodeId ? 50 : 60
  return 100
}

export function getConditionFieldCandidates(
  variables: WorkflowVariableDefinition[],
): ConditionFieldCandidate[] {
  const seen = new Set<string>()
  return variables
    .filter(isConditionFieldCandidate)
    .filter((variable) => {
      const key = [
        variable.sourceNodeId ?? variable.category,
        variable.label.trim().toLowerCase(),
        variable.type,
      ].join(':')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((variable) => ({
      token: variable.token,
      label: variable.label,
      type: variable.type as WorkflowValueType,
      semanticRole: semanticRoleForConditionVariable(variable),
      sample: variable.previewValue ?? variable.sampleValue,
      category: conditionFieldCategory(variable),
      priority: conditionFieldPriority(variable),
      advanced: conditionFieldCategory(variable) === 'Advanced fields',
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.label.localeCompare(b.label)
    })
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`
}

export function serializeConditionRule(rule: ConditionRule) {
  const left = rule.fieldToken
  switch (rule.operator) {
    case 'exists':
      return `${left} exists`
    case 'not_exists':
      return `${left} does not exist`
    case 'true':
      return `${left} == true`
    case 'false':
      return `${left} == false`
    case 'contains':
      return `${left} contains ${quote(rule.value ?? '')}`
    case 'not_contains':
      return `${left} does not contain ${quote(rule.value ?? '')}`
    case 'starts_with':
      return `${left} starts with ${quote(rule.value ?? '')}`
    case 'ends_with':
      return `${left} ends with ${quote(rule.value ?? '')}`
    case 'any_of':
      return `${left} is any of ${quote(rule.value ?? '')}`
    case 'none_of':
      return `${left} is none of ${quote(rule.value ?? '')}`
    case 'is_not':
    case 'not_equals':
      return `${left} != ${quote(rule.value ?? '')}`
    case 'greater_than':
      return `${left} > ${rule.value ?? ''}`
    case 'less_than':
      return `${left} < ${rule.value ?? ''}`
    case 'greater_or_equal':
      return `${left} >= ${rule.value ?? ''}`
    case 'less_or_equal':
      return `${left} <= ${rule.value ?? ''}`
    case 'before':
      return `${left} before ${quote(rule.value ?? '')}`
    case 'after':
      return `${left} after ${quote(rule.value ?? '')}`
    case 'on_or_before':
      return `${left} on or before ${quote(rule.value ?? '')}`
    case 'on_or_after':
      return `${left} on or after ${quote(rule.value ?? '')}`
    case 'is':
    case 'equals':
    default:
      return `${left} == ${quote(rule.value ?? '')}`
  }
}

export function parseConditionExpression(
  expression: string,
  candidates: Array<{
    token: string
    label: string
    type: WorkflowValueType
    semanticRole?: WorkflowFieldSemanticRole
  }>,
): ConditionRule | null {
  const raw = expression.trim()
  if (!raw) return null
  const candidate = candidates.find((item) => raw.startsWith(item.token))
  if (!candidate) return null
  const remainder = raw.slice(candidate.token.length).trim()
  const unquote = (value: string) =>
    value.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"')

  const operators: Array<[RegExp, ConditionOperator]> = [
    [/^does\s+not\s+exist$/i, 'not_exists'],
    [/^is\s+empty$/i, 'not_exists'],
    [/^is\s+not\s+empty$/i, 'exists'],
    [/^exists$/i, 'exists'],
    [/^does\s+not\s+contain\s+(.+)$/i, 'not_contains'],
    [/^contains\s+(.+)$/i, 'contains'],
    [/^starts\s+with\s+(.+)$/i, 'starts_with'],
    [/^ends\s+with\s+(.+)$/i, 'ends_with'],
    [/^is\s+any\s+of\s+(.+)$/i, 'any_of'],
    [/^is\s+none\s+of\s+(.+)$/i, 'none_of'],
    [/^!=\s+(.+)$/i, candidate.type === 'number' ? 'not_equals' : 'is_not'],
    [/^>=\s+(.+)$/i, 'greater_or_equal'],
    [/^<=\s+(.+)$/i, 'less_or_equal'],
    [/^>\s+(.+)$/i, 'greater_than'],
    [/^<\s+(.+)$/i, 'less_than'],
    [/^before\s+(.+)$/i, 'before'],
    [/^after\s+(.+)$/i, 'after'],
    [/^on\s+or\s+before\s+(.+)$/i, 'on_or_before'],
    [/^on\s+or\s+after\s+(.+)$/i, 'on_or_after'],
    [/^==\s+true$/i, 'true'],
    [/^==\s+false$/i, 'false'],
    [/^==\s+(.+)$/i, candidate.type === 'number' ? 'equals' : 'is'],
  ]

  for (const [regex, operator] of operators) {
    const match = remainder.match(regex)
    if (!match) continue
    return {
      fieldToken: candidate.token,
      fieldLabel: candidate.label,
      fieldType: candidate.type,
      fieldSemanticRole: candidate.semanticRole,
      operator,
      value: match[1] ? unquote(match[1]) : undefined,
    }
  }
  return null
}

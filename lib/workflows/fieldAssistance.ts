import type { NodeConfigField } from '@/lib/workflows/types'
import type { WorkflowVariableDefinition } from '@/lib/workflows/variableRegistry'
import {
  formatVariableReadableLabel,
  formatVariableToken,
} from '@/lib/workflows/variableRegistry'
import { getCompatibleVariablesForField } from '@/lib/workflows/dataMapping'

export type FieldAssistanceSuggestion =
  | {
      id: string
      kind: 'example'
      label: string
      value: string
      description?: string
    }
  | {
      id: string
      kind: 'variable'
      label: string
      value: string
      description?: string
      sample?: unknown
    }
  | {
      id: string
      kind: 'literal'
      label: string
      value: string
      description?: string
    }

function fieldKey(field: NodeConfigField) {
  return field.key ?? field.id
}

function textForSuggestion(value: unknown) {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  return JSON.stringify(value, null, 2)
}

function exampleValueForField(field: NodeConfigField) {
  const explicit = field.example ?? field.defaultValue
  const value = textForSuggestion(explicit)
  if (!value.trim()) return ''
  if (
    field.type === 'number' ||
    field.type === 'select' ||
    field.type === 'multi-select'
  )
    return ''
  return value
}

type PresetSuggestion =
  | string
  | { label: string; value: string; description?: string }

function literalSuggestion(
  preset: PresetSuggestion,
): FieldAssistanceSuggestion {
  const value = typeof preset === 'string' ? preset : preset.value
  const label = typeof preset === 'string' ? preset : preset.label
  return {
    id: `literal:${value}`,
    kind: 'literal',
    label,
    value,
    description: typeof preset === 'string' ? undefined : preset.description,
  }
}

function variableSuggestion(
  variable: WorkflowVariableDefinition,
): FieldAssistanceSuggestion {
  return {
    id: `variable:${variable.token ?? variable.key}`,
    kind: 'variable',
    label: formatVariableReadableLabel(variable),
    value: variable.token ?? formatVariableToken(variable.key),
    description: variable.origin ?? variable.category,
    sample: variable.previewValue ?? variable.sampleValue,
  }
}

const PRESETS: Record<string, PresetSuggestion[]> = {
  stage: ['New', 'Qualified', 'Proposal', 'Won', 'Lost', 'Onboarding'],
  healthStatus: ['Healthy', 'Needs Attention', 'At Risk'],
  priority: ['Low', 'Medium', 'High', 'Urgent'],
  nextAction: [
    'Schedule kickoff call',
    'Request missing documents',
    'Send proposal',
    'Follow up tomorrow',
    'Assign technician',
    'Review account',
  ],
  owner: [
    { label: 'Owner', value: '{{owner.id}}' },
    { label: 'Ops Team', value: '{{team.ops}}' },
    { label: 'Support Team', value: '{{team.support}}' },
    { label: 'Skillify AI', value: '{{skillify.ai}}' },
  ],
  assignee: [
    { label: 'Owner', value: '{{owner.id}}' },
    { label: 'Ops Team', value: '{{team.ops}}' },
    { label: 'Support Team', value: '{{team.support}}' },
    { label: 'Skillify AI', value: '{{skillify.ai}}' },
  ],
  team: [
    { label: 'Ops Team', value: '{{team.ops}}' },
    { label: 'Support Team', value: '{{team.support}}' },
  ],
  messageSubject: [
    'Quick follow-up',
    'Proposal follow-up',
    'Welcome to onboarding',
    'Review request',
  ],
  taskTitle: [
    'Follow up with customer',
    'Create review follow-up',
    'Schedule next step',
  ],
  taskDescription: [
    'Summarize next steps.',
    'Review the account and follow up with the customer.',
    'Confirm missing details and update the team.',
  ],
  message: [
    'Hi {{client.name}}, thanks for reaching out.',
    'We received your request and will follow up shortly.',
    'Thanks for contacting us. Here is the next step.',
  ],
  description: [
    'Review the customer record and confirm the next step.',
    'Summarize the request, status, and follow-up owner.',
  ],
  note: [
    'Customer asked for a follow-up.',
    'Add this context to the customer timeline.',
  ],
}

function variableText(variable: WorkflowVariableDefinition) {
  return [
    variable.key,
    variable.path,
    variable.label,
    variable.category,
    variable.origin,
    variable.sourceNodeLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function semanticVariableScore(
  field: NodeConfigField,
  variable: WorkflowVariableDefinition,
) {
  const text = variableText(variable)
  const role = field.semanticRole
  const semantic = field.semanticType ?? 'genericText'
  let score = 0

  if (
    field.preferredVariableGroups?.some((group) =>
      text.includes(group.toLowerCase()),
    )
  ) {
    score += 30
  }
  if (
    field.excludedVariableGroups?.some((group) =>
      text.includes(group.toLowerCase()),
    )
  ) {
    score -= 100
  }

  if (isTechnicalVariable(variable) && !field.includeTechnicalSuggestions) {
    score -= 100
  }

  if (role === 'email' || semantic === 'emailAddress') {
    if (variable.type === 'email') score += 50
    if (
      text.includes('client') ||
      text.includes('lead') ||
      text.includes('customer')
    )
      score += 20
    if (text.includes('workspace') || text.includes('owner')) score -= 5
  } else if (role === 'phone' || semantic === 'phoneNumber') {
    if (variable.type === 'phone') score += 50
    if (
      text.includes('client') ||
      text.includes('lead') ||
      text.includes('customer')
    )
      score += 20
    if (text.includes('workspace') || text.includes('owner')) score -= 5
  } else if (
    role === 'message' ||
    role === 'description' ||
    role === 'note' ||
    semantic === 'messageBody'
  ) {
    if (
      variable.type === 'object' ||
      variable.type === 'array' ||
      variable.type === 'unknown'
    )
      score -= 100
    if (
      text.includes('client') ||
      text.includes('lead') ||
      text.includes('customer')
    )
      score += 35
    if (text.includes('name')) score += 25
    if (text.includes('company')) score += 18
    if (
      text.includes('service') ||
      text.includes('appointment') ||
      text.includes('issue') ||
      text.includes('request')
    )
      score += 16
    if (text.includes('owner') || text.includes('team')) score += 6
    if (text.includes('workspace')) score -= 12
    if (variable.type === 'email' || variable.type === 'phone') score -= 8
  } else if (
    role === 'title' ||
    semantic === 'taskDescription' ||
    semantic === 'taskTitle' ||
    semantic === 'nextAction'
  ) {
    if (
      text.includes('task') ||
      text.includes('client') ||
      text.includes('lead') ||
      text.includes('service')
    )
      score += 24
    if (
      text.includes('name') ||
      text.includes('company') ||
      text.includes('status')
    )
      score += 12
    if (variable.type === 'email' || variable.type === 'phone') score -= 15
    if (text.includes('workspace')) score -= 12
  } else if (role === 'number' || semantic === 'duration') {
    if (variable.type === 'number' || variable.type === 'duration') score += 50
    else score -= 100
  } else if (
    role === 'owner' ||
    role === 'assignee' ||
    role === 'team' ||
    semantic === 'owner' ||
    semantic === 'assignee'
  ) {
    if (
      text.includes('owner') ||
      text.includes('assignee') ||
      text.includes('team') ||
      text.includes('user')
    )
      score += 40
    if (
      variable.type === 'email' ||
      variable.type === 'phone' ||
      text.includes('duration')
    )
      score -= 100
  } else if (
    role === 'stage' ||
    role === 'status' ||
    role === 'priority' ||
    role === 'enum' ||
    semantic === 'stage' ||
    semantic === 'healthStatus' ||
    semantic === 'priority' ||
    semantic === 'durationUnit'
  ) {
    score -= 100
  } else {
    if (text.includes('client') || text.includes('lead')) score += 10
    if (text.includes('workspace')) score -= 8
  }

  return score
}

function presetsForField(field: NodeConfigField) {
  const options =
    field.options?.map((option) => option.label || option.value) ?? []
  const rolePresets = field.semanticRole
    ? (PRESETS[field.semanticRole] ?? [])
    : []
  return [
    ...options,
    ...(field.suggestions ?? []),
    ...rolePresets,
    ...(field.semanticType ? (PRESETS[field.semanticType] ?? []) : []),
  ]
}

function isTechnicalVariable(variable: WorkflowVariableDefinition) {
  const text = variableText(variable)
  const value = variable.previewValue ?? variable.sampleValue
  return (
    variable.type === 'object' ||
    variable.type === 'array' ||
    variable.type === 'unknown' ||
    typeof value === 'object' ||
    /\b(uuid|internal|runtime|raw|payload|record|node)\b/.test(text) ||
    /\b(run|message|task|lead|client|request)[_\s.-]*id\b/.test(text) ||
    /^id$/i.test(variable.label.trim())
  )
}

export function getContextualFieldSuggestions({
  field,
  value,
  variables,
}: {
  field: NodeConfigField
  value: unknown
  variables: WorkflowVariableDefinition[]
}): FieldAssistanceSuggestion[] {
  if (field.suggestionMode === 'none') return []

  const suggestions: FieldAssistanceSuggestion[] = []
  const current = String(value ?? '')
  const example = exampleValueForField(field)
  if (!current.trim() && example) {
    suggestions.push({
      id: `example:${fieldKey(field)}`,
      kind: 'example',
      label: 'Use example',
      value: example,
      description: example,
    })
  }

  const showPresets =
    field.suggestionMode === 'presets' ||
    field.suggestionMode === 'presetsAndWorkflowData' ||
    field.suggestionMode === undefined
  if (showPresets) {
    for (const preset of presetsForField(field))
      suggestions.push(literalSuggestion(preset))
  }

  const showWorkflowData =
    field.suggestionMode === 'workflowData' ||
    field.suggestionMode === 'presetsAndWorkflowData'
  if (showWorkflowData) {
    const compatible = getCompatibleVariablesForField({ field, variables })
    const ranked = compatible
      .map((variable) => ({
        variable,
        score: semanticVariableScore(field, variable),
      }))
      .filter((item) => item.score > -50)
      .sort(
        (a, b) =>
          b.score - a.score || a.variable.label.localeCompare(b.variable.label),
      )
      .slice(0, 8)

    for (const item of ranked)
      suggestions.push(variableSuggestion(item.variable))
  }

  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.kind}:${suggestion.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

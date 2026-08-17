'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Edge, Node } from 'reactflow'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { NodeConfig, NodeConfigField } from '@/lib/workflows/types'
import type { WorkflowValueType } from '@/lib/workflows/types'
import {
  getNodeFieldValidation,
  type NodeValidationResult,
} from '@/lib/workflows/nodeValidation'
import { insertTextAtCursor } from '@/lib/workflows/textInsertion'
import {
  getContextualFieldSuggestions,
  type FieldAssistanceSuggestion,
} from '@/lib/workflows/fieldAssistance'
import {
  conditionOperatorNeedsValue,
  conditionOperatorsForType,
  conditionValueOptionsForField,
  getConditionFieldCandidates,
  isConditionValueCompatible,
  normalizeConditionValue,
  parseConditionExpression,
  serializeConditionRule,
  type ConditionOperator,
} from '@/lib/workflows/conditionBuilder'
import {
  applySchemaPreset,
  DEFAULT_SCHEMA_CHIPS,
  DEFAULT_SCHEMA_PRESETS,
  parseSchemaObject,
  toggleSchemaChip,
} from '@/lib/workflows/schemaBuilder'
import {
  getCompatibleVariablesForField,
  getRelevantVariablesForField,
  validateVariableValueForField,
} from '@/lib/workflows/dataMapping'
import { canonicalizeVariableTokens } from '@/lib/workflows/variableTokens'
import {
  extractVariableReferences,
  formatVariableToken,
  formatVariableReadableLabel,
  formatVariableSourceLabel,
  getAvailableVariablesForNode,
  getWorkflowVariableDefinition,
  resolveVariablePreviewText,
  searchWorkflowVariables,
  workflowVariableRegistry,
  type WorkflowVariableDefinition,
  type WorkflowVariableReference,
} from '@/lib/workflows/variableRegistry'

type RegistryInspectorFieldsProps = {
  fields: NodeConfigField[]
  config: NodeConfig
  validation: NodeValidationResult
  onChange: (key: string, value: unknown) => void
  node?: Node | null
  nodes?: Node[]
  edges?: Edge[]
  focusFieldKey?: string | null
  focusFieldKeys?: string[]
  focusRequestId?: number
  onFocusHandled?: () => void
}

function VariableChips({
  value,
  variables,
  onInspect,
  onRemove,
}: {
  value: unknown
  variables: WorkflowVariableDefinition[]
  onInspect: (reference: WorkflowVariableReference) => void
  onRemove: (reference: WorkflowVariableReference) => void
}) {
  const references = extractVariableReferences(value, variables)
  if (!references.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {references.map((reference) => (
        <button
          key={`${reference.key}-${reference.raw}`}
          type="button"
          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100"
          title={
            reference.definition
              ? [
                  `Friendly label: ${formatVariableReadableLabel(reference.definition)}`,
                  `Produced by: ${formatVariableSourceLabel(reference.definition)}`,
                  `Type: ${reference.definition.type}`,
                  `Current value source: ${String(reference.definition.previewValue ?? reference.definition.sampleValue ?? 'Preview unavailable')}`,
                ].join('\n')
              : (reference.message ?? 'This workflow data needs attention.')
          }
          onClick={() => onInspect(reference)}
        >
          {reference.definition
            ? formatVariableReadableLabel(reference.definition)
            : fallbackVariableLabel(reference)}
          <span
            className="ml-1 text-cyan-100/70"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(reference)
            }}
          >
            x
          </span>
        </button>
      ))}
    </div>
  )
}

function VariablePreview({
  value,
  variables,
  issues,
}: {
  value: unknown
  variables: WorkflowVariableDefinition[]
  issues?: ReturnType<typeof validateVariableValueForField>
}) {
  const references = variablePreviewReferences(value, variables)
  const hasIssues = Boolean(issues?.length)
  if (!references.length && !hasIssues) return null
  const resolvedPreview = resolveVariablePreviewText(value, variables)
  return (
    <div className="space-y-1 rounded-lg border border-slate-800/70 bg-slate-950/45 p-2">
      {typeof resolvedPreview === 'string' && resolvedPreview !== value ? (
        <div className="bg-cyan-300/8 rounded-md border border-cyan-300/15 px-2 py-1 text-[10px] text-cyan-50">
          {resolvedPreview}
        </div>
      ) : null}
      {references.map((reference) => (
        <div
          key={`${reference.raw}:${reference.key}`}
          className="flex items-start justify-between gap-3 text-[10px]"
        >
          <div className="min-w-0">
            <p
              className={
                reference.definition
                  ? 'truncate text-cyan-100'
                  : 'text-rose-300'
              }
            >
              {reference.definition
                ? formatVariableReadableLabel(reference.definition)
                : (reference.message ??
                  'This variable is not available in the current workflow.')}
            </p>
            <p className="truncate text-slate-500">
              {reference.definition
                ? `From ${formatVariableSourceLabel(reference.definition)} · ${reference.definition.type}`
                : 'This workflow data needs attention'}
            </p>
          </div>
          <div className="shrink-0 text-right text-slate-400">
            <p>{reference.definition?.type ?? 'broken'}</p>
            <p className="max-w-[120px] truncate text-slate-500">
              {String(reference.definition?.sampleValue ?? '')}
            </p>
          </div>
        </div>
      ))}
      {issues?.map((issue, index) => (
        <p
          key={`${issue.field ?? 'field'}:${issue.message}:${index}`}
          className={
            issue.severity === 'error'
              ? 'text-[10px] text-rose-300'
              : 'text-[10px] text-amber-300'
          }
        >
          {issue.message}
        </p>
      ))}
    </div>
  )
}

function fieldKey(field: NodeConfigField) {
  return field.key ?? field.id
}

function valueForField(field: NodeConfigField, config: NodeConfig) {
  const nested =
    config.config &&
    typeof config.config === 'object' &&
    !Array.isArray(config.config)
      ? (config.config as NodeConfig)
      : {}
  const value = config[fieldKey(field)] ?? nested[fieldKey(field)]
  return value ?? field.defaultValue ?? ''
}

function supportsVariableInsertion(field: NodeConfigField) {
  if (typeof field.supportsVariables === 'boolean')
    return field.supportsVariables
  return [
    'text',
    'textarea',
    'json',
    'code',
    'ai-prompt',
    'variable',
    'key-value',
  ].includes(field.type)
}

function variablePreviewReferences(
  value: unknown,
  variables: WorkflowVariableDefinition[],
) {
  return extractVariableReferences(value, variables)
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

function clampNumber(value: number, field: NodeConfigField) {
  if (Number.isNaN(value)) return field.defaultValue ?? ''
  let next = value
  if (typeof field.min === 'number') next = Math.max(field.min, next)
  if (typeof field.max === 'number') next = Math.min(field.max, next)
  return next
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function titleCaseWords(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function fallbackVariableLabel(reference: WorkflowVariableReference) {
  const path =
    reference.token?.kind === 'node' ? reference.token.path : reference.key
  const parts = path.split('.')
  const prefix = parts.length > 1 ? parts[0] : ''
  const leaf = parts.at(-1) ?? path
  const normalizedPrefix = prefix === 'record' ? '' : prefix
  return titleCaseWords([normalizedPrefix, leaf].filter(Boolean).join(' '))
}

function variableDisplayForToken(
  token: string,
  variables: WorkflowVariableDefinition[],
) {
  const variable =
    variables.find((item) => item.token === token || item.key === token) ??
    getWorkflowVariableDefinition(token, variables) ??
    getWorkflowVariableDefinition(token, workflowVariableRegistry)
  if (!variable) {
    const friendly = titleCaseWords(
      token
        .replace(/[{}]/g, '')
        .replace(/^workspace\.supportEmail$/, 'Support Email')
        .replace(/^workspace\.email$/, 'Workspace Email')
        .replace(/^client\./, 'customer.')
        .replace(/^record\./, '')
        .replace(/\./g, ' '),
    )
    return {
      token,
      label: friendly,
      source: 'Custom',
      sample: '',
      type: 'string',
    }
  }
  return {
    token: variable.token ?? formatVariableToken(variable.key),
    label: formatVariableReadableLabel(variable),
    source: formatVariableSourceLabel(variable),
    sample: variable.sampleValue ?? variable.previewValue,
    type: variable.type,
  }
}

const ALIAS_VARIABLES: Array<{
  aliases: string[]
  keys: string[]
  label: string
}> = [
  {
    aliases: ['email', 'client email', 'customer email'],
    keys: ['client.email', 'lead.email', 'record.email', 'workspace.email'],
    label: 'Client Email',
  },
  {
    aliases: ['lead email'],
    keys: ['lead.email', 'record.email'],
    label: 'Lead Email',
  },
  {
    aliases: ['name', 'client name', 'customer name'],
    keys: ['client.name', 'lead.fullName', 'record.name', 'lead.name'],
    label: 'Client Name',
  },
  {
    aliases: ['lead name'],
    keys: ['lead.fullName', 'lead.name', 'record.name'],
    label: 'Lead Name',
  },
  {
    aliases: ['contact name'],
    keys: ['contact.name', 'record.name'],
    label: 'Contact Name',
  },
  {
    aliases: ['phone', 'client phone', 'customer phone'],
    keys: ['client.phone', 'lead.phone', 'record.phone', 'workspace.phone'],
    label: 'Client Phone',
  },
  {
    aliases: ['lead phone'],
    keys: ['lead.phone', 'record.phone'],
    label: 'Lead Phone',
  },
]

function variableForKeys(
  keys: string[],
  variables: WorkflowVariableDefinition[],
) {
  for (const key of keys) {
    const variable =
      variables.find(
        (item) =>
          item.key.endsWith(`.${key}`) ||
          item.path === key ||
          item.key === key ||
          item.token === `{{${key}}}`,
      ) ?? getWorkflowVariableDefinition(key, workflowVariableRegistry)
    if (variable) return variable.token ?? formatVariableToken(variable.key)
  }
  return null
}

function aliasSuggestionForValue(
  value: unknown,
  variables: WorkflowVariableDefinition[],
) {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const entry = ALIAS_VARIABLES.find((item) =>
    item.aliases.includes(normalized),
  )
  if (!entry) return null
  const variable = variableForKeys(entry.keys, variables)
  return variable ? { ...entry, variable } : null
}

function commonValuesForField(
  field: NodeConfigField,
  variables: WorkflowVariableDefinition[],
) {
  const key = fieldKey(field).toLowerCase()
  const label = field.label.toLowerCase()
  if (key === 'recipient') {
    return Array.from(
      new Set(
        [
          variableForKeys(['lead.email', 'record.email'], variables),
          variableForKeys(['client.email'], variables),
          variableForKeys(['owner.email'], variables),
          variableForKeys(['workspace.email'], variables),
        ].filter((value): value is string => Boolean(value)),
      ),
    )
  }
  if (key === 'cc') {
    return Array.from(
      new Set(
        [
          variableForKeys(['owner.email'], variables),
          variableForKeys(['workspace.email'], variables),
        ].filter((value): value is string => Boolean(value)),
      ),
    )
  }
  if (key === 'phone' || label.includes('phone')) {
    return Array.from(
      new Set(
        [
          variableForKeys(['lead.phone', 'record.phone'], variables),
          variableForKeys(['client.phone'], variables),
          variableForKeys(['contact.phone'], variables),
        ].filter((value): value is string => Boolean(value)),
      ),
    )
  }
  if (key.includes('name') || label.includes('name')) {
    return Array.from(
      new Set(
        [
          variableForKeys(
            ['lead.fullName', 'lead.name', 'record.name'],
            variables,
          ),
          variableForKeys(['client.name'], variables),
          variableForKeys(['contact.name'], variables),
        ].filter((value): value is string => Boolean(value)),
      ),
    )
  }
  if (key === 'subject') {
    return [
      'Follow-up',
      'Quick follow-up',
      'Proposal follow-up',
      'Welcome to onboarding',
      'Review request',
    ]
  }
  if (key === 'categories') {
    return ['Lead', 'Customer', 'Needs Review', 'Spam', 'High Intent']
  }
  if (key === 'owner' || label.includes('assignee')) {
    return ['Owner', 'Ops Team', 'Support Team', 'Skillify AI']
  }
  if (key === 'priority') {
    return ['Low', 'Medium', 'High', 'Urgent']
  }
  if (key === 'method') {
    return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
  if (key === 'body' && (field.type === 'json' || field.type === 'code')) {
    return [
      '{}',
      '{ "id": "{{client.id}}" }',
      '{ "name": "{{client.name}}", "email": "{{client.email}}" }',
    ]
  }
  if ((key === 'schema' || key === 'schemahint') && field.type === 'json') {
    return [
      '{ "name": "string", "email": "string", "phone": "string", "company": "string" }',
      '{ "summary": "string", "priority": "string", "next_action": "string" }',
    ]
  }
  return []
}

function mappingFieldText(field: NodeConfigField) {
  return `${fieldKey(field)} ${field.label}`.toLowerCase()
}

function customValuePlaceholder(field: NodeConfigField) {
  const text = mappingFieldText(field)
  if (field.acceptedTypes?.includes('email') || text.includes('email')) {
    return 'john@example.com'
  }
  if (field.acceptedTypes?.includes('phone') || text.includes('phone')) {
    return '+1 555 555 5555'
  }
  if (
    field.acceptedTypes?.includes('url') ||
    text.includes('url') ||
    text.includes('link')
  ) {
    return field.placeholder?.startsWith('http')
      ? field.placeholder
      : 'https://example.com/webhook'
  }
  if (field.options?.length) {
    return `Select ${field.options.map((option) => option.label || option.value).join(', ')}.`
  }
  if (field.type === 'number' || field.acceptedTypes?.includes('number'))
    return '30'
  if (field.acceptedTypes?.includes('date') || text.includes('date')) {
    return '2026-07-15'
  }
  if (field.acceptedTypes?.includes('datetime') || text.includes('time')) {
    return '2026-07-15T14:30:00Z'
  }
  if (text.includes('subject')) return 'Follow-up on your request'
  if (
    field.allowsMixedText ||
    text.includes('body') ||
    text.includes('message') ||
    text.includes('prompt') ||
    text.includes('instructions')
  ) {
    return 'Hello {{customer.name}}, thanks for contacting us.'
  }
  return field.placeholder ?? 'Enter a custom value'
}

function normalizedOptionValue(value: unknown, field: NodeConfigField) {
  if (!field.options?.length) return String(value)
  const raw = String(value ?? '').trim()
  const exact = field.options.find((option) => option.value === raw)
  if (exact) return exact.value
  const lower = raw.toLowerCase()
  return (
    field.options.find((option) => option.value.toLowerCase() === lower)
      ?.value ?? raw
  )
}

function variableSelectorGroup(variable: WorkflowVariableDefinition) {
  if (variable.sourceNodeId) return 'Workflow Data'
  if (
    variable.category === 'Workspace Variables' ||
    variable.key.startsWith('workspace.') ||
    variable.key.startsWith('owner.')
  ) {
    return 'Workspace Data'
  }
  if (
    variable.category === 'Automation' ||
    variable.key.startsWith('automation.')
  ) {
    return 'Workflow Data'
  }
  return variable.category || 'Workflow Data'
}

function groupedVariables(variables: WorkflowVariableDefinition[]) {
  const order = ['Workflow Data', 'Workspace Data']
  const groups = variables.reduce<Record<string, WorkflowVariableDefinition[]>>(
    (acc, variable) => {
      const group = variableSelectorGroup(variable)
      acc[group] = acc[group] ?? []
      acc[group].push(variable)
      return acc
    },
    {},
  )
  return [
    ...order
      .filter((group) => groups[group]?.length)
      .map((group) => ({ title: group, variables: groups[group] })),
    ...Object.entries(groups)
      .filter(([group]) => !order.includes(group))
      .map(([title, variables]) => ({ title, variables })),
  ]
}

function FieldChrome({
  field,
  validation,
  children,
  onInsertVariable,
  highlighted,
}: {
  field: NodeConfigField
  validation: NodeValidationResult
  children: React.ReactNode
  onInsertVariable: () => void
  highlighted?: boolean
}) {
  const message = getNodeFieldValidation(validation, fieldKey(field))
  return (
    <div
      className={[
        'space-y-1.5 rounded-xl transition',
        highlighted
          ? 'border border-cyan-300/45 bg-cyan-300/5 p-2 shadow-[0_0_0_1px_rgba(103,232,249,0.16)]'
          : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-slate-300">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-rose-300">*</span>
          ) : null}
        </label>
        <span className="ml-auto text-[10px] text-slate-500">
          {field.required ? 'Required' : 'Optional'}
        </span>
        {supportsVariableInsertion(field) ? (
          <Button size="xs" variant="ghost" onClick={onInsertVariable}>
            Insert Workflow Data
          </Button>
        ) : null}
      </div>
      {children}
      {field.helpText ? (
        <p className="text-[10px] text-slate-500">{field.helpText}</p>
      ) : null}
      {message ? (
        <p
          className={
            message.severity === 'error'
              ? 'text-[11px] text-rose-300'
              : 'text-[11px] text-amber-300'
          }
        >
          {message.message}
        </p>
      ) : null}
    </div>
  )
}

function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add row',
}: {
  value: unknown
  onChange: (value: Array<{ key: string; value: string }>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
}) {
  const rows = Array.isArray(value)
    ? (value as Array<{ key?: string; value?: string }>)
    : []
  const normalized = rows.length ? rows : [{ key: '', value: '' }]

  return (
    <div className="space-y-2">
      {normalized.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={row.key ?? ''}
            placeholder={keyPlaceholder}
            className="h-8 text-[12px]"
            onChange={(event) => {
              const next = normalized.slice()
              next[index] = { ...next[index], key: event.target.value }
              onChange(next as Array<{ key: string; value: string }>)
            }}
          />
          <Input
            value={row.value ?? ''}
            placeholder={valuePlaceholder}
            className="h-8 text-[12px]"
            onChange={(event) => {
              const next = normalized.slice()
              next[index] = { ...next[index], value: event.target.value }
              onChange(next as Array<{ key: string; value: string }>)
            }}
          />
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              const next = normalized.filter(
                (_, rowIndex) => rowIndex !== index,
              )
              onChange(
                (next.length ? next : [{ key: '', value: '' }]) as Array<{
                  key: string
                  value: string
                }>,
              )
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="secondary"
        onClick={() =>
          onChange([...normalized, { key: '', value: '' }] as Array<{
            key: string
            value: string
          }>)
        }
      >
        {addLabel}
      </Button>
    </div>
  )
}

export function RegistryInspectorFields({
  fields,
  config,
  validation,
  onChange,
  node,
  nodes = [],
  edges = [],
  focusFieldKey,
  focusFieldKeys = [],
  focusRequestId,
  onFocusHandled,
}: RegistryInspectorFieldsProps) {
  const [variablePickerField, setVariablePickerField] = useState<string | null>(
    null,
  )
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [variableSearch, setVariableSearch] = useState('')
  const [conditionDrafts, setConditionDrafts] = useState<
    Record<
      string,
      { token?: string; operator?: ConditionOperator; value?: string }
    >
  >({})
  const [inspectedVariable, setInspectedVariable] =
    useState<WorkflowVariableReference | null>(null)
  const fieldRefs = useRef<
    Record<string, HTMLInputElement | HTMLTextAreaElement | null>
  >({})
  const fieldContainerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const availableVariables = useMemo(
    () =>
      getAvailableVariablesForNode(node, node ? { nodes, edges } : undefined),
    [edges, node, nodes],
  )

  useEffect(() => {
    setVariablePickerField(null)
    setFocusedFieldKey(null)
    setActiveSuggestionIndex(-1)
    setVariableSearch('')
  }, [node?.id])

  useEffect(() => {
    const closeAssistance = () => {
      setVariablePickerField(null)
      setFocusedFieldKey(null)
      setActiveSuggestionIndex(-1)
      setVariableSearch('')
    }
    window.addEventListener(
      'workflow-builder:close-field-assistance',
      closeAssistance,
    )
    return () =>
      window.removeEventListener(
        'workflow-builder:close-field-assistance',
        closeAssistance,
      )
  }, [])

  useEffect(() => {
    if (!focusFieldKey) return
    const key = focusFieldKey
    setVariablePickerField(key)
    setFocusedFieldKey(key)
    setVariableSearch('')
    const scrollToField = () => {
      const fieldContainer = fieldContainerRefs.current[key]
      const inspectorScroller = fieldContainer?.closest(
        '[data-inspector-scroll="true"]',
      ) as HTMLElement | null
      if (fieldContainer && inspectorScroller) {
        const fieldRect = fieldContainer.getBoundingClientRect()
        const scrollerRect = inspectorScroller.getBoundingClientRect()
        const stickyHeaderOffset = 96
        const bottomPadding = 28
        const visibleTop = scrollerRect.top + stickyHeaderOffset
        const visibleBottom = scrollerRect.bottom - bottomPadding
        const comfortableTop = visibleTop + 24
        const desiredTop =
          visibleTop + Math.max(48, (visibleBottom - visibleTop) * 0.28)
        const topTooHigh = fieldRect.top < comfortableTop
        const topTooLow =
          fieldRect.top > visibleTop + (visibleBottom - visibleTop) * 0.55

        if (topTooHigh || topTooLow) {
          const nextScrollTop =
            inspectorScroller.scrollTop + fieldRect.top - desiredTop
          inspectorScroller.scrollTo({
            top: Math.max(0, nextScrollTop),
            behavior: 'smooth',
          })
        }
      } else {
        fieldContainer?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
      fieldRefs.current[key]?.focus({ preventScroll: true })
      onFocusHandled?.()
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToField()
        window.setTimeout(scrollToField, 80)
      })
    })
  }, [focusFieldKey, focusRequestId, onFocusHandled])

  const contextualSuggestionsForField = (field: NodeConfigField) => {
    const key = fieldKey(field)
    if (focusedFieldKey !== key) return []
    if (!supportsVariableInsertion(field)) return []
    if (
      field.type === 'key-value' ||
      field.type === 'select' ||
      field.type === 'multi-select'
    ) {
      return []
    }
    if (field.conditionBuilder?.enabled) return []
    if (field.schemaChips?.length || field.schemaPresets?.length) return []
    return getContextualFieldSuggestions({
      field,
      value: config[key],
      variables: availableVariables,
    })
  }

  const insertTextIntoField = (
    key: string,
    textToInsert: string,
    options: { replace?: boolean } = {},
  ) => {
    const current = config[key]
    if (Array.isArray(current)) return
    const text =
      typeof current === 'string' ? current : current ? String(current) : ''
    if (text.includes(textToInsert)) return
    const targetField = fields.find((field) => fieldKey(field) === key)
    if (
      options.replace ||
      targetField?.allowsMixedText === false ||
      !text.trim() ||
      aliasSuggestionForValue(text, availableVariables)
    ) {
      onChange(key, textToInsert)
      return
    }

    const ref = fieldRefs.current[key]
    const inserted = insertTextAtCursor({
      value: text,
      insert: textToInsert,
      selectionStart: ref?.selectionStart,
      selectionEnd: ref?.selectionEnd,
    })
    onChange(key, inserted.value)
    window.requestAnimationFrame(() => {
      fieldRefs.current[key]?.focus()
      fieldRefs.current[key]?.setSelectionRange(
        inserted.cursor,
        inserted.cursor,
      )
    })
  }

  const canonicalizeFieldValue = (key: string, value: unknown) => {
    if (typeof value !== 'string' || !value.includes('{{')) return
    const canonical = canonicalizeVariableTokens(value)
    if (canonical !== value) onChange(key, canonical)
  }

  const insertVariable = (variable: string) => {
    if (!variablePickerField) return
    const targetField = fields.find(
      (field) => fieldKey(field) === variablePickerField,
    )
    const current = config[variablePickerField]
    if (Array.isArray(current) || targetField?.type === 'key-value') {
      const currentRows = Array.isArray(current) ? current : []
      const rows = currentRows.length
        ? (current as Array<{ key?: string; value?: string }>).slice()
        : [{ key: '', value: '' }]
      const targetIndex = rows.findIndex(
        (row) => !String(row.value ?? '').trim(),
      )
      const index = targetIndex >= 0 ? targetIndex : 0
      const currentValue = String(rows[index]?.value ?? '')
      if (currentValue.includes(variable)) {
        setVariablePickerField(null)
        setVariableSearch('')
        return
      }
      rows[index] = {
        ...rows[index],
        value: currentValue.trim() ? `${currentValue} ${variable}` : variable,
      }
      onChange(variablePickerField, rows)
      setVariablePickerField(null)
      setVariableSearch('')
      return
    }
    insertTextIntoField(variablePickerField, variable)
    setVariablePickerField(null)
    setVariableSearch('')
  }

  const applyContextualSuggestion = (
    field: NodeConfigField,
    suggestion: FieldAssistanceSuggestion,
  ) => {
    const key = fieldKey(field)
    const current = String(config[key] ?? '')
    if (suggestion.kind === 'example' && !current.trim()) {
      onChange(key, suggestion.value)
      window.requestAnimationFrame(() => {
        fieldRefs.current[key]?.focus()
        const end = suggestion.value.length
        fieldRefs.current[key]?.setSelectionRange(end, end)
      })
      return
    }
    insertTextIntoField(key, suggestion.value, {
      replace: field.allowsMixedText === false,
    })
  }

  const handleTextControlKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: NodeConfigField,
  ) => {
    const suggestions = contextualSuggestionsForField(field)
    if (!suggestions.length) return
    if (event.key === 'Escape') {
      setFocusedFieldKey(null)
      setActiveSuggestionIndex(-1)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((current) => {
        const start = current < 0 ? 0 : current
        const delta = event.key === 'ArrowDown' ? 1 : -1
        return (start + delta + suggestions.length) % suggestions.length
      })
      return
    }
    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      const suggestion = suggestions[activeSuggestionIndex]
      if (!suggestion) return
      const current = String(config[fieldKey(field)] ?? '')
      if (suggestion.kind !== 'example' || !current.trim()) {
        event.preventDefault()
        applyContextualSuggestion(field, suggestion)
      }
    }
  }

  const renderContextualSuggestionTray = (field: NodeConfigField) => {
    const suggestions = contextualSuggestionsForField(field)
    if (!suggestions.length) return null
    return (
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/95 p-2 shadow-xl shadow-black/25">
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 10).map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              aria-label={`Insert ${suggestion.label}`}
              className={[
                'max-w-full rounded-full border px-2 py-1 text-left text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                index === activeSuggestionIndex
                  ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-50'
                  : 'border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white',
              ].join(' ')}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyContextualSuggestion(field, suggestion)}
            >
              <span className="block truncate">{suggestion.label}</span>
              {suggestion.description ||
              ('sample' in suggestion && suggestion.sample !== undefined) ? (
                <span className="block max-w-[12rem] truncate text-[9px] text-slate-500">
                  {suggestion.description ??
                    ('sample' in suggestion ? String(suggestion.sample) : '')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const applyFieldSuggestion = (
    field: NodeConfigField,
    suggestion: string,
    options: { replace?: boolean } = {},
  ) => {
    const key = fieldKey(field)
    if (field.type === 'select') {
      onChange(key, suggestion)
      return
    }
    if (field.type === 'multi-select') {
      const current = config[key]
      const values = Array.isArray(current)
        ? current.map((item) => String(item))
        : String(current ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
      if (
        !values.some((item) => item.toLowerCase() === suggestion.toLowerCase())
      ) {
        onChange(key, [...values, suggestion])
      }
      return
    }
    insertTextIntoField(key, suggestion, options)
  }

  const renderFieldSuggestions = (field: NodeConfigField) => {
    return null
  }

  const grouped = useMemo(() => {
    return fields
      .filter((field) => isFieldVisible(field, config, fields))
      .reduce<Record<string, NodeConfigField[]>>((groups, field) => {
        const group = field.group ?? 'Settings'
        groups[group] = groups[group] ?? []
        groups[group].push(field)
        return groups
      }, {})
  }, [config, fields])

  const conditionCandidates = useMemo(
    () => getConditionFieldCandidates(availableVariables),
    [availableVariables],
  )

  const renderConditionBuilder = (field: NodeConfigField) => {
    const key = fieldKey(field)
    const value = String(valueForField(field, config) ?? '')
    const parsed = parseConditionExpression(value, conditionCandidates)
    const draft = conditionDrafts[key] ?? {}
    const selected = conditionCandidates.find(
      (candidate) => candidate.token === (parsed?.fieldToken ?? draft.token),
    )
    const fieldType = parsed?.fieldType ?? selected?.type ?? 'string'
    const fieldSemanticRole =
      parsed?.fieldSemanticRole ?? selected?.semanticRole
    const operators = selected
      ? conditionOperatorsForType(fieldType, fieldSemanticRole)
      : []
    const operator =
      parsed?.operator &&
      operators.some((item) => item.value === parsed.operator)
        ? parsed.operator
        : draft.operator &&
            operators.some((item) => item.value === draft.operator)
          ? draft.operator
          : ''
    const needsValue = Boolean(
      selected &&
      operator &&
      conditionOperatorNeedsValue(
        fieldType,
        operator as ConditionOperator,
        fieldSemanticRole,
      ),
    )
    const valueOptions = selected
      ? conditionValueOptionsForField({
          fieldLabel: selected.label,
          fieldType,
          semanticRole: fieldSemanticRole,
        })
      : []
    const selectedValue =
      (parsed?.value ?? draft.value)
        ? normalizeConditionValue({
            fieldLabel: selected?.label ?? parsed?.fieldLabel ?? 'Value',
            fieldType,
            semanticRole: fieldSemanticRole,
            value: parsed?.value ?? draft.value,
          })
        : ''
    const groupedConditionCandidates = conditionCandidates.reduce<
      Record<string, typeof conditionCandidates>
    >((groups, candidate) => {
      groups[candidate.category] = groups[candidate.category] ?? []
      groups[candidate.category].push(candidate)
      return groups
    }, {})
    const updateRule = (patch: {
      token?: string
      operator?: ConditionOperator
      value?: string
    }) => {
      const nextToken = patch.token ?? selected?.token
      const nextSelected = conditionCandidates.find(
        (candidate) => candidate.token === nextToken,
      )
      if (!nextSelected) return
      const nextType = nextSelected.type
      const nextRole = nextSelected.semanticRole
      const nextOperators = conditionOperatorsForType(nextType, nextRole)
      const nextOperator =
        patch.operator &&
        nextOperators.some((item) => item.value === patch.operator)
          ? patch.operator
          : operator && nextOperators.some((item) => item.value === operator)
            ? (operator as ConditionOperator)
            : undefined
      const operatorChanged =
        patch.operator !== undefined && patch.operator !== operator
      const fieldChanged =
        patch.token !== undefined && patch.token !== selected?.token
      const candidateValue =
        patch.value ??
        (fieldChanged || operatorChanged ? '' : parsed?.value) ??
        draft.value ??
        ''
      setConditionDrafts((current) => ({
        ...current,
        [key]: {
          token: nextSelected.token,
          operator: nextOperator,
          value: candidateValue,
        },
      }))
      if (!nextOperator) {
        onChange(key, '')
        return
      }
      const normalizedCandidateValue = normalizeConditionValue({
        fieldLabel: nextSelected.label,
        fieldType: nextSelected.type,
        semanticRole: nextRole,
        value: candidateValue,
      })
      const nextNeedsValue = conditionOperatorNeedsValue(
        nextType,
        nextOperator,
        nextRole,
      )
      const nextValue = isConditionValueCompatible({
        fieldLabel: nextSelected.label,
        fieldType: nextSelected.type,
        semanticRole: nextRole,
        operator: nextOperator,
        value: normalizedCandidateValue,
      })
        ? normalizedCandidateValue
        : ''
      if (nextNeedsValue && !nextValue) {
        onChange(key, '')
        return
      }
      onChange(
        key,
        serializeConditionRule({
          fieldToken: nextSelected.token,
          fieldLabel: nextSelected.label,
          fieldType: nextSelected.type,
          fieldSemanticRole: nextRole,
          operator: nextOperator,
          value: nextValue,
        }),
      )
    }

    if (!conditionCandidates.length) {
      return (
        <Textarea
          ref={(node) => {
            fieldRefs.current[key] = node
          }}
          value={value}
          placeholder={field.placeholder}
          rows={3}
          className="resize-none font-mono text-[12px]"
          onFocus={() => setFocusedFieldKey(key)}
          onChange={(event) => onChange(key, event.target.value)}
          onBlur={(event) => canonicalizeFieldValue(key, event.target.value)}
        />
      )
    }

    return (
      <div
        className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/35 p-2"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {value.trim() && !parsed ? (
          <div className="rounded-md border border-amber-400/20 bg-amber-400/10 p-2 text-[11px] text-amber-100">
            Advanced expression preserved. Use the field below if this rule
            cannot be represented as Field / Operator / Value.
          </div>
        ) : null}
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
              Field
            </span>
            <Select
              value={selected?.token ?? ''}
              className="h-8 w-full text-[12px]"
              aria-label="Condition field"
              onChange={(event) => updateRule({ token: event.target.value })}
            >
              <option value="">Select field</option>
              {Object.entries(groupedConditionCandidates).map(
                ([category, candidates]) => (
                  <optgroup key={category} label={category}>
                    {candidates.map((candidate) => (
                      <option key={candidate.token} value={candidate.token}>
                        {candidate.label}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
              Operator
            </span>
            <Select
              value={operator}
              className="h-8 w-full text-[12px]"
              aria-label="Condition operator"
              onChange={(event) =>
                updateRule({
                  operator: event.target.value as ConditionOperator,
                })
              }
              disabled={!selected}
            >
              <option value="">Select condition</option>
              {operators.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          {needsValue ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Value
              </span>
              {valueOptions.length ? (
                <Select
                  value={selectedValue}
                  className="h-8 w-full text-[12px]"
                  aria-label="Condition value"
                  onChange={(event) =>
                    updateRule({ value: event.target.value })
                  }
                >
                  <option value="">Select value</option>
                  {valueOptions.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={
                    fieldType === 'number' || fieldType === 'duration'
                      ? 'number'
                      : fieldType === 'date'
                        ? 'date'
                        : fieldType === 'datetime'
                          ? 'datetime-local'
                          : 'text'
                  }
                  value={selectedValue}
                  placeholder={
                    selected?.sample ? String(selected.sample) : 'Select value'
                  }
                  className="h-8 w-full text-[12px]"
                  aria-label="Condition value"
                  onChange={(event) =>
                    updateRule({ value: event.target.value })
                  }
                />
              )}
            </label>
          ) : (
            <div className="flex h-8 items-center rounded-md border border-slate-800/70 bg-slate-950/40 px-2 text-[11px] text-slate-500">
              {selected && operator ? 'No value needed' : 'Select value'}
            </div>
          )}
        </div>
        {value.trim() && !parsed ? (
          <Textarea
            ref={(node) => {
              fieldRefs.current[key] = node
            }}
            value={value}
            placeholder={field.placeholder}
            rows={3}
            className="resize-none font-mono text-[12px]"
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={(event) => canonicalizeFieldValue(key, event.target.value)}
          />
        ) : null}
      </div>
    )
  }

  const renderSchemaBuilder = (field: NodeConfigField, value: unknown) => {
    const key = fieldKey(field)
    const schemaChips = field.schemaChips?.length
      ? field.schemaChips
      : DEFAULT_SCHEMA_CHIPS
    const presets = field.schemaPresets?.length
      ? field.schemaPresets
      : DEFAULT_SCHEMA_PRESETS
    const parsed = parseSchemaObject(value)
    const activeKeys = new Set(parsed.schema ? Object.keys(parsed.schema) : [])
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap gap-1.5">
            {schemaChips.map((chip) => {
              const active = activeKeys.has(chip.key)
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  className={[
                    'rounded-full border px-2 py-0.5 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                    active
                      ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-50'
                      : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-cyan-300/40 hover:text-slate-100',
                  ].join(' ')}
                  onClick={() => {
                    const next = toggleSchemaChip(value, chip)
                    if (!next.error) onChange(key, next.value)
                  }}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                size="xs"
                variant="secondary"
                onClick={() => onChange(key, applySchemaPreset(preset))}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {parsed.error ? (
            <p className="mt-2 text-[10px] text-amber-300">{parsed.error}</p>
          ) : null}
        </div>
        <Textarea
          ref={(node) => {
            fieldRefs.current[key] = node
          }}
          value={
            typeof value === 'string'
              ? value
              : value
                ? JSON.stringify(value, null, 2)
                : ''
          }
          placeholder={field.placeholder ?? 'Editor placeholder'}
          rows={5}
          className="resize-none font-mono text-[12px]"
          onFocus={() => setFocusedFieldKey(key)}
          onChange={(event) => onChange(key, event.target.value)}
          onBlur={(event) => canonicalizeFieldValue(key, event.target.value)}
        />
      </div>
    )
  }

  const renderControl = (field: NodeConfigField) => {
    const key = fieldKey(field)
    const value = valueForField(field, config)
    const commonClass = 'text-[12px]'

    if (field.conditionBuilder?.enabled) {
      return renderConditionBuilder(field)
    }

    if (field.type === 'textarea' || field.type === 'ai-prompt') {
      return (
        <Textarea
          ref={(node) => {
            fieldRefs.current[key] = node
          }}
          value={String(value)}
          placeholder={field.placeholder}
          rows={field.type === 'ai-prompt' ? 5 : 3}
          className={`resize-none ${commonClass}`}
          onFocus={() => {
            setFocusedFieldKey(key)
            const suggestions = getContextualFieldSuggestions({
              field,
              value,
              variables: availableVariables,
            })
            setActiveSuggestionIndex(
              !String(value).trim() &&
                suggestions.some((item) => item.kind === 'example')
                ? 0
                : -1,
            )
          }}
          onKeyDown={(event) => handleTextControlKeyDown(event, field)}
          onChange={(event) => onChange(key, event.target.value)}
          onBlur={(event) => {
            canonicalizeFieldValue(key, event.target.value)
            setFocusedFieldKey((current) => (current === key ? null : current))
            setActiveSuggestionIndex(-1)
          }}
        />
      )
    }

    if (field.type === 'number') {
      const numericValue =
        value === '' || value === undefined || value === null
          ? ''
          : String(clampNumber(Number(value), field))
      return (
        <Input
          type="number"
          value={numericValue}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          className={`h-8 ${commonClass}`}
          onChange={(event) => {
            if (event.target.value === '') {
              onChange(key, '')
              return
            }
            const clamped = clampNumber(Number(event.target.value), field)
            onChange(key, clamped)
          }}
          onBlur={(event) => {
            if (event.target.value === '') {
              onChange(key, field.defaultValue ?? field.min ?? 0)
            }
          }}
        />
      )
    }

    if (field.type === 'boolean' || field.type === 'toggle') {
      return (
        <label className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2 text-[12px] text-slate-300">
          <span>{field.placeholder ?? 'Enabled'}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(key, event.target.checked)}
          />
        </label>
      )
    }

    if (field.type === 'select') {
      const displayValue = normalizedOptionValue(value, field)
      return (
        <Select
          value={displayValue}
          className={`h-8 ${commonClass}`}
          onChange={(event) => onChange(key, event.target.value)}
        >
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )
    }

    if (field.type === 'multi-select') {
      const values = Array.isArray(value)
        ? value.map((item) => String(item))
        : String(value)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
      return (
        <div className="space-y-2">
          <Input
            value={values.join(', ')}
            placeholder={field.placeholder ?? 'Comma-separated values'}
            className={`h-8 ${commonClass}`}
            onChange={(event) =>
              onChange(
                key,
                event.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
          />
          {values.length ? (
            <div className="flex flex-wrap gap-1.5">
              {values.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200"
                  onClick={() =>
                    onChange(
                      key,
                      values.filter((valueItem) => valueItem !== item),
                    )
                  }
                >
                  {item}
                  <span className="ml-1 text-slate-500">x</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )
    }

    if (field.type === 'key-value') {
      const mappingMode = key === 'fieldMappings'
      return (
        <KeyValueEditor
          value={value}
          keyPlaceholder={mappingMode ? 'Field name' : 'Key'}
          valuePlaceholder={mappingMode ? 'Value / variable' : 'Value'}
          addLabel={mappingMode ? 'Add field row' : 'Add row'}
          onChange={(next) => onChange(key, next)}
        />
      )
    }

    if (field.type === 'json' || field.type === 'code') {
      if (
        field.type === 'json' &&
        (field.schemaChips?.length || field.schemaPresets?.length)
      ) {
        return renderSchemaBuilder(field, value)
      }
      const schemaHelper =
        field.type === 'json' && ['schema', 'schemaHint'].includes(key)
      return (
        <div className="space-y-2">
          {schemaHelper ? (
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-2 text-[11px] text-slate-400">
              <div className="flex items-center justify-between gap-2">
                <span>Build schema from common fields.</span>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    onChange(
                      key,
                      '{ "name": "string", "email": "string", "phone": "string", "company": "string" }',
                    )
                  }
                >
                  Build schema
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Name', 'Email', 'Phone', 'Company'].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <Textarea
            ref={(node) => {
              fieldRefs.current[key] = node
            }}
            value={
              typeof value === 'string'
                ? value
                : value
                  ? JSON.stringify(value, null, 2)
                  : ''
            }
            placeholder={field.placeholder ?? 'Editor placeholder'}
            rows={5}
            className={`resize-none font-mono ${commonClass}`}
            onFocus={() => setFocusedFieldKey(key)}
            onKeyDown={(event) => handleTextControlKeyDown(event, field)}
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={(event) => {
              canonicalizeFieldValue(key, event.target.value)
              setFocusedFieldKey((current) =>
                current === key ? null : current,
              )
              setActiveSuggestionIndex(-1)
            }}
          />
        </div>
      )
    }

    return (
      <Input
        ref={(node) => {
          fieldRefs.current[key] = node
        }}
        value={String(value)}
        placeholder={field.placeholder}
        className={`h-8 ${commonClass}`}
        onFocus={() => {
          setFocusedFieldKey(key)
          const suggestions = getContextualFieldSuggestions({
            field,
            value,
            variables: availableVariables,
          })
          setActiveSuggestionIndex(
            !String(value).trim() &&
              suggestions.some((item) => item.kind === 'example')
              ? 0
              : -1,
          )
        }}
        onKeyDown={(event) => handleTextControlKeyDown(event, field)}
        onChange={(event) => onChange(key, event.target.value)}
        onBlur={(event) => {
          canonicalizeFieldValue(key, event.target.value)
          setFocusedFieldKey((current) => (current === key ? null : current))
          setActiveSuggestionIndex(-1)
        }}
      />
    )
  }

  const fieldIssues = (field: NodeConfigField) => {
    if (!node) return []
    return validateVariableValueForField({
      value: config[fieldKey(field)] ?? field.defaultValue,
      field,
      targetNode: node,
      nodes,
      edges,
    })
  }

  const renderInlineVariableSelector = (field: NodeConfigField) => {
    const key = fieldKey(field)
    if (variablePickerField !== key) return null
    const compatible = getCompatibleVariablesForField({
      field,
      variables: availableVariables,
    })
    const relevant = getRelevantVariablesForField({
      field,
      variables: compatible,
    })
    const options = searchWorkflowVariables(
      variableSearch,
      relevant.length ? relevant : compatible,
    )
    const groups = groupedVariables(options)
    const customPlaceholder = customValuePlaceholder(field)

    return (
      <div
        className="max-h-[22rem] overflow-y-auto rounded-lg border border-cyan-300/25 bg-slate-950/95 p-3 text-[11px] text-slate-300 shadow-xl shadow-black/30"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setVariablePickerField(null)
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-slate-200">Use Workflow Data</p>
            <p className="mt-1 text-slate-500">
              Choose data from a previous step or enter a custom value.
            </p>
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setVariablePickerField(null)}
          >
            Close
          </Button>
        </div>
        <div className="sticky top-0 z-10 -mx-3 mt-3 bg-slate-950/95 px-3 pb-2">
          <Input
            data-no-shortcuts
            value={variableSearch}
            placeholder="Search available values..."
            className="h-8 text-[12px]"
            onChange={(event) => setVariableSearch(event.target.value)}
          />
        </div>
        <div className="mt-1 space-y-3 pr-1">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.title}
              </div>
              <div className="grid gap-1.5">
                {group.variables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    className="hover:bg-cyan-300/8 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-[0.3rem] text-left transition hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                    title={[
                      `Type: ${variable.type}`,
                      `Example: ${String(variable.previewValue ?? variable.sampleValue ?? 'Unavailable')}`,
                      `Source: ${formatVariableSourceLabel(variable)}`,
                    ].join('\n')}
                    onClick={() =>
                      insertVariable(
                        variable.token ?? formatVariableToken(variable.key),
                      )
                    }
                  >
                    <span className="block text-[11px] text-slate-100">
                      {formatVariableReadableLabel(variable)}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {formatVariableSourceLabel(variable)}
                    </span>
                    {variable.previewValue !== undefined ||
                    variable.sampleValue !== undefined ? (
                      <span className="block truncate text-[10px] text-slate-600">
                        {String(variable.previewValue ?? variable.sampleValue)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!groups.length ? (
            <p className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2 text-[11px] text-slate-500">
              No compatible workflow data is available for this field yet.
              <span className="block text-slate-400">
                Use a Custom Value instead.
              </span>
            </p>
          ) : null}
          {!variableSearch.trim() ||
          'custom value enter a custom value'.includes(
            variableSearch.trim().toLowerCase(),
          ) ||
          customPlaceholder
            .toLowerCase()
            .includes(variableSearch.trim().toLowerCase()) ? (
            <section>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Custom Value
              </div>
              <button
                type="button"
                className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-2 py-[0.3rem] text-left transition hover:border-slate-700 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                onClick={() => {
                  setVariablePickerField(null)
                  window.requestAnimationFrame(() =>
                    fieldRefs.current[key]?.focus(),
                  )
                }}
              >
                <span className="block text-[11px] text-slate-100">
                  Custom Value
                </span>
                <span className="block text-[10px] text-slate-500">
                  Enter a value like {customPlaceholder}.
                </span>
              </button>
            </section>
          ) : null}
        </div>
      </div>
    )
  }

  if (!fields.length) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-[11px] text-slate-400">
        This node does not expose configuration fields yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, groupFields]) => (
        <section key={group} className="space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {group}
          </div>
          {groupFields.map((field) => {
            const key = fieldKey(field)
            const fieldIssue = getNodeFieldValidation(validation, key)
            const isFocusedRepairField =
              focusFieldKeys.includes(key) || focusFieldKey === key
            const highlighted = isFocusedRepairField && Boolean(fieldIssue)
            return (
              <div
                key={key}
                ref={(element) => {
                  fieldContainerRefs.current[key] = element
                }}
              >
                <FieldChrome
                  field={field}
                  validation={validation}
                  highlighted={highlighted}
                  onInsertVariable={() => {
                    setVariablePickerField((current) =>
                      current === key ? null : key,
                    )
                    setVariableSearch('')
                  }}
                >
                  {renderControl(field)}
                  {renderContextualSuggestionTray(field)}
                  {renderFieldSuggestions(field)}
                  {renderInlineVariableSelector(field)}
                  <VariableChips
                    value={config[key]}
                    variables={availableVariables}
                    onInspect={setInspectedVariable}
                    onRemove={(reference) => {
                      const current = String(config[key] ?? '')
                      onChange(
                        key,
                        current
                          .replace(reference.raw, '')
                          .replace(/\s{2,}/g, ' ')
                          .trim(),
                      )
                    }}
                  />
                  <VariablePreview
                    value={config[key]}
                    variables={availableVariables}
                    issues={fieldIssues(field)}
                  />
                </FieldChrome>
              </div>
            )
          })}
        </section>
      ))}
      {inspectedVariable ? (
        <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-3 text-[11px] text-cyan-50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {inspectedVariable.definition
                  ? formatVariableReadableLabel(inspectedVariable.definition)
                  : fallbackVariableLabel(inspectedVariable)}
              </p>
              <p className="mt-1 text-cyan-100/75">
                Previous Step:{' '}
                {inspectedVariable.definition?.origin ??
                  inspectedVariable.definition?.category ??
                  'Workflow'}
              </p>
              <p className="text-cyan-100/75">
                Value Type: {inspectedVariable.definition?.type ?? 'Unknown'}
              </p>
              <p className="text-cyan-100/75">
                Preview Value:{' '}
                {String(
                  inspectedVariable.definition?.previewValue ?? 'Unavailable',
                )}
              </p>
              <p className="text-cyan-100/75">
                Usage Count: Preview only · Used In: Current step
              </p>
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setInspectedVariable(null)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

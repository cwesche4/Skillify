import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { WorkflowDataFlowReport } from '@/lib/workflows/workflowDataFlow'
import {
  resolveWorkspaceFieldOptions,
  type WorkflowWorkspaceOptionContext,
  type WorkspaceFieldOption,
} from '@/lib/workflows/workspaceFieldOptions'
import type { WorkflowValueType } from '@/lib/workflows/types'

export type BranchPreviewInput = {
  id: string
  nodeId: string
  nodeLabel: string
  fieldLabel: string
  fieldKey: string
  operator: string
  expectedLabel: string
  expectedValue: string
  currentLabel: string
  currentValue: string
  valueType: WorkflowValueType
  options: WorkspaceFieldOption[]
  unavailable?: boolean
}

export type BranchPreviewEvaluation = {
  inputId: string
  fieldLabel: string
  actualLabel: string
  actualValue: string
  operator: string
  expectedLabel: string
  expectedValue: string
  matched: boolean
  explanation: string
}

export type BranchPreviewOverrides = Record<string, string>

const OPERATOR_PATTERNS = [
  { text: 'greater than or equal to', op: '>=' },
  { text: 'less than or equal to', op: '<=' },
  { text: 'does not equal', op: '!=' },
  { text: 'not equals', op: '!=' },
  { text: 'is not', op: '!=' },
  { text: 'greater than', op: '>' },
  { text: 'less than', op: '<' },
  { text: 'contains', op: 'contains' },
  { text: 'equals', op: '==' },
  { text: ' is ', op: '==' },
  { text: '==', op: '==' },
  { text: '=', op: '==' },
  { text: '>', op: '>' },
  { text: '<', op: '<' },
]

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function nodeLabel(node: Node) {
  const label = (node.data as { label?: unknown } | undefined)?.label
  if (typeof label === 'string' && label.trim()) return label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Step'
  )
}

function titleCase(value: string) {
  return value
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseCondition(raw: unknown) {
  const condition = String(raw ?? '').trim()
  if (!condition) return null
  const normalized = condition.replace(/\s+/g, ' ')
  for (const candidate of OPERATOR_PATTERNS) {
    const index = normalized.toLowerCase().indexOf(candidate.text.toLowerCase())
    if (index <= 0) continue
    const operatorText = normalized
      .slice(index, index + candidate.text.length)
      .trim()
    const field = normalized
      .slice(0, index)
      .trim()
      .replace(/\{\{\s*|\s*\}\}/g, '')
    const expected = normalized
      .slice(index + candidate.text.length)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (field && expected) {
      return {
        fieldKey: field,
        fieldLabel: titleCase(field.split('.').at(-1) ?? field),
        operator: candidate.op,
        operatorText: operatorText || candidate.op,
        expected,
      }
    }
  }
  if (
    normalized.toLowerCase() === 'true' ||
    normalized.toLowerCase() === 'false'
  ) {
    return {
      fieldKey: 'condition',
      fieldLabel: 'Condition',
      operator: '==',
      operatorText: 'is',
      expected: 'true',
    }
  }
  return null
}

export function evaluateConditionExpression(
  raw: unknown,
  previewData: Record<string, unknown> = {},
) {
  const parsed = parseCondition(raw)
  if (!parsed)
    return { matched: true, parsed: null, actualValue: '', actualLabel: '' }
  if (parsed.fieldKey === 'condition') {
    const actualValue = String(previewData[parsed.fieldKey] ?? parsed.expected)
    return {
      matched: compare(actualValue, parsed.expected, parsed.operator),
      parsed,
      actualValue,
      actualLabel: actualValue,
    }
  }
  const actual =
    previewData[parsed.fieldKey] ??
    previewData[parsed.fieldLabel] ??
    previewData[parsed.fieldLabel.toLowerCase()] ??
    parsed.expected
  const actualValue = String(actual)
  return {
    matched: compare(actualValue, parsed.expected, parsed.operator),
    parsed,
    actualValue,
    actualLabel: actualValue,
  }
}

function inferType(value: string): WorkflowValueType {
  if (/^(true|false)$/i.test(value)) return 'boolean'
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number'
  if (/^\S+@\S+\.\S+$/.test(value)) return 'email'
  if (/^\+?[\d\s().-]{7,}$/.test(value)) return 'phone'
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
  return 'string'
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function displayFor(value: string, options: WorkspaceFieldOption[]) {
  return (
    options.find(
      (item) =>
        item.value === value || normalize(item.label) === normalize(value),
    )?.label ?? value
  )
}

function compare(actual: string, expected: string, operator: string) {
  const actualNumber = Number(actual)
  const expectedNumber = Number(expected)
  if (operator === 'contains')
    return normalize(actual).includes(normalize(expected))
  if (operator === '!=') return normalize(actual) !== normalize(expected)
  if (
    operator === '>' &&
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber)
  )
    return actualNumber > expectedNumber
  if (
    operator === '<' &&
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber)
  )
    return actualNumber < expectedNumber
  if (
    operator === '>=' &&
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber)
  )
    return actualNumber >= expectedNumber
  if (
    operator === '<=' &&
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber)
  )
    return actualNumber <= expectedNumber
  return normalize(actual) === normalize(expected)
}

export function getBranchPreviewInputs({
  nodes,
  dataFlow,
  workspace,
  overrides = {},
}: {
  nodes: Node[]
  edges?: Edge[]
  dataFlow?: WorkflowDataFlowReport
  workspace?: WorkflowWorkspaceOptionContext | null
  overrides?: BranchPreviewOverrides
}): BranchPreviewInput[] {
  void dataFlow
  return nodes.flatMap((node) => {
    const definition = getWorkflowNodeDefinition(registryIdForNode(node))
    if (!definition?.branchPaths?.length) return []
    const inputs = definition.branchPaths
      .filter((path) => path.conditionField && !path.isFallback)
      .map((path): BranchPreviewInput | null => {
        const parsed = parseCondition(
          (node.data as Record<string, unknown> | undefined)?.[
            path.conditionField!
          ],
        )
        if (!parsed) return null
        const valueType = inferType(parsed.expected)
        const pseudoField = {
          id: parsed.fieldKey,
          label: parsed.fieldLabel,
          type: valueType === 'number' ? 'number' : 'select',
          semanticType:
            parsed.fieldLabel.toLowerCase().includes('owner') ||
            parsed.fieldLabel.toLowerCase().includes('assignee')
              ? 'owner'
              : parsed.fieldLabel.toLowerCase().includes('team')
                ? 'owner'
                : parsed.fieldLabel.toLowerCase().includes('stage')
                  ? 'stage'
                  : parsed.fieldLabel.toLowerCase().includes('health')
                    ? 'healthStatus'
                    : valueType === 'boolean'
                      ? undefined
                      : undefined,
          semanticRole:
            parsed.fieldLabel.toLowerCase().includes('owner') ||
            parsed.fieldLabel.toLowerCase().includes('assignee')
              ? 'owner'
              : parsed.fieldLabel.toLowerCase().includes('team')
                ? 'team'
                : valueType === 'boolean'
                  ? 'boolean'
                  : valueType === 'number'
                    ? 'number'
                    : 'enum',
          workspaceOptionCategory: parsed.fieldLabel
            .toLowerCase()
            .includes('team')
            ? 'teams'
            : parsed.fieldLabel.toLowerCase().includes('owner') ||
                parsed.fieldLabel.toLowerCase().includes('assignee')
              ? 'members'
              : parsed.fieldLabel.toLowerCase().includes('stage')
                ? 'crmStages'
                : parsed.fieldLabel.toLowerCase().includes('health')
                  ? 'healthStatuses'
                  : undefined,
        } as const
        const baseOptions: WorkspaceFieldOption[] =
          valueType === 'boolean'
            ? [
                {
                  label: 'True',
                  value: 'true',
                  source: 'registry.options',
                  type: 'boolean',
                },
                {
                  label: 'False',
                  value: 'false',
                  source: 'registry.options',
                  type: 'boolean',
                },
              ]
            : []
        const options: WorkspaceFieldOption[] = [
          ...baseOptions,
          ...resolveWorkspaceFieldOptions({
            field: pseudoField,
            workspace,
            currentValue: parsed.expected,
          }),
        ]
        const id = `${node.id}:${path.pathKey}:${parsed.fieldKey}`
        const currentValue = overrides[id] ?? parsed.expected
        const expectedLabel = displayFor(parsed.expected, options)
        const currentLabel = displayFor(currentValue, options)
        return {
          id,
          nodeId: node.id,
          nodeLabel: nodeLabel(node),
          fieldLabel: parsed.fieldLabel,
          fieldKey: parsed.fieldKey,
          operator: parsed.operator,
          expectedValue: parsed.expected,
          expectedLabel,
          currentValue,
          currentLabel,
          valueType,
          options: Array.from(
            new Map(options.map((item) => [item.value, item])).values(),
          ),
          unavailable: options.some(
            (item) => item.value === parsed.expected && item.unavailable,
          ),
        }
      })
      .filter((item): item is BranchPreviewInput => Boolean(item))
    return inputs
  })
}

export function evaluateBranchPreviewInput(
  input: BranchPreviewInput,
): BranchPreviewEvaluation {
  const matched = compare(
    input.currentValue,
    input.expectedValue,
    input.operator,
  )
  return {
    inputId: input.id,
    fieldLabel: input.fieldLabel,
    actualLabel: input.currentLabel,
    actualValue: input.currentValue,
    operator: input.operator,
    expectedLabel: input.expectedLabel,
    expectedValue: input.expectedValue,
    matched,
    explanation: `${input.fieldLabel} was ${input.currentLabel}. Condition: ${input.fieldLabel} is ${input.expectedLabel}. Result: ${matched ? 'Matched' : 'Did not match'}.`,
  }
}

export function branchPreviewDataFromInputs(inputs: BranchPreviewInput[]) {
  return Object.fromEntries(
    inputs.map((input) => [input.fieldKey, input.currentValue]),
  )
}

export function branchPreviewFingerprint(overrides: BranchPreviewOverrides) {
  return JSON.stringify(
    Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)),
  )
}

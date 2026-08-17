import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { NodeConfigField, WorkflowValueType } from '@/lib/workflows/types'
import {
  extractVariableReferences,
  getAvailableVariablesForNode,
  getNodeOutputVariables,
  getUpstreamNodeIds,
  getWorkflowVariableDefinition,
  workflowVariableRegistry,
  type WorkflowVariableDefinition,
} from '@/lib/workflows/variableRegistry'
import type { WorkflowVariableType } from '@/lib/workflows/variableRegistry'
import {
  checkVariableCompatibility,
  labelForVariableType,
  validateLiteralValueShape,
} from '@/lib/workflows/variableCompatibility'
import { findVariableTokens } from '@/lib/workflows/variableTokens'

export type WorkflowDataMapping = {
  target: string
  source?: string
  mode?: 'variable' | 'text'
  value?: string
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

export function getTargetMappingVariables(
  node: Node,
): WorkflowVariableDefinition[] {
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  const fields =
    definition?.configFields.filter((field) => field.supportsVariables) ?? []
  return fields.map((field) => {
    const key = field.key ?? field.id
    const type = (field.acceptedTypes?.[0] ?? 'string') as WorkflowVariableType
    return {
      id: key,
      key,
      path: key,
      token: key,
      label: field.mappingLabel ?? field.label,
      category: 'Custom Variables',
      group: definition?.label ?? 'Target',
      type,
      valueType: type,
      previewValue: field.defaultValue ?? field.placeholder ?? '',
      sampleValue: field.defaultValue ?? field.placeholder ?? '',
      description: field.helpText,
      origin: definition?.label,
      direction: 'input',
      nullable: !field.required,
    }
  })
}

export type MappingValidationIssue = {
  severity: 'warning' | 'error'
  message: string
  edgeId?: string
  nodeId?: string
  field?: string
  status?:
    | 'valid'
    | 'warning'
    | 'incompatible'
    | 'broken-source'
    | 'required-missing'
}

function fieldKey(field: NodeConfigField) {
  return field.key ?? field.id
}

function isFieldVisible(
  field: NodeConfigField,
  config: Record<string, unknown>,
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

function normalizeAcceptedTypes(
  types?: WorkflowValueType[],
): WorkflowVariableType[] {
  const normalized = (types ?? ['unknown']).filter(
    (type): type is WorkflowVariableType => type !== 'any',
  )
  return normalized.length ? normalized : ['unknown']
}

function hasLiteralValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function configValueForField(
  config: Record<string, unknown>,
  field: Pick<NodeConfigField, 'id' | 'key'>,
  defaultValue?: unknown,
) {
  const key = fieldKey(field as NodeConfigField)
  const nested =
    config.config &&
    typeof config.config === 'object' &&
    !Array.isArray(config.config)
      ? (config.config as Record<string, unknown>)
      : {}
  return config[key] ?? nested[key] ?? defaultValue
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

function optionValuesForField(field: Pick<NodeConfigField, 'options'>) {
  return new Set((field.options ?? []).map((option) => option.value))
}

function variableMatchesFieldOptions({
  variable,
  field,
}: {
  variable: WorkflowVariableDefinition
  field: Pick<NodeConfigField, 'options'>
}) {
  const optionValues = optionValuesForField(field)
  if (!optionValues.size) return true
  const candidates = [variable.sampleValue, variable.previewValue].filter(
    (value) => value !== undefined && value !== null,
  )
  return candidates.some((candidate) =>
    optionValues.has(normalizedOptionValue(candidate, field.options)),
  )
}

const SIMPLE_EMAIL_ALIASES = new Set([
  'email',
  'client email',
  'customer email',
  'lead email',
  'contact email',
  'owner email',
  'workspace email',
])

const SIMPLE_PHONE_ALIASES = new Set([
  'phone',
  'client phone',
  'customer phone',
  'lead phone',
  'contact phone',
  'owner phone',
  'workspace phone',
])

const SIMPLE_NAME_ALIASES = new Set([
  'name',
  'client name',
  'customer name',
  'lead name',
  'contact name',
])

function isSimpleVariableAlias(
  value: unknown,
  acceptedTypes: WorkflowVariableType[],
) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized.includes('{{')) return false
  if (acceptedTypes.includes('email') && SIMPLE_EMAIL_ALIASES.has(normalized)) {
    return true
  }
  if (acceptedTypes.includes('phone') && SIMPLE_PHONE_ALIASES.has(normalized)) {
    return true
  }
  if (acceptedTypes.includes('string') && SIMPLE_NAME_ALIASES.has(normalized)) {
    return true
  }
  return false
}

function nodeLabel(node?: Node) {
  if (!node) return 'Workflow Structure'
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Node'
  )
}

function outputPathLabel(path: string) {
  return (
    path
      .split('.')
      .at(-1)
      ?.replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\bid\b/gi, 'ID')
      .replace(/^\w/, (value) => value.toUpperCase()) ?? path
  )
}

function friendlyDeletedSourceMessage(path: string) {
  return `Source step no longer exists. ${outputPathLabel(path)} is still referenced.`
}

function messageForIncompatibleVariable({
  fieldLabel,
  acceptedTypes,
  output,
}: {
  fieldLabel: string
  acceptedTypes: WorkflowVariableType[]
  output: WorkflowVariableDefinition
}) {
  const targetType =
    acceptedTypes.find((type) => type !== 'string' && type !== 'unknown') ??
    acceptedTypes[0] ??
    'unknown'
  return `${fieldLabel} expects ${labelForVariableType(targetType)}, but ${output.label} provides ${labelForVariableType(output.type)}.`
}

export function validateVariableValueForField({
  value,
  field,
  targetNode,
  nodes,
  edges,
}: {
  value: unknown
  field: Pick<
    NodeConfigField,
    | 'acceptedTypes'
    | 'allowsMixedText'
    | 'label'
    | 'mappingLabel'
    | 'required'
    | 'id'
    | 'key'
    | 'options'
    | 'requiredMessage'
  >
  targetNode: Node
  nodes: Node[]
  edges: Edge[]
}): MappingValidationIssue[] {
  const fieldName = fieldKey(field as NodeConfigField)
  const fieldLabel = field.mappingLabel ?? field.label
  const acceptedTypes = normalizeAcceptedTypes(field.acceptedTypes)
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const upstreamIds = getUpstreamNodeIds(targetNode.id, edges)
  const availableVariables = getAvailableVariablesForNode(targetNode, {
    nodes,
    edges,
  })
  const tokens = findVariableTokens(value)
  const issues: MappingValidationIssue[] = []

  if (!tokens.length) {
    if (!isSimpleVariableAlias(value, acceptedTypes)) {
      const literal = validateLiteralValueShape({
        value,
        acceptedTypes,
        fieldLabel,
        allowsMixedText: field.allowsMixedText,
      })
      if (literal.status !== 'compatible') {
        issues.push({
          severity: literal.status === 'incompatible' ? 'error' : 'warning',
          message: literal.message,
          nodeId: targetNode.id,
          field: fieldName,
          status:
            literal.status === 'incompatible' ? 'incompatible' : 'warning',
        })
      }
    }
    const optionValues = new Set(
      (field.options ?? []).map((option) => option.value),
    )
    const optionValue = normalizedOptionValue(value, field.options)
    if (
      optionValues.size > 0 &&
      hasLiteralValue(value) &&
      !optionValues.has(optionValue)
    ) {
      issues.push({
        severity: 'error',
        message:
          field.requiredMessage ??
          `${fieldLabel} must be one of ${Array.from(optionValues).join(', ')}.`,
        nodeId: targetNode.id,
        field: fieldName,
        status: 'incompatible',
      })
    }
    return issues
  }

  for (const token of tokens) {
    let definition: WorkflowVariableDefinition | undefined

    if (token.kind === 'node') {
      const sourceNode = nodeMap.get(token.nodeId)
      if (!sourceNode) {
        issues.push({
          severity: 'error',
          message: friendlyDeletedSourceMessage(token.path),
          nodeId: targetNode.id,
          field: fieldName,
          status: 'broken-source',
        })
        continue
      }
      if (sourceNode.id === targetNode.id || !upstreamIds.has(sourceNode.id)) {
        issues.push({
          severity: 'error',
          message: `${nodeLabel(sourceNode)} is no longer connected before ${nodeLabel(targetNode)}.`,
          nodeId: targetNode.id,
          field: fieldName,
          status: 'broken-source',
        })
        continue
      }
      definition = getNodeOutputVariables(sourceNode).find(
        (output) => output.path === token.path,
      )
      if (!definition) {
        issues.push({
          severity: 'error',
          message: `${nodeLabel(sourceNode)} no longer provides the ${outputPathLabel(token.path)} output.`,
          nodeId: targetNode.id,
          field: fieldName,
          status: 'broken-source',
        })
        continue
      }
    } else {
      const key =
        token.kind === 'workspace' ? `workspace.${token.path}` : token.path
      definition =
        getWorkflowVariableDefinition(key, availableVariables) ??
        getWorkflowVariableDefinition(key, workflowVariableRegistry)
      if (!definition) {
        issues.push({
          severity: 'error',
          message: 'This variable is not available in the current workflow.',
          nodeId: targetNode.id,
          field: fieldName,
          status: 'broken-source',
        })
        continue
      }
    }

    const compatibility = checkVariableCompatibility({
      sourceType: definition.type,
      acceptedTypes,
      allowsMixedText: field.allowsMixedText,
    })
    if (
      compatibility.status !== 'incompatible' &&
      optionValuesForField(field).size > 0 &&
      !variableMatchesFieldOptions({ variable: definition, field })
    ) {
      issues.push({
        severity: 'error',
        message:
          field.requiredMessage ??
          `${fieldLabel} must be one of ${Array.from(optionValuesForField(field)).join(', ')}.`,
        nodeId: targetNode.id,
        field: fieldName,
        status: 'incompatible',
      })
      continue
    }
    if (compatibility.status === 'incompatible') {
      issues.push({
        severity: 'error',
        message: messageForIncompatibleVariable({
          fieldLabel,
          acceptedTypes,
          output: definition,
        }),
        nodeId: targetNode.id,
        field: fieldName,
        status: 'incompatible',
      })
    } else if (compatibility.status === 'warning') {
      issues.push({
        severity: 'warning',
        message: `${fieldLabel}: ${compatibility.message}`,
        nodeId: targetNode.id,
        field: fieldName,
        status: 'warning',
      })
    }
  }

  return issues
}

export function getCompatibleVariablesForField({
  field,
  variables,
}: {
  field: Pick<NodeConfigField, 'acceptedTypes' | 'allowsMixedText' | 'options'>
  variables: WorkflowVariableDefinition[]
}) {
  const acceptedTypes = normalizeAcceptedTypes(field.acceptedTypes)
  return variables.filter((variable) => {
    if (!variableMatchesFieldOptions({ variable, field })) {
      return false
    }
    const compatibility = checkVariableCompatibility({
      sourceType: variable.type,
      acceptedTypes,
      allowsMixedText: field.allowsMixedText,
    })
    return compatibility.status !== 'incompatible'
  })
}

type MappingFieldLike = Pick<
  NodeConfigField,
  'acceptedTypes' | 'allowsMixedText' | 'options'
> &
  Partial<Pick<NodeConfigField, 'id' | 'key' | 'label'>>

function mappingFieldLabel(field: MappingFieldLike) {
  return [field.key, field.id, field.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isInternalIdentifier(variable: WorkflowVariableDefinition) {
  const source = normalizedMappingText(variable)
  return (
    /\b(id|uuid|token|slug)\b/.test(source) ||
    /\brun[_\s.-]*id\b/.test(source) ||
    /\bmessage[_\s.-]*id\b/.test(source)
  )
}

function isScalarVariable(variable: WorkflowVariableDefinition) {
  return !['object', 'array', 'boolean', 'unknown'].includes(variable.type)
}

export function getMappingRelevanceScore({
  field,
  variable,
}: {
  field: MappingFieldLike
  variable: WorkflowVariableDefinition
}) {
  const acceptedTypes = normalizeAcceptedTypes(field.acceptedTypes)
  if (!variableMatchesFieldOptions({ variable, field })) return 0
  const compatibility = checkVariableCompatibility({
    sourceType: variable.type,
    acceptedTypes,
    allowsMixedText: field.allowsMixedText,
  })
  if (compatibility.status === 'incompatible') return 0

  const target = mappingFieldLabel(field)
  const source = normalizedMappingText(variable)
  const targetHas = (pattern: RegExp) => pattern.test(target)
  const sourceHas = (pattern: RegExp) => pattern.test(source)
  const expectsId = targetHas(/\b(id|record id|client id|lead id|message id)\b/)
  const isSubject = targetHas(/\b(subject)\b/)
  const isTitleOrName = targetHas(/\b(title|name)\b/)
  const isBodyLike = targetHas(
    /\b(body|message|prompt|instructions|description|note)\b/,
  )
  const isEmailField =
    acceptedTypes.includes('email') &&
    !field.allowsMixedText &&
    targetHas(
      /\b(recipient|email|cc|from|owner|assignee|contact|customer|client|lead)\b/,
    )
  const isPhoneField =
    acceptedTypes.includes('phone') &&
    !field.allowsMixedText &&
    targetHas(/\b(recipient|phone|sms|mobile|contact|customer|client|lead)\b/)
  const isUrlField =
    acceptedTypes.includes('url') &&
    !field.allowsMixedText &&
    targetHas(/\b(url|link|endpoint|website|review)\b/)

  if (isEmailField) {
    if (variable.type !== 'email' || !sourceHas(/\b(email|e-mail)\b/)) return 0
    return sourceHas(
      /\b(lead|contact|client|customer|owner|assigned|workspace|support|recipient)\b/,
    )
      ? 100
      : 70
  }

  if (isPhoneField) {
    if (
      variable.type !== 'phone' ||
      !sourceHas(/\b(phone|mobile|sms|cell|caller)\b/)
    )
      return 0
    return sourceHas(
      /\b(lead|contact|client|customer|caller|workspace|office|recipient)\b/,
    )
      ? 100
      : 70
  }

  if (isUrlField) {
    if (variable.type !== 'url' || !sourceHas(/\b(url|link|website|review)\b/))
      return 0
    return sourceHas(/\b(review|website|workspace|link|url)\b/) ? 100 : 70
  }

  if (isSubject) {
    if (
      [
        'email',
        'phone',
        'url',
        'object',
        'array',
        'boolean',
        'unknown',
      ].includes(variable.type)
    )
      return 0
    if (isInternalIdentifier(variable) && !expectsId) return 0
    if (sourceHas(/\b(address|slug|run|message id|internal)\b/)) return 0
    if (
      sourceHas(
        /\b(name|company|title|subject|status|stage|type|job|estimate|invoice|number|amount|value|appointment|date|workspace)\b/,
      )
    ) {
      return 80
    }
    return 0
  }

  if (isTitleOrName) {
    if (['object', 'array', 'boolean', 'unknown'].includes(variable.type))
      return 0
    if (isInternalIdentifier(variable) && !expectsId) return 0
    if (sourceHas(/\b(slug|run|message id|internal)\b/)) return 0
    if (
      sourceHas(
        /\b(name|full name|company|customer|client|lead|contact|title|subject|status|stage|type|job|project)\b/,
      )
    ) {
      return sourceHas(
        /\b(name|full name|company|customer|client|lead|contact)\b/,
      )
        ? 90
        : 70
    }
    return 0
  }

  if (isBodyLike) {
    if (!isScalarVariable(variable)) return 0
    if (isInternalIdentifier(variable) && !expectsId) return 0
    if (sourceHas(/\b(slug|internal)\b/)) return 0
    if (
      sourceHas(
        /\b(lead|contact|client|customer|name|email|phone|company|status|stage|date|time|amount|value|address|job|form|response|workspace|support|website|delivery|recipient|source)\b/,
      )
    ) {
      return sourceHas(
        /\b(lead|contact|client|customer|name|email|phone|company)\b/,
      )
        ? 90
        : 70
    }
    return 0
  }

  if (expectsId) {
    return isInternalIdentifier(variable) ? 80 : 0
  }

  if (acceptedTypes.includes('number') || acceptedTypes.includes('duration')) {
    return sourceHas(
      /\b(value|amount|total|score|count|duration|minutes|hours|number|revenue|probability)\b/,
    )
      ? 80
      : 0
  }

  if (acceptedTypes.includes('date') || acceptedTypes.includes('datetime')) {
    return sourceHas(/\b(date|time|appointment|due|current)\b/) &&
      !sourceHas(/\b(sent|created|run)\b/)
      ? 80
      : 0
  }

  return 0
}

export function getRelevantVariablesForField({
  field,
  variables,
}: {
  field: MappingFieldLike
  variables: WorkflowVariableDefinition[]
}) {
  return variables
    .map((variable) => ({
      variable,
      score: getMappingRelevanceScore({ field, variable }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.variable)
}

function compatibleTypes(
  input: WorkflowVariableDefinition,
  output: WorkflowVariableDefinition,
) {
  return (
    checkVariableCompatibility({
      sourceType: output.type,
      acceptedTypes: [input.type],
      allowsMixedText: false,
    }).status !== 'incompatible'
  )
}

function normalizedMappingText(variable: WorkflowVariableDefinition) {
  return [
    variable.key,
    variable.path,
    variable.label,
    variable.group,
    variable.sourceNodeLabel,
    variable.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function semanticMappingScore(
  input: WorkflowVariableDefinition,
  output: WorkflowVariableDefinition,
) {
  if (input.nullable) return 0
  if (!compatibleTypes(input, output)) return 0

  const target = normalizedMappingText(input)
  const source = normalizedMappingText(output)
  const targetHas = (pattern: RegExp) => pattern.test(target)
  const sourceHas = (pattern: RegExp) => pattern.test(source)

  if (input.type === 'email') {
    if (!sourceHas(/\b(email|e-mail)\b/)) return 0
    if (
      targetHas(
        /\b(recipient|email|cc|from|owner|assignee|contact|customer|client|lead)\b/,
      )
    ) {
      return sourceHas(
        /\b(lead|contact|client|customer|owner|workspace|support|recipient)\b/,
      )
        ? 100
        : 80
    }
    return 0
  }

  if (input.type === 'phone') {
    if (!sourceHas(/\b(phone|mobile|sms|cell)\b/)) return 0
    return targetHas(/\b(recipient|phone|sms|contact|customer|client|lead)\b/)
      ? 100
      : 0
  }

  if (input.type === 'url') {
    if (!sourceHas(/\b(url|link|website|review)\b/)) return 0
    return targetHas(/\b(url|link|endpoint|website|review)\b/) ? 100 : 0
  }

  if (input.type === 'number' || input.type === 'duration') {
    if (
      !sourceHas(
        /\b(value|amount|total|score|count|duration|minutes|hours|number|revenue|probability)\b/,
      )
    ) {
      return 0
    }
    return targetHas(
      /\b(value|amount|total|score|count|duration|minutes|hours|number|threshold|revenue|probability)\b/,
    )
      ? 100
      : 0
  }

  if (input.type === 'date' || input.type === 'datetime') {
    if (!sourceHas(/\b(date|time|at|created|sent|due|current)\b/)) return 0
    return targetHas(/\b(date|time|at|created|sent|due|current)\b/) ? 100 : 0
  }

  if (input.type === 'string') {
    if (targetHas(/\b(subject)\b/)) {
      return sourceHas(/\b(subject|title)\b/) ? 80 : 0
    }
    if (targetHas(/\b(body|message|prompt|instructions|description|note)\b/)) {
      if (
        sourceHas(
          /\b(id|status|sent|delivered|delivery|timestamp|time|at|recipient)\b/,
        )
      ) {
        return 0
      }
      return sourceHas(
        /\b(body|message|text|summary|response|note|description)\b/,
      )
        ? 80
        : 0
    }
    if (
      targetHas(
        /\b(name|title|company|owner|assignee|status|priority|stage|source)\b/,
      )
    ) {
      const targetWords =
        target.match(
          /\b(name|title|company|owner|assignee|status|priority|stage|source)\b/g,
        ) ?? []
      return targetWords.some((word) => source.includes(word)) ? 80 : 0
    }
  }

  return 0
}

export function buildDefaultMappings({
  source,
  target,
}: {
  source: Node
  target: Node
}): WorkflowDataMapping[] {
  const outputs = getNodeOutputVariables(source)
  const inputs = getTargetMappingVariables(target)
  const targetData = (target.data ?? {}) as Record<string, unknown>
  return inputs.map((input) => {
    const ranked = outputs
      .map((output) => ({ output, score: semanticMappingScore(input, output) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
    const top = ranked[0]
    const exact =
      top && ranked.filter((item) => item.score === top.score).length === 1
        ? top.output
        : undefined
    const existingValue = targetData[input.path] ?? targetData[input.key]
    const targetField = getWorkflowNodeDefinition(
      registryIdForNode(target),
    )?.configFields.find((field) => fieldKey(field) === input.key)
    const rawExistingText =
      !exact &&
      !input.nullable &&
      existingValue !== undefined &&
      existingValue !== null &&
      String(existingValue).trim()
        ? String(existingValue)
        : ''
    const existingText = targetField?.options?.length
      ? normalizedOptionValue(rawExistingText, targetField.options)
      : rawExistingText
    return {
      target: input.key,
      source: exact?.key,
      mode: exact ? 'variable' : 'text',
      value: exact ? undefined : existingText,
    }
  })
}

export function validateDataMappings({
  edge,
  source,
  target,
  nodes,
  edges,
}: {
  edge: Edge
  source?: Node
  target?: Node
  nodes?: Node[]
  edges?: Edge[]
}): MappingValidationIssue[] {
  if (!source || !target) {
    return [
      {
        severity: 'error',
        message: 'This connection is missing a source or destination step.',
        edgeId: edge.id,
      },
    ]
  }
  const mappings = Array.isArray(edge.data?.mappings)
    ? (edge.data?.mappings as WorkflowDataMapping[])
    : buildDefaultMappings({ source, target })
  const sourceVariables = getNodeOutputVariables(source)
  const availableVariables = getAvailableVariablesForNode(target, {
    nodes: nodes ?? [source, target],
    edges: edges ?? [edge],
  })
  const targetInputs = getTargetMappingVariables(target)
  const targetDefinition = getWorkflowNodeDefinition(registryIdForNode(target))
  const targetFields = targetDefinition?.configFields ?? []

  return targetInputs.flatMap((input): MappingValidationIssue[] => {
    const mapping = mappings.find((item) => item.target === input.key)
    const targetField = targetFields.find(
      (field) => fieldKey(field) === input.key,
    )
    if (!mapping) {
      if (input.nullable) return []
      return [
        {
          severity: 'warning' as const,
          message: `${input.label} has not been mapped.`,
          edgeId: edge.id,
          nodeId: target.id,
          field: input.key,
          status: 'required-missing',
        },
      ]
    }
    if (mapping.mode === 'text') {
      if (!String(mapping.value ?? '').trim()) {
        if (input.nullable) return []
        const label =
          targetField?.mappingLabel ?? targetField?.label ?? input.label
        return [
          {
            severity: 'warning' as const,
            message: `${label} has not been mapped. Choose workflow data or enter a custom value.`,
            edgeId: edge.id,
            nodeId: target.id,
            field: input.key,
            status: 'required-missing',
          },
        ]
      }
      return validateVariableValueForField({
        value: mapping.value ?? '',
        field: {
          id: input.key,
          key: input.key,
          label: targetField?.mappingLabel ?? targetField?.label ?? input.label,
          mappingLabel: targetField?.mappingLabel,
          acceptedTypes: targetField?.acceptedTypes ?? [input.type],
          allowsMixedText:
            targetField?.allowsMixedText ?? input.type === 'string',
          options: targetField?.options,
        },
        targetNode: target,
        nodes: nodes ?? [source, target],
        edges: edges ?? [edge],
      }).map((issue) => ({ ...issue, edgeId: edge.id }))
    }

    if (!mapping.source) {
      if (input.nullable) return []
      const label =
        targetField?.mappingLabel ?? targetField?.label ?? input.label
      return [
        {
          severity: 'warning' as const,
          message: `${label} has not been mapped. Choose workflow data or enter a custom value.`,
          edgeId: edge.id,
          nodeId: target.id,
          field: input.key,
          status: 'required-missing',
        },
      ]
    }
    const output =
      sourceVariables.find((item) => item.key === mapping.source) ??
      availableVariables.find((item) => item.key === mapping.source)
    if (!output) {
      return [
        {
          severity: 'error' as const,
          message: 'Broken source',
          edgeId: edge.id,
          nodeId: target.id,
          field: input.key,
          status: 'broken-source',
        },
      ]
    }
    const compatibility = checkVariableCompatibility({
      sourceType: output.type,
      acceptedTypes: normalizeAcceptedTypes(
        targetField?.acceptedTypes ?? [input.type],
      ),
      allowsMixedText: targetField?.allowsMixedText ?? false,
    })
    if (compatibility.status === 'incompatible') {
      return [
        {
          severity: 'error' as const,
          message: messageForIncompatibleVariable({
            fieldLabel: input.label,
            acceptedTypes: normalizeAcceptedTypes(
              targetField?.acceptedTypes ?? [input.type],
            ),
            output,
          }),
          edgeId: edge.id,
          nodeId: target.id,
          field: input.key,
          status: 'incompatible',
        },
      ]
    }
    if (compatibility.status === 'warning') {
      return [
        {
          severity: 'warning' as const,
          message: compatibility.message,
          edgeId: edge.id,
          nodeId: target.id,
          field: input.key,
          status: 'warning',
        },
      ]
    }
    return []
  })
}

export function validateNodeConfigVariables({
  node,
  nodes,
  edges,
}: {
  node: Node
  nodes: Node[]
  edges: Edge[]
}): MappingValidationIssue[] {
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  if (!definition) return []
  const config = (node.data ?? {}) as Record<string, unknown>
  const nestedConfig =
    config.config &&
    typeof config.config === 'object' &&
    !Array.isArray(config.config)
      ? (config.config as Record<string, unknown>)
      : {}
  const effectiveConfig = { ...nestedConfig, ...config }
  return definition.configFields
    .filter((field) =>
      isFieldVisible(field, effectiveConfig, definition.configFields),
    )
    .flatMap((field) => {
      const key = fieldKey(field)
      const value = configValueForField(
        effectiveConfig,
        field,
        field.defaultValue,
      )
      if (!field.supportsVariables && !hasLiteralValue(value)) return []
      return validateVariableValueForField({
        value,
        field,
        targetNode: node,
        nodes,
        edges,
      })
    })
}

export function validateWorkflowVariables({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): MappingValidationIssue[] {
  const issues: MappingValidationIssue[] = []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const variableUsage = new Map<string, number>()

  for (const node of nodes) {
    const definition = getWorkflowNodeDefinition(registryIdForNode(node))
    const data = (node.data ?? {}) as Record<string, unknown>
    const nestedData =
      data.config &&
      typeof data.config === 'object' &&
      !Array.isArray(data.config)
        ? (data.config as Record<string, unknown>)
        : {}
    const effectiveData = { ...nestedData, ...data }
    const variables = getAvailableVariablesForNode(node, { nodes, edges })
    for (const field of definition?.configFields ?? []) {
      if (!isFieldVisible(field, effectiveData, definition?.configFields ?? []))
        continue
      for (const reference of extractVariableReferences(
        configValueForField(effectiveData, field, field.defaultValue),
        variables,
      )) {
        variableUsage.set(
          reference.key,
          (variableUsage.get(reference.key) ?? 0) + 1,
        )
      }
    }
    issues.push(...validateNodeConfigVariables({ node, nodes, edges }))
  }

  for (const edge of edges) {
    issues.push(
      ...validateDataMappings({
        edge,
        source: nodeMap.get(edge.source),
        target: nodeMap.get(edge.target),
        nodes,
        edges,
      }),
    )
  }

  const duplicateVariables = Array.from(variableUsage.entries()).filter(
    ([, count]) => count > 3,
  )
  for (const [key] of duplicateVariables) {
    issues.push({
      severity: 'warning',
      message: `Duplicate variable usage: {{${key}}}`,
    })
  }

  return issues
}

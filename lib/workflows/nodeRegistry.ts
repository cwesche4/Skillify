import type { BuilderNodeType, PlanId } from '@/lib/builder/node-types'
import type {
  NodeConfigField,
  WorkflowNode,
  WorkflowNodeCategory,
  WorkflowConnectionRole,
  WorkflowDiscoveryNodeDomain,
  WorkflowDiscoveryNodeType,
  WorkflowNodeDefinition,
  WorkflowPort,
  WorkflowValueType,
} from '@/lib/workflows/types'
import {
  discoverWorkflowNodes,
  validateWorkflowNodeDiscoveryMetadata,
} from '@/lib/workflows/nodeDiscovery'
import { schedulingWorkflowNodeDefinitions } from '@/lib/workflows/schedulingRegistry'

export const WORKFLOW_NODE_CATEGORIES: WorkflowNodeCategory[] = [
  'Triggers',
  'Scheduling',
  'Business / CRM',
  'Communication',
  'Logic',
  'AI',
  'Integrations',
  'Utilities',
  'Organization',
]

const textField = (
  id: string,
  label: string,
  required = false,
  placeholder?: string,
  helpText?: string,
  group?: string,
  metadata: Partial<NodeConfigField> = {},
): NodeConfigField => ({
  id,
  label,
  type: 'text',
  required,
  placeholder,
  helpText,
  group,
  requiredMessage: required
    ? `${metadata.mappingLabel ?? label} is empty.`
    : undefined,
  ...metadata,
})

const textareaField = (
  id: string,
  label: string,
  required = false,
  placeholder?: string,
  helpText?: string,
  group?: string,
  metadata: Partial<NodeConfigField> = {},
): NodeConfigField => ({
  id,
  label,
  type: 'textarea',
  required,
  placeholder,
  helpText,
  group,
  requiredMessage: required
    ? `${metadata.mappingLabel ?? label} is empty.`
    : undefined,
  ...metadata,
})

const selectField = (
  id: string,
  label: string,
  options: string[],
  defaultValue?: string,
  group?: string,
  helpText?: string,
  metadata: Partial<NodeConfigField> = {},
): NodeConfigField => ({
  id,
  label,
  type: 'select',
  defaultValue,
  group,
  placeholder: `Select ${label.toLowerCase()}`,
  helpText,
  options: options.map((value) => ({ label: value, value })),
  ...metadata,
})

const toggleField = (
  id: string,
  label: string,
  defaultValue = false,
  group?: string,
  helpText?: string,
): NodeConfigField => ({
  id,
  label,
  type: 'toggle',
  defaultValue,
  group,
  placeholder: label,
  helpText,
})

const numberField = (
  id: string,
  label: string,
  defaultValue?: number,
  group?: string,
  options?: Partial<NodeConfigField>,
): NodeConfigField => ({
  id,
  label,
  type: 'number',
  defaultValue,
  group,
  placeholder: String(defaultValue ?? ''),
  ...options,
})

const keyValueField = (
  id: string,
  label: string,
  group?: string,
  options?: Pick<
    NodeConfigField,
    'required' | 'showWhen' | 'helpText' | 'requiredMessage' | 'repairGroup'
  >,
): NodeConfigField => ({
  id,
  label,
  type: 'key-value',
  group,
  placeholder: 'Add key/value rows',
  ...options,
})

const aiTemperatureField = () =>
  numberField('temperature', 'Temperature', 0.2, 'AI', {
    min: 0,
    max: 2,
    step: 0.1,
    helpText:
      'Controls response randomness. Use 0 for deterministic output and higher values for more variation.',
  })

const previewOutput = (node: WorkflowNode) => ({
  nodeId: node.id,
  nodeType: node.type,
  preview: true,
  message: `${node.label} simulated successfully.`,
})

const placeholder = (area: 'validation' | 'execution', label: string) => ({
  placeholder: true as const,
  description: `${label} ${area} will be provided by the workflow runtime.`,
})

function defaultPlaceholder(field: NodeConfigField) {
  if (field.placeholder) return field.placeholder
  if (field.type === 'select') return `Select ${field.label.toLowerCase()}`
  if (field.type === 'multi-select') return 'Add comma-separated values'
  if (field.type === 'json') return '{ }'
  if (field.type === 'code') return 'Define the rule or expression'
  if (field.type === 'ai-prompt')
    return 'Tell the AI what to do using {{variables}}'
  if (field.type === 'number')
    return String(field.defaultValue ?? field.min ?? 0)
  return `Enter ${field.label.toLowerCase()}`
}

function defaultHelpText(field: NodeConfigField) {
  if (field.helpText) return field.helpText
  if (field.type === 'ai-prompt')
    return 'Use variables like {{lead.message}} to include record data.'
  if (field.type === 'json')
    return 'JSON preview only. Variables such as {{client.id}} are supported.'
  if (field.type === 'key-value')
    return 'Add rows for values that should be passed forward.'
  if (
    field.type === 'number' &&
    (typeof field.min === 'number' || typeof field.max === 'number')
  ) {
    return `Allowed range: ${field.min ?? 'any'} to ${field.max ?? 'any'}.`
  }
  return undefined
}

function normalizeConfigField(field: NodeConfigField): NodeConfigField {
  const key = (field.key ?? field.id).toLowerCase()
  const label = field.label.toLowerCase()
  const inferredSemanticType: NodeConfigField['semanticType'] =
    field.semanticType ??
    (field.acceptedTypes?.includes('email') ||
    key.includes('email') ||
    key === 'recipient'
      ? 'emailAddress'
      : field.acceptedTypes?.includes('phone') || key.includes('phone')
        ? 'phoneNumber'
        : key.includes('subject')
          ? 'messageSubject'
          : key.includes('body') ||
              key.includes('message') ||
              field.type === 'ai-prompt'
            ? 'messageBody'
            : key.includes('title')
              ? 'taskTitle'
              : key.includes('description')
                ? 'taskDescription'
                : key.includes('stage')
                  ? 'stage'
                  : key.includes('health')
                    ? 'healthStatus'
                    : key.includes('priority')
                      ? 'priority'
                      : key.includes('nextaction')
                        ? 'nextAction'
                        : key.includes('owner')
                          ? 'owner'
                          : key.includes('assignee')
                            ? 'assignee'
                            : key.includes('duration') ||
                                key.includes('offset') ||
                                label.includes('timeout')
                              ? 'duration'
                              : key === 'unit'
                                ? 'durationUnit'
                                : field.type === 'json'
                                  ? 'schema'
                                  : field.type === 'code'
                                    ? 'conditionField'
                                    : field.type === 'text' ||
                                        field.type === 'textarea'
                                      ? 'genericText'
                                      : undefined)
  const inferredSemanticRole: NodeConfigField['semanticRole'] =
    field.semanticRole ??
    (inferredSemanticType === 'emailAddress'
      ? 'email'
      : inferredSemanticType === 'phoneNumber'
        ? 'phone'
        : inferredSemanticType === 'messageSubject'
          ? 'subject'
          : inferredSemanticType === 'messageBody'
            ? key.includes('note') || label.includes('note')
              ? 'note'
              : 'message'
            : inferredSemanticType === 'taskTitle'
              ? 'title'
              : inferredSemanticType === 'taskDescription'
                ? key.includes('note') || label.includes('note')
                  ? 'note'
                  : 'description'
                : inferredSemanticType === 'healthStatus'
                  ? 'status'
                  : inferredSemanticType === 'nextAction'
                    ? 'status'
                    : inferredSemanticType === 'duration'
                      ? 'number'
                      : inferredSemanticType === 'durationUnit'
                        ? 'enum'
                        : inferredSemanticType === 'schema'
                          ? 'schema'
                          : inferredSemanticType === 'conditionField'
                            ? 'conditionField'
                            : inferredSemanticType === 'json'
                              ? 'payload'
                              : inferredSemanticType === 'url'
                                ? 'genericText'
                                : inferredSemanticType)
  const storesReference =
    field.storesReference ??
    ['owner', 'assignee', 'team'].includes(inferredSemanticRole ?? '')
  const supportsVariables =
    field.supportsVariables ??
    [
      'text',
      'textarea',
      'json',
      'code',
      'ai-prompt',
      'variable',
      'key-value',
    ].includes(field.type)
  const acceptedTypes: WorkflowValueType[] =
    field.acceptedTypes ??
    (field.type === 'number'
      ? ['number']
      : field.type === 'boolean' || field.type === 'toggle'
        ? ['boolean']
        : field.type === 'select' || field.type === 'multi-select'
          ? ['string']
          : field.type === 'json' || field.type === 'key-value'
            ? [
                'string',
                'number',
                'boolean',
                'email',
                'phone',
                'url',
                'date',
                'datetime',
                'object',
                'array',
              ]
            : ['string', 'email', 'phone', 'url', 'number', 'date', 'datetime'])
  return {
    ...field,
    label: field.label || field.id,
    placeholder: defaultPlaceholder(field),
    helpText: defaultHelpText(field),
    supportsVariables,
    acceptedTypes,
    allowsMixedText:
      field.allowsMixedText ??
      ['textarea', 'ai-prompt', 'json', 'code'].includes(field.type),
    mappingLabel: field.mappingLabel ?? field.label,
    semanticRole: inferredSemanticRole,
    semanticType: inferredSemanticType,
    suggestionMode:
      field.suggestionMode ??
      (field.conditionBuilder?.enabled
        ? 'structured'
        : inferredSemanticType === 'schema'
          ? 'structured'
          : field.type === 'select' || field.type === 'number'
            ? 'presets'
            : [
                  'stage',
                  'healthStatus',
                  'priority',
                  'nextAction',
                  'owner',
                  'assignee',
                  'durationUnit',
                ].includes(inferredSemanticType ?? '')
              ? 'presets'
              : [
                    'emailAddress',
                    'phoneNumber',
                    'messageBody',
                    'messageSubject',
                    'taskTitle',
                    'taskDescription',
                  ].includes(inferredSemanticType ?? '')
                ? 'presetsAndWorkflowData'
                : 'none'),
    presetGroup: field.presetGroup,
    suggestionCategories: field.suggestionCategories,
    includeTechnicalSuggestions: field.includeTechnicalSuggestions,
    preferredVariableKinds: field.preferredVariableKinds,
    inputControl:
      field.inputControl ??
      (storesReference
        ? 'entity-select'
        : inferredSemanticRole === 'date'
          ? 'date'
          : inferredSemanticRole === 'datetime'
            ? 'datetime'
            : inferredSemanticRole === 'boolean'
              ? 'boolean'
              : inferredSemanticRole === 'schema' ||
                  inferredSemanticRole === 'payload'
                ? 'schema'
                : undefined),
    displayMode: field.displayMode ?? 'friendly',
    storesReference,
    conditionCapable:
      field.conditionCapable ??
      !['schema', 'payload', 'technical'].includes(inferredSemanticRole ?? ''),
    allowedOperators: field.allowedOperators,
    valueControl: field.valueControl,
    emptyValueAllowed: field.emptyValueAllowed,
    allowedEntityTypes:
      field.allowedEntityTypes ??
      (storesReference ? [inferredSemanticRole ?? 'entity'] : undefined),
    optionSource: field.optionSource,
    workspaceOptionCategory:
      field.workspaceOptionCategory ??
      (storesReference
        ? inferredSemanticRole === 'team'
          ? 'teams'
          : 'members'
        : inferredSemanticType === 'stage'
          ? 'crmStages'
          : inferredSemanticType === 'healthStatus'
            ? 'healthStatuses'
            : inferredSemanticType === 'priority'
              ? 'priorities'
              : inferredSemanticType === 'durationUnit'
                ? 'durationUnits'
                : undefined),
    storedValue: field.storedValue ?? (storesReference ? 'id' : 'value'),
    supportsPreviewOverride:
      field.supportsPreviewOverride ??
      Boolean(field.conditionBuilder?.enabled || field.conditionCapable),
    allowedVariableScopes: field.allowedVariableScopes,
    preferredVariableGroups: field.preferredVariableGroups,
    excludedVariableGroups: field.excludedVariableGroups,
    example: field.example ?? field.defaultValue,
    suggestions: field.suggestions,
    schemaPresets: field.schemaPresets,
    schemaChips: field.schemaChips,
    conditionBuilder: field.conditionBuilder,
    requiredMessage:
      field.requiredMessage ??
      (field.required
        ? field.type === 'select'
          ? `Select ${field.label.toLowerCase()}.`
          : field.type === 'key-value'
            ? `Add at least one complete ${field.label.toLowerCase()} row.`
            : `Enter ${field.label.toLowerCase()} before continuing.`
        : undefined),
  }
}

type RegistryDefinitionInput = Omit<
  WorkflowNodeDefinition,
  'configurationSchema' | 'validation' | 'execution' | 'executePreview'
>

function inferDiscoveryType(
  definition: RegistryDefinitionInput,
): WorkflowDiscoveryNodeType {
  if (definition.discovery?.type) return definition.discovery.type
  if (definition.connectionRole === 'trigger' || definition.canBeTrigger)
    return 'trigger'
  if (definition.category === 'Communication') return 'communication'
  if (definition.category === 'AI') return 'ai'
  if (definition.category === 'Integrations') return 'integration'
  if (
    definition.category === 'Utilities' ||
    definition.category === 'Organization'
  )
    return 'utility'
  if (
    definition.connectionRole === 'logic' ||
    definition.category === 'Logic' ||
    definition.branchRole === 'condition'
  ) {
    return definition.id === 'wait.delay' ? 'utility' : 'condition'
  }
  return 'action'
}

function inferDiscoveryDomain(
  definition: RegistryDefinitionInput,
): WorkflowDiscoveryNodeDomain {
  if (definition.discovery?.domain) return definition.discovery.domain
  if (
    definition.category === 'Scheduling' ||
    definition.id.startsWith('scheduling.')
  )
    return 'scheduling'
  if (definition.id.startsWith('task.') || definition.id === 'task.create')
    return 'tasks'
  if (definition.id.startsWith('client.')) return 'clients'
  if (
    definition.id.startsWith('crm.') ||
    definition.id.startsWith('lead.') ||
    definition.id.startsWith('opportunity.') ||
    definition.id.startsWith('note.') ||
    definition.category === 'Business / CRM'
  ) {
    return 'crm'
  }
  if (definition.category === 'Organization') return 'organization'
  return 'general'
}

function inferDiscoveryGroup(
  definition: RegistryDefinitionInput,
  type: WorkflowDiscoveryNodeType,
) {
  if (definition.discovery?.group?.trim()) return definition.discovery.group
  if (type === 'trigger') {
    if (definition.id.startsWith('task.')) return 'Task Triggers'
    if (definition.id.startsWith('service_request.'))
      return 'Service Request Triggers'
    return 'CRM Triggers'
  }
  if (type === 'communication') return 'Messages'
  if (type === 'ai') return 'AI'
  if (type === 'integration') return 'Webhooks'
  if (type === 'condition') return 'Branches & Conditions'
  if (type === 'utility') {
    if (definition.category === 'Organization') return 'Organization'
    if (definition.id.includes('delay')) return 'Timing'
    return 'Utilities'
  }
  if (definition.id.startsWith('task.')) return 'Task Actions'
  if (definition.id.startsWith('client.')) return 'Client Actions'
  return 'CRM Actions'
}

function normalizeDiscovery(definition: RegistryDefinitionInput) {
  const type = inferDiscoveryType(definition)
  const domain = inferDiscoveryDomain(definition)
  return {
    type,
    domain,
    group: inferDiscoveryGroup(definition, type),
    aliases: definition.discovery?.aliases ?? [],
    tags: definition.discovery?.tags ?? [],
    keywords: definition.discovery?.keywords ?? [],
    searchPriority: definition.discovery?.searchPriority ?? 0,
    isFeatured: definition.discovery?.isFeatured,
  }
}

function defineNode(
  definition: RegistryDefinitionInput,
): WorkflowNodeDefinition {
  const connectionRole: WorkflowConnectionRole =
    definition.connectionRole ??
    (definition.canBeTrigger
      ? 'trigger'
      : definition.category === 'Logic'
        ? 'logic'
        : definition.category === 'Organization' ||
            definition.category === 'Utilities'
          ? 'utility'
          : 'action')
  const defaultAllowedInputs: WorkflowConnectionRole[] =
    connectionRole === 'trigger'
      ? []
      : ['trigger', 'action', 'logic', 'utility']
  const defaultAllowedOutputs: WorkflowConnectionRole[] =
    connectionRole === 'utility'
      ? ['action', 'logic', 'utility']
      : ['action', 'logic', 'utility']
  const discovery = normalizeDiscovery(definition)
  return {
    type: definition.type ?? definition.id,
    planRequirement: definition.planRequirement ?? 'basic',
    connectionRole,
    allowedInputs: definition.allowedInputs ?? defaultAllowedInputs,
    allowedOutputs: definition.allowedOutputs ?? defaultAllowedOutputs,
    acceptsMultipleInputs:
      definition.acceptsMultipleInputs ?? connectionRole === 'logic',
    acceptsMultipleOutputs:
      definition.acceptsMultipleOutputs ??
      (connectionRole === 'logic' || connectionRole === 'trigger'),
    terminalCapable:
      definition.terminalCapable ??
      (connectionRole === 'action' || connectionRole === 'utility'),
    requiresOutgoingConnection:
      definition.requiresOutgoingConnection ?? connectionRole === 'trigger',
    allowsMultipleOutgoing:
      definition.allowsMultipleOutgoing ??
      definition.acceptsMultipleOutputs ??
      (connectionRole === 'logic' || connectionRole === 'trigger'),
    maxOutgoingConnections: definition.maxOutgoingConnections,
    branchHandles: definition.branchHandles,
    requiredBranchHandles: definition.requiredBranchHandles,
    optionalBranchHandles: definition.optionalBranchHandles,
    branchRole: definition.branchRole,
    branchMode: definition.branchMode,
    branchPaths: definition.branchPaths,
    defaultPath: definition.defaultPath,
    fallbackPath: definition.fallbackPath,
    outputCardinality: definition.outputCardinality,
    executionMode: definition.executionMode,
    mergeBehavior: definition.mergeBehavior,
    requiresConfiguredBranch: definition.requiresConfiguredBranch,
    maxIncomingConnections: definition.maxIncomingConnections,
    trigger: definition.trigger ?? connectionRole === 'trigger',
    action: definition.action ?? connectionRole === 'action',
    logic: definition.logic ?? connectionRole === 'logic',
    utility: definition.utility ?? connectionRole === 'utility',
    configurationSchema: {
      placeholder: true,
      fields: definition.configFields.map((field) => field.id),
    },
    validation: placeholder('validation', definition.label),
    execution: placeholder('execution', definition.label),
    aiDescription:
      definition.aiDescription ??
      `${definition.label}: ${definition.description}`,
    documentation:
      definition.documentation ??
      `${definition.description} Configure required fields before enabling this workflow.`,
    executePreview: previewOutput,
    ...definition,
    discovery,
    availability: definition.availability ?? { state: 'available' },
    iconKey: definition.iconKey ?? definition.ui?.icon ?? 'workflow',
    configFields: definition.configFields.map(normalizeConfigField),
  }
}

const commonInput = [{ id: 'input', label: 'Input', dataType: 'any' as const }]
const objectInput = [
  {
    id: 'record',
    label: 'Record',
    dataType: 'object' as const,
    required: true,
  },
]
const delayOutputs: WorkflowPort[] = [
  {
    id: 'wait.duration',
    label: 'Wait duration',
    dataType: 'number',
    sampleValue: 30,
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'wait',
  },
  {
    id: 'wait.unit',
    label: 'Wait unit',
    dataType: 'string',
    sampleValue: 'minutes',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'wait',
  },
  {
    id: 'wait.resumedAt',
    label: 'Resumed At',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:30:00Z',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'wait',
  },
  {
    id: 'wait.completed',
    label: 'Wait completed',
    dataType: 'boolean',
    sampleValue: true,
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'wait',
  },
]

const leadOutputs: WorkflowPort[] = [
  {
    id: 'lead.id',
    label: 'Lead ID',
    dataType: 'string',
    sampleValue: 'lead_987',
  },
  {
    id: 'lead.firstName',
    label: 'First name',
    dataType: 'string',
    sampleValue: 'John',
  },
  {
    id: 'lead.lastName',
    label: 'Last name',
    dataType: 'string',
    sampleValue: 'Rivera',
  },
  {
    id: 'lead.fullName',
    label: 'Full name',
    dataType: 'string',
    sampleValue: 'John Rivera',
  },
  {
    id: 'lead.email',
    label: 'Email',
    dataType: 'email',
    sampleValue: 'john@example.com',
  },
  {
    id: 'lead.phone',
    label: 'Phone',
    dataType: 'phone',
    sampleValue: '+1 555 555 5555',
  },
  {
    id: 'lead.company',
    label: 'Company',
    dataType: 'string',
    sampleValue: 'Skillify',
  },
  {
    id: 'lead.status',
    label: 'Status',
    dataType: 'string',
    sampleValue: 'New',
  },
  {
    id: 'lead.createdAt',
    label: 'Created at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
  },
]

const crmTriggerOutputs: WorkflowPort[] = [
  {
    id: 'record.id',
    label: 'Record ID',
    dataType: 'string',
    sampleValue: 'crm_12345',
  },
  {
    id: 'record.type',
    label: 'Record type',
    dataType: 'string',
    sampleValue: 'lead',
  },
  {
    id: 'record.name',
    label: 'Record name',
    dataType: 'string',
    sampleValue: 'NorthStar Electric',
  },
  {
    id: 'record.email',
    label: 'Record email',
    dataType: 'email',
    sampleValue: 'owner@northstar.com',
  },
  {
    id: 'record.phone',
    label: 'Record phone',
    dataType: 'phone',
    sampleValue: '+1 555 555 5555',
  },
  {
    id: 'record.status',
    label: 'Record status',
    dataType: 'string',
    sampleValue: 'New',
  },
  {
    id: 'event.type',
    label: 'Event type',
    dataType: 'string',
    sampleValue: 'lead.created',
  },
  {
    id: 'event.occurredAt',
    label: 'Occurred at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
  },
]

const taskOutputs: WorkflowPort[] = [
  {
    id: 'task.id',
    label: 'Task ID',
    dataType: 'string',
    sampleValue: 'task_123',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'task',
  },
  {
    id: 'task.title',
    label: 'Task title',
    dataType: 'string',
    sampleValue: 'Follow up with lead',
    dataRole: 'business',
    namespace: 'task',
  },
  {
    id: 'task.status',
    label: 'Task status',
    dataType: 'string',
    sampleValue: 'Open',
    dataRole: 'business',
    namespace: 'task',
    writePath: 'task.status',
  },
  {
    id: 'task.assigneeId',
    label: 'Assignee ID',
    dataType: 'string',
    sampleValue: 'user_123',
    dataRole: 'business',
    namespace: 'task',
    writePath: 'task.assigneeId',
  },
  {
    id: 'task.createdAt',
    label: 'Created at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'task',
  },
]

const emailOutputs: WorkflowPort[] = [
  {
    id: 'message.id',
    label: 'Message ID',
    dataType: 'string',
    sampleValue: 'msg_123',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'email',
  },
  {
    id: 'message.status',
    label: 'Delivery status',
    dataType: 'string',
    sampleValue: 'prepared',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'email',
  },
  {
    id: 'message.sentAt',
    label: 'Sent at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'email',
  },
  {
    id: 'recipient.email',
    label: 'Recipient email',
    dataType: 'email',
    sampleValue: 'client@example.com',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'email',
  },
]

const smsOutputs: WorkflowPort[] = [
  {
    id: 'message.id',
    label: 'Message ID',
    dataType: 'string',
    sampleValue: 'sms_123',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'sms',
  },
  {
    id: 'message.status',
    label: 'Delivery status',
    dataType: 'string',
    sampleValue: 'prepared',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'sms',
  },
  {
    id: 'message.sentAt',
    label: 'Sent at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'sms',
  },
  {
    id: 'recipient.phone',
    label: 'Recipient phone',
    dataType: 'phone',
    sampleValue: '+1 555 555 5555',
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'sms',
  },
]

const webhookOutputs: WorkflowPort[] = [
  {
    id: 'response.status',
    label: 'Response status',
    dataType: 'number',
    sampleValue: 200,
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'webhook',
  },
  {
    id: 'response.body',
    label: 'Response body',
    dataType: 'object',
    sampleValue: { ok: true },
    dataRole: 'runtime',
    warnWhenUnused: false,
    namespace: 'webhook',
  },
  {
    id: 'response.headers',
    label: 'Response headers',
    dataType: 'object',
    sampleValue: { 'content-type': 'application/json' },
    dataRole: 'technical',
    warnWhenUnused: false,
    namespace: 'webhook',
  },
]

const aiReplyOutputs: WorkflowPort[] = [
  {
    id: 'response.text',
    label: 'Response text',
    dataType: 'string',
    sampleValue: 'Thanks for reaching out.',
  },
  {
    id: 'response.summary',
    label: 'Response summary',
    dataType: 'string',
    sampleValue: 'Friendly customer reply',
  },
  {
    id: 'response.confidence',
    label: 'Confidence',
    dataType: 'number',
    sampleValue: 0.86,
  },
  {
    id: 'response.generatedAt',
    label: 'Generated at',
    dataType: 'datetime',
    sampleValue: '2026-07-10T14:00:00Z',
  },
]

export const workflowNodeRegistry: WorkflowNodeDefinition[] = [
  ...schedulingWorkflowNodeDefinitions.map(defineNode),
  defineNode({
    id: 'crm.trigger',
    type: 'crm-trigger',
    label: 'CRM Trigger',
    category: 'Triggers',
    description: 'Start a workflow from a Skillify CRM event.',
    iconKey: 'database',
    inputs: [],
    outputs: crmTriggerOutputs,
    configFields: [
      {
        id: 'eventName',
        key: 'event',
        label: 'Event',
        type: 'select',
        required: true,
        group: 'Trigger',
        helpText: 'Choose the CRM event that starts this workflow.',
        options: [
          { label: 'Lead created', value: 'lead.created' },
          { label: 'Lead converted', value: 'lead.converted' },
          { label: 'Opportunity created', value: 'opportunity.created' },
          {
            label: 'Opportunity stage changed',
            value: 'opportunity.stage_changed',
          },
          { label: 'Opportunity won', value: 'opportunity.won' },
          { label: 'Client health changed', value: 'client.health_changed' },
          { label: 'Task created', value: 'task.created' },
          { label: 'Task completed', value: 'task.completed' },
          {
            label: 'Service request submitted',
            value: 'service_request.created',
          },
        ],
      },
      textField(
        'workspace',
        'Workspace',
        false,
        '{{ workspace.id }}',
        'Optional workspace filter.',
        'Trigger',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'database', color: 'cyan', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'lead.created',
    type: 'crm-trigger',
    label: 'Lead Created',
    category: 'Triggers',
    description: 'Start when a new lead enters the workspace.',
    iconKey: 'user-plus',
    inputs: [],
    outputs: leadOutputs,
    configFields: [
      textField(
        'sourceFilter',
        'Source filter',
        false,
        'Website form',
        'Limit this trigger to a lead source.',
        'Trigger',
      ),
      {
        id: 'tags',
        label: 'Tags',
        type: 'multi-select',
        placeholder: 'VIP, Enterprise',
        helpText: 'Placeholder tag filter. Real tag selection connects later.',
        group: 'Filters',
      },
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'user-plus', color: 'cyan', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'opportunity.stage_changed',
    type: 'crm-trigger',
    label: 'Opportunity Stage Changed',
    category: 'Triggers',
    description: 'Start when an opportunity moves to another sales stage.',
    iconKey: 'chart',
    inputs: [],
    outputs: [
      {
        id: 'opportunity.stage',
        label: 'Stage',
        dataType: 'string',
        sampleValue: 'Proposal',
      },
      {
        id: 'opportunity.owner',
        label: 'Owner',
        dataType: 'string',
        sampleValue: 'Avery Chen',
      },
      {
        id: 'opportunity.probability',
        label: 'Probability',
        dataType: 'number',
        sampleValue: 72,
      },
      {
        id: 'opportunity.revenue',
        label: 'Revenue',
        dataType: 'number',
        sampleValue: 42000,
      },
    ],
    configFields: [
      textField(
        'fromStage',
        'From stage',
        false,
        'Qualified',
        'Optional previous stage filter.',
        'Trigger',
      ),
      textField(
        'toStage',
        'To stage',
        false,
        'Proposal',
        'Optional destination stage filter.',
        'Trigger',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'chart', color: 'purple', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'client.health_changed',
    type: 'crm-trigger',
    label: 'Client Health Changed',
    category: 'Triggers',
    description:
      'Start when a client becomes healthy, at risk, or needs attention.',
    iconKey: 'heart-pulse',
    inputs: [],
    outputs: [
      {
        id: 'client.name',
        label: 'Client name',
        dataType: 'string',
        sampleValue: 'NorthStar Electric',
      },
      {
        id: 'client.health',
        label: 'Health',
        dataType: 'string',
        sampleValue: 'At Risk',
      },
      {
        id: 'client.assignedTech',
        label: 'Assigned tech',
        dataType: 'string',
        sampleValue: 'Mina Patel',
      },
      {
        id: 'client.tags',
        label: 'Tags',
        dataType: 'array',
        sampleValue: ['VIP'],
      },
    ],
    configFields: [
      selectField(
        'health',
        'Health status',
        ['Healthy', 'Watch', 'At Risk'],
        undefined,
        'Trigger',
        'Optional health status filter.',
      ),
      textField(
        'workspace',
        'Workspace',
        false,
        '{{workspace.id}}',
        'Optional workspace filter.',
        'Trigger',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: {
      icon: 'heart-pulse',
      color: 'emerald',
      builderNodeType: 'crm-trigger',
    },
  }),
  defineNode({
    id: 'task.created',
    type: 'crm-trigger',
    label: 'Task Created',
    category: 'Triggers',
    description: 'Start when a task is created manually or by automation.',
    iconKey: 'check-square',
    inputs: [],
    outputs: taskOutputs,
    configFields: [
      textField(
        'assignee',
        'Assignee',
        false,
        '{{task.assignee}}',
        'Optional assignee filter.',
        'Trigger',
      ),
      selectField(
        'priority',
        'Priority',
        ['Low', 'Medium', 'High', 'Urgent'],
        undefined,
        'Trigger',
        'Optional priority filter.',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'check-square', color: 'blue', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'task.completed',
    type: 'crm-trigger',
    label: 'Task Completed',
    category: 'Triggers',
    description: 'Start when a workspace task is completed.',
    iconKey: 'check',
    inputs: [],
    outputs: taskOutputs,
    configFields: [
      textField(
        'assignee',
        'Assignee',
        false,
        '{{task.assignee}}',
        'Optional assignee filter.',
        'Trigger',
      ),
      textField(
        'completedBy',
        'Completed by',
        false,
        '{{user.id}}',
        'Optional user filter.',
        'Trigger',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'check', color: 'emerald', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'service_request.created',
    type: 'crm-trigger',
    label: 'Service Request Submitted',
    category: 'Triggers',
    description: 'Start when a customer or operator creates a service request.',
    iconKey: 'wrench',
    inputs: [],
    outputs: [
      {
        id: 'serviceRequest.id',
        label: 'Request ID',
        dataType: 'string',
        sampleValue: 'sr_4421',
      },
      {
        id: 'serviceRequest.customer',
        label: 'Customer',
        dataType: 'string',
        sampleValue: 'NorthStar Electric',
      },
      {
        id: 'serviceRequest.address',
        label: 'Address',
        dataType: 'string',
        sampleValue: '1200 Market St',
      },
      {
        id: 'serviceRequest.equipment',
        label: 'Equipment',
        dataType: 'string',
        sampleValue: 'Panel A',
      },
    ],
    configFields: [
      textField(
        'requestType',
        'Request type',
        false,
        'Repair',
        'Optional service request type filter.',
        'Trigger',
      ),
      textField(
        'territory',
        'Territory',
        false,
        '{{workspace.region}}',
        'Optional territory or region filter.',
        'Trigger',
      ),
    ],
    canBeTrigger: true,
    canBeAction: false,
    ui: { icon: 'wrench', color: 'amber', builderNodeType: 'crm-trigger' },
  }),
  defineNode({
    id: 'task.create',
    type: 'crm-action',
    label: 'Create Task',
    category: 'Business / CRM',
    description: 'Create a follow-up task for a workspace owner or team.',
    iconKey: 'check-square',
    configPanel: 'task',
    inputs: objectInput,
    outputs: taskOutputs,
    configFields: [
      textField(
        'title',
        'Title',
        true,
        'Follow up with {{client.name}}',
        'Task title shown to the assignee.',
        'Task',
        {
          semanticType: 'taskTitle',
          suggestionMode: 'presetsAndWorkflowData',
          repairGroup: 'taskDefinition',
        },
      ),
      textareaField(
        'description',
        'Description',
        false,
        'Summarize next steps.',
        undefined,
        'Task',
        {
          semanticType: 'taskDescription',
          suggestionMode: 'presetsAndWorkflowData',
          preferredVariableGroups: [
            'client',
            'lead',
            'task',
            'service',
            'company',
          ],
          excludedVariableGroups: ['workspace.email', 'owner.email'],
          repairGroup: 'taskDefinition',
        },
      ),
      textField(
        'owner',
        'Owner',
        false,
        '{{owner.id}}',
        'Placeholder owner field. Team picker connects later.',
        'Assignment',
        {
          semanticType: 'owner',
          suggestionMode: 'presets',
          repairGroup: 'taskDefinition',
        },
      ),
      selectField(
        'priority',
        'Priority',
        ['Low', 'Medium', 'High', 'Urgent'],
        'Medium',
        'Task',
        undefined,
        {
          semanticType: 'priority',
          suggestionMode: 'presets',
          repairGroup: 'taskDefinition',
        },
      ),
      selectField(
        'status',
        'Status',
        ['Open', 'In Progress', 'Done'],
        'Open',
        'Task',
        'Preview status for the created task.',
        { repairGroup: 'taskDefinition' },
      ),
      numberField('dueOffset', 'Due offset', 1, 'Timing', {
        min: 0,
        step: 1,
        helpText:
          'Number of selected time units from when the workflow reaches this step.',
        repairGroup: 'taskDefinition',
      }),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: {
      icon: 'check-square',
      color: 'emerald',
      builderNodeType: 'crm-action',
    },
  }),
  defineNode({
    id: 'client.update',
    type: 'crm-action',
    label: 'Update Client',
    category: 'Business / CRM',
    description:
      'Update client fields such as health, stage, owner, or next action.',
    iconKey: 'users',
    configPanel: 'client-update',
    inputs: [
      { id: 'client', label: 'Client', dataType: 'object', required: true },
    ],
    outputs: [
      {
        id: 'client.health',
        label: 'Client Health',
        dataType: 'string',
        sampleValue: 'Healthy',
        dataRole: 'business',
        namespace: 'client',
        writePath: 'client.health',
      },
      {
        id: 'client.stage',
        label: 'Client Stage',
        dataType: 'string',
        sampleValue: 'Onboarding',
        dataRole: 'business',
        namespace: 'client',
        writePath: 'client.stage',
      },
      {
        id: 'client.ownerId',
        label: 'Client Owner ID',
        dataType: 'string',
        sampleValue: 'user_owner',
        dataRole: 'business',
        namespace: 'client',
        writePath: 'client.ownerId',
      },
      {
        id: 'client.nextAction',
        label: 'Next Action',
        dataType: 'string',
        sampleValue: 'Schedule kickoff call',
        dataRole: 'business',
        namespace: 'client',
        writePath: 'client.nextAction',
      },
    ],
    configFields: [
      selectField(
        'health',
        'Health',
        ['Healthy', 'Needs Attention', 'At Risk'],
        undefined,
        'Client',
        undefined,
        { semanticType: 'healthStatus', suggestionMode: 'presets' },
      ),
      textField('stage', 'Stage', false, 'Onboarding', undefined, 'Client', {
        semanticType: 'stage',
        suggestionMode: 'presets',
      }),
      textField(
        'owner',
        'Owner',
        false,
        '{{owner.id}}',
        undefined,
        'Assignment',
        { semanticType: 'owner', suggestionMode: 'presets' },
      ),
      textField(
        'nextAction',
        'Next action',
        false,
        'Schedule kickoff call',
        undefined,
        'Client',
        { semanticType: 'nextAction', suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'users', color: 'purple', builderNodeType: 'crm-action' },
  }),
  defineNode({
    id: 'note.add',
    type: 'crm-action',
    label: 'Add Note',
    category: 'Business / CRM',
    description:
      'Attach an internal note to a client, lead, task, or opportunity.',
    iconKey: 'note',
    configPanel: 'crm-action',
    inputs: objectInput,
    outputs: [
      {
        id: 'note.id',
        label: 'Note ID',
        dataType: 'string',
        sampleValue: 'note_123',
        dataRole: 'runtime',
        warnWhenUnused: false,
        namespace: 'note',
      },
      {
        id: 'note.body',
        label: 'Note Body',
        dataType: 'string',
        sampleValue: 'Follow-up context',
        dataRole: 'business',
        namespace: 'note',
      },
    ],
    configFields: [
      textareaField(
        'note',
        'Note',
        true,
        'Add context for the team.',
        undefined,
        'Note',
        {
          semanticType: 'taskDescription',
          suggestionMode: 'presetsAndWorkflowData',
        },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'note', color: 'slate', builderNodeType: 'crm-action' },
  }),
  defineNode({
    id: 'crm.action',
    type: 'crm-action',
    label: 'CRM Action',
    category: 'Business / CRM',
    description:
      'Create, update, or enrich CRM records through a configured integration.',
    iconKey: 'database-zap',
    planRequirement: 'elite',
    configPanel: 'crm-action',
    inputs: objectInput,
    outputs: [
      {
        id: 'record.id',
        label: 'Record ID',
        dataType: 'string',
        sampleValue: 'crm_12345',
        dataRole: 'runtime',
        warnWhenUnused: false,
        namespace: 'crm',
      },
      {
        id: 'record.status',
        label: 'Record Status',
        dataType: 'string',
        sampleValue: 'Updated',
        dataRole: 'business',
        namespace: 'crm',
      },
    ],
    configFields: [
      selectField(
        'objectType',
        'Object type',
        ['contact', 'company', 'deal', 'task', 'note'],
        'contact',
        'CRM',
        'CRM object that receives this action.',
      ),
      selectField(
        'action',
        'Action',
        ['contact.update', 'deal.update', 'task.create', 'note.add'],
        'contact.update',
        'CRM',
        'Preview CRM operation. Real execution connects later.',
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: {
      icon: 'database-zap',
      color: 'purple',
      builderNodeType: 'crm-action',
    },
  }),
  defineNode({
    id: 'send.email',
    type: 'webhook',
    label: 'Send Email',
    category: 'Communication',
    description: 'Preview an email delivery step. Real sending connects later.',
    iconKey: 'mail',
    configPanel: 'email',
    inputs: [
      {
        id: 'recipient',
        label: 'Recipient',
        dataType: 'string',
        required: true,
      },
    ],
    outputs: emailOutputs,
    configFields: [
      {
        ...textField(
          'recipient',
          'Recipient',
          true,
          '{{client.email}}',
          'Email address or variable placeholder.',
          'Message',
          {
            semanticType: 'emailAddress',
            suggestionMode: 'presetsAndWorkflowData',
            repairGroup: 'emailMessage',
          },
        ),
        acceptedTypes: ['email'],
        supportsVariables: true,
        allowsMixedText: false,
        mappingLabel: 'Recipient Email',
      },
      textField(
        'from',
        'From',
        false,
        'Workspace default',
        'Uses the workspace sender until email providers connect.',
        'Message',
        {
          semanticType: 'emailAddress',
          suggestionMode: 'presets',
          repairGroup: 'emailMessage',
        },
      ),
      textField('cc', 'CC', false, '{{owner.email}}', undefined, 'Message', {
        semanticType: 'emailAddress',
        suggestionMode: 'presetsAndWorkflowData',
        repairGroup: 'emailMessage',
      }),
      {
        ...textField(
          'subject',
          'Subject',
          true,
          'Quick follow-up',
          undefined,
          'Message',
          {
            semanticType: 'messageSubject',
            suggestionMode: 'presetsAndWorkflowData',
            repairGroup: 'emailMessage',
          },
        ),
        acceptedTypes: [
          'string',
          'email',
          'phone',
          'number',
          'date',
          'datetime',
        ],
        supportsVariables: true,
        allowsMixedText: true,
      },
      {
        ...textareaField(
          'body',
          'Body',
          true,
          'Hi {{client.name}},',
          undefined,
          'Message',
          {
            semanticType: 'messageBody',
            suggestionMode: 'presetsAndWorkflowData',
            preferredVariableGroups: [
              'client',
              'lead',
              'customer',
              'company',
              'service',
              'appointment',
            ],
            excludedVariableGroups: ['workspace.email', 'owner.email'],
            repairGroup: 'emailMessage',
          },
        ),
        acceptedTypes: [
          'string',
          'email',
          'phone',
          'number',
          'date',
          'datetime',
        ],
        supportsVariables: true,
        allowsMixedText: true,
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'mail', color: 'blue', builderNodeType: 'webhook' },
  }),
  defineNode({
    id: 'send.sms',
    type: 'webhook',
    label: 'Send SMS',
    category: 'Communication',
    description: 'Preview an SMS delivery step. Real sending connects later.',
    iconKey: 'message',
    configPanel: 'sms',
    inputs: [
      { id: 'phone', label: 'Phone', dataType: 'string', required: true },
    ],
    outputs: smsOutputs,
    configFields: [
      {
        ...textField(
          'phone',
          'Phone',
          true,
          '{{client.phone}}',
          'Phone number or variable placeholder.',
          'Message',
          {
            semanticType: 'phoneNumber',
            suggestionMode: 'presetsAndWorkflowData',
            repairGroup: 'smsMessage',
          },
        ),
        acceptedTypes: ['phone'],
        supportsVariables: true,
        allowsMixedText: false,
        mappingLabel: 'Recipient Phone',
      },
      {
        ...textareaField(
          'message',
          'Message',
          true,
          'Hi {{client.name}},',
          undefined,
          'Message',
          {
            semanticType: 'messageBody',
            suggestionMode: 'presetsAndWorkflowData',
            preferredVariableGroups: [
              'client',
              'lead',
              'customer',
              'company',
              'service',
              'appointment',
            ],
            excludedVariableGroups: ['workspace.email', 'owner.email'],
            repairGroup: 'smsMessage',
          },
        ),
        acceptedTypes: [
          'string',
          'email',
          'phone',
          'number',
          'date',
          'datetime',
        ],
        supportsVariables: true,
        allowsMixedText: true,
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'message', color: 'cyan', builderNodeType: 'webhook' },
  }),
  defineNode({
    id: 'condition.branch',
    type: 'or-path',
    label: 'Condition / Branch',
    category: 'Logic',
    description: 'Route records into separate paths based on business rules.',
    iconKey: 'branch',
    configPanel: 'condition',
    inputs: [{ id: 'input', label: 'Input', dataType: 'any', required: true }],
    outputs: [
      { id: 'match', label: 'Matches', dataType: 'boolean', sampleValue: true },
      {
        id: 'fallback',
        label: 'Otherwise',
        dataType: 'boolean',
        sampleValue: false,
      },
      {
        id: 'branch',
        label: 'Branch',
        dataType: 'string',
        sampleValue: 'true',
      },
      {
        id: 'evaluatedAt',
        label: 'Evaluated at',
        dataType: 'datetime',
        sampleValue: '2026-07-10T14:00:00Z',
      },
    ],
    acceptsMultipleOutputs: true,
    allowsMultipleOutgoing: true,
    branchHandles: ['match', 'fallback'],
    requiredBranchHandles: ['match', 'fallback'],
    branchRole: 'condition',
    branchMode: 'exclusive',
    outputCardinality: 'single',
    executionMode: 'sequential',
    mergeBehavior: 'implicit',
    requiresConfiguredBranch: true,
    defaultPath: 'match',
    fallbackPath: 'fallback',
    branchPaths: [
      {
        pathKey: 'match',
        pathLabel: 'Matches',
        sourceHandle: 'match',
        handleAliases: ['matched'],
        order: 0,
        conditionField: 'condition',
        required: true,
      },
      {
        pathKey: 'fallback',
        pathLabel: 'Otherwise',
        sourceHandle: 'fallback',
        handleAliases: ['unmatched'],
        order: 1,
        conditionField: 'condition',
        isFallback: true,
        required: true,
      },
    ],
    configFields: [
      {
        id: 'condition',
        label: 'Condition builder',
        type: 'code',
        required: false,
        placeholder: 'client.health == "At Risk"',
        helpText:
          'Placeholder condition builder. Visual rule editing connects later.',
        group: 'Logic',
        semanticType: 'conditionField',
        suggestionMode: 'structured',
        conditionBuilder: { enabled: true },
        repairGroup: 'conditionBuilder',
      },
    ],
    validate: (config) => {
      const messages = []
      if (!String(config.condition ?? '').trim()) {
        messages.push({
          field: 'condition',
          severity: 'warning' as const,
          message: 'Choose a field, condition, and value for this branch.',
        })
      }
      return { status: messages.length ? 'warning' : 'ready', messages }
    },
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'branch', color: 'amber', builderNodeType: 'or-path' },
  }),
  defineNode({
    id: 'or.path',
    type: 'or-path',
    label: 'OR Path',
    category: 'Logic',
    description:
      'Route runs into alternate paths when any condition can match.',
    iconKey: 'split',
    configPanel: 'condition',
    inputs: commonInput,
    outputs: [
      { id: 'path_a', label: 'Path A', dataType: 'any' },
      { id: 'path_b', label: 'Path B', dataType: 'any' },
    ],
    acceptsMultipleOutputs: true,
    allowsMultipleOutgoing: true,
    branchHandles: ['path_a', 'path_b'],
    requiredBranchHandles: ['path_a', 'path_b'],
    branchRole: 'router',
    branchMode: 'first-match',
    outputCardinality: 'single',
    executionMode: 'sequential',
    mergeBehavior: 'implicit',
    requiresConfiguredBranch: true,
    branchPaths: [
      {
        pathKey: 'path_a',
        pathLabel: 'Path A',
        sourceHandle: 'path_a',
        order: 0,
        conditionField: 'conditions',
        required: true,
      },
      {
        pathKey: 'path_b',
        pathLabel: 'Path B',
        sourceHandle: 'path_b',
        order: 1,
        conditionField: 'conditions',
        required: true,
      },
    ],
    configFields: [
      {
        ...textareaField(
          'conditions',
          'Path conditions',
          false,
          'Path A when...',
          undefined,
          'Logic',
        ),
        type: 'code',
        semanticType: 'conditionField',
        suggestionMode: 'structured',
        conditionBuilder: { enabled: true },
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'split', color: 'amber', builderNodeType: 'or-path' },
  }),
  defineNode({
    id: 'wait.delay',
    type: 'delay',
    label: 'Wait / Delay',
    category: 'Logic',
    description: 'Pause workflow execution before continuing.',
    iconKey: 'clock',
    configPanel: 'delay',
    inputs: commonInput,
    outputs: delayOutputs,
    terminalCapable: true,
    requiresOutgoingConnection: false,
    configFields: [
      {
        id: 'duration',
        label: 'Duration',
        type: 'number',
        required: true,
        defaultValue: 30,
        min: 1,
        step: 1,
        group: 'Timing',
        placeholder: '30',
        helpText: 'Enter how many units to wait.',
        acceptedTypes: ['number'],
        supportsVariables: true,
        allowsMixedText: false,
        semanticType: 'duration',
        suggestionMode: 'workflowData',
        requiredMessage: 'Enter a duration greater than 0.',
        repairGroup: 'delayConfiguration',
      },
      {
        ...selectField(
          'unit',
          'Unit',
          ['seconds', 'minutes', 'hours', 'days'],
          'minutes',
          'Timing',
          'Choose seconds, minutes, hours, or days.',
          {
            semanticType: 'durationUnit',
            suggestionMode: 'presets',
            repairGroup: 'delayConfiguration',
          },
        ),
        required: true,
        acceptedTypes: ['string'],
        supportsVariables: true,
        allowsMixedText: false,
        requiredMessage: 'Choose seconds, minutes, hours, or days.',
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'clock', color: 'slate', builderNodeType: 'delay' },
  }),
  defineNode({
    id: 'ai.generate_response',
    type: 'ai-llm',
    label: 'AI Reply',
    category: 'AI',
    description:
      'Draft a response with workspace context. Requires user review later.',
    iconKey: 'sparkles',
    planRequirement: 'pro',
    configPanel: 'ai-prompt',
    inputs: [{ id: 'context', label: 'Context', dataType: 'object' }],
    outputs: aiReplyOutputs,
    configFields: [
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'ai-prompt',
        required: true,
        defaultValue:
          'Draft a helpful reply using {{client.name}} and the latest record details.',
        placeholder: 'Draft a helpful response using {{client.name}}.',
        group: 'AI',
        helpText: 'Use variables like {{lead.message}} to include record data.',
        requiredMessage: 'Enter instructions for what the AI should do.',
        semanticType: 'messageBody',
        suggestionMode: 'presetsAndWorkflowData',
        preferredVariableGroups: ['client', 'lead', 'customer', 'company'],
        repairGroup: 'aiPrompt',
      },
      selectField(
        'tone',
        'Tone',
        ['Professional', 'Friendly', 'Sales', 'Support', 'Custom'],
        'Professional',
        'AI',
        'Preview-only tone guidance for the generated reply.',
      ),
      textField('model', 'Model', false, 'gpt-4.1-mini', undefined, 'AI', {
        suggestionMode: 'none',
      }),
      aiTemperatureField(),
      numberField('topP', 'Top P', 1, 'Advanced', {
        min: 0,
        max: 1,
        step: 0.05,
        helpText: 'Limits token sampling breadth for preview configuration.',
      }),
      numberField('maxTokens', 'Max tokens', 800, 'Advanced', {
        min: 1,
        step: 1,
        helpText: 'Preview response length limit.',
      }),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'sparkles', color: 'purple', builderNodeType: 'ai-llm' },
  }),
  defineNode({
    id: 'ai.llm',
    type: 'ai-llm',
    label: 'AI LLM',
    category: 'AI',
    description: 'Call an LLM to generate or transform text using a prompt.',
    iconKey: 'bot',
    planRequirement: 'pro',
    configPanel: 'ai-prompt',
    inputs: commonInput,
    outputs: aiReplyOutputs,
    configFields: [
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'ai-prompt',
        required: true,
        defaultValue:
          'Analyze the incoming record and return the requested output.',
        placeholder: 'Analyze this record and produce...',
        group: 'AI',
        helpText: 'Use variables like {{lead.message}} to include record data.',
        requiredMessage: 'Enter instructions for what the AI should do.',
        semanticType: 'messageBody',
        suggestionMode: 'presetsAndWorkflowData',
        preferredVariableGroups: ['client', 'lead', 'customer', 'company'],
        repairGroup: 'aiPrompt',
      },
      textField('model', 'Model', true, 'gpt-4.1-mini', undefined, 'AI', {
        suggestionMode: 'none',
      }),
      selectField(
        'outputFormat',
        'Output format',
        ['Text', 'Markdown', 'JSON', 'HTML'],
        'Text',
        'AI',
        'Preview-only format guidance for downstream nodes.',
        { suggestionMode: 'presets' },
      ),
      aiTemperatureField(),
      numberField('topP', 'Top P', 1, 'Advanced', {
        min: 0,
        max: 1,
        step: 0.05,
        helpText: 'Limits token sampling breadth for preview configuration.',
      }),
      numberField('frequencyPenalty', 'Frequency penalty', 0, 'Advanced', {
        min: -2,
        max: 2,
        step: 0.1,
        helpText: 'Discourages repeated wording in preview output.',
      }),
      numberField('presencePenalty', 'Presence penalty', 0, 'Advanced', {
        min: -2,
        max: 2,
        step: 0.1,
        helpText: 'Encourages new topics in preview output.',
      }),
      numberField('maxTokens', 'Max tokens', 800, 'Advanced', {
        min: 1,
        step: 1,
        helpText: 'Preview response length limit.',
      }),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'bot', color: 'purple', builderNodeType: 'ai-llm' },
  }),
  defineNode({
    id: 'ai.classifier',
    type: 'ai-classifier',
    label: 'AI Classifier',
    category: 'AI',
    description: 'Classify events or messages into configured categories.',
    iconKey: 'tags',
    planRequirement: 'pro',
    inputs: commonInput,
    outputs: [
      {
        id: 'classification.category',
        label: 'Category',
        dataType: 'string',
        sampleValue: 'Qualified Lead',
      },
      {
        id: 'classification.confidence',
        label: 'Confidence',
        dataType: 'number',
        sampleValue: 0.91,
      },
      {
        id: 'classification.fallback',
        label: 'Fallback used',
        dataType: 'boolean',
        sampleValue: false,
      },
    ],
    configFields: [
      {
        id: 'categories',
        label: 'Categories',
        type: 'multi-select',
        required: true,
        defaultValue: ['Lead', 'Customer', 'Needs Review'],
        placeholder: 'Lead, Customer, Needs Review',
        group: 'AI',
        helpText:
          'Add category labels separated by commas. Each label appears as an editable chip.',
        requiredMessage: 'Add at least one classifier category.',
      },
      textField(
        'fallbackCategory',
        'Fallback category',
        false,
        'Needs Review',
        'Used when the classifier is not confident enough in preview.',
        'AI',
        { semanticType: 'priority', suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'tags', color: 'purple', builderNodeType: 'ai-classifier' },
  }),
  defineNode({
    id: 'ai.splitter',
    type: 'ai-splitter',
    label: 'AI Splitter',
    category: 'AI',
    description: 'Extract structured fields from unstructured text.',
    iconKey: 'split-square',
    planRequirement: 'pro',
    inputs: commonInput,
    outputs: [
      {
        id: 'fields.name',
        label: 'Name',
        dataType: 'string',
        sampleValue: 'John Rivera',
      },
      {
        id: 'fields.email',
        label: 'Email',
        dataType: 'email',
        sampleValue: 'john@example.com',
      },
      {
        id: 'fields.phone',
        label: 'Phone',
        dataType: 'phone',
        sampleValue: '+1 555 555 5555',
      },
      {
        id: 'fields.company',
        label: 'Company',
        dataType: 'string',
        sampleValue: 'Skillify',
      },
    ],
    acceptsMultipleOutputs: true,
    allowsMultipleOutgoing: true,
    branchRole: 'splitter',
    branchMode: 'multi-match',
    outputCardinality: 'multiple',
    executionMode: 'parallel',
    mergeBehavior: 'implicit',
    requiresConfiguredBranch: true,
    branchHandles: [
      'fields.name',
      'fields.email',
      'fields.phone',
      'fields.company',
    ],
    optionalBranchHandles: [
      'fields.name',
      'fields.email',
      'fields.phone',
      'fields.company',
    ],
    branchPaths: [
      {
        pathKey: 'fields.name',
        pathLabel: 'Name',
        sourceHandle: 'fields.name',
        order: 0,
      },
      {
        pathKey: 'fields.email',
        pathLabel: 'Email',
        sourceHandle: 'fields.email',
        order: 1,
      },
      {
        pathKey: 'fields.phone',
        pathLabel: 'Phone',
        sourceHandle: 'fields.phone',
        order: 2,
      },
      {
        pathKey: 'fields.company',
        pathLabel: 'Company',
        sourceHandle: 'fields.company',
        order: 3,
      },
    ],
    configFields: [
      {
        id: 'schemaHint',
        label: 'Fields to extract',
        type: 'json',
        required: true,
        defaultValue:
          '{ "name": "string", "email": "string", "phone": "string", "company": "string" }',
        placeholder: '{ "email": "string" }',
        group: 'AI',
        helpText:
          'Use Build schema or start with example fields like Name, Email, Phone, and Company.',
        requiredMessage: 'Choose at least one field to extract.',
        schemaChips: [
          { label: 'Name', key: 'name', type: 'string' },
          { label: 'Email', key: 'email', type: 'string' },
          { label: 'Phone', key: 'phone', type: 'string' },
          { label: 'Company', key: 'company', type: 'string' },
        ],
        schemaPresets: [
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
        ],
        semanticType: 'schema',
        suggestionMode: 'structured',
        repairGroup: 'aiSchema',
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: {
      icon: 'split-square',
      color: 'purple',
      builderNodeType: 'ai-splitter',
    },
  }),
  defineNode({
    id: 'ai.transform',
    type: 'ai-transform',
    label: 'AI Transform',
    category: 'AI',
    description: 'Transform JSON with schema-bound output.',
    iconKey: 'wand',
    planRequirement: 'elite',
    inputs: commonInput,
    outputs: [
      {
        id: 'output.json',
        label: 'Output JSON',
        dataType: 'object',
        sampleValue: { name: 'John Rivera' },
      },
      {
        id: 'output.text',
        label: 'Output text',
        dataType: 'string',
        sampleValue: 'John Rivera',
      },
    ],
    configFields: [
      {
        id: 'schema',
        label: 'Output fields',
        type: 'json',
        required: true,
        defaultValue:
          '{ "name": "string", "email": "string", "phone": "string", "company": "string" }',
        placeholder: '{ "summary": "string" }',
        group: 'Transform',
        helpText:
          'Use Build schema or start with example fields like Name, Email, Phone, and Company.',
        requiredMessage: 'Choose at least one output field.',
        semanticType: 'schema',
        suggestionMode: 'structured',
        repairGroup: 'aiSchema',
      },
      selectField(
        'outputMode',
        'Output mode',
        ['JSON', 'Text', 'Fields'],
        'JSON',
        'Transform',
        'Choose how downstream steps should read the result.',
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'wand', color: 'purple', builderNodeType: 'ai-transform' },
  }),
  defineNode({
    id: 'ai.decision',
    type: 'ai-decision',
    label: 'AI Decision',
    category: 'AI',
    description: 'Choose among predefined branches with confidence thresholds.',
    iconKey: 'brain-circuit',
    planRequirement: 'elite',
    configPanel: 'ai-prompt',
    inputs: commonInput,
    outputs: [
      {
        id: 'decision.path',
        label: 'Selected path',
        dataType: 'string',
        sampleValue: 'qualified',
      },
      {
        id: 'decision.confidence',
        label: 'Confidence',
        dataType: 'number',
        sampleValue: 0.84,
      },
      {
        id: 'decision.evaluatedAt',
        label: 'Evaluated at',
        dataType: 'datetime',
        sampleValue: '2026-07-10T14:00:00Z',
      },
    ],
    configFields: [
      {
        id: 'instructions',
        label: 'Instructions',
        type: 'ai-prompt',
        required: true,
        defaultValue:
          'Choose the best next path based on the record context and confidence threshold.',
        placeholder: 'Choose the best next path.',
        group: 'Decision',
        helpText:
          'Tell the AI how to choose a branch. Use variables like {{lead.value}}.',
        requiredMessage: 'Enter decision instructions.',
        semanticType: 'messageBody',
        suggestionMode: 'presetsAndWorkflowData',
        repairGroup: 'aiDecision',
      },
      numberField(
        'confidenceThreshold',
        'Confidence threshold',
        0.7,
        'Decision',
        {
          min: 0,
          max: 1,
          step: 0.05,
          helpText:
            'Minimum confidence required before the selected branch is considered usable.',
        },
      ),
      textField(
        'fallbackPath',
        'Fallback path',
        false,
        'Ask human',
        'Used when confidence is below the threshold.',
        'Decision',
        { semanticType: 'nextAction', suggestionMode: 'presets' },
      ),
      toggleField(
        'askHumanFallback',
        'Ask human fallback',
        true,
        'Decision',
        'Preview-only handoff flag for low-confidence decisions.',
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: {
      icon: 'brain-circuit',
      color: 'purple',
      builderNodeType: 'ai-decision',
    },
  }),
  defineNode({
    id: 'webhook.placeholder',
    type: 'webhook',
    label: 'Webhook',
    category: 'Integrations',
    description: 'Preview an outbound webhook call.',
    iconKey: 'webhook',
    configPanel: 'webhook',
    inputs: [{ id: 'payload', label: 'Payload', dataType: 'object' }],
    outputs: webhookOutputs,
    configFields: [
      {
        ...textField(
          'url',
          'URL',
          true,
          'https://example.com/webhook',
          'Endpoint URL. Variables are supported in preview.',
          'Request',
          {
            semanticType: 'url',
            suggestionMode: 'presetsAndWorkflowData',
            repairGroup: 'webhookRequest',
          },
        ),
        acceptedTypes: ['url'],
        supportsVariables: true,
        allowsMixedText: false,
      },
      selectField(
        'method',
        'Method',
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        'POST',
        'Request',
        'HTTP method to preview for this webhook.',
        { suggestionMode: 'presets', repairGroup: 'webhookRequest' },
      ),
      keyValueField('headers', 'Headers', 'Request', {
        repairGroup: 'webhookRequest',
      }),
      selectField(
        'outputMode',
        'Output mode',
        ['JSON', 'Fields'],
        'JSON',
        'Request',
        undefined,
        { suggestionMode: 'presets', repairGroup: 'webhookResponse' },
      ),
      {
        id: 'body',
        label: 'Body',
        type: 'json',
        defaultValue: '{}',
        placeholder: '{ "id": "{{client.id}}" }',
        group: 'Request',
        showWhen: { field: 'outputMode', equals: 'JSON' },
        semanticType: 'json',
        suggestionMode: 'structured',
        repairGroup: 'webhookRequest',
      },
      keyValueField('fieldMappings', 'Fields', 'Request', {
        required: true,
        requiredMessage: 'Add at least one field mapping.',
        helpText:
          'Map output field names to static values or variables like {{client.id}}.',
        showWhen: { field: 'outputMode', equals: 'Fields' },
        repairGroup: 'webhookResponse',
      }),
      numberField('timeoutSeconds', 'Timeout', 30, 'Advanced', {
        min: 1,
        step: 1,
        semanticType: 'duration',
        suggestionMode: 'workflowData',
        helpText: 'Seconds to wait before the preview request would time out.',
      }),
      selectField(
        'retryPolicy',
        'Retry policy',
        ['None', 'Retry once', 'Retry three times'],
        'None',
        'Advanced',
        'Preview retry behavior for future execution.',
        { suggestionMode: 'presets' },
      ),
      selectField(
        'authentication',
        'Authentication',
        ['None', 'Bearer token', 'Basic auth', 'API key'],
        'None',
        'Advanced',
        'Authentication placeholder. No secret storage is connected yet.',
        { suggestionMode: 'presets' },
      ),
      selectField(
        'responseParsing',
        'Response parsing',
        ['JSON', 'Text', 'Headers only'],
        'JSON',
        'Advanced',
        'How the future runtime should expose webhook responses.',
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'webhook', color: 'blue', builderNodeType: 'webhook' },
  }),
  defineNode({
    id: 'group',
    type: 'group',
    label: 'Group',
    category: 'Organization',
    description: 'Visually group related nodes in complex flows.',
    iconKey: 'boxes',
    inputs: [],
    outputs: [],
    configFields: [
      textField(
        'groupName',
        'Group name',
        false,
        'Workflow section',
        'Display name for this group.',
        'Group',
        { semanticType: 'genericText', suggestionMode: 'presets' },
      ),
      textareaField(
        'note',
        'Group note',
        false,
        'Describe what these nodes do together.',
        'Internal note for editors.',
        'Group',
        { semanticType: 'genericText', suggestionMode: 'presets' },
      ),
      toggleField(
        'collapsed',
        'Collapse by default',
        false,
        'Group',
        'Preview-only collapse preference.',
      ),
      selectField(
        'style',
        'Style',
        ['Slate', 'Blue', 'Purple', 'Green', 'Amber'],
        'Slate',
        'Group',
        'Visual style placeholder. Rendering stays unchanged for now.',
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: false,
    ui: { icon: 'boxes', color: 'slate', builderNodeType: 'group' },
  }),
  defineNode({
    id: 'utility.wait.delay',
    type: 'delay',
    label: 'Wait / Delay',
    category: 'Utilities',
    description:
      'Pause workflow execution before continuing. Also available under Logic.',
    iconKey: 'clock',
    configPanel: 'delay',
    inputs: commonInput,
    outputs: delayOutputs,
    configFields: [
      {
        id: 'duration',
        label: 'Duration',
        type: 'number',
        required: true,
        defaultValue: 30,
        min: 1,
        step: 1,
        group: 'Timing',
        placeholder: '30',
        helpText: 'Enter how many units to wait.',
        acceptedTypes: ['number'],
        supportsVariables: true,
        allowsMixedText: false,
        semanticType: 'duration',
        suggestionMode: 'workflowData',
        requiredMessage: 'Enter a duration greater than 0.',
        repairGroup: 'delayConfiguration',
      },
      {
        ...selectField(
          'unit',
          'Unit',
          ['seconds', 'minutes', 'hours', 'days'],
          'minutes',
          'Timing',
          'Choose seconds, minutes, hours, or days.',
          {
            semanticType: 'durationUnit',
            suggestionMode: 'presets',
            repairGroup: 'delayConfiguration',
          },
        ),
        required: true,
        acceptedTypes: ['string'],
        supportsVariables: true,
        allowsMixedText: false,
        requiredMessage: 'Choose seconds, minutes, hours, or days.',
      },
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'clock', color: 'slate', builderNodeType: 'delay' },
  }),
  defineNode({
    id: 'utility.date.formatter',
    type: 'crm-action',
    label: 'Date Formatter',
    category: 'Utilities',
    description:
      'Preview date formatting before passing values to another node.',
    iconKey: 'calendar',
    inputs: commonInput,
    outputs: [{ id: 'date', label: 'Formatted Date', dataType: 'string' }],
    configFields: [
      textField(
        'inputDate',
        'Input date',
        false,
        '{{automation.current_time}}',
        'Date value or variable to format.',
        'Utility',
        {
          semanticType: 'genericText',
          suggestionMode: 'workflowData',
          preferredVariableGroups: ['date', 'time', 'automation'],
        },
      ),
      selectField(
        'format',
        'Format',
        ['MM/DD/YYYY', 'YYYY-MM-DD', 'Month D, YYYY', 'Relative time'],
        'MM/DD/YYYY',
        'Utility',
        'Preview-only output format.',
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'calendar', color: 'slate', builderNodeType: 'crm-action' },
  }),
  defineNode({
    id: 'utility.text.formatter',
    type: 'crm-action',
    label: 'Text Formatter',
    category: 'Utilities',
    description: 'Preview text cleanup, casing, or trimming before continuing.',
    iconKey: 'text',
    inputs: commonInput,
    outputs: [{ id: 'text', label: 'Formatted Text', dataType: 'string' }],
    configFields: [
      textField(
        'inputText',
        'Input text',
        false,
        '{{client.name}}',
        'Text value or variable to format.',
        'Utility',
        { semanticType: 'genericText', suggestionMode: 'workflowData' },
      ),
      selectField(
        'operation',
        'Operation',
        ['Trim', 'Title Case', 'Uppercase', 'Lowercase', 'Slugify'],
        'Trim',
        'Utility',
        'Preview-only text operation.',
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'text', color: 'slate', builderNodeType: 'crm-action' },
  }),
  defineNode({
    id: 'utility.math.calculate',
    type: 'crm-action',
    label: 'Math / Calculate',
    category: 'Utilities',
    description: 'Preview simple calculations for scores, amounts, or offsets.',
    iconKey: 'calculator',
    inputs: commonInput,
    outputs: [{ id: 'value', label: 'Calculated Value', dataType: 'number' }],
    configFields: [
      textField(
        'expression',
        'Expression',
        false,
        '{{lead.value}} * 0.1',
        'Preview-only expression. Real formula execution connects later.',
        'Utility',
        {
          semanticType: 'genericText',
          suggestionMode: 'workflowData',
          preferredVariableGroups: ['number', 'value', 'revenue'],
        },
      ),
      selectField(
        'rounding',
        'Rounding',
        ['None', 'Nearest whole number', 'Two decimals'],
        'Two decimals',
        'Utility',
        undefined,
        { suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'calculator', color: 'slate', builderNodeType: 'crm-action' },
  }),
  defineNode({
    id: 'utility.generate.id',
    type: 'crm-action',
    label: 'Generate ID',
    category: 'Utilities',
    description: 'Preview a unique ID value for downstream mapping.',
    iconKey: 'hash',
    inputs: commonInput,
    outputs: [{ id: 'id', label: 'Generated ID', dataType: 'string' }],
    configFields: [
      selectField(
        'format',
        'ID format',
        ['UUID', 'Short ID', 'Readable ID'],
        'Short ID',
        'Utility',
        'Preview-only ID style.',
        { suggestionMode: 'presets' },
      ),
      textField(
        'prefix',
        'Prefix',
        false,
        'wf',
        'Optional ID prefix.',
        'Utility',
        { semanticType: 'genericText', suggestionMode: 'presets' },
      ),
    ],
    canBeTrigger: false,
    canBeAction: true,
    ui: { icon: 'hash', color: 'slate', builderNodeType: 'crm-action' },
  }),
]

export type WorkflowNodeDefinitionId =
  (typeof workflowNodeRegistry)[number]['id']

const BUILDER_TYPE_FALLBACK_DEFINITION_ID: Partial<
  Record<BuilderNodeType, string>
> = {
  trigger: 'crm.trigger',
  'crm-trigger': 'crm.trigger',
  'crm-action': 'crm.action',
  webhook: 'webhook.placeholder',
  delay: 'wait.delay',
  'or-path': 'condition.branch',
  'ai-llm': 'ai.llm',
  'ai-classifier': 'ai.classifier',
  'ai-splitter': 'ai.splitter',
  'ai-transform': 'ai.transform',
  'ai-decision': 'ai.decision',
  group: 'group',
}

export function getWorkflowNodeDefinition(type: string) {
  const exact = workflowNodeRegistry.find((node) => node.id === type)
  if (exact) return exact

  const fallbackId =
    BUILDER_TYPE_FALLBACK_DEFINITION_ID[type as BuilderNodeType]
  if (fallbackId) {
    return workflowNodeRegistry.find((node) => node.id === fallbackId)
  }

  return workflowNodeRegistry.find((node) => node.type === type)
}

export function getWorkflowNodesByCategory(category: WorkflowNodeCategory) {
  return workflowNodeRegistry.filter((node) => node.category === category)
}

export function searchWorkflowNodes(query: string) {
  return discoverWorkflowNodes(workflowNodeRegistry, {
    query,
    includeUnavailable: true,
  }).map((result) => result.node)
}

export function getTriggerNodes() {
  return workflowNodeRegistry.filter((node) => node.canBeTrigger)
}

export function getActionNodes() {
  return workflowNodeRegistry.filter((node) => node.canBeAction)
}

export function isNodeAllowedForPlan(
  node: WorkflowNodeDefinition,
  plan: PlanId,
) {
  const required = node.planRequirement ?? 'basic'
  const rank: Record<PlanId, number> = { basic: 0, pro: 1, elite: 2 }
  return rank[plan] >= rank[required]
}

export function getWorkflowNodeDefinitionsByCategory() {
  return workflowNodeRegistry.reduce<Record<string, WorkflowNodeDefinition[]>>(
    (groups, definition) => {
      const key = definition.category
      groups[key] = groups[key] ?? []
      groups[key].push(definition)
      return groups
    },
    {},
  )
}

export function getBuilderNodeTypeForDefinition(
  node: WorkflowNodeDefinition,
): BuilderNodeType {
  return (node.ui?.builderNodeType ?? node.type ?? 'unknown') as BuilderNodeType
}

export function validateWorkflowNodeRegistryDiscovery() {
  return validateWorkflowNodeDiscoveryMetadata(workflowNodeRegistry)
}

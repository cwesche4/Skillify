export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'

export type WorkflowRunKind = 'preview' | 'test' | 'live'

export type WorkflowNodeCategory =
  | 'Triggers'
  | 'Scheduling'
  | 'Business / CRM'
  | 'Communication'
  | 'Logic'
  | 'AI'
  | 'Integrations'
  | 'Utilities'
  | 'Organization'

export type WorkflowDiscoveryNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'communication'
  | 'ai'
  | 'integration'
  | 'utility'

export type WorkflowDiscoveryNodeDomain =
  | 'scheduling'
  | 'crm'
  | 'commerce'
  | 'projects'
  | 'tasks'
  | 'clients'
  | 'team'
  | 'inventory'
  | 'finance'
  | 'reports'
  | 'organization'
  | 'general'

export type WorkflowNodeAvailabilityState =
  | 'available'
  | 'requiresConfiguration'
  | 'requiresAuthentication'
  | 'comingSoon'
  | 'unavailableForWorkspace'
  | 'unavailableForPlan'

export type WorkflowNodeDiscoveryMetadata = {
  type: WorkflowDiscoveryNodeType
  domain: WorkflowDiscoveryNodeDomain
  group: string
  aliases?: string[]
  tags?: string[]
  keywords?: string[]
  searchPriority?: number
  isFeatured?: boolean
}

export type WorkflowNodeAvailability = {
  state: WorkflowNodeAvailabilityState
  label?: string
  message?: string
  selectable?: boolean
}

export type WorkflowConnectionRole = 'trigger' | 'action' | 'logic' | 'utility'
export type WorkflowBranchMode =
  | 'exclusive'
  | 'first-match'
  | 'multi-match'
  | 'parallel'
  | 'fallback'
export type WorkflowBranchPathDefinition = {
  pathKey: string
  pathLabel: string
  sourceHandle: string
  handleAliases?: string[]
  order?: number
  conditionField?: string
  isDefault?: boolean
  isFallback?: boolean
  enabled?: boolean
  required?: boolean
}
export type WorkflowValueType =
  | 'any'
  | 'unknown'
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'duration'
  | 'object'
  | 'array'

export type WorkflowNodeConfigPanelId =
  | 'generic'
  | 'webhook'
  | 'email'
  | 'sms'
  | 'crm-action'
  | 'task'
  | 'client-update'
  | 'ai-prompt'
  | 'condition'
  | 'delay'

export type WorkflowFieldSemanticRole =
  | 'email'
  | 'phone'
  | 'personName'
  | 'companyName'
  | 'owner'
  | 'assignee'
  | 'team'
  | 'stage'
  | 'status'
  | 'priority'
  | 'subject'
  | 'title'
  | 'message'
  | 'description'
  | 'note'
  | 'address'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'currency'
  | 'boolean'
  | 'enum'
  | 'conditionField'
  | 'conditionOperator'
  | 'conditionValue'
  | 'schema'
  | 'payload'
  | 'identifier'
  | 'technical'
  | 'genericText'

export type WorkflowPort = {
  id: string
  label: string
  dataType: WorkflowValueType
  required?: boolean
  description?: string
  sampleValue?: unknown
  nullable?: boolean
  itemType?: WorkflowValueType
  dataRole?: 'business' | 'runtime' | 'technical'
  warnWhenUnused?: boolean
  importance?: 'low' | 'normal' | 'high'
  namespace?: string
  writePath?: string
}

export type NodeConfigField = {
  id: string
  label: string
  key?: string
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'boolean'
    | 'toggle'
    | 'multi-select'
    | 'key-value'
    | 'variable'
    | 'json'
    | 'code'
    | 'ai-prompt'
  required?: boolean
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  group?: string
  helpText?: string
  requiredMessage?: string
  repairGroup?: string
  acceptedTypes?: WorkflowValueType[]
  supportsVariables?: boolean
  allowsMixedText?: boolean
  mappingLabel?: string
  semanticRole?: WorkflowFieldSemanticRole
  semanticType?:
    | 'emailAddress'
    | 'phoneNumber'
    | 'messageBody'
    | 'messageSubject'
    | 'taskTitle'
    | 'taskDescription'
    | 'stage'
    | 'healthStatus'
    | 'priority'
    | 'nextAction'
    | 'owner'
    | 'assignee'
    | 'conditionField'
    | 'conditionValue'
    | 'duration'
    | 'durationUnit'
    | 'schema'
    | 'url'
    | 'json'
    | 'genericText'
  suggestionMode?:
    | 'none'
    | 'presets'
    | 'workflowData'
    | 'presetsAndWorkflowData'
    | 'structured'
  presetGroup?: string
  suggestionCategories?: string[]
  includeTechnicalSuggestions?: boolean
  preferredVariableKinds?: string[]
  inputControl?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'entity-select'
    | 'number'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'schema'
    | 'technical'
  displayMode?: 'friendly' | 'technical'
  storesReference?: boolean
  conditionCapable?: boolean
  allowedOperators?: string[]
  valueControl?:
    | 'input'
    | 'select'
    | 'entity-select'
    | 'number'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'none'
  emptyValueAllowed?: boolean
  allowedEntityTypes?: string[]
  optionSource?: string
  workspaceOptionCategory?: string
  storedValue?: 'id' | 'value' | 'label'
  supportsPreviewOverride?: boolean
  allowedVariableScopes?: string[]
  preferredVariableGroups?: string[]
  excludedVariableGroups?: string[]
  example?: unknown
  suggestions?: string[]
  schemaPresets?: Array<{
    label: string
    schema: Record<string, string>
  }>
  schemaChips?: Array<{
    label: string
    key: string
    type: string
  }>
  conditionBuilder?: {
    enabled: boolean
  }
  min?: number
  max?: number
  step?: number
  showWhen?: {
    field: string
    equals: string | number | boolean
  }
}

export type NodeConfig = Record<string, unknown>

export type WorkflowTrigger = {
  id: string
  event: string
  source: 'manual' | 'crm' | 'schedule' | 'webhook' | 'system'
  config?: NodeConfig
}

export type WorkflowNode = {
  id: string
  type: string
  label: string
  config: NodeConfig
  position?: { x: number; y: number }
  disabled?: boolean
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export type Workflow = {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger?: WorkflowTrigger
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt?: string
  updatedAt?: string
}

export type WorkflowValidationIssue = {
  id: string
  severity: 'error' | 'warning'
  code:
    | 'missing-trigger'
    | 'missing-config'
    | 'invalid-edge'
    | 'unknown-node'
    | 'unreachable-node'
    | 'cycle'
    | 'missing-input'
  message: string
  nodeId?: string
  edgeId?: string
}

export type WorkflowValidationResult = {
  ok: boolean
  issues: WorkflowValidationIssue[]
}

export type WorkflowExecutionLog = {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  nodeId?: string
  issueId?: string
}

export type WorkflowExecutionStep = {
  id: string
  runId: string
  nodeId: string
  nodeType: string
  label: string
  status: WorkflowRunStatus
  startedAt?: string
  finishedAt?: string
  logs: WorkflowExecutionLog[]
  error?: string
  output?: Record<string, unknown>
}

export type WorkflowExecution = {
  id: string
  workflowId: string
  workspaceId: string
  status: WorkflowRunStatus
  triggerSource: string
  startedAt: string
  finishedAt?: string
  steps: WorkflowExecutionStep[]
  logs: WorkflowExecutionLog[]
  error?: string
  mode?: 'preview' | 'production'
  runKind?: WorkflowRunKind
  workflowFingerprint?: string
  graph?: unknown
  context?: unknown
  validation?: {
    status: 'passed' | 'passed-with-warnings' | 'blocked'
    readinessState:
      | 'ready'
      | 'ready-with-warnings'
      | 'needs-attention'
      | 'cannot-publish'
    readinessLabel: string
    errorCount: number
    warningCount: number
    infoCount: number
    issueIds: string[]
    blockingIssueIds: string[]
  }
  summary?: {
    workflow: string
    completed: number
    failed: number
    skipped: number
    executionTimeMs: number
    variablesCreated: number
    variablesUsed: number
    nodesExecuted: number
    warnings: number
    errors: number
    branchCount: number
    estimatedRuntimeMs: number
    selectedPaths?: number
    skippedPaths?: number
    fallbackPathsUsed?: number
  }
  replay?: {
    timestamp: string
    workflowVersion: string
    executionGraph: unknown
    variables: Record<string, unknown>
    logs: WorkflowExecutionLog[]
    outputs: Record<string, Record<string, unknown>>
  }
}

export type WorkflowExecutionContext = {
  workspaceId: string
  triggerEvent?: string
  input?: Record<string, unknown>
}

export type WorkflowNodeExecutionHandler = (
  node: WorkflowNode,
  context: WorkflowExecutionContext,
) => Promise<Record<string, unknown>> | Record<string, unknown>

export type WorkflowNodeDefinition = {
  id: string
  type?: string
  label: string
  category: WorkflowNodeCategory
  description: string
  iconKey?: string
  planRequirement?: 'basic' | 'pro' | 'elite'
  inputs: WorkflowPort[]
  outputs: WorkflowPort[]
  configFields: NodeConfigField[]
  discovery?: WorkflowNodeDiscoveryMetadata
  availability?: WorkflowNodeAvailability
  configPanel?: WorkflowNodeConfigPanelId
  configurationSchema?: Record<string, unknown>
  validation?: {
    placeholder: true
    description: string
  }
  validate?: (config: NodeConfig) => {
    status: 'ready' | 'warning' | 'error'
    messages: Array<{
      field?: string
      severity: 'warning' | 'error'
      message: string
    }>
  }
  execution?: {
    placeholder: true
    description: string
  }
  aiDescription?: string
  documentation?: string
  canBeTrigger?: boolean
  canBeAction?: boolean
  connectionRole?: WorkflowConnectionRole
  allowedInputs?: WorkflowConnectionRole[]
  allowedOutputs?: WorkflowConnectionRole[]
  acceptsMultipleInputs?: boolean
  acceptsMultipleOutputs?: boolean
  terminalCapable?: boolean
  requiresOutgoingConnection?: boolean
  allowsMultipleOutgoing?: boolean
  maxOutgoingConnections?: number
  branchHandles?: string[]
  requiredBranchHandles?: string[]
  optionalBranchHandles?: string[]
  branchRole?:
    | 'condition'
    | 'router'
    | 'splitter'
    | 'fallback'
    | 'approval'
    | 'merge'
  branchMode?: WorkflowBranchMode
  branchPaths?: WorkflowBranchPathDefinition[]
  defaultPath?: string
  fallbackPath?: string
  outputCardinality?: 'single' | 'multiple' | 'all'
  executionMode?: 'sequential' | 'parallel'
  mergeBehavior?: 'none' | 'implicit' | 'explicit' | 'unsupported'
  requiresConfiguredBranch?: boolean
  maxIncomingConnections?: number
  trigger?: boolean
  action?: boolean
  logic?: boolean
  utility?: boolean
  allowLoop?: boolean
  ui?: {
    icon?: string
    color?: 'blue' | 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate'
    builderNodeType?:
      | 'trigger'
      | 'delay'
      | 'webhook'
      | 'crm-trigger'
      | 'crm-action'
      | 'ai-llm'
      | 'ai-classifier'
      | 'ai-decision'
      | 'ai-transform'
      | 'ai-splitter'
      | 'or-path'
      | 'group'
  }
  executePreview?: WorkflowNodeExecutionHandler
}

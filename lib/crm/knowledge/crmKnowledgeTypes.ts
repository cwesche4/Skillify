export type CRMKnowledgeRecordSource =
  | 'authoritative'
  | 'preview'
  | 'demo'
  | 'fixture'
  | 'unknown'

export type CRMKnowledgeWorkspace = {
  id: string
  slug?: string
  name?: string
  timezone: string
  businessModel?: string
}

export type CRMKnowledgeActor = {
  userId?: string
  workspaceMemberId?: string
  role?: string
  permissions: string[]
}

export type CRMKnowledgeContextRequest =
  | 'dashboard'
  | 'leadPrioritization'
  | 'followUp'
  | 'opportunityPipeline'
  | 'clientContext'
  | 'dataQuality'
  | 'general'

export type CRMLeadKnowledgeRecord = {
  id: string
  workspaceId: string
  name: string
  company?: string
  contactEmail?: string
  contactPhone?: string
  status?: string
  stage?: string
  source?: string
  value?: number
  ownerId?: string
  ownerName?: string
  createdAt?: string
  updatedAt?: string
  lastActivityAt?: string
  followUpDue?: string
  nextStep?: string
  notes?: string
  converted?: boolean
  convertedAt?: string
  convertedDestination?: string
  connectedRecordId?: string
  connectedRecordType?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMFollowUpKnowledgeRecord = {
  id: string
  workspaceId: string
  leadId: string
  ownerId?: string
  dueAt?: string
  completedAt?: string
  channel?: string
  outcome?: string
  nextAction?: string
  nextFollowUpDate?: string
  notes?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMOpportunityKnowledgeRecord = {
  id: string
  workspaceId: string
  name: string
  client?: string
  company?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  status?: string
  stage?: string
  value?: number
  probability?: number
  expectedRevenue?: number
  ownerId?: string
  ownerName?: string
  nextStep?: string
  lastActivityAt?: string
  createdAt?: string
  updatedAt?: string
  convertedAt?: string
  expectedCloseDate?: string
  leadId?: string
  sourceLeadId?: string
  clientId?: string
  saleId?: string
  riskReason?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMClientKnowledgeRecord = {
  id: string
  workspaceId: string
  name: string
  company?: string
  email?: string
  phone?: string
  status?: string
  pipelineStage?: string
  health?: string
  value?: number
  ownerId?: string
  ownerName?: string
  createdAt?: string
  updatedAt?: string
  lastActivity?: string
  nextAction?: string
  openTasks?: number
  openServiceRequests?: number
  sourceLeadId?: string
  sourceOpportunityId?: string
  sourceSaleId?: string
  tags?: string[]
  provenance?: CRMKnowledgeRecordSource
}

export type CRMTaskKnowledgeRecord = {
  id: string
  workspaceId: string
  title: string
  status?: string
  priority?: string
  dueDate?: string
  ownerId?: string
  assignedOwner?: string
  relatedRecordId?: string
  relatedRecordType?: string
  relatedRecordLabel?: string
  createdAt?: string
  completedAt?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMActivityKnowledgeRecord = {
  id: string
  workspaceId: string
  recordId?: string
  recordType?: CRMEntityType
  title: string
  timestamp?: string
  ownerId?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMMeetingKnowledgeRecord = {
  id: string
  workspaceId: string
  title: string
  startsAt?: string
  endsAt?: string
  ownerId?: string
  assignedMemberIds?: string[]
  linkedRecordId?: string
  linkedRecordType?: CRMEntityType
  status?: string
  provenance?: CRMKnowledgeRecordSource
}

export type CRMKnowledgeThresholds = {
  staleLeadDays: number
  staleOpportunityDays: number
  dueSoonDays: number
  highValueLeadThreshold: number
  highValueOpportunityThreshold: number
  sourcePerformanceMinimumSample: number
  maxRecommendations: number
}

export type CRMKnowledgeSource = {
  workspace: CRMKnowledgeWorkspace
  actor: CRMKnowledgeActor
  now: Date | string
  context?: CRMKnowledgeContextRequest
  thresholds?: Partial<CRMKnowledgeThresholds>
  leads?: CRMLeadKnowledgeRecord[]
  followUps?: CRMFollowUpKnowledgeRecord[]
  opportunities?: CRMOpportunityKnowledgeRecord[]
  clients?: CRMClientKnowledgeRecord[]
  tasks?: CRMTaskKnowledgeRecord[]
  activities?: CRMActivityKnowledgeRecord[]
  meetings?: CRMMeetingKnowledgeRecord[]
}

export type CRMEntityType =
  | 'lead'
  | 'opportunity'
  | 'client'
  | 'task'
  | 'activity'
  | 'meeting'
  | 'pipeline'
  | 'followUp'

export type CRMReference = {
  id: string
  workspaceId: string
  entityType: CRMEntityType
  entityId: string
  label: string
  safeSummary: string
  timestamp?: string
  source: CRMKnowledgeRecordSource
  metadata?: Record<string, string | number | boolean | null>
}

export type CRMDataQualityFinding = {
  id: string
  severity: 'info' | 'warning' | 'blocking'
  category:
    | 'permission'
    | 'workspaceScope'
    | 'missingOwner'
    | 'missingContact'
    | 'missingNextStep'
    | 'invalidDate'
    | 'orphanedRelationship'
    | 'inconsistentLifecycle'
    | 'dataLimitation'
  recordType?: CRMEntityType
  recordId?: string
  explanation: string
  suggestedCorrection: string
  referenceId?: string
}

export type CRMRisk = {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recordType: CRMEntityType
  recordId: string
  title: string
  explanation: string
  score: number
  referenceIds: string[]
}

export type CRMRecommendationUrgency = 'low' | 'medium' | 'high' | 'critical'

export type CRMRecommendation = {
  id: string
  type:
    | 'crm.followUpLead'
    | 'crm.assignOwner'
    | 'crm.completeContact'
    | 'crm.addNextStep'
    | 'crm.convertQualifiedLead'
    | 'crm.reviewStaleRecord'
    | 'crm.updateOpportunityCloseDate'
    | 'crm.reviewPipelineRisk'
  targetRecordType: CRMEntityType
  targetRecordId: string
  targetLabel: string
  title: string
  summary: string
  urgency: CRMRecommendationUrgency
  score: number
  confidence: 'low' | 'medium' | 'high'
  reasonCodes: string[]
  supportingFacts: string[]
  references: CRMReference[]
  warnings: CRMDataQualityFinding[]
  suggestedAction: {
    type: string
    approvalRequired: true
    executionStatus: 'notStarted'
  }
  deterministic: true
  source: {
    provider: 'crm'
    engine: 'CRM Knowledge Provider'
    version: 'foundation'
    scoreScale: '0-100'
  }
}

export type CRMLeadFacts = {
  total: number
  active: number
  converted: number
  disqualified: number
  overdueFollowUps: number
  dueTodayFollowUps: number
  dueSoonFollowUps: number
  missingOwner: number
  missingContact: number
  missingNextStep: number
  stale: number
  highValue: number
  totalActiveValue: number
  averageActiveLeadAgeDays: number
  byStatus: Record<string, number>
  byStage: Record<string, number>
  bySource: Record<string, number>
  byOwner: Record<string, number>
}

export type CRMOpportunityFacts = {
  total: number
  open: number
  won: number
  lost: number
  atRisk: number
  stale: number
  missingOwner: number
  missingNextStep: number
  overdueCloseDate: number
  pipelineValue: number
  weightedExpectedRevenue: number
  atRiskValue: number
  stalledValue: number
  unassignedValue: number
  overdueCloseValue: number
  byStage: Record<string, { count: number; value: number }>
  byOwner: Record<string, { count: number; value: number }>
}

export type CRMPipelineFacts = {
  stageCount: number
  topStageByValue: string | null
  topStageShare: number
  concentrationRisk: 'low' | 'medium' | 'high'
  bottlenecks: Array<{
    stage: string
    count: number
    value: number
    reason: string
  }>
  topDeals: Array<{
    id: string
    label: string
    value: number
    stage: string
    score: number
  }>
}

export type CRMClientFacts = {
  total: number
  active: number
  inactive: number
  newLast30Days: number
  missingOwner: number
  missingContact: number
  openTasks: number
  openServiceRequests: number
  linkedFromLeads: number
  linkedFromOpportunities: number
  byStatus: Record<string, number>
  byHealth: Record<string, number>
}

export type CRMFollowUpFacts = {
  total: number
  completed: number
  overdue: number
  dueToday: number
  upcoming: number
  noResponse: number
  workloadByOwner: Record<string, number>
}

export type CRMActivityFacts = {
  total: number
  recent: number
  meetings: number
  tasks: number
  openTasks: number
  overdueTasks: number
}

export type CRMKnowledgeSummary = {
  todayPriorities: string[]
  overdueFollowUps: string[]
  leadPipelineSummary: string
  opportunityPipelineSummary: string
  stalledRecords: string[]
  atRiskRevenue: string
  ownerWorkload: string[]
  leadSourcePerformance: string[]
  recentChanges: string[]
  upcomingSalesActivity: string[]
}

export type CRMKnowledgeSnapshot = {
  id: string
  generatedAt: string
  workspaceId: string
  context: {
    request: CRMKnowledgeContextRequest
    timezone: string
    permissionsApplied: string[]
    includedEntities: CRMEntityType[]
  }
  metrics: {
    leads: CRMLeadFacts
    opportunities: CRMOpportunityFacts
    clients: CRMClientFacts
    followUps: CRMFollowUpFacts
    activities: CRMActivityFacts
  }
  leadFacts: CRMLeadFacts
  opportunityFacts: CRMOpportunityFacts
  pipelineFacts: CRMPipelineFacts
  clientFacts: CRMClientFacts
  followUpFacts: CRMFollowUpFacts
  activityFacts: CRMActivityFacts
  risks: CRMRisk[]
  recommendations: CRMRecommendation[]
  summaries: CRMKnowledgeSummary
  references: CRMReference[]
  warnings: CRMDataQualityFinding[]
  dataQuality: CRMDataQualityFinding[]
}

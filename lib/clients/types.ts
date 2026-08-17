export type ClientStatus =
  | 'Active'
  | 'Waiting'
  | 'Completed'
  | 'Maintenance'
  | 'Inactive'

export type PipelineStage =
  | 'Onboarding'
  | 'In Progress'
  | 'Waiting on Client'
  | 'Review / Approval'
  | 'Completed'
  | 'Maintenance'
  | 'Inactive'

export type ClientTag = string

export type WorkspaceClientTagOption = {
  id: string
  workspaceId: string
  label: string
  normalizedLabel: string
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type ClientHealth =
  | 'Healthy'
  | 'Needs Attention'
  | 'At Risk'
  | 'Unresponsive'

export type ClientActivity = {
  id: string
  title: string
  description: string
  timestamp: string
}

export type WorkspaceClient = {
  id: string
  workspaceId: string
  sharedContactId?: string
  sourceLeadId?: string
  sourceOpportunityId?: string
  sourceSaleId?: string
  name: string
  company: string
  email: string
  phone: string
  status: ClientStatus
  pipelineStage: PipelineStage
  lastActivity: string
  openTasks: number
  value: number
  nextAction: string
  ownerId: string
  health: ClientHealth
  tags: ClientTag[]
  internalNotes?: string
  notes: string
  activity: ClientActivity[]
  tasks: string[]
  suggestedAutomations: string[]
  opportunity: {
    value: number
    nextAction: string
    probability: number
    expectedCloseWindow: string
  }
}

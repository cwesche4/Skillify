export type ExecutionStatus = 'success' | 'failed' | 'pending' | 'running'

export type ExecutionStep = {
  id: string
  name: string
  status: ExecutionStatus
  timestamp: string | null
  message: string | null
}

export type WorkflowExecution = {
  id: string
  workspaceId: string
  workflowId: string
  workflowName: string
  status: ExecutionStatus
  trigger: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  stepsTotal: number
  stepsCompleted: number
  errorMessage: string | null
  logs: string[]
  createdAt: string
  detailHref?: string
  workflowHref?: string
  isMock?: boolean
}

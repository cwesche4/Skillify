export type RunEventStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

export type RunEvent = {
  nodeId: string
  status: RunEventStatus
  timestamp: number
  duration: number
}

export type RunTimeline = {
  events: RunEvent[]
  startedAt: number
  finishedAt: number
}

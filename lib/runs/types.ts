export type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL'

export type RunSegment = {
  id: string
  start: number
  end: number
  status: RunStatus
  nodeId?: string
  label?: string
}

export type RunTimelineData = {
  runId: string
  runLabel?: string
  runStatus?: RunStatus
  startedAt?: number | string | Date
  compareMeta?: {
    // optional compare metadata, read-only and derived
    // key: nodeId => summary of deltas across runs
    nodeDeltas?: Record<
      string,
      {
        deltaMs: number
        statusChange?: boolean
        confidence?: number
      }
    >
  }
  segments: RunSegment[]
}

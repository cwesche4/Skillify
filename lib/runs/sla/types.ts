export interface SlaConfig {
  runTimeoutMs?: number
  nodeTimeoutMs?: number
}

export type SlaBreachType = 'run-timeout' | 'node-timeout'

export interface SlaBreachEvent {
  type: SlaBreachType
  runId: string
  nodeId?: string
  nodeLabel?: string
  occurredAt: string
  reason: string
}

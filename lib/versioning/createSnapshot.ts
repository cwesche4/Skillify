import { checksumFlow, stableStringify } from './checksum'
import type { AutomationVersionSnapshot } from './types'

type CreateSnapshotArgs = {
  flow: unknown
  schemaVersion: number
}

export function createSnapshot({
  flow,
  schemaVersion,
}: CreateSnapshotArgs): AutomationVersionSnapshot {
  const serialized = stableStringify(flow)
  return {
    id: '',
    versionId: '',
    flowJson: JSON.parse(serialized),
    schemaVersion,
    nodeCount: Array.isArray((flow as any)?.nodes)
      ? (flow as any).nodes.length
      : 0,
    edgeCount: Array.isArray((flow as any)?.edges)
      ? (flow as any).edges.length
      : 0,
    checksum: checksumFlow(flow),
    createdAt: Date.now(),
  }
}

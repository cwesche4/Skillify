import type { TimelineItem } from '@/lib/runs/timeline/types'
import type { CostEstimate } from '@/lib/ai/telemetry/costEstimator'

export type DiffStatus = 'added' | 'removed' | 'changed' | 'same'

export interface RunDiffItem {
  id?: string
  nodeId?: string
  label?: string
  status: DiffStatus
  from?: TimelineItem
  to?: TimelineItem
  reason?: string
  isApprovalChange?: boolean
  isSlaChange?: boolean
}

export interface RunDiffSummary {
  added: number
  removed: number
  changed: number
  same: number
  branchChanges: number
  failuresToSuccess: number
  successToFailure: number
  tokenDelta?: number
  costDelta?: [number, number]
}

function statusFromEvents(a?: TimelineItem, b?: TimelineItem): DiffStatus {
  if (a && !b) return 'removed'
  if (!a && b) return 'added'
  if (a && b) {
    if (a.status !== b.status || a.title !== b.title) return 'changed'
    return 'same'
  }
  return 'same'
}

export function computeRunDiff(params: {
  from: TimelineItem[]
  to: TimelineItem[]
  fromCosts?: CostEstimate[]
  toCosts?: CostEstimate[]
}): { items: RunDiffItem[]; summary: RunDiffSummary } {
  const fromMap = new Map<string, TimelineItem>()
  params.from.forEach((i) => fromMap.set(i.id, i))
  const toMap = new Map<string, TimelineItem>()
  params.to.forEach((i) => toMap.set(i.id, i))

  const allIds = new Set<string>([
    ...params.from.map((i) => i.id),
    ...params.to.map((i) => i.id),
  ])

  const items: RunDiffItem[] = []
  for (const id of allIds) {
    const a = fromMap.get(id)
    const b = toMap.get(id)
    const isApprovalChange =
      (a?.type?.startsWith('approval-') || b?.type?.startsWith('approval-')) &&
      a?.type !== b?.type
    const isSlaChange =
      (a?.type === 'sla-breach' && !b) || (b?.type === 'sla-breach' && !a)
    items.push({
      nodeId: a?.details?.nodeId ?? b?.details?.nodeId,
      label: a?.title ?? b?.title,
      status: statusFromEvents(a, b),
      from: a,
      to: b,
      reason:
        a && b && a.status !== b.status
          ? `${a.status} → ${b.status}`
          : undefined,
      isApprovalChange,
      isSlaChange,
    })
  }

  let branchChanges = 0
  let failuresToSuccess = 0
  let successToFailure = 0

  items.forEach((i) => {
    if (
      i.from?.type === 'node-entered' &&
      i.to?.type === 'node-entered' &&
      i.from?.subtitle !== i.to?.subtitle
    ) {
      branchChanges += 1
    }
    if (i.reason === 'failed → success') failuresToSuccess += 1
    if (i.reason === 'success → failed') successToFailure += 1
  })

  const tokenDelta =
    (params.toCosts?.reduce((s, c) => s + c.totalTokens, 0) ?? 0) -
    (params.fromCosts?.reduce((s, c) => s + c.totalTokens, 0) ?? 0)
  const costDelta: [number, number] = [
    (params.toCosts?.reduce((s, c) => s + c.estimatedCostRange[0], 0) ?? 0) -
      (params.fromCosts?.reduce((s, c) => s + c.estimatedCostRange[0], 0) ?? 0),
    (params.toCosts?.reduce((s, c) => s + c.estimatedCostRange[1], 0) ?? 0) -
      (params.fromCosts?.reduce((s, c) => s + c.estimatedCostRange[1], 0) ?? 0),
  ]

  const summary: RunDiffSummary = {
    added: items.filter((i) => i.status === 'added').length,
    removed: items.filter((i) => i.status === 'removed').length,
    changed: items.filter((i) => i.status === 'changed').length,
    same: items.filter((i) => i.status === 'same').length,
    branchChanges,
    failuresToSuccess,
    successToFailure,
    tokenDelta,
    costDelta,
  }

  return { items, summary }
}

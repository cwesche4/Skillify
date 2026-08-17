import type { CollaborationAggregate, CollaborationEvent } from './types'

export function aggregateCollaboration(
  events: CollaborationEvent[],
): CollaborationAggregate {
  const editorIds = new Set<string>()
  const reviewerIds = new Set<string>()
  let manualInterventions = 0
  let replays = 0

  for (const event of events) {
    if (event.type === 'editor-joined' && event.userId)
      editorIds.add(event.userId)
    if (event.type === 'approval-reviewer' && event.userId)
      reviewerIds.add(event.userId)
    if (event.type === 'manual-intervention') manualInterventions += 1
    if (event.type === 'replay-viewed') replays += 1
  }

  return {
    editors: editorIds.size,
    reviewers: reviewerIds.size,
    manualInterventions,
    replays,
  }
}

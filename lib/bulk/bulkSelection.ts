export type BulkSelectionState = {
  workspaceId: string
  selectedIds: string[]
  lastSelectedId: string | null
  allMatchingSelected: boolean
}

export type BulkHeaderState = 'unchecked' | 'checked' | 'indeterminate'

export function createBulkSelectionState(
  workspaceId: string,
): BulkSelectionState {
  return {
    workspaceId,
    selectedIds: [],
    lastSelectedId: null,
    allMatchingSelected: false,
  }
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter((id) => id.trim())))
}

function visibleRange(visibleIds: string[], firstId: string, secondId: string) {
  const firstIndex = visibleIds.indexOf(firstId)
  const secondIndex = visibleIds.indexOf(secondId)
  if (firstIndex === -1 || secondIndex === -1) return [secondId]
  const start = Math.min(firstIndex, secondIndex)
  const end = Math.max(firstIndex, secondIndex)
  return visibleIds.slice(start, end + 1)
}

export function toggleBulkRecord({
  state,
  id,
  visibleIds,
  checked,
  range,
}: {
  state: BulkSelectionState
  id: string
  visibleIds: string[]
  checked?: boolean
  range?: boolean
}): BulkSelectionState {
  const selected = new Set(state.selectedIds)
  const isSelected = selected.has(id)
  const shouldSelect = checked ?? !isSelected

  if (range && state.lastSelectedId) {
    for (const rangeId of visibleRange(visibleIds, state.lastSelectedId, id)) {
      if (shouldSelect) selected.add(rangeId)
      else selected.delete(rangeId)
    }
  } else if (shouldSelect) {
    selected.add(id)
  } else {
    selected.delete(id)
  }

  return {
    ...state,
    selectedIds: uniqueIds(Array.from(selected)),
    lastSelectedId: id,
    allMatchingSelected: false,
  }
}

export function selectVisibleRecords(
  state: BulkSelectionState,
  visibleIds: string[],
): BulkSelectionState {
  return {
    ...state,
    selectedIds: uniqueIds([...state.selectedIds, ...visibleIds]),
    lastSelectedId: visibleIds.at(-1) ?? state.lastSelectedId,
    allMatchingSelected: false,
  }
}

export function selectAllMatchingRecords(
  state: BulkSelectionState,
  matchingIds: string[],
): BulkSelectionState {
  return {
    ...state,
    selectedIds: uniqueIds(matchingIds),
    lastSelectedId: matchingIds.at(-1) ?? state.lastSelectedId,
    allMatchingSelected: true,
  }
}

export function clearBulkSelection(
  state: BulkSelectionState,
): BulkSelectionState {
  return {
    ...state,
    selectedIds: [],
    lastSelectedId: null,
    allMatchingSelected: false,
  }
}

export function reconcileBulkSelection({
  state,
  workspaceId,
  validIds,
}: {
  state: BulkSelectionState
  workspaceId: string
  validIds: string[]
}): BulkSelectionState {
  if (state.workspaceId !== workspaceId)
    return createBulkSelectionState(workspaceId)
  const valid = new Set(validIds)
  const selectedIds = state.selectedIds.filter((id) => valid.has(id))
  const lastSelectedId =
    state.lastSelectedId && valid.has(state.lastSelectedId)
      ? state.lastSelectedId
      : null
  return {
    ...state,
    selectedIds,
    lastSelectedId,
    allMatchingSelected:
      state.allMatchingSelected &&
      selectedIds.length === validIds.length &&
      validIds.length > 0,
  }
}

export function getBulkHeaderState({
  selectedIds,
  visibleIds,
}: {
  selectedIds: string[]
  visibleIds: string[]
}): BulkHeaderState {
  if (visibleIds.length === 0) return 'unchecked'
  const selected = new Set(selectedIds)
  const visibleSelectedCount = visibleIds.filter((id) =>
    selected.has(id),
  ).length
  if (visibleSelectedCount === 0) return 'unchecked'
  if (visibleSelectedCount === visibleIds.length) return 'checked'
  return 'indeterminate'
}

export function getVisibleSelectedCount({
  selectedIds,
  visibleIds,
}: {
  selectedIds: string[]
  visibleIds: string[]
}) {
  const selected = new Set(selectedIds)
  return visibleIds.filter((id) => selected.has(id)).length
}

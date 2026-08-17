'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  clearBulkSelection,
  createBulkSelectionState,
  getBulkHeaderState,
  getVisibleSelectedCount,
  reconcileBulkSelection,
  selectAllMatchingRecords,
  selectVisibleRecords,
  toggleBulkRecord,
} from '@/lib/bulk/bulkSelection'

export function useBulkSelection({
  workspaceId,
  visibleIds,
  validIds,
}: {
  workspaceId: string
  visibleIds: string[]
  validIds: string[]
}) {
  const [state, setState] = useState(() =>
    createBulkSelectionState(workspaceId),
  )

  useEffect(() => {
    setState((current) =>
      reconcileBulkSelection({ state: current, workspaceId, validIds }),
    )
  }, [validIds, workspaceId])

  const selectedIdSet = useMemo(
    () => new Set(state.selectedIds),
    [state.selectedIds],
  )
  const headerState = useMemo(
    () => getBulkHeaderState({ selectedIds: state.selectedIds, visibleIds }),
    [state.selectedIds, visibleIds],
  )
  const visibleSelectedCount = useMemo(
    () =>
      getVisibleSelectedCount({ selectedIds: state.selectedIds, visibleIds }),
    [state.selectedIds, visibleIds],
  )

  const toggleOne = useCallback(
    ({
      id,
      checked,
      range,
    }: {
      id: string
      checked?: boolean
      range?: boolean
    }) => {
      setState((current) =>
        toggleBulkRecord({ state: current, id, checked, range, visibleIds }),
      )
    },
    [visibleIds],
  )

  const toggleVisible = useCallback(
    (checked: boolean) => {
      setState((current) =>
        checked
          ? selectVisibleRecords(current, visibleIds)
          : {
              ...current,
              selectedIds: current.selectedIds.filter(
                (id) => !visibleIds.includes(id),
              ),
              allMatchingSelected: false,
            },
      )
    },
    [visibleIds],
  )

  const selectAllMatching = useCallback(() => {
    setState((current) => selectAllMatchingRecords(current, validIds))
  }, [validIds])

  const clear = useCallback(() => {
    setState((current) => clearBulkSelection(current))
  }, [])

  return {
    state,
    selectedIds: state.selectedIds,
    selectedIdSet,
    selectedCount: state.selectedIds.length,
    headerState,
    visibleSelectedCount,
    allMatchingSelected: state.allMatchingSelected,
    toggleOne,
    toggleVisible,
    selectAllMatching,
    clear,
  }
}

import { describe, expect, it } from 'vitest'

import {
  clearBulkSelection,
  createBulkSelectionState,
  getBulkHeaderState,
  reconcileBulkSelection,
  selectAllMatchingRecords,
  selectVisibleRecords,
  toggleBulkRecord,
} from '@/lib/bulk/bulkSelection'
import {
  executeBulkAction,
  type BulkActionDefinition,
} from '@/lib/bulk/bulkActions'
import { SKILLIFY_BULK_ACTION_MATRIX } from '@/lib/bulk/actionMatrix'

describe('bulk selection primitives', () => {
  it('toggles one record and clears selection', () => {
    const state = createBulkSelectionState('workspace-a')
    const selected = toggleBulkRecord({
      state,
      id: 'record-a',
      visibleIds: ['record-a', 'record-b'],
    })

    expect(selected.selectedIds).toEqual(['record-a'])
    expect(clearBulkSelection(selected).selectedIds).toEqual([])
  })

  it('selects all visible records and reports indeterminate state', () => {
    const state = createBulkSelectionState('workspace-a')
    const selected = toggleBulkRecord({
      state,
      id: 'record-a',
      visibleIds: ['record-a', 'record-b', 'record-c'],
    })

    expect(
      getBulkHeaderState({
        selectedIds: selected.selectedIds,
        visibleIds: ['record-a', 'record-b', 'record-c'],
      }),
    ).toBe('indeterminate')

    const allVisible = selectVisibleRecords(selected, [
      'record-a',
      'record-b',
      'record-c',
    ])
    expect(allVisible.selectedIds).toEqual(['record-a', 'record-b', 'record-c'])
    expect(
      getBulkHeaderState({
        selectedIds: allVisible.selectedIds,
        visibleIds: ['record-a', 'record-b', 'record-c'],
      }),
    ).toBe('checked')
  })

  it('shift-click range selection uses current visible order', () => {
    const first = toggleBulkRecord({
      state: createBulkSelectionState('workspace-a'),
      id: 'record-b',
      visibleIds: ['record-a', 'record-b', 'record-c', 'record-d'],
      checked: true,
    })
    const range = toggleBulkRecord({
      state: first,
      id: 'record-d',
      visibleIds: ['record-a', 'record-b', 'record-c', 'record-d'],
      checked: true,
      range: true,
    })

    expect(range.selectedIds).toEqual(['record-b', 'record-c', 'record-d'])
  })

  it('reconciles filtered records and clears on workspace change', () => {
    const selected = selectAllMatchingRecords(
      createBulkSelectionState('workspace-a'),
      ['record-a', 'record-b', 'record-c'],
    )

    expect(
      reconcileBulkSelection({
        state: selected,
        workspaceId: 'workspace-a',
        validIds: ['record-a', 'record-c'],
      }).selectedIds,
    ).toEqual(['record-a', 'record-c'])

    expect(
      reconcileBulkSelection({
        state: selected,
        workspaceId: 'workspace-b',
        validIds: ['record-a', 'record-b', 'record-c'],
      }),
    ).toEqual(createBulkSelectionState('workspace-b'))
  })

  it('enforces permissions and reports partial action results honestly', () => {
    const action: BulkActionDefinition<{ id: string }, { skipId?: string }> = {
      id: 'test.partial',
      label: 'Partial',
      recordType: 'commerce-customer',
      inputKind: 'none',
      requiredPermission: 'admin',
      execute: ({ records, input }) => ({
        actionId: 'test.partial',
        total: records.length,
        succeeded: records.filter((record) => record.id !== input.skipId)
          .length,
        skipped: records.filter((record) => record.id === input.skipId).length,
        failed: 0,
        summary: 'partial',
        items: records.map((record) => ({
          id: record.id,
          status: record.id === input.skipId ? 'skipped' : 'success',
        })),
      }),
    }

    expect(
      executeBulkAction({
        action,
        context: {
          workspaceId: 'workspace-a',
          selectedIds: ['a'],
          records: [{ id: 'a' }],
          input: {},
          permission: 'member',
        },
      }).summary,
    ).toBe('You do not have permission to perform this bulk action.')

    const result = executeBulkAction({
      action,
      context: {
        workspaceId: 'workspace-a',
        selectedIds: ['a', 'b'],
        records: [{ id: 'a' }, { id: 'b' }],
        input: { skipId: 'b' },
        permission: 'admin',
      },
    })
    expect(result.succeeded).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('documents restricted lifecycle actions in the platform matrix', () => {
    const orders = SKILLIFY_BULK_ACTION_MATRIX.find(
      (entry) => entry.recordType === 'order',
    )
    const customers = SKILLIFY_BULK_ACTION_MATRIX.find(
      (entry) => entry.recordType === 'commerce-customer',
    )

    expect(orders?.restrictedActions).toContain('Mark paid')
    expect(orders?.restrictedActions).toContain('Mark shipped')
    expect(customers?.allowedActions).toContain('Change customer type')
    expect(customers?.selectAllMatching).toBe('supported')
  })
})

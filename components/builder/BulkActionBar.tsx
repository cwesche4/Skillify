import type { FC } from 'react'
import {
  Trash2,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = {
  selectedCount: number
  onEnable: () => void
  onDisable: () => void
  onDelete: () => void
  onEditShared: () => void
}

export const BulkActionBar: FC<Props> = ({
  selectedCount,
  onEnable,
  onDisable,
  onDelete,
  onEditShared,
}) => {
  if (selectedCount <= 1) return null

  return (
    <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <span className="text-[12px] text-slate-300">
        {selectedCount} nodes selected
      </span>
      <div className="flex flex-1 items-center gap-2">
        <Button
          size="xs"
          variant="subtle"
          onClick={onEnable}
          className="inline-flex items-center gap-1"
        >
          <ToggleRight className="h-4 w-4" aria-hidden />
          Enable
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={onDisable}
          className="inline-flex items-center gap-1"
        >
          <ToggleLeft className="h-4 w-4" aria-hidden />
          Disable
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={onEditShared}
          className="inline-flex items-center gap-1"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Edit shared fields
        </Button>
      </div>
      <Button
        size="xs"
        variant="destructive"
        onClick={onDelete}
        className="inline-flex items-center gap-1"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete (preview)
      </Button>
    </div>
  )
}

export default BulkActionBar

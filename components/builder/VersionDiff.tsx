import type { FC } from 'react'
import DiffViewer from 'react-diff-viewer-continued'

type Props = {
  previous?: any
  next?: any
}

/**
 * Simple JSON diff viewer for flow snapshots.
 * Past versions are read-only; restore creates a new version elsewhere.
 */
export const VersionDiff: FC<Props> = ({ previous, next }) => {
  const oldText = JSON.stringify(previous ?? {}, null, 2)
  const newText = JSON.stringify(next ?? {}, null, 2)
  return (
    <div className="max-h-[60vh] overflow-auto rounded border border-slate-800">
      <DiffViewer
        oldValue={oldText}
        newValue={newText}
        splitView={true}
        hideLineNumbers={false}
        showDiffOnly={false}
        styles={{
          diffContainer: { background: '#0f172a' },
          line: { color: '#e2e8f0', fontSize: '12px' },
        }}
      />
    </div>
  )
}

export default VersionDiff

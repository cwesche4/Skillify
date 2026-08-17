'use client'

import { Button } from '@/components/ui/Button'
import React, { useCallback, useMemo } from 'react'

type Props = {
  presetName: string
  onPresetNameChange: (value: string) => void
  presets: Record<string, { name: string; data: any }>
  onSavePreset: () => void
  onApplyPreset: (name: string) => void
  onDeletePreset: (name: string) => void
}

function InspectorPresetsComponent({
  presetName,
  onPresetNameChange,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: Props) {
  const presetList = useMemo(() => Object.values(presets), [presets])
  const hasPresets = presetList.length > 0
  const presetOptions = useMemo(
    () =>
      presetList.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      )),
    [presetList],
  )

  const handlePresetNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onPresetNameChange(e.target.value),
    [onPresetNameChange],
  )

  const handleApplyPreset = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const key = e.target.value
      if (!key) return
      onApplyPreset(key)
    },
    [onApplyPreset],
  )

  const handleDeletePreset = useCallback(() => {
    if (!presetName.trim()) return
    onDeletePreset(presetName.trim())
  }, [onDeletePreset, presetName])

  return (
    <details className="mb-3 rounded-lg border border-slate-800/70 bg-slate-900/45 text-[11px] shadow-sm">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-900/70">
        Saved setups
        <span className="ml-2 font-normal text-slate-500">
          Local preview presets
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-800/70 p-3">
        {!hasPresets ? (
          <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 p-3 text-[11px] text-slate-500">
            No saved setups yet. Save the current step configuration as a local
            preview preset to reuse it while editing.
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={presetName}
            onChange={handlePresetNameChange}
            placeholder="Setup name"
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-800/70 bg-slate-900 px-3 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
          <Button
            size="xs"
            onClick={onSavePreset}
            data-testid="inspector-preset-save"
          >
            Save setup
          </Button>
          {hasPresets && (
            <select
              className="h-8 rounded-md border border-slate-800/70 bg-slate-900 px-3 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700"
              onChange={handleApplyPreset}
              defaultValue=""
              data-testid="inspector-preset-apply"
            >
              <option value="">Apply setup...</option>
              {presetOptions}
            </select>
          )}
          {hasPresets && (
            <Button
              size="xs"
              variant="secondary"
              onClick={handleDeletePreset}
              data-testid="inspector-preset-delete"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </details>
  )
}

export const InspectorPresetsSection = React.memo(InspectorPresetsComponent)

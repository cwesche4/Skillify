'use client'

import React from 'react'
import { useEffect, useRef } from 'react'

import type { BulkHeaderState } from '@/lib/bulk/bulkSelection'
import { cn } from '@/lib/utils'

export function BulkSelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
  onClick,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: (
    checked: boolean,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void
  onClick?: (event: React.MouseEvent<HTMLInputElement>) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onChange={(event) => {
        event.stopPropagation()
        onChange(event.target.checked, event)
      }}
      className={cn(
        'h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
      )}
    />
  )
}

export function HeaderBulkSelectionCheckbox({
  state,
  label = 'Select all visible records',
  onChange,
}: {
  state: BulkHeaderState
  label?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <BulkSelectionCheckbox
      checked={state === 'checked'}
      indeterminate={state === 'indeterminate'}
      label={label}
      onChange={(checked) => onChange(checked)}
    />
  )
}

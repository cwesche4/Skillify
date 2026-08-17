'use client'

import React, { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ConfigurationEducationHint } from '@/components/ui/ConfigurationEducationHint'
import { Input } from '@/components/ui/Input'

export function ConfigurationQuickAdd({
  label,
  addLabel,
  manageLabel,
  manageHref,
  hintId,
  hintTitle,
  hintBody,
  onCreate,
}: {
  label: string
  addLabel: string
  manageLabel: string
  manageHref: string
  hintId: string
  hintTitle: string
  hintBody: string
  onCreate: (label: string) => { label?: string; error?: string }
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const result = onCreate(value)
    if (result.error) {
      setError(result.error)
      return
    }
    setValue('')
    setError(null)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <ConfigurationEducationHint id={hintId} title={hintTitle}>
        {hintBody}
      </ConfigurationEducationHint>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
        >
          {addLabel}
        </Button>
        <a
          href={manageHref}
          className="text-xs font-medium text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline"
        >
          {manageLabel}
        </a>
      </div>
      {open ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                if (error) setError(null)
              }}
              placeholder={label}
              aria-label={label}
            />
            <Button type="button" size="sm" onClick={submit}>
              Save
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

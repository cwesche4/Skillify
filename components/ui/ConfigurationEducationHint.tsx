'use client'

import React, { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

export function ConfigurationEducationHint({
  id,
  title,
  children,
  action,
}: {
  id: string
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = `skillify-config-hint-dismissed:${id}`
    setVisible(window.localStorage.getItem(key) !== 'true')
  }, [id])

  if (!visible) return null

  const dismiss = () => {
    window.localStorage.setItem(`skillify-config-hint-dismissed:${id}`, 'true')
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{title}</p>
          <div className="text-cyan-100/75">{children}</div>
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  )
}

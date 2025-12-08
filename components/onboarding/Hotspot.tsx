// components/onboarding/Hotspot.tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'

type HotspotProps = {
  id: string
  label: string
  children: ReactNode
}

export function Hotspot({ id, label, children }: HotspotProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = `skillify-hotspot-dismissed:${id}`
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      setVisible(true)
    }
  }, [id])

  function dismiss() {
    const key = `skillify-hotspot-dismissed:${id}`
    window.localStorage.setItem(key, 'true')
    setVisible(false)
  }

  return (
    <div className="relative">
      {children}
      {visible && (
        <div className="pointer-events-none absolute -right-2 -top-2 z-20">
          <div className="relative">
            <div className="shadow-brand-primary/50 h-3 w-3 rounded-full bg-brand-primary shadow-lg" />
            <div className="border-brand-primary/70 absolute inset-0 animate-ping rounded-full border" />
          </div>
          <div className="pointer-events-auto mt-2 w-56 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-100">{label}</p>
              <button
                onClick={dismiss}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

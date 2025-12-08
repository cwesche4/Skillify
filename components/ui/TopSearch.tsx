'use client'

import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function TopSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative hidden w-full max-w-xs items-center sm:flex">
      <Search
        size={14}
        className="pointer-events-none absolute left-2 text-slate-500"
      />
      <input
        ref={inputRef}
        placeholder="Search (⌘K / Ctrl+K)"
        className="w-full rounded-md border border-slate-700 bg-slate-900/80 py-1.5 pl-7 pr-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
      />
    </div>
  )
}

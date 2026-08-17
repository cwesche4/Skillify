'use client'

import { Moon, Sun } from 'lucide-react'
import React from 'react'
import { useEffect, useState } from 'react'
import {
  applySkillifyThemeToDocument,
  persistSkillifyThemePreference,
  readSkillifyThemePreference,
  type SkillifyTheme,
} from '@/lib/theme/theme'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<SkillifyTheme>('dark')

  useEffect(() => {
    setMounted(true)
    const nextTheme = readSkillifyThemePreference(window.localStorage)
    setTheme(nextTheme)
    persistSkillifyThemePreference(window.localStorage, nextTheme)
    applySkillifyThemeToDocument(document.documentElement, nextTheme)
  }, [])

  if (!mounted) return null

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    persistSkillifyThemePreference(window.localStorage, nextTheme)
    applySkillifyThemeToDocument(document.documentElement, nextTheme)
  }

  const isDark = theme === 'dark'
  const actionLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary focus-visible:ring-brand-primary/60 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-colors focus:outline-none focus-visible:ring-2"
      aria-label={actionLabel}
      title={actionLabel}
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}

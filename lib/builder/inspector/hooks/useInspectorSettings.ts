'use client'

import { useCallback, useState } from 'react'

import {
  loadInspectorSettings,
  saveInspectorSettings,
  type InspectorAISettings,
} from '@/lib/inspector/settings'

export function saveInspectorSettingsBackup(
  workspaceId: string | undefined,
  settings: InspectorAISettings,
) {
  if (!workspaceId) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `skillify.inspector.settings.backup.${workspaceId}`,
      JSON.stringify(settings),
    )
  } catch {
    /* ignore */
  }
}

export function loadInspectorSettingsBackup(
  workspaceId: string | undefined,
): InspectorAISettings | null {
  if (!workspaceId) return null
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(
      `skillify.inspector.settings.backup.${workspaceId}`,
    )
    if (!raw) return null
    return JSON.parse(raw) as InspectorAISettings
  } catch {
    return null
  }
}

export function useInspectorSettings(workspaceId: string | undefined) {
  const [settings, setSettings] = useState<InspectorAISettings>(() =>
    loadInspectorSettings(workspaceId),
  )

  const toggleSetting = useCallback(
    (key: keyof InspectorAISettings, next: boolean) => {
      const updated = { ...settings, [key]: next }
      setSettings(updated)
      if (workspaceId) {
        saveInspectorSettings(workspaceId, updated)
      }
    },
    [settings, workspaceId],
  )

  return { settings, setSettings, toggleSetting }
}

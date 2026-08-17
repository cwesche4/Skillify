'use client'

import { useCallback, useState } from 'react'

import {
  loadInspectorWorkMode,
  saveInspectorWorkMode,
  type InspectorWorkMode,
} from '@/lib/inspector/workModes'
import {
  loadInspectorSettingsBackup,
  saveInspectorSettingsBackup,
} from '@/lib/builder/inspector/hooks/useInspectorSettings'
import type { InspectorAISettings } from '@/lib/inspector/settings'

export function useInspectorWorkMode(workspaceId: string | undefined) {
  const [workMode, setWorkMode] = useState<InspectorWorkMode>(
    () => loadInspectorWorkMode(workspaceId).id,
  )

  const updateWorkMode = useCallback(
    (mode: InspectorWorkMode) => {
      setWorkMode(mode)
      if (workspaceId) {
        saveInspectorWorkMode(workspaceId, mode)
      }
    },
    [workspaceId],
  )

  const applyExpertPreset = useCallback(
    (
      currentSettings: InspectorAISettings,
      toggle: (key: keyof InspectorAISettings, next: boolean) => void,
    ) => {
      if (!workspaceId) return
      saveInspectorSettingsBackup(workspaceId, currentSettings)
      toggle('enableInspectorAI', false)
      toggle('enableSuggestions', false)
      toggle('enableAutoFix', false)
      toggle('enableWalkthroughs', false)
      toggle('enableTelemetry', false)
    },
    [workspaceId],
  )

  const restoreFromBackup = useCallback(
    (toggle: (key: keyof InspectorAISettings, next: boolean) => void) => {
      if (!workspaceId) return
      const backup = loadInspectorSettingsBackup(workspaceId)
      const target =
        backup ??
        ({
          enableInspectorAI: false,
          enableSuggestions: false,
          enableAutoFix: false,
          enableWalkthroughs: false,
          enableTelemetry: false,
        } satisfies InspectorAISettings)
      ;(
        [
          'enableInspectorAI',
          'enableSuggestions',
          'enableAutoFix',
          'enableWalkthroughs',
          'enableTelemetry',
        ] as (keyof InspectorAISettings)[]
      ).forEach((key) => {
        if (target && key in target) {
          toggle(key, !!target[key])
        }
      })
    },
    [workspaceId],
  )

  return { workMode, updateWorkMode, applyExpertPreset, restoreFromBackup }
}

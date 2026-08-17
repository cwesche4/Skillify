import type { InspectorAISettings } from '@/lib/inspector/settings'
import type { InspectorWorkMode } from '@/lib/inspector/workModes'

export type WorkModePolicy = {
  aiEnabled: boolean
  suggestionsEnabled: boolean
  autoFixEnabled: boolean
  walkthroughsEnabled: boolean
  telemetryLevel: 'silent' | 'minimal' | 'verbose'
  defaultTab?: string
}

export function resolveWorkModePolicy(
  mode: InspectorWorkMode,
  _settings: InspectorAISettings, // unused by design: policies only restrict, user settings provide intent
): WorkModePolicy {
  switch (mode) {
    case 'build':
      return {
        aiEnabled: true,
        suggestionsEnabled: true,
        autoFixEnabled: true,
        walkthroughsEnabled: true,
        telemetryLevel: 'minimal',
        defaultTab: 'config',
      }
    case 'debug':
      return {
        aiEnabled: true,
        suggestionsEnabled: true,
        autoFixEnabled: true,
        walkthroughsEnabled: true,
        telemetryLevel: 'verbose',
        defaultTab: 'logs',
      }
    case 'review':
      return {
        aiEnabled: true,
        suggestionsEnabled: true,
        autoFixEnabled: false,
        walkthroughsEnabled: true,
        telemetryLevel: 'minimal',
        defaultTab: 'config',
      }
    case 'expert':
      return {
        aiEnabled: true,
        suggestionsEnabled: true,
        autoFixEnabled: true,
        walkthroughsEnabled: true,
        telemetryLevel: 'minimal',
        defaultTab: 'config',
      }
    default:
      return {
        aiEnabled: true,
        suggestionsEnabled: true,
        autoFixEnabled: true,
        walkthroughsEnabled: true,
        telemetryLevel: 'minimal',
        defaultTab: 'config',
      }
  }
}

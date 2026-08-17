import { InspectorAISettings } from './settings'
import { InspectorWorkMode } from './workModes'

type InspectorDefaultsInput = {
  workspaceId?: string
  userSettings: InspectorAISettings
  userWorkMode?: InspectorWorkMode
}

const orgDefaults: InspectorAISettings & { workMode: InspectorWorkMode } = {
  enableInspectorAI: true,
  enableSuggestions: true,
  enableAutoFix: true,
  enableWalkthroughs: true,
  enableTelemetry: true,
  enableHeatmap: false,
  workMode: 'build',
}

/**
 * Resolves inspector defaults without overriding user intent.
 * Order of precedence:
 *   org defaults -> user preferences
 * User settings always win; work mode defaults are applied only when absent.
 */
export function resolveInspectorDefaults({
  userSettings,
  userWorkMode,
}: InspectorDefaultsInput): InspectorAISettings & {
  workMode: InspectorWorkMode
} {
  return {
    ...orgDefaults,
    ...userSettings,
    workMode: userWorkMode ?? orgDefaults.workMode,
  }
}

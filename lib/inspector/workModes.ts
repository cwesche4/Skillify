export type InspectorWorkMode = 'build' | 'debug' | 'review' | 'expert'

export type InspectorWorkModeConfig = {
  id: InspectorWorkMode
  defaultTab?: string
  aiVisible?: boolean
  telemetryLevel?: 'silent' | 'minimal' | 'verbose'
}

export const INSPECTOR_WORK_MODES: Record<
  InspectorWorkMode,
  InspectorWorkModeConfig
> = {
  build: {
    id: 'build',
    defaultTab: 'config',
    aiVisible: false,
    telemetryLevel: 'minimal',
  },
  debug: {
    id: 'debug',
    defaultTab: 'logs',
    aiVisible: true,
    telemetryLevel: 'verbose',
  },
  review: {
    id: 'review',
    defaultTab: 'config',
    aiVisible: true,
    telemetryLevel: 'minimal',
  },
  expert: {
    id: 'expert',
    defaultTab: 'config',
    aiVisible: false,
    telemetryLevel: 'minimal',
  },
}

export function loadInspectorWorkMode(workspaceId: string | undefined) {
  if (!workspaceId) return INSPECTOR_WORK_MODES.build
  if (typeof window === 'undefined') return INSPECTOR_WORK_MODES.build
  try {
    const raw = window.localStorage.getItem(
      `skillify.inspector.workMode.${workspaceId}`,
    )
    if (!raw) return INSPECTOR_WORK_MODES.build
    const id = raw as InspectorWorkMode
    return INSPECTOR_WORK_MODES[id] ?? INSPECTOR_WORK_MODES.build
  } catch {
    return INSPECTOR_WORK_MODES.build
  }
}

export function saveInspectorWorkMode(
  workspaceId: string,
  mode: InspectorWorkMode,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `skillify.inspector.workMode.${workspaceId}`,
      mode,
    )
  } catch {
    // ignore
  }
}

import type { InspectorTelemetryPayload } from '@/lib/inspector/telemetry'

type Entry = {
  event: string
  payload: InspectorTelemetryPayload
}

const baseTs = Date.UTC(2023, 0, 1, 10, 0, 0, 0)

export const inspectorTelemetryEntries: Entry[] = [
  {
    event: 'inspector_tab_viewed',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs,
    },
  },
  {
    event: 'inspector_tab_viewed',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'logs',
      timestamp: baseTs + 1000,
    },
  },
  {
    event: 'inspector_tab_viewed',
    payload: {
      workspaceId: 'ws-2',
      automationId: 'auto-2',
      nodeType: 'trigger',
      tab: 'config',
      timestamp: baseTs + 86_400_000,
    },
  },
  {
    event: 'inspector_tab_viewed',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      // missing timestamp -> bucket unknown
    },
  },
  {
    event: 'inspector_validation_failed',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs,
    },
  },
  {
    event: 'inspector_validation_cleared',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 2000,
    },
  },
  {
    event: 'inspector_ai_suggestion_shown',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs,
    },
  },
  {
    event: 'inspector_ai_autofix_applied',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 3000,
    },
  },
  {
    event: 'inspector_ai_action_failed',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 4000,
    },
  },
  {
    event: 'inspector_ai_suggestion_shown',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 5000,
    },
  },
  {
    event: 'inspector_preset_saved',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs,
    },
  },
  {
    event: 'inspector_preset_applied',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 6000,
    },
  },
  {
    event: 'inspector_preset_deleted',
    payload: {
      workspaceId: 'ws-1',
      automationId: 'auto-1',
      nodeType: 'action',
      tab: 'config',
      timestamp: baseTs + 7000,
    },
  },
  // Unknown event should be ignored
  {
    event: 'inspector_unknown_event',
    payload: {
      workspaceId: 'ws-3',
      automationId: 'auto-3',
      nodeType: 'condition',
      tab: 'config',
      timestamp: baseTs,
    },
  },
]

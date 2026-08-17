import {
  addDateKeys,
  getStartOfWeekDateKey,
  getStartOfWorkspaceDay,
  getWorkspaceDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import {
  getPersistedSchedulingSettings,
  listSchedulingWorkspaceData,
} from '@/lib/scheduling/services/schedulingService'
import type {
  SchedulingCapabilities,
  SchedulingSectionKey,
} from '@/lib/scheduling/types'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { canManageScheduling } from '@/lib/workspaces/workspaceRoles'

export async function loadSchedulingPageProps({
  workspace,
  capabilities,
}: {
  workspace: {
    id: string
    slug: string
    businessModel: WorkspaceBusinessModel | string
  }
  capabilities: SchedulingCapabilities
}) {
  const persistedSettings = await getPersistedSchedulingSettings({
    workspaceId: workspace.id,
    businessModel: workspace.businessModel,
    capabilities,
  })
  const timezone = persistedSettings.timezone
  const todayKey = getWorkspaceDateKey(new Date(), timezone)
  const rangeStartKey = getStartOfWeekDateKey(todayKey, 1)
  const rangeEndKey = addDateKeys(rangeStartKey, 120)
  const data = await listSchedulingWorkspaceData({
    workspaceId: workspace.id,
    businessModel: workspace.businessModel,
    capabilities,
    endsAfter: getStartOfWorkspaceDay(rangeStartKey, timezone),
    startsBefore: getStartOfWorkspaceDay(rangeEndKey, timezone),
  })
  return {
    initialSettings: data.settings,
    initialEvents: data.events,
    initialSeries: data.series,
    initialAvailability: data.availability,
  }
}

export function canManageSchedulingRole(role: unknown) {
  return canManageScheduling(role)
}

export type SchedulingRouteSection = SchedulingSectionKey | 'settings'

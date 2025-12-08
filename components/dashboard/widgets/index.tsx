// components/dashboard/widgets/index.tsx

import WorkspaceSuccessRate from './WorkspaceSuccessRate'
import WorkspaceMembers from './WorkspaceMembers'
import RecentRunsWidget from './RecentRunsWidget'
import AiCoachInsightsWidget from './AiCoachInsightsWidget'

export type WidgetId =
  | 'successRate'
  | 'members'
  | 'recentRuns'
  | 'aiCoachInsights'

export interface WidgetConfig {
  id: WidgetId
  label: string
  defaultVisible: boolean
  defaultOrder: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<{ workspaceId: string; data: any }>
}

export const WIDGETS: Record<WidgetId, WidgetConfig> = {
  successRate: {
    id: 'successRate',
    label: 'Workspace Health',
    component: WorkspaceSuccessRate,
    defaultVisible: true,
    defaultOrder: 1,
  },
  members: {
    id: 'members',
    label: 'Members',
    component: WorkspaceMembers,
    defaultVisible: true,
    defaultOrder: 2,
  },
  recentRuns: {
    id: 'recentRuns',
    label: 'Recent Runs',
    component: RecentRunsWidget,
    defaultVisible: true,
    defaultOrder: 3,
  },
  aiCoachInsights: {
    id: 'aiCoachInsights',
    label: 'AI Coach Insights',
    component: AiCoachInsightsWidget,
    defaultVisible: true,
    defaultOrder: 4,
  },
}

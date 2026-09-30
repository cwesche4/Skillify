import type { LeadClientRecord } from '@/lib/leads/clientTypes'
import { LeadStage } from '@/lib/prisma/enums'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'

export type DurableLeadSavedView =
  | 'all'
  | 'due-today'
  | 'overdue'
  | 'due-or-overdue'
  | 'new'
  | 'contacted'
  | 'estimate-visit'
  | 'follow-up'
  | 'won'
  | 'lost'
  | 'high-value'

export const durableLeadSavedViews: Array<{
  id: DurableLeadSavedView
  label: string
}> = [
  { id: 'all', label: 'All Leads' },
  { id: 'due-today', label: 'Due Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due-or-overdue', label: 'Due Today or Overdue' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'estimate-visit', label: 'Estimate / Visit' },
  { id: 'follow-up', label: 'Follow-Up' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'high-value', label: 'High Value' },
]

const viewIds = new Set(durableLeadSavedViews.map((view) => view.id))
export const activeLeadFollowUpStages = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.ESTIMATE_VISIT,
  LeadStage.FOLLOW_UP,
] as const
const activeStages = new Set<LeadStage>(activeLeadFollowUpStages)
const stageByView: Partial<Record<DurableLeadSavedView, LeadStage>> = {
  new: LeadStage.NEW,
  contacted: LeadStage.CONTACTED,
  'estimate-visit': LeadStage.ESTIMATE_VISIT,
  'follow-up': LeadStage.FOLLOW_UP,
  won: LeadStage.WON,
  lost: LeadStage.LOST,
}

export function normalizeDurableLeadSavedView(
  value: string | null | undefined,
): DurableLeadSavedView {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'needs-follow-up') return 'due-or-overdue'
  if (normalized === 'high_value') return 'high-value'
  return normalized && viewIds.has(normalized as DurableLeadSavedView)
    ? (normalized as DurableLeadSavedView)
    : 'all'
}

export function isActiveLeadFollowUp(lead: LeadClientRecord) {
  return (
    !lead.archivedAt &&
    !lead.convertedCustomerId &&
    activeStages.has(lead.stage)
  )
}

export function matchesDurableLeadSavedView(
  lead: LeadClientRecord,
  view: DurableLeadSavedView,
  options: {
    now?: Date
    timezone: string
    highValueCents?: number
  },
) {
  if (lead.archivedAt) return false
  const stage = stageByView[view]
  if (stage) return lead.stage === stage
  if (view === 'high-value') {
    return (
      (lead.estimatedValueCents ?? 0) >= (options.highValueCents ?? 350_000)
    )
  }
  if (view === 'due-today' || view === 'overdue' || view === 'due-or-overdue') {
    if (!lead.followUpAt || !isActiveLeadFollowUp(lead)) return false
    const today = getWorkspaceDateKey(
      options.now ?? new Date(),
      options.timezone,
    )
    const due = getWorkspaceDateKey(lead.followUpAt, options.timezone)
    if (view === 'due-today') return due === today
    if (view === 'overdue') return due < today
    return due <= today
  }
  return true
}

export function filterDurableLeads(
  leads: LeadClientRecord[],
  view: DurableLeadSavedView,
  search: string,
  options: { now?: Date; timezone: string; highValueCents?: number },
) {
  const query = search.trim().toLowerCase()
  return leads.filter(
    (lead) =>
      matchesDurableLeadSavedView(lead, view, options) &&
      (!query ||
        [
          lead.displayName,
          lead.companyName,
          lead.email,
          lead.phone,
          lead.nextStep,
          lead.source,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)),
  )
}

import type {
  LeadRecord,
  LeadSource,
  LeadStage,
  LeadStatus,
} from '@/lib/sales/demoSalesRecords'
import {
  getWorkspaceDateKey,
  isSchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import {
  getLeadLifecycleState,
  normalizeLeadRecord,
  normalizeLeadStage,
  type LeadLifecycleState,
} from '@/lib/crm/pipelineStageRegistry'
import { selectLeadsNeedingFollowUp } from '@/lib/workspace-records/relationships'

export type LeadSavedViewId =
  | 'all'
  | 'needs-follow-up'
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'nurture'
  | 'converted'
  | 'disqualified'
  | 'high-value'

export type LeadSortOption =
  | 'followUpPriority'
  | 'newestAdded'
  | 'oldestAdded'
  | 'followUpSoonest'
  | 'followUpLatest'
  | 'highestValue'
  | 'lowestValue'
  | 'status'

export type LeadFilterState = {
  search?: string
  statusFilter?: 'All' | LeadStatus
  stageFilter?: string
  sourceFilter?: LeadSource | 'All'
  viewId?: LeadSavedViewId
  metric?:
    | 'totalLeads'
    | 'newThisMonth'
    | 'needsFollowUp'
    | 'conversionRate'
    | null
  drilldown?:
    | { type: 'status'; status: LeadStatus }
    | { type: 'stage'; stage: LeadStage }
    | { type: 'source'; source: LeadSource }
    | { type: 'followUp'; mode: 'overdue' | 'today' | 'inactive' }
    | { type: 'conversion'; mode: 'converted' | 'open' | 'lost' }
    | { type: 'value'; mode: 'high' }
    | { type: 'age'; mode: 'average' }
    | null
  today: string
  staleActivityCutoff: string
  timezone?: string
  ownerName?: (lead: LeadRecord) => string
}

const statusSortOrder: Record<string, number> = {
  New: 0,
  Contacted: 1,
  Qualified: 2,
  Nurture: 3,
  Converted: 4,
  Disqualified: 5,
}

export function getNormalizedLeads(leads: LeadRecord[]) {
  return leads.map(normalizeLeadRecord)
}

export function getLeadStage(lead: LeadRecord) {
  return normalizeLeadStage(lead.stage, lead.converted)
}

export function isConvertedLead(lead: LeadRecord) {
  return getLeadLifecycleState(lead) === 'CONVERTED'
}

export function isActiveLead(lead: LeadRecord) {
  return getLeadLifecycleState(lead) === 'ACTIVE'
}

export function getLeadLifecycleLabel(lead: LeadRecord) {
  const lifecycle = getLeadLifecycleState(lead)
  if (lifecycle === 'CONVERTED') return 'Converted'
  if (lifecycle === 'ARCHIVED') return 'Disqualified'
  return lead.status
}

export function isLeadOverdue(
  lead: LeadRecord,
  today: string,
  timezone = 'America/New_York',
) {
  const followUpDate = getLeadDateKey(lead.followUpDue, timezone)
  return isActiveLead(lead) && Boolean(followUpDate && followUpDate < today)
}

export function isLeadDueToday(
  lead: LeadRecord,
  today: string,
  timezone = 'America/New_York',
) {
  return (
    isActiveLead(lead) && getLeadDateKey(lead.followUpDue, timezone) === today
  )
}

export function hasStaleLeadActivity(
  lead: LeadRecord,
  staleActivityCutoff: string,
) {
  if (!isActiveLead(lead)) return false
  return !lead.lastActivityAt || lead.lastActivityAt <= staleActivityCutoff
}

export function getLeadSavedViewCounts(leads: LeadRecord[]) {
  const normalized = getNormalizedLeads(leads)
  return {
    all: normalized.length,
    needsFollowUp: selectLeadsNeedingFollowUp(normalized).length,
    new: normalized.filter((lead) => isActiveLead(lead) && lead.stage === 'New')
      .length,
    contacted: normalized.filter(
      (lead) => isActiveLead(lead) && lead.stage === 'Contacted',
    ).length,
    qualified: normalized.filter(
      (lead) => isActiveLead(lead) && lead.stage === 'Qualified',
    ).length,
    nurture: normalized.filter(
      (lead) => isActiveLead(lead) && lead.stage === 'Nurture',
    ).length,
    converted: normalized.filter(isConvertedLead).length,
    disqualified: normalized.filter(
      (lead) => getLeadLifecycleState(lead) === 'ARCHIVED',
    ).length,
    highValue: normalized.filter(
      (lead) => isActiveLead(lead) && lead.value >= 3500,
    ).length,
  }
}

export function getLeadMetrics(
  leads: LeadRecord[],
  today: string,
  staleActivityCutoff: string,
  timezone = 'America/New_York',
) {
  const normalized = getNormalizedLeads(leads)
  const converted = normalized.filter(isConvertedLead).length
  const active = normalized.filter(isActiveLead)
  const currentMonth = today.slice(0, 7)
  return {
    totalLeads: normalized.length,
    newThisMonth: normalized.filter((lead) =>
      getLeadDateKey(lead.createdAt, timezone)?.startsWith(currentMonth),
    ).length,
    needsFollowUp: selectLeadsNeedingFollowUp(normalized).length,
    conversionRate: Math.round(
      (converted / Math.max(normalized.length, 1)) * 100,
    ),
    activeCount: active.length,
    converted,
    overdue: normalized.filter((lead) => isLeadOverdue(lead, today, timezone))
      .length,
    dueToday: normalized.filter((lead) => isLeadDueToday(lead, today, timezone))
      .length,
    inactive: normalized.filter((lead) =>
      hasStaleLeadActivity(lead, staleActivityCutoff),
    ).length,
  }
}

export function filterLeads(leads: LeadRecord[], filters: LeadFilterState) {
  const query = filters.search?.trim().toLowerCase() ?? ''
  const timezone = filters.timezone ?? 'America/New_York'
  return getNormalizedLeads(leads).filter((lead) => {
    const matchesSearch = query
      ? [
          lead.name,
          lead.company,
          lead.nextStep,
          lead.source,
          filters.ownerName?.(lead) ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      : true
    const matchesStatus =
      !filters.statusFilter ||
      filters.statusFilter === 'All' ||
      lead.status === filters.statusFilter
    const matchesStage =
      !filters.stageFilter ||
      filters.stageFilter === 'All' ||
      lead.stage === filters.stageFilter
    const matchesMetric =
      filters.metric === 'newThisMonth'
        ? getLeadDateKey(lead.createdAt, timezone)?.startsWith(
            filters.today.slice(0, 7),
          )
        : filters.metric === 'needsFollowUp'
          ? selectLeadsNeedingFollowUp([lead]).length === 1
          : true
    const matchesDrilldown = !filters.drilldown
      ? true
      : filters.drilldown.type === 'status'
        ? isActiveLead(lead) && lead.status === filters.drilldown.status
        : filters.drilldown.type === 'stage'
          ? isActiveLead(lead) && lead.stage === filters.drilldown.stage
          : filters.drilldown.type === 'source'
            ? lead.source === filters.drilldown.source
            : filters.drilldown.type === 'followUp'
              ? filters.drilldown.mode === 'overdue'
                ? isLeadOverdue(lead, filters.today, timezone)
                : filters.drilldown.mode === 'today'
                  ? isLeadDueToday(lead, filters.today, timezone)
                  : hasStaleLeadActivity(lead, filters.staleActivityCutoff)
              : filters.drilldown.type === 'conversion'
                ? filters.drilldown.mode === 'converted'
                  ? isConvertedLead(lead)
                  : filters.drilldown.mode === 'open'
                    ? isActiveLead(lead)
                    : getLeadLifecycleState(lead) === 'ARCHIVED'
                : filters.drilldown.type === 'value'
                  ? lead.value >= 3500 && isActiveLead(lead)
                  : true

    return (
      matchesSearch &&
      matchesStatus &&
      matchesStage &&
      matchesMetric &&
      matchesDrilldown
    )
  })
}

export function getLeadStageCount(
  leads: LeadRecord[],
  stage: LeadStatus | 'Converted' | 'Disqualified',
) {
  const normalized = getNormalizedLeads(leads)
  if (stage === 'Converted') return normalized.filter(isConvertedLead).length
  if (stage === 'Disqualified') {
    return normalized.filter(
      (lead) => getLeadLifecycleState(lead) === 'ARCHIVED',
    ).length
  }
  return normalized.filter(
    (lead) => isActiveLead(lead) && lead.status === stage,
  ).length
}

export function getLeadLifecycleStateForRecord(
  lead: LeadRecord,
): LeadLifecycleState {
  return getLeadLifecycleState(lead)
}

export function normalizeLeadSort(
  value: string | null | undefined,
): LeadSortOption {
  switch (value) {
    case 'newestAdded':
    case 'oldestAdded':
    case 'followUpSoonest':
    case 'followUpLatest':
    case 'highestValue':
    case 'lowestValue':
    case 'status':
      return value
    default:
      return 'followUpPriority'
  }
}

export function sortLeads(
  leads: LeadRecord[],
  today: string,
  staleActivityCutoff: string,
  sortBy: LeadSortOption = 'followUpPriority',
  timezone = 'America/New_York',
) {
  return [...getNormalizedLeads(leads)].sort((a, b) =>
    compareLeads(a, b, {
      today,
      staleActivityCutoff,
      sortBy,
      timezone,
    }),
  )
}

export function compareLeads(
  a: LeadRecord,
  b: LeadRecord,
  options: {
    today: string
    staleActivityCutoff: string
    sortBy: LeadSortOption
    timezone?: string
  },
) {
  const timezone = options.timezone ?? 'America/New_York'
  switch (options.sortBy) {
    case 'newestAdded':
      return compareCreatedDesc(a, b, timezone) || compareLeadId(a, b)
    case 'oldestAdded':
      return compareCreatedAsc(a, b, timezone) || compareLeadId(a, b)
    case 'followUpSoonest':
      return (
        compareFollowUpDateAsc(a, b) ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
    case 'followUpLatest':
      return (
        compareFollowUpDateDesc(a, b) ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
    case 'highestValue':
      return (
        b.value - a.value ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
    case 'lowestValue':
      return (
        a.value - b.value ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
    case 'status':
      return (
        compareStatus(a, b) ||
        compareFollowUpPriority(a, b, options.today, timezone) ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
    case 'followUpPriority':
    default:
      return (
        compareLifecyclePriority(a, b) ||
        compareFollowUpPriority(a, b, options.today, timezone) ||
        compareCreatedDesc(a, b, timezone) ||
        compareLeadId(a, b)
      )
  }
}

export function getLeadDateKey(
  value: string | null | undefined,
  timezone = 'America/New_York',
) {
  if (!value) return null
  if (isSchedulingDateKey(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return getWorkspaceDateKey(parsed, timezone)
}

export function getLeadDateTimeMs(
  value: string | null | undefined,
  timezone = 'America/New_York',
) {
  if (!value) return Number.NaN
  if (isSchedulingDateKey(value)) {
    return dateKeyOrdinal(value)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return Number.NaN
  const dateKey = getWorkspaceDateKey(parsed, timezone)
  return dateKeyOrdinal(dateKey) * 100_000_000 + parsed.getTime() / 100_000
}

export function getLeadFollowUpPriority(
  lead: LeadRecord,
  today: string,
  timezone = 'America/New_York',
) {
  if (!isActiveLead(lead)) return 5
  const followUpDate = getLeadDateKey(lead.followUpDue, timezone)
  if (!followUpDate) return 4
  if (followUpDate < today) return 0
  if (followUpDate === today) return 1
  return 2
}

function compareLifecyclePriority(a: LeadRecord, b: LeadRecord) {
  return lifecyclePriority(a) - lifecyclePriority(b)
}

function lifecyclePriority(lead: LeadRecord) {
  return isActiveLead(lead) ? 0 : 1
}

function compareFollowUpPriority(
  a: LeadRecord,
  b: LeadRecord,
  today: string,
  timezone: string,
) {
  const aPriority = getLeadFollowUpPriority(a, today, timezone)
  const bPriority = getLeadFollowUpPriority(b, today, timezone)
  if (aPriority !== bPriority) return aPriority - bPriority

  if (aPriority === 0) {
    return compareFollowUpDateAsc(a, b)
  }
  if (aPriority === 1 || aPriority === 2) {
    return compareFollowUpDateAsc(a, b)
  }
  return 0
}

function compareFollowUpDateAsc(a: LeadRecord, b: LeadRecord) {
  const aDate = getLeadDateKey(a.followUpDue) ?? '9999-12-31'
  const bDate = getLeadDateKey(b.followUpDue) ?? '9999-12-31'
  return aDate.localeCompare(bDate)
}

function compareFollowUpDateDesc(a: LeadRecord, b: LeadRecord) {
  const aDate = getLeadDateKey(a.followUpDue) ?? '0000-00-00'
  const bDate = getLeadDateKey(b.followUpDue) ?? '0000-00-00'
  return bDate.localeCompare(aDate)
}

function compareCreatedDesc(a: LeadRecord, b: LeadRecord, timezone: string) {
  const aTime = getLeadDateTimeMs(a.createdAt, timezone)
  const bTime = getLeadDateTimeMs(b.createdAt, timezone)
  return compareNullableNumberDesc(aTime, bTime)
}

function compareCreatedAsc(a: LeadRecord, b: LeadRecord, timezone: string) {
  const aTime = getLeadDateTimeMs(a.createdAt, timezone)
  const bTime = getLeadDateTimeMs(b.createdAt, timezone)
  return compareNullableNumberAsc(aTime, bTime)
}

function compareStatus(a: LeadRecord, b: LeadRecord) {
  const aStatusRank = statusSortOrder[getLeadLifecycleLabel(a)] ?? 99
  const bStatusRank = statusSortOrder[getLeadLifecycleLabel(b)] ?? 99
  return aStatusRank - bStatusRank
}

function compareLeadId(a: LeadRecord, b: LeadRecord) {
  return a.id.localeCompare(b.id)
}

function compareNullableNumberDesc(a: number, b: number) {
  const aValid = Number.isFinite(a)
  const bValid = Number.isFinite(b)
  if (aValid && bValid) return b - a
  if (aValid) return -1
  if (bValid) return 1
  return 0
}

function compareNullableNumberAsc(a: number, b: number) {
  const aValid = Number.isFinite(a)
  const bValid = Number.isFinite(b)
  if (aValid && bValid) return a - b
  if (aValid) return -1
  if (bValid) return 1
  return 0
}

function dateKeyOrdinal(dateKey: string) {
  if (!isSchedulingDateKey(dateKey)) return Number.NaN
  return Number(dateKey.replaceAll('-', ''))
}

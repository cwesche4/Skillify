import type {
  OpportunityRecord,
  OpportunityStage,
  OpportunityStatus,
} from '@/lib/sales/demoSalesRecords'
import { calculateExpectedRevenue } from '@/lib/workspace-records/businessRules'
import { selectOpenOpportunities } from '@/lib/workspace-records/relationships'

export type OpportunityDashboardSort =
  | 'salesPriority'
  | 'expectedRevenue'
  | 'value'

export const opportunityFollowUpCutoff = '2026-06-20'

export type OpportunityDashboardMetrics = {
  openDeals: OpportunityRecord[]
  forecastable: OpportunityRecord[]
  pipelineValue: number
  expectedRevenue: number
  averageDealSize: number
  averageProbability: number
  needsFollowUp: OpportunityRecord[]
  highRisk: OpportunityRecord[]
  oldestActiveOpportunity: OpportunityRecord | null
}

export function getOpportunityExpectedRevenue(opportunity: OpportunityRecord) {
  return calculateExpectedRevenue(opportunity.value, opportunity.probability)
}

export function getOpportunityDashboardMetrics(
  opportunities: OpportunityRecord[],
): OpportunityDashboardMetrics {
  const openDeals = selectOpenOpportunities(opportunities)
  const forecastable = openDeals.filter(
    (opportunity) => opportunity.probability > 0,
  )
  const pipelineValue = openDeals.reduce(
    (sum, opportunity) => sum + opportunity.value,
    0,
  )
  const expectedRevenue = forecastable.reduce(
    (sum, opportunity) => sum + getOpportunityExpectedRevenue(opportunity),
    0,
  )
  const needsFollowUp = openDeals.filter(
    (opportunity) => opportunity.lastActivityAt <= opportunityFollowUpCutoff,
  )
  const highRisk = opportunities.filter(
    (opportunity) => opportunity.status === 'At Risk',
  )
  const oldestActiveOpportunity =
    [...openDeals].sort((a, b) =>
      (a.lastActivityAt ?? '').localeCompare(b.lastActivityAt ?? ''),
    )[0] ?? null

  return {
    openDeals,
    forecastable,
    pipelineValue,
    expectedRevenue,
    averageDealSize:
      opportunities.length > 0
        ? Math.round(
            opportunities.reduce(
              (sum, opportunity) => sum + opportunity.value,
              0,
            ) / opportunities.length,
          )
        : 0,
    averageProbability:
      forecastable.length > 0
        ? Math.round(
            forecastable.reduce(
              (sum, opportunity) => sum + opportunity.probability,
              0,
            ) / forecastable.length,
          )
        : 0,
    needsFollowUp,
    highRisk,
    oldestActiveOpportunity,
  }
}

function getExpectedCloseSortValue(opportunity: OpportunityRecord) {
  return opportunity.expectedCloseDate ?? '9999-12-31'
}

function getCreatedSortValue(opportunity: OpportunityRecord) {
  return (
    opportunity.convertedAt ??
    opportunity.createdAt ??
    opportunity.lastActivityAt
  )
}

export function compareOpportunitiesByDefaultPriority(
  first: OpportunityRecord,
  second: OpportunityRecord,
) {
  const firstNeedsFollowUp = first.lastActivityAt <= opportunityFollowUpCutoff
  const secondNeedsFollowUp = second.lastActivityAt <= opportunityFollowUpCutoff
  if (firstNeedsFollowUp !== secondNeedsFollowUp) {
    return firstNeedsFollowUp ? -1 : 1
  }

  const closeDateDelta = getExpectedCloseSortValue(first).localeCompare(
    getExpectedCloseSortValue(second),
  )
  if (closeDateDelta !== 0) return closeDateDelta

  const valueDelta = second.value - first.value
  if (valueDelta !== 0) return valueDelta

  return getCreatedSortValue(second).localeCompare(getCreatedSortValue(first))
}

export function sortOpportunitiesForDashboard(
  opportunities: OpportunityRecord[],
  sort: OpportunityDashboardSort,
) {
  if (sort === 'expectedRevenue') {
    return [...opportunities].sort(
      (a, b) =>
        getOpportunityExpectedRevenue(b) - getOpportunityExpectedRevenue(a),
    )
  }

  if (sort === 'value') {
    return [...opportunities].sort((a, b) => b.value - a.value)
  }

  return [...opportunities].sort(compareOpportunitiesByDefaultPriority)
}

export function getOpportunityStatusForChartLabel(
  label: string,
): OpportunityStatus | null {
  if (label === 'Active') return 'Active'
  if (label === 'At Risk') return 'At Risk'
  if (label === 'Closed-Won') return 'Closed-Won'
  if (label === 'Closed-Lost') return 'Closed-Lost'
  return null
}

export function isOpportunityStage(value: string): value is OpportunityStage {
  return [
    'Discovery',
    'Needs Analysis',
    'Site Visit',
    'Scoping',
    'Proposal Preparation',
    'Proposal Sent',
    'Negotiation',
    'Won',
    'Lost',
  ].includes(value)
}

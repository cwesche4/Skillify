import { createCRMReference } from '@/lib/crm/knowledge/crmKnowledgeReferences'
import {
  addCurrency,
  addDaysToDateKey,
  clampScore,
  compareDateKeys,
  dateKeyInTimezone,
  daysBetweenDateKeys,
  daysSince,
  formatCurrency,
  incrementCount,
  isBlank,
  normalizeDateKey,
  resolveCRMKnowledgeThresholds,
  sortByScoreThenId,
  toDateOrNull,
  uniqueSorted,
} from '@/lib/crm/knowledge/crmKnowledgeScoring'
import type {
  CRMActivityFacts,
  CRMActivityKnowledgeRecord,
  CRMClientFacts,
  CRMClientKnowledgeRecord,
  CRMDataQualityFinding,
  CRMEntityType,
  CRMFollowUpFacts,
  CRMFollowUpKnowledgeRecord,
  CRMKnowledgeContextRequest,
  CRMKnowledgeSnapshot,
  CRMKnowledgeSource,
  CRMKnowledgeSummary,
  CRMLeadFacts,
  CRMLeadKnowledgeRecord,
  CRMMeetingKnowledgeRecord,
  CRMOpportunityFacts,
  CRMOpportunityKnowledgeRecord,
  CRMPipelineFacts,
  CRMRecommendation,
  CRMReference,
  CRMRisk,
  CRMTaskKnowledgeRecord,
} from '@/lib/crm/knowledge/crmKnowledgeTypes'

type NormalizedCRMSource = {
  generatedAt: string
  todayKey: string
  contextRequest: CRMKnowledgeContextRequest
  permissionsApplied: string[]
  leads: CRMLeadKnowledgeRecord[]
  followUps: CRMFollowUpKnowledgeRecord[]
  opportunities: CRMOpportunityKnowledgeRecord[]
  clients: CRMClientKnowledgeRecord[]
  tasks: CRMTaskKnowledgeRecord[]
  activities: CRMActivityKnowledgeRecord[]
  meetings: CRMMeetingKnowledgeRecord[]
  references: CRMReference[]
  dataQuality: CRMDataQualityFinding[]
}

type CRMCalculationResult = {
  source: NormalizedCRMSource
  leadFacts: CRMLeadFacts
  opportunityFacts: CRMOpportunityFacts
  pipelineFacts: CRMPipelineFacts
  clientFacts: CRMClientFacts
  followUpFacts: CRMFollowUpFacts
  activityFacts: CRMActivityFacts
  risks: CRMRisk[]
  recommendations: CRMRecommendation[]
  summaries: CRMKnowledgeSummary
}

const CRM_READ_PERMISSIONS = [
  'crm:read',
  'leads:read',
  'opportunities:read',
  'clients:read',
  'tasks:read',
]

export function getCRMKnowledgeContext(source: CRMKnowledgeSource) {
  const calculated = calculateCRMKnowledge(source)
  return {
    generatedAt: calculated.source.generatedAt,
    workspaceId: source.workspace.id,
    timezone: source.workspace.timezone || 'UTC',
    context: calculated.source.contextRequest,
    permissionsApplied: calculated.source.permissionsApplied,
    counts: {
      leads: calculated.leadFacts.total,
      opportunities: calculated.opportunityFacts.total,
      clients: calculated.clientFacts.total,
      openTasks: calculated.activityFacts.openTasks,
      recommendations: calculated.recommendations.length,
      warnings: calculated.source.dataQuality.length,
    },
    priorities: calculated.summaries.todayPriorities,
    deterministic: true,
  }
}

export function getCRMKnowledgeSnapshot(
  source: CRMKnowledgeSource,
): CRMKnowledgeSnapshot {
  const calculated = calculateCRMKnowledge(source)
  const includedEntities: CRMEntityType[] = []
  if (calculated.source.leads.length > 0) includedEntities.push('lead')
  if (calculated.source.opportunities.length > 0)
    includedEntities.push('opportunity')
  if (calculated.source.clients.length > 0) includedEntities.push('client')
  if (calculated.source.tasks.length > 0) includedEntities.push('task')
  if (calculated.source.followUps.length > 0) includedEntities.push('followUp')
  if (calculated.source.activities.length > 0) includedEntities.push('activity')
  if (calculated.source.meetings.length > 0) includedEntities.push('meeting')

  return {
    id: `crm-knowledge:${source.workspace.id}:${calculated.source.generatedAt}`,
    generatedAt: calculated.source.generatedAt,
    workspaceId: source.workspace.id,
    context: {
      request: calculated.source.contextRequest,
      timezone: source.workspace.timezone || 'UTC',
      permissionsApplied: calculated.source.permissionsApplied,
      includedEntities,
    },
    metrics: {
      leads: calculated.leadFacts,
      opportunities: calculated.opportunityFacts,
      clients: calculated.clientFacts,
      followUps: calculated.followUpFacts,
      activities: calculated.activityFacts,
    },
    leadFacts: calculated.leadFacts,
    opportunityFacts: calculated.opportunityFacts,
    pipelineFacts: calculated.pipelineFacts,
    clientFacts: calculated.clientFacts,
    followUpFacts: calculated.followUpFacts,
    activityFacts: calculated.activityFacts,
    risks: calculated.risks,
    recommendations: calculated.recommendations,
    summaries: calculated.summaries,
    references: calculated.source.references,
    warnings: calculated.source.dataQuality,
    dataQuality: calculated.source.dataQuality,
  }
}

export function getCRMKnowledgeRecommendations(
  source: CRMKnowledgeSource,
): CRMRecommendation[] {
  return getCRMKnowledgeSnapshot(source).recommendations
}

export function getCRMKnowledgeExplanation(recommendation: CRMRecommendation) {
  return {
    id: `crm-explanation:${recommendation.targetRecordType}:${recommendation.targetRecordId}`,
    summary: `${recommendation.title}. ${recommendation.summary} This is a deterministic CRM recommendation based on workspace CRM state.`,
    confidence: recommendation.confidence,
    reasons: recommendation.reasonCodes.map((code, index) => ({
      code,
      label: recommendation.supportingFacts[index] ?? code,
      source: 'crm-knowledge-provider',
    })),
    warnings: recommendation.warnings,
    references: recommendation.references,
    metadata: {
      score: recommendation.score,
      urgency: recommendation.urgency,
      deterministic: true,
      suggestedAction: recommendation.suggestedAction,
    },
  }
}

function calculateCRMKnowledge(
  source: CRMKnowledgeSource,
): CRMCalculationResult {
  const normalized = normalizeCRMKnowledgeSource(source)
  const thresholds = resolveCRMKnowledgeThresholds(source.thresholds)
  const risks: CRMRisk[] = []
  const recommendations: CRMRecommendation[] = []
  const leadFacts = calculateLeadFacts(
    normalized,
    thresholds,
    risks,
    recommendations,
  )
  const opportunityFacts = calculateOpportunityFacts(
    normalized,
    thresholds,
    risks,
    recommendations,
  )
  const pipelineFacts = calculatePipelineFacts(normalized, opportunityFacts)
  const clientFacts = calculateClientFacts(normalized)
  const followUpFacts = calculateFollowUpFacts(normalized)
  const activityFacts = calculateActivityFacts(normalized)
  const sortedRecommendations = sortByScoreThenId(recommendations).slice(
    0,
    thresholds.maxRecommendations,
  )
  const summaries = createSummaries({
    normalized,
    leadFacts,
    opportunityFacts,
    pipelineFacts,
    clientFacts,
    followUpFacts,
    activityFacts,
    risks,
    recommendations: sortedRecommendations,
  })

  return {
    source: normalized,
    leadFacts,
    opportunityFacts,
    pipelineFacts,
    clientFacts,
    followUpFacts,
    activityFacts,
    risks,
    recommendations: sortedRecommendations,
    summaries,
  }
}

function normalizeCRMKnowledgeSource(
  source: CRMKnowledgeSource,
): NormalizedCRMSource {
  const workspaceId = source.workspace.id
  const timezone = source.workspace.timezone || 'UTC'
  const now = toDateOrNull(source.now) ?? new Date(0)
  const generatedAt = now.toISOString()
  const todayKey = dateKeyInTimezone(now, timezone)
  const permissionsApplied = uniqueSorted(source.actor.permissions ?? [])
  const dataQuality: CRMDataQualityFinding[] = []

  if (!hasAnyCRMReadPermission(source.actor.permissions)) {
    dataQuality.push({
      id: 'crm-data-quality:permission:crm-read',
      severity: 'blocking',
      category: 'permission',
      explanation:
        'The actor does not have a CRM read permission, so CRM knowledge was withheld.',
      suggestedCorrection:
        'Grant an appropriate workspace CRM read permission before assembling CRM knowledge.',
    })
    return {
      generatedAt,
      todayKey,
      contextRequest: source.context ?? 'general',
      permissionsApplied,
      leads: [],
      followUps: [],
      opportunities: [],
      clients: [],
      tasks: [],
      activities: [],
      meetings: [],
      references: [],
      dataQuality,
    }
  }

  const leads = canRead(source.actor.permissions, 'leads')
    ? filterWorkspaceRecords(
        source.leads ?? [],
        workspaceId,
        'lead',
        dataQuality,
      )
    : []
  const followUps = canRead(source.actor.permissions, 'leads')
    ? filterWorkspaceRecords(
        source.followUps ?? [],
        workspaceId,
        'followUp',
        dataQuality,
      )
    : []
  const opportunities = canRead(source.actor.permissions, 'opportunities')
    ? filterWorkspaceRecords(
        source.opportunities ?? [],
        workspaceId,
        'opportunity',
        dataQuality,
      )
    : []
  const clients = canRead(source.actor.permissions, 'clients')
    ? filterWorkspaceRecords(
        source.clients ?? [],
        workspaceId,
        'client',
        dataQuality,
      )
    : []
  const tasks = canRead(source.actor.permissions, 'tasks')
    ? filterWorkspaceRecords(
        source.tasks ?? [],
        workspaceId,
        'task',
        dataQuality,
      )
    : []
  const activities = canRead(source.actor.permissions, 'crm')
    ? filterWorkspaceRecords(
        source.activities ?? [],
        workspaceId,
        'activity',
        dataQuality,
      )
    : []
  const meetings = canRead(source.actor.permissions, 'crm')
    ? filterWorkspaceRecords(
        source.meetings ?? [],
        workspaceId,
        'meeting',
        dataQuality,
      )
    : []

  const references = [
    ...leads.map((lead) =>
      createCRMReference({
        workspaceId,
        entityType: 'lead',
        entityId: lead.id,
        label: lead.name,
        safeSummary: `${lead.name}${lead.company ? ` at ${lead.company}` : ''}`,
        timestamp: lead.lastActivityAt ?? lead.updatedAt ?? lead.createdAt,
        source: lead.provenance,
        metadata: {
          status: lead.status ?? null,
          stage: lead.stage ?? null,
          ownerId: lead.ownerId ?? null,
        },
      }),
    ),
    ...opportunities.map((opportunity) =>
      createCRMReference({
        workspaceId,
        entityType: 'opportunity',
        entityId: opportunity.id,
        label: opportunity.name,
        safeSummary: `${opportunity.name}${opportunity.client ? ` for ${opportunity.client}` : ''}`,
        timestamp:
          opportunity.lastActivityAt ??
          opportunity.updatedAt ??
          opportunity.createdAt,
        source: opportunity.provenance,
        metadata: {
          status: opportunity.status ?? null,
          stage: opportunity.stage ?? null,
          ownerId: opportunity.ownerId ?? null,
        },
      }),
    ),
    ...clients.map((client) =>
      createCRMReference({
        workspaceId,
        entityType: 'client',
        entityId: client.id,
        label: client.name,
        safeSummary: `${client.name}${client.company ? ` at ${client.company}` : ''}`,
        timestamp: client.lastActivity ?? client.updatedAt ?? client.createdAt,
        source: client.provenance,
        metadata: {
          status: client.status ?? null,
          ownerId: client.ownerId ?? null,
        },
      }),
    ),
  ]

  collectRelationshipFindings({
    workspaceId,
    leads,
    opportunities,
    clients,
    tasks,
    dataQuality,
  })

  return {
    generatedAt,
    todayKey,
    contextRequest: source.context ?? 'general',
    permissionsApplied,
    leads,
    followUps,
    opportunities,
    clients,
    tasks,
    activities,
    meetings,
    references,
    dataQuality,
  }
}

function calculateLeadFacts(
  source: NormalizedCRMSource,
  thresholds: ReturnType<typeof resolveCRMKnowledgeThresholds>,
  risks: CRMRisk[],
  recommendations: CRMRecommendation[],
): CRMLeadFacts {
  const facts: CRMLeadFacts = {
    total: source.leads.length,
    active: 0,
    converted: 0,
    disqualified: 0,
    overdueFollowUps: 0,
    dueTodayFollowUps: 0,
    dueSoonFollowUps: 0,
    missingOwner: 0,
    missingContact: 0,
    missingNextStep: 0,
    stale: 0,
    highValue: 0,
    totalActiveValue: 0,
    averageActiveLeadAgeDays: 0,
    byStatus: {},
    byStage: {},
    bySource: {},
    byOwner: {},
  }
  let activeAgeTotal = 0

  for (const lead of source.leads) {
    incrementCount(facts.byStatus, normalizeLeadStatus(lead))
    incrementCount(facts.byStage, lead.stage)
    incrementCount(facts.bySource, lead.source)
    incrementCount(facts.byOwner, lead.ownerId)

    if (isConvertedLead(lead)) {
      facts.converted += 1
      if (lead.followUpDue) {
        pushFinding(source.dataQuality, {
          category: 'inconsistentLifecycle',
          recordType: 'lead',
          recordId: lead.id,
          explanation:
            'A converted lead still has a follow-up due date in its CRM source data.',
          suggestedCorrection:
            'Clear follow-up due dates after conversion or move the work to the connected record.',
        })
      }
      continue
    }
    if (isDisqualifiedLead(lead)) {
      facts.disqualified += 1
      continue
    }

    facts.active += 1
    facts.totalActiveValue += safeNumber(lead.value)
    activeAgeTotal += Math.max(
      0,
      daysSince(lead.createdAt, source.todayKey) ?? 0,
    )

    const missingOwner = isBlank(lead.ownerId)
    const missingContact =
      isBlank(lead.contactEmail) && isBlank(lead.contactPhone)
    const missingNextStep = isBlank(lead.nextStep)
    const value = safeNumber(lead.value)
    const activityAge =
      daysSince(
        lead.lastActivityAt ?? lead.updatedAt ?? lead.createdAt,
        source.todayKey,
      ) ?? 0
    const isStale = activityAge >= thresholds.staleLeadDays
    const isHighValue = value >= thresholds.highValueLeadThreshold
    const dueStatus = getFollowUpDueStatus(lead, source)

    if (missingOwner) {
      facts.missingOwner += 1
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.assignOwner',
        title: 'Assign a lead owner',
        summary: `${lead.name} has no owner assigned.`,
        urgency: isHighValue ? 'high' : 'medium',
        score: isHighValue ? 78 : 62,
        reasonCodes: ['lead.missingOwner'],
        supportingFacts: ['No owner is assigned to this active lead.'],
        suggestedActionType: 'assignOwner',
      })
      pushFinding(source.dataQuality, {
        category: 'missingOwner',
        recordType: 'lead',
        recordId: lead.id,
        explanation: 'An active lead is missing an owner.',
        suggestedCorrection:
          'Assign a workspace owner before the next follow-up.',
      })
    }
    if (missingContact) {
      facts.missingContact += 1
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.completeContact',
        title: 'Complete lead contact information',
        summary: `${lead.name} is missing both email and phone contact details.`,
        urgency: 'medium',
        score: 58,
        reasonCodes: ['lead.missingContact'],
        supportingFacts: ['No usable email or phone number is available.'],
        suggestedActionType: 'completeContact',
      })
      pushFinding(source.dataQuality, {
        category: 'missingContact',
        recordType: 'lead',
        recordId: lead.id,
        explanation: 'An active lead has no email or phone number.',
        suggestedCorrection: 'Add at least one reliable contact method.',
      })
    }
    if (missingNextStep) {
      facts.missingNextStep += 1
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.addNextStep',
        title: 'Add the next lead step',
        summary: `${lead.name} has no next action recorded.`,
        urgency: 'medium',
        score: 60,
        reasonCodes: ['lead.missingNextStep'],
        supportingFacts: ['No next step is recorded for this active lead.'],
        suggestedActionType: 'addNextStep',
      })
      pushFinding(source.dataQuality, {
        category: 'missingNextStep',
        recordType: 'lead',
        recordId: lead.id,
        explanation: 'An active lead is missing a next step.',
        suggestedCorrection: 'Record the next action so the lead can progress.',
      })
    }
    if (isStale) {
      facts.stale += 1
      addRisk(source, risks, 'lead', lead.id, lead.name, {
        severity:
          activityAge >= thresholds.staleLeadDays * 2 ? 'high' : 'medium',
        explanation: `${lead.name} has no recent lead activity for ${activityAge} days.`,
        score: clampScore(45 + activityAge),
      })
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.reviewStaleRecord',
        title: 'Review stale lead activity',
        summary: `${lead.name} has not had recent CRM activity.`,
        urgency: isHighValue ? 'high' : 'medium',
        score: clampScore(52 + activityAge + (isHighValue ? 10 : 0)),
        reasonCodes: ['lead.staleActivity'],
        supportingFacts: [`No recent activity for ${activityAge} days.`],
        suggestedActionType: 'reviewLead',
      })
    }
    if (isHighValue) facts.highValue += 1
    if (dueStatus === 'overdue') {
      facts.overdueFollowUps += 1
      const dueAge = Math.max(
        0,
        daysBetweenDateKeys(lead.followUpDue!, source.todayKey),
      )
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.followUpLead',
        title: 'Follow up with overdue lead',
        summary: `${lead.name} has an overdue follow-up.`,
        urgency: dueAge >= 3 || isHighValue ? 'critical' : 'high',
        score: clampScore(80 + dueAge + (isHighValue ? 8 : 0)),
        reasonCodes: ['lead.followUpOverdue'],
        supportingFacts: [
          `Follow-up was due ${dueAge} day${dueAge === 1 ? '' : 's'} ago.`,
        ],
        suggestedActionType: 'scheduleFollowUp',
      })
    } else if (dueStatus === 'today') {
      facts.dueTodayFollowUps += 1
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.followUpLead',
        title: 'Complete today’s lead follow-up',
        summary: `${lead.name} has a follow-up due today.`,
        urgency: isHighValue ? 'high' : 'medium',
        score: isHighValue ? 72 : 64,
        reasonCodes: ['lead.followUpDueToday'],
        supportingFacts: ['Follow-up is due today in the workspace timezone.'],
        suggestedActionType: 'scheduleFollowUp',
      })
    } else if (dueStatus === 'soon') {
      facts.dueSoonFollowUps += 1
    }
    if (isQualifiedLead(lead)) {
      addLeadRecommendation(source, recommendations, lead, {
        type: 'crm.convertQualifiedLead',
        title: 'Review qualified lead conversion',
        summary: `${lead.name} is qualified and not converted.`,
        urgency: isHighValue ? 'high' : 'medium',
        score: isHighValue ? 76 : 66,
        reasonCodes: ['lead.qualifiedNotConverted'],
        supportingFacts: [
          'Lead stage/status indicates qualification without conversion.',
        ],
        suggestedActionType: 'reviewConversion',
      })
    }
  }

  facts.averageActiveLeadAgeDays =
    facts.active > 0 ? Math.round(activeAgeTotal / facts.active) : 0
  return facts
}

function calculateOpportunityFacts(
  source: NormalizedCRMSource,
  thresholds: ReturnType<typeof resolveCRMKnowledgeThresholds>,
  risks: CRMRisk[],
  recommendations: CRMRecommendation[],
): CRMOpportunityFacts {
  const facts: CRMOpportunityFacts = {
    total: source.opportunities.length,
    open: 0,
    won: 0,
    lost: 0,
    atRisk: 0,
    stale: 0,
    missingOwner: 0,
    missingNextStep: 0,
    overdueCloseDate: 0,
    pipelineValue: 0,
    weightedExpectedRevenue: 0,
    atRiskValue: 0,
    stalledValue: 0,
    unassignedValue: 0,
    overdueCloseValue: 0,
    byStage: {},
    byOwner: {},
  }

  for (const opportunity of source.opportunities) {
    const status = normalizeOpportunityStatus(opportunity)
    const value = safeNumber(opportunity.value)
    const probability = clampProbability(opportunity.probability)
    addCurrency(facts.byStage, opportunity.stage, value)
    addCurrency(facts.byOwner, opportunity.ownerId, value)

    if (status === 'won') {
      facts.won += 1
      continue
    }
    if (status === 'lost') {
      facts.lost += 1
      continue
    }

    facts.open += 1
    facts.pipelineValue += value
    facts.weightedExpectedRevenue += Number.isFinite(
      opportunity.expectedRevenue ?? NaN,
    )
      ? Math.round(opportunity.expectedRevenue!)
      : Math.round(value * (probability / 100))

    const activityAge =
      daysSince(
        opportunity.lastActivityAt ??
          opportunity.updatedAt ??
          opportunity.createdAt,
        source.todayKey,
      ) ?? 0
    const missingOwner = isBlank(opportunity.ownerId)
    const missingNextStep = isBlank(opportunity.nextStep)
    const isStale = activityAge >= thresholds.staleOpportunityDays
    const isAtRisk =
      status === 'atRisk' ||
      isStale ||
      missingNextStep ||
      missingOwner ||
      isOverdueDate(opportunity.expectedCloseDate, source.todayKey)

    if (isAtRisk) {
      facts.atRisk += 1
      facts.atRiskValue += value
      addRisk(source, risks, 'opportunity', opportunity.id, opportunity.name, {
        severity:
          value >= thresholds.highValueOpportunityThreshold ? 'high' : 'medium',
        explanation: `${opportunity.name} has one or more deterministic pipeline risk indicators.`,
        score: clampScore(
          55 + (value >= thresholds.highValueOpportunityThreshold ? 15 : 0),
        ),
      })
    }
    if (isStale) {
      facts.stale += 1
      facts.stalledValue += value
      addOpportunityRecommendation(source, recommendations, opportunity, {
        type: 'crm.reviewStaleRecord',
        title: 'Re-engage stalled opportunity',
        summary: `${opportunity.name} has no recent opportunity activity.`,
        urgency:
          value >= thresholds.highValueOpportunityThreshold ? 'high' : 'medium',
        score: clampScore(
          58 +
            activityAge +
            (value >= thresholds.highValueOpportunityThreshold ? 10 : 0),
        ),
        reasonCodes: ['opportunity.staleActivity'],
        supportingFacts: [`No recent activity for ${activityAge} days.`],
        suggestedActionType: 'reviewOpportunity',
      })
    }
    if (missingOwner) {
      facts.missingOwner += 1
      facts.unassignedValue += value
      addOpportunityRecommendation(source, recommendations, opportunity, {
        type: 'crm.assignOwner',
        title: 'Assign an opportunity owner',
        summary: `${opportunity.name} has no owner assigned.`,
        urgency:
          value >= thresholds.highValueOpportunityThreshold ? 'high' : 'medium',
        score: value >= thresholds.highValueOpportunityThreshold ? 78 : 62,
        reasonCodes: ['opportunity.missingOwner'],
        supportingFacts: ['No owner is assigned to this open opportunity.'],
        suggestedActionType: 'assignOwner',
      })
      pushFinding(source.dataQuality, {
        category: 'missingOwner',
        recordType: 'opportunity',
        recordId: opportunity.id,
        explanation: 'An open opportunity is missing an owner.',
        suggestedCorrection:
          'Assign a workspace owner before the next sales activity.',
      })
    }
    if (missingNextStep) {
      facts.missingNextStep += 1
      addOpportunityRecommendation(source, recommendations, opportunity, {
        type: 'crm.addNextStep',
        title: 'Add the next opportunity step',
        summary: `${opportunity.name} has no next action recorded.`,
        urgency: 'medium',
        score: 64,
        reasonCodes: ['opportunity.missingNextStep'],
        supportingFacts: [
          'No next step is recorded for this open opportunity.',
        ],
        suggestedActionType: 'addNextStep',
      })
      pushFinding(source.dataQuality, {
        category: 'missingNextStep',
        recordType: 'opportunity',
        recordId: opportunity.id,
        explanation: 'An open opportunity is missing a next step.',
        suggestedCorrection:
          'Record the next action so the opportunity can progress.',
      })
    }
    if (isOverdueDate(opportunity.expectedCloseDate, source.todayKey)) {
      facts.overdueCloseDate += 1
      facts.overdueCloseValue += value
      addOpportunityRecommendation(source, recommendations, opportunity, {
        type: 'crm.updateOpportunityCloseDate',
        title: 'Update overdue close date',
        summary: `${opportunity.name} has an expected close date in the past.`,
        urgency:
          value >= thresholds.highValueOpportunityThreshold ? 'high' : 'medium',
        score: value >= thresholds.highValueOpportunityThreshold ? 74 : 60,
        reasonCodes: ['opportunity.closeDateOverdue'],
        supportingFacts: [
          'Expected close date is before the workspace-local current date.',
        ],
        suggestedActionType: 'updateCloseDate',
      })
    }
  }

  return facts
}

function calculatePipelineFacts(
  source: NormalizedCRMSource,
  opportunityFacts: CRMOpportunityFacts,
): CRMPipelineFacts {
  const stages = Object.entries(opportunityFacts.byStage)
    .filter(([, value]) => value.value > 0)
    .sort((first, second) => second[1].value - first[1].value)
  const topStage = stages[0] ?? null
  const topStageShare =
    topStage && opportunityFacts.pipelineValue > 0
      ? Math.round((topStage[1].value / opportunityFacts.pipelineValue) * 100)
      : 0
  const topDeals = source.opportunities
    .filter((opportunity) => normalizeOpportunityStatus(opportunity) === 'open')
    .map((opportunity) => ({
      id: opportunity.id,
      label: opportunity.name,
      value: safeNumber(opportunity.value),
      stage: opportunity.stage ?? 'Unspecified',
      score: clampScore(safeNumber(opportunity.probability)),
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 5)

  return {
    stageCount: stages.length,
    topStageByValue: topStage?.[0] ?? null,
    topStageShare,
    concentrationRisk:
      topStageShare >= 60 ? 'high' : topStageShare >= 40 ? 'medium' : 'low',
    bottlenecks: stages
      .filter(([, value]) => value.count >= 2)
      .map(([stage, value]) => ({
        stage,
        count: value.count,
        value: value.value,
        reason: `${value.count} open opportunities are concentrated in ${stage}.`,
      })),
    topDeals,
  }
}

function calculateClientFacts(source: NormalizedCRMSource): CRMClientFacts {
  const facts: CRMClientFacts = {
    total: source.clients.length,
    active: 0,
    inactive: 0,
    newLast30Days: 0,
    missingOwner: 0,
    missingContact: 0,
    openTasks: 0,
    openServiceRequests: 0,
    linkedFromLeads: 0,
    linkedFromOpportunities: 0,
    byStatus: {},
    byHealth: {},
  }

  for (const client of source.clients) {
    incrementCount(facts.byStatus, client.status)
    incrementCount(facts.byHealth, client.health)
    if (/inactive|completed/i.test(client.status ?? '')) facts.inactive += 1
    else facts.active += 1
    if ((daysSince(client.createdAt, source.todayKey) ?? 999) <= 30) {
      facts.newLast30Days += 1
    }
    if (isBlank(client.ownerId)) {
      facts.missingOwner += 1
      pushFinding(source.dataQuality, {
        category: 'missingOwner',
        recordType: 'client',
        recordId: client.id,
        explanation: 'A client record is missing an owner.',
        suggestedCorrection:
          'Assign a workspace owner to clarify accountability.',
      })
    }
    if (isBlank(client.email) && isBlank(client.phone)) {
      facts.missingContact += 1
      pushFinding(source.dataQuality, {
        category: 'missingContact',
        recordType: 'client',
        recordId: client.id,
        explanation: 'A client record has no email or phone number.',
        suggestedCorrection: 'Add at least one reliable client contact method.',
      })
    }
    facts.openTasks += Math.max(0, safeNumber(client.openTasks))
    facts.openServiceRequests += Math.max(
      0,
      safeNumber(client.openServiceRequests),
    )
    if (client.sourceLeadId) facts.linkedFromLeads += 1
    if (client.sourceOpportunityId) facts.linkedFromOpportunities += 1
  }

  if (source.clients.length > 0) {
    pushFinding(source.dataQuality, {
      category: 'dataLimitation',
      severity: 'info',
      explanation:
        'Client revenue and lifetime value are not authoritative in the current CRM source.',
      suggestedCorrection:
        'Use commerce/order sources for revenue until CRM revenue persistence is introduced.',
    })
  }

  return facts
}

function calculateFollowUpFacts(source: NormalizedCRMSource): CRMFollowUpFacts {
  const facts: CRMFollowUpFacts = {
    total: source.followUps.length,
    completed: 0,
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
    noResponse: 0,
    workloadByOwner: {},
  }

  for (const followUp of source.followUps) {
    if (followUp.completedAt) facts.completed += 1
    if (/no response|unresponsive/i.test(followUp.outcome ?? ''))
      facts.noResponse += 1
    incrementCount(facts.workloadByOwner, followUp.ownerId)
    const dueKey = normalizeDateKey(followUp.dueAt)
    if (!dueKey || followUp.completedAt) continue
    if (dueKey < source.todayKey) facts.overdue += 1
    else if (dueKey === source.todayKey) facts.dueToday += 1
    else facts.upcoming += 1
  }

  return facts
}

function calculateActivityFacts(source: NormalizedCRMSource): CRMActivityFacts {
  const todayMinus7 = addDaysToDateKey(source.todayKey, -7)
  const openTasks = source.tasks.filter(
    (task) => !/completed|canceled/i.test(task.status ?? ''),
  )
  return {
    total: source.activities.length,
    recent: source.activities.filter(
      (activity) => (normalizeDateKey(activity.timestamp) ?? '') >= todayMinus7,
    ).length,
    meetings: source.meetings.length,
    tasks: source.tasks.length,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter(
      (task) =>
        (normalizeDateKey(task.dueDate) ?? '9999-12-31') < source.todayKey,
    ).length,
  }
}

function createSummaries({
  normalized,
  leadFacts,
  opportunityFacts,
  pipelineFacts,
  clientFacts,
  followUpFacts,
  activityFacts,
  risks,
  recommendations,
}: {
  normalized: NormalizedCRMSource
  leadFacts: CRMLeadFacts
  opportunityFacts: CRMOpportunityFacts
  pipelineFacts: CRMPipelineFacts
  clientFacts: CRMClientFacts
  followUpFacts: CRMFollowUpFacts
  activityFacts: CRMActivityFacts
  risks: CRMRisk[]
  recommendations: CRMRecommendation[]
}): CRMKnowledgeSummary {
  return {
    todayPriorities: recommendations
      .slice(0, 5)
      .map((recommendation) => recommendation.title),
    overdueFollowUps: normalized.leads
      .filter((lead) => getFollowUpDueStatus(lead, normalized) === 'overdue')
      .map((lead) => lead.name)
      .slice(0, 8),
    leadPipelineSummary: `${leadFacts.active} active leads with ${leadFacts.overdueFollowUps} overdue follow-ups and ${formatCurrency(leadFacts.totalActiveValue)} active lead value.`,
    opportunityPipelineSummary: `${opportunityFacts.open} open opportunities worth ${formatCurrency(opportunityFacts.pipelineValue)} with ${formatCurrency(opportunityFacts.weightedExpectedRevenue)} weighted expected revenue.`,
    stalledRecords: risks
      .filter((risk) => /stale|recent|risk/i.test(risk.explanation))
      .map((risk) => risk.title)
      .slice(0, 8),
    atRiskRevenue: formatCurrency(opportunityFacts.atRiskValue),
    ownerWorkload: Object.entries({
      ...leadFacts.byOwner,
      ...followUpFacts.workloadByOwner,
    })
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5)
      .map(([owner, count]) => `${owner}: ${count}`),
    leadSourcePerformance: Object.entries(leadFacts.bySource)
      .sort((first, second) => second[1] - first[1])
      .map(([source, count]) => `${source}: ${count}`)
      .slice(0, 5),
    recentChanges: [
      `${activityFacts.recent} recent CRM activities`,
      `${clientFacts.newLast30Days} new clients in the last 30 days`,
      pipelineFacts.topStageByValue
        ? `${pipelineFacts.topStageByValue} is the largest open stage by value`
        : 'No open pipeline stage concentration detected',
    ],
    upcomingSalesActivity: [
      `${leadFacts.dueTodayFollowUps} lead follow-ups due today`,
      `${leadFacts.dueSoonFollowUps} lead follow-ups due soon`,
      `${followUpFacts.upcoming} explicit follow-up records upcoming`,
    ],
  }
}

function addLeadRecommendation(
  source: NormalizedCRMSource,
  recommendations: CRMRecommendation[],
  lead: CRMLeadKnowledgeRecord,
  input: {
    type: CRMRecommendation['type']
    title: string
    summary: string
    urgency: CRMRecommendation['urgency']
    score: number
    reasonCodes: string[]
    supportingFacts: string[]
    suggestedActionType: string
  },
) {
  addRecommendation(source, recommendations, {
    ...input,
    targetRecordType: 'lead',
    targetRecordId: lead.id,
    targetLabel: lead.name,
    reference: referenceFor(source, 'lead', lead.id),
  })
}

function addOpportunityRecommendation(
  source: NormalizedCRMSource,
  recommendations: CRMRecommendation[],
  opportunity: CRMOpportunityKnowledgeRecord,
  input: {
    type: CRMRecommendation['type']
    title: string
    summary: string
    urgency: CRMRecommendation['urgency']
    score: number
    reasonCodes: string[]
    supportingFacts: string[]
    suggestedActionType: string
  },
) {
  addRecommendation(source, recommendations, {
    ...input,
    targetRecordType: 'opportunity',
    targetRecordId: opportunity.id,
    targetLabel: opportunity.name,
    reference: referenceFor(source, 'opportunity', opportunity.id),
  })
}

function addRecommendation(
  source: NormalizedCRMSource,
  recommendations: CRMRecommendation[],
  input: {
    type: CRMRecommendation['type']
    targetRecordType: CRMEntityType
    targetRecordId: string
    targetLabel: string
    title: string
    summary: string
    urgency: CRMRecommendation['urgency']
    score: number
    reasonCodes: string[]
    supportingFacts: string[]
    suggestedActionType: string
    reference: CRMReference | null
  },
) {
  recommendations.push({
    id: `crm-recommendation:${input.type}:${input.targetRecordType}:${input.targetRecordId}`,
    type: input.type,
    targetRecordType: input.targetRecordType,
    targetRecordId: input.targetRecordId,
    targetLabel: input.targetLabel,
    title: input.title,
    summary: input.summary,
    urgency: input.urgency,
    score: clampScore(input.score),
    confidence:
      input.score >= 75 ? 'high' : input.score >= 55 ? 'medium' : 'low',
    reasonCodes: input.reasonCodes,
    supportingFacts: input.supportingFacts,
    references: input.reference ? [input.reference] : [],
    warnings: source.dataQuality.filter(
      (finding) =>
        finding.recordType === input.targetRecordType &&
        finding.recordId === input.targetRecordId,
    ),
    suggestedAction: {
      type: input.suggestedActionType,
      approvalRequired: true,
      executionStatus: 'notStarted',
    },
    deterministic: true,
    source: {
      provider: 'crm',
      engine: 'CRM Knowledge Provider',
      version: 'foundation',
      scoreScale: '0-100',
    },
  })
}

function addRisk(
  source: NormalizedCRMSource,
  risks: CRMRisk[],
  recordType: CRMEntityType,
  recordId: string,
  label: string,
  input: {
    severity: CRMRisk['severity']
    explanation: string
    score: number
  },
) {
  risks.push({
    id: `crm-risk:${recordType}:${recordId}`,
    severity: input.severity,
    recordType,
    recordId,
    title: label,
    explanation: input.explanation,
    score: clampScore(input.score),
    referenceIds: [referenceFor(source, recordType, recordId)?.id ?? ''].filter(
      Boolean,
    ),
  })
}

function getFollowUpDueStatus(
  lead: CRMLeadKnowledgeRecord,
  source: NormalizedCRMSource,
): 'overdue' | 'today' | 'soon' | 'future' | 'none' {
  const dueKey = normalizeDateKey(lead.followUpDue)
  if (!dueKey) return 'none'
  if (hasCompletedFollowUpForDueDate(lead.id, dueKey, source.followUps))
    return 'none'
  if (dueKey < source.todayKey) return 'overdue'
  if (dueKey === source.todayKey) return 'today'
  if (dueKey <= addDaysToDateKey(source.todayKey, 3)) return 'soon'
  return 'future'
}

function hasCompletedFollowUpForDueDate(
  leadId: string,
  dueKey: string,
  followUps: CRMFollowUpKnowledgeRecord[],
) {
  return followUps.some((followUp) => {
    if (followUp.leadId !== leadId || !followUp.completedAt) return false
    const completedKey = normalizeDateKey(followUp.completedAt)
    return Boolean(completedKey && completedKey >= dueKey)
  })
}

function collectRelationshipFindings({
  leads,
  opportunities,
  clients,
  tasks,
  dataQuality,
}: {
  workspaceId: string
  leads: CRMLeadKnowledgeRecord[]
  opportunities: CRMOpportunityKnowledgeRecord[]
  clients: CRMClientKnowledgeRecord[]
  tasks: CRMTaskKnowledgeRecord[]
  dataQuality: CRMDataQualityFinding[]
}) {
  const leadIds = new Set(leads.map((lead) => lead.id))
  const opportunityIds = new Set(
    opportunities.map((opportunity) => opportunity.id),
  )
  const clientIds = new Set(clients.map((client) => client.id))

  for (const opportunity of opportunities) {
    const sourceLeadId = opportunity.sourceLeadId ?? opportunity.leadId
    if (sourceLeadId && !leadIds.has(sourceLeadId)) {
      pushFinding(dataQuality, {
        category: 'orphanedRelationship',
        recordType: 'opportunity',
        recordId: opportunity.id,
        explanation:
          'An opportunity references a source lead that is not present in the workspace CRM source.',
        suggestedCorrection:
          'Repair or remove the orphaned source lead relationship.',
      })
    }
    if (opportunity.clientId && !clientIds.has(opportunity.clientId)) {
      pushFinding(dataQuality, {
        category: 'orphanedRelationship',
        recordType: 'opportunity',
        recordId: opportunity.id,
        explanation:
          'An opportunity references a client that is not present in the workspace CRM source.',
        suggestedCorrection:
          'Repair or remove the orphaned client relationship.',
      })
    }
  }

  for (const task of tasks) {
    if (
      task.relatedRecordType === 'lead' &&
      !leadIds.has(task.relatedRecordId ?? '')
    ) {
      pushFinding(dataQuality, {
        category: 'orphanedRelationship',
        recordType: 'task',
        recordId: task.id,
        explanation: 'A CRM task references a missing lead.',
        suggestedCorrection:
          'Reconnect the task to an existing lead or archive it.',
      })
    }
    if (
      task.relatedRecordType === 'opportunity' &&
      !opportunityIds.has(task.relatedRecordId ?? '')
    ) {
      pushFinding(dataQuality, {
        category: 'orphanedRelationship',
        recordType: 'task',
        recordId: task.id,
        explanation: 'A CRM task references a missing opportunity.',
        suggestedCorrection:
          'Reconnect the task to an existing opportunity or archive it.',
      })
    }
  }
}

function filterWorkspaceRecords<T extends { id: string; workspaceId: string }>(
  records: T[],
  workspaceId: string,
  recordType: CRMEntityType,
  dataQuality: CRMDataQualityFinding[],
): T[] {
  const result: T[] = []
  for (const record of records) {
    if (record.workspaceId !== workspaceId) {
      pushFinding(dataQuality, {
        category: 'workspaceScope',
        severity: 'blocking',
        recordType,
        recordId: record.id,
        explanation:
          'A CRM source record was excluded because it belongs to a different workspace.',
        suggestedCorrection:
          'Assemble CRM knowledge only from records scoped to the active workspace.',
      })
      continue
    }
    result.push(record)
  }
  return result
}

function pushFinding(
  findings: CRMDataQualityFinding[],
  finding: Omit<CRMDataQualityFinding, 'id' | 'severity'> & {
    severity?: CRMDataQualityFinding['severity']
  },
) {
  const id = [
    'crm-data-quality',
    finding.category,
    finding.recordType ?? 'workspace',
    finding.recordId ?? findings.length,
  ].join(':')
  if (findings.some((item) => item.id === id)) return
  findings.push({
    id,
    severity: finding.severity ?? 'warning',
    ...finding,
  })
}

function referenceFor(
  source: NormalizedCRMSource,
  entityType: CRMEntityType,
  entityId: string,
) {
  return (
    source.references.find(
      (reference) =>
        reference.entityType === entityType && reference.entityId === entityId,
    ) ?? null
  )
}

function hasAnyCRMReadPermission(permissions: string[]) {
  return CRM_READ_PERMISSIONS.some((permission) =>
    permissions.includes(permission),
  )
}

function canRead(
  permissions: string[],
  entity: 'crm' | 'leads' | 'opportunities' | 'clients' | 'tasks',
) {
  if (permissions.includes('crm:read')) {
    return true
  }
  if (entity === 'crm') return permissions.includes('crm:read')
  return permissions.includes(`${entity}:read`)
}

function normalizeLeadStatus(lead: CRMLeadKnowledgeRecord) {
  if (isConvertedLead(lead)) return 'Converted'
  if (isDisqualifiedLead(lead)) return 'Disqualified'
  return lead.status ?? lead.stage ?? 'Unspecified'
}

function isConvertedLead(lead: CRMLeadKnowledgeRecord) {
  return (
    Boolean(lead.converted) ||
    /converted/i.test(`${lead.status ?? ''} ${lead.stage ?? ''}`)
  )
}

function isDisqualifiedLead(lead: CRMLeadKnowledgeRecord) {
  return /disqualified|lost|archived/i.test(
    `${lead.status ?? ''} ${lead.stage ?? ''}`,
  )
}

function isQualifiedLead(lead: CRMLeadKnowledgeRecord) {
  return (
    /qualified/i.test(`${lead.status ?? ''} ${lead.stage ?? ''}`) &&
    !isConvertedLead(lead)
  )
}

function normalizeOpportunityStatus(
  opportunity: CRMOpportunityKnowledgeRecord,
): 'open' | 'won' | 'lost' | 'atRisk' {
  const status =
    `${opportunity.status ?? ''} ${opportunity.stage ?? ''}`.toLowerCase()
  if (status.includes('closed-won') || /\bwon\b/.test(status)) return 'won'
  if (status.includes('closed-lost') || /\blost\b/.test(status)) return 'lost'
  if (status.includes('risk')) return 'atRisk'
  return 'open'
}

function isOverdueDate(value: string | undefined, todayKey: string) {
  const dateKey = normalizeDateKey(value)
  return Boolean(dateKey && compareDateKeys(dateKey, todayKey) < 0)
}

function safeNumber(value?: number) {
  return Number.isFinite(value ?? NaN) ? Number(value) : 0
}

function clampProbability(value?: number) {
  if (!Number.isFinite(value ?? NaN)) return 0
  return Math.max(0, Math.min(100, Math.round(value!)))
}

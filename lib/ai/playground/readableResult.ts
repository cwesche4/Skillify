import { formatRecommendationScoreLabel } from '@/lib/ai/playground/recommendationFormatting'

export type AIPlaygroundReadableWarning = {
  id: string
  message: string
  severity: 'info' | 'warning' | 'blocking'
}

export type AIPlaygroundReadableRecommendation = {
  id: string
  title: string
  targetLabel?: string
  explanation?: string
  confidence?: string
  scoreLabel: string
  reasons: string[]
  warnings: string[]
  source: string
  deterministic: boolean
  approvalRequired?: boolean
}

export type AIPlaygroundReadableProposal = {
  id: string
  title: string
  target?: string
  targetDetail?: string
  summary?: string
  currentState?: string
  proposedState?: string
  reasons: string[]
  expectedImpact: string[]
  warnings: string[]
  explanation: string
  approvalRequired: boolean
  executionStatus: string
  validationStatus: 'valid' | 'incomplete' | 'unknown'
  validationMessage?: string
}

export type AIPlaygroundReadableProposalPlan = {
  id: string
  title: string
  objective: string
  affectedRecords: string[]
  expectedImpact: string[]
  warnings: string[]
  riskLevel?: string
  approvalRequired: boolean
  executionStatus: string
  validationStatus: 'valid' | 'incomplete' | 'unknown'
  validationMessage?: string
  steps: Array<{
    id: string
    order: number
    actionType: string
    target?: string
    currentState?: string
    proposedState?: string
    reason?: string
    dependencies: string[]
    approvalStatus?: string
    executionStatus: string
  }>
}

export type AIPlaygroundReadableResult = {
  title: string
  summary: string
  details: string[]
  recommendations: AIPlaygroundReadableRecommendation[]
  warnings: AIPlaygroundReadableWarning[]
  proposals: AIPlaygroundReadableProposal[]
  proposalPlans: AIPlaygroundReadableProposalPlan[]
  proposalUnavailable?: boolean
  followUpSuggestions: string[]
  emptyState?: {
    title: string
    message: string
  }
  provenance: {
    runtimeProvider: string
    knowledgeProvider: string
    deterministicFacts: boolean
    execution: string
    confidence: string
    providerOutcome: string
    generationStatus: string
    responseSourceLabel: string
  }
  displayWarning?: string
}

export function buildAIPlaygroundReadableResult(
  payload: unknown,
): AIPlaygroundReadableResult {
  const result = asRecord(payload)
  const response = asRecord(result.response)
  const inspection = asRecord(result.inspection)
  const provider = asRecord(result.provider)
  const providerVerification = asRecord(inspection.providerVerification)
  const recommendationSource = asRecord(
    providerVerification.recommendationSource ??
      inspection.recommendationSource,
  )
  const workspaceAIResponse = asRecord(response.workspaceAIResponse)
  const runtimeResponse = asRecord(workspaceAIResponse.runtimeResponse)
  const structuredResponse = asRecord(runtimeResponse.structuredResponse)
  const domain = inferDomain({ response, recommendationSource })
  const intent =
    readString(response.intent) ?? readString(response.routedIntent)
  const title = titleForIntent({ domain, intent, response })
  const answer = asRecord(structuredResponse.answer)
  const workspaceAnswer = asRecord(workspaceAIResponse.answer)
  const directAnswer = asRecord(response.answer)
  const summary =
    readString(directAnswer.summary) ??
    readString(workspaceAnswer.summary) ??
    readString(answer.summary) ??
    readString(structuredResponse.reasoningSummary) ??
    deterministicSummary({ domain, response }) ??
    readString(response.summary && asRecord(response.summary).summary) ??
    readString(response.analysis && asRecord(response.analysis).summary) ??
    readString(firstRecord(response.explanations)?.summary) ??
    fallbackSummary(domain)
  const details = uniqueStrings([
    ...readStringArray(directAnswer.details),
    ...readStringArray(workspaceAnswer.details),
    ...readStringArray(answer.details),
    ...deterministicDetails({ domain, response }),
  ]).slice(0, 12)
  const recommendations = normalizeRecommendations(response.recommendations)
  const proposals = normalizeProposals(response.actionProposals)
  const proposalPlans = normalizeProposalPlans(
    response.actionProposalPlans ??
      response.proposalPlans ??
      structuredResponse.actionProposalPlans,
  )
  const proposalRequested =
    response.actionProposalRequested === true ||
    response.includeActionProposal === true ||
    response.requestedActionProposal === true
  const warnings = normalizeWarnings([
    ...readArray(response.warnings),
    ...readArray(structuredResponse.warnings),
    ...recommendations.flatMap((recommendation) =>
      recommendation.warnings.map((message) => ({
        message,
        severity: 'warning',
      })),
    ),
    ...domainEmptyWarnings({ domain, response }),
  ])
  const followUpSuggestions = uniqueStrings([
    ...readStringArray(response.followUpSuggestions),
    ...readStringArray(workspaceAIResponse.followUpSuggestions),
    ...readStringArray(runtimeResponse.followUpSuggestions),
    ...readStringArray(structuredResponse.followUpSuggestions),
  ]).slice(0, 6)
  const emptyState = emptyStateFor({
    domain,
    response,
    recommendations,
    summary,
  })
  const runtimeProvider =
    readString(provider.label) ??
    readString(providerVerification.selectedProviderLabel) ??
    'Unknown'
  const knowledgeProvider =
    readString(recommendationSource.sourceEngine) ??
    (domain === 'crm'
      ? 'CRM Knowledge Provider'
      : domain === 'workspace'
        ? 'Workspace Investigation'
        : 'Scheduling Knowledge')
  const deterministicFacts = recommendationSource.deterministic !== false
  const aiInvoked = providerVerification.invoked === true
  const providerOutcome =
    readString(runtimeResponse.providerOutcome) ?? 'deterministicFallback'
  const generationStatus = generationStatusLabel(providerOutcome)
  const displayWarning = summary
    ? undefined
    : 'Response completed, but the structured result could not be displayed.'

  return {
    title,
    summary: summary || displayWarning || fallbackSummary(domain),
    details,
    recommendations,
    warnings,
    proposals,
    proposalPlans,
    proposalUnavailable:
      proposalRequested && !proposals.length && !proposalPlans.length,
    followUpSuggestions,
    emptyState,
    provenance: {
      runtimeProvider,
      knowledgeProvider,
      deterministicFacts,
      execution: readString(inspection.actionExecution) ?? 'not-executed',
      confidence: readString(response.confidence) ?? 'unknown',
      providerOutcome,
      generationStatus,
      responseSourceLabel: responseSourceLabel({
        aiInvoked,
        runtimeProvider,
        knowledgeProvider,
        providerOutcome,
      }),
    },
    displayWarning,
  }
}

function generationStatusLabel(providerOutcome: string) {
  if (providerOutcome === 'generated') return 'Generated'
  if (providerOutcome === 'providerTimeout') return 'Completed with fallback'
  if (providerOutcome === 'providerUnavailable')
    return 'Completed with fallback'
  if (providerOutcome === 'validationFallback')
    return 'Completed with validation fallback'
  if (providerOutcome === 'failed') return 'Failed'
  if (providerOutcome === 'clarification') return 'Clarification needed'
  return 'Deterministic fallback'
}

function responseSourceLabel({
  aiInvoked,
  runtimeProvider,
  knowledgeProvider,
  providerOutcome,
}: {
  aiInvoked: boolean
  runtimeProvider: string
  knowledgeProvider: string
  providerOutcome: string
}) {
  if (providerOutcome === 'providerTimeout') {
    return `${runtimeProvider} timed out. Deterministic fallback from ${knowledgeProvider}.`
  }
  if (providerOutcome === 'providerUnavailable') {
    return `${runtimeProvider} was unavailable. Deterministic fallback from ${knowledgeProvider}.`
  }
  if (providerOutcome === 'validationFallback') {
    return `Provider output could not be fully validated. Deterministic fallback from ${knowledgeProvider}.`
  }
  if (aiInvoked) {
    return `AI Summary generated through ${runtimeProvider} from deterministic ${knowledgeProvider}.`
  }
  return `Deterministic Summary generated from ${knowledgeProvider}.`
}

function inferDomain({
  response,
  recommendationSource,
}: {
  response: Record<string, unknown>
  recommendationSource: Record<string, unknown>
}) {
  const sourceProviderId = readString(recommendationSource.sourceProviderId)
  const routedIntent = readString(response.routedIntent)
  const intent = readString(response.intent)
  if (routedIntent === 'workspace.investigateQuestion') {
    return 'workspace' as const
  }
  if (
    sourceProviderId === 'crm' ||
    routedIntent?.startsWith('crm.') ||
    isCRMIntent(intent)
  ) {
    return 'crm' as const
  }
  return 'scheduling' as const
}

function titleForIntent({
  domain,
  intent,
  response,
}: {
  domain: 'scheduling' | 'crm' | 'workspace'
  intent?: string
  response: Record<string, unknown>
}) {
  const analysisTitle = readString(
    response.analysis && asRecord(response.analysis).title,
  )
  const summaryTitle = readString(
    response.summary && asRecord(response.summary).title,
  )
  const explanationTitle = readString(firstRecord(response.explanations)?.title)
  const mapped = intent ? intentTitleMap[intent] : undefined
  if (mapped) return mapped
  if (analysisTitle) return analysisTitle
  if (summaryTitle) return summaryTitle
  if (explanationTitle) return explanationTitle
  if (domain === 'crm') return 'CRM Overview'
  if (domain === 'workspace') return 'Workspace Investigation'
  return 'Schedule Summary'
}

const intentTitleMap: Record<string, string> = {
  analyzeSchedule: 'Schedule Summary',
  analyzeWorkload: 'Workload Summary',
  analyzeConflicts: 'Scheduling Conflict Analysis',
  summarizeTodaysSchedule: "Today's Schedule",
  summarizeUpcomingWork: 'Upcoming Work',
  recommendTechnician: 'Technician Recommendation',
  recommendTeam: 'Team Recommendation',
  recommendLocation: 'Location Recommendation',
  recommendAppointmentTime: 'Appointment Time Recommendation',
  recommendAlternateSchedule: 'Alternate Schedule Recommendation',
  recommendReassignment: 'Reassignment Recommendation',
  explainSchedulingConflict: 'Scheduling Conflict Analysis',
  explainTechnicianAvailability: 'Technician Availability',
  explainWorkload: 'Workload Summary',
  prioritizeLeads: 'Lead Priorities',
  analyzeFollowUps: 'Follow-Up Analysis',
  analyzeOpportunities: 'Opportunity Analysis',
  analyzePipeline: 'Pipeline Summary',
  analyzeDataQuality: 'CRM Data Quality',
  crmOverview: 'CRM Overview',
  explainLead: 'Lead Explanation',
  explainOpportunityRisk: 'Opportunity Risk Analysis',
  recommendNextActions: 'CRM Next Actions',
  'crm.prioritizeLeads': 'Lead Priorities',
  'crm.analyzeFollowUps': 'Follow-Up Analysis',
  'crm.analyzeOpportunities': 'Opportunity Analysis',
  'crm.analyzePipeline': 'Pipeline Summary',
  'crm.analyzeDataQuality': 'CRM Data Quality',
  'crm.explainRecord': 'CRM Record Explanation',
  'workspace.investigateQuestion': 'Workspace Investigation',
}

function deterministicSummary({
  domain,
  response,
}: {
  domain: 'scheduling' | 'crm' | 'workspace'
  response: Record<string, unknown>
}) {
  if (domain === 'crm' && crmHasNoAuthoritativeRecords(response)) {
    return 'CRM Knowledge is registered, but this workspace does not currently have authoritative persisted CRM records available to the Playground.'
  }
  const summary = asRecord(response.summary)
  const analysis = asRecord(response.analysis)
  if (readString(summary.summary)) return readString(summary.summary)
  if (readString(analysis.summary)) return readString(analysis.summary)
  return undefined
}

function deterministicDetails({
  domain,
  response,
}: {
  domain: 'scheduling' | 'crm' | 'workspace'
  response: Record<string, unknown>
}) {
  if (domain === 'crm') {
    return crmDetails(response)
  }
  if (domain === 'workspace') {
    return workspaceInvestigationDetails(response)
  }
  return schedulingDetails(response)
}

function workspaceInvestigationDetails(response: Record<string, unknown>) {
  const details: string[] = []
  const plan = asRecord(response.analysisPlan)
  const steps = readArray(plan.steps).map(asRecord)
  const claims = readArray(response.claims).map(asRecord)
  const missingData = readStringArray(plan.missingData)
  const confirmed = claims.filter(
    (claim) => readString(claim.type) === 'CONFIRMED',
  )
  const derived = claims.filter(
    (claim) => readString(claim.type) === 'DERIVED_METRIC',
  )
  const inferred = claims.filter(
    (claim) => readString(claim.type) === 'INFERRED',
  )
  const guidance = claims.filter(
    (claim) => readString(claim.type) === 'GENERAL_GUIDANCE',
  )
  const unknown = claims.filter((claim) => readString(claim.type) === 'UNKNOWN')
  const limitations = claims.filter(
    (claim) => readString(claim.type) === 'DATA_QUALITY_LIMITATION',
  )

  if (steps.length > 0) {
    details.push(
      `${steps.length} read-only investigation step${steps.length === 1 ? '' : 's'} selected from registered knowledge tools.`,
    )
  }
  for (const claim of confirmed.slice(0, 3)) {
    const text = readString(claim.text)
    if (text) details.push(`Confirmed: ${text}`)
  }
  for (const claim of derived.slice(0, 2)) {
    const text = readString(claim.text)
    if (text) details.push(`Derived metric: ${text}`)
  }
  for (const claim of inferred.slice(0, 2)) {
    const text = readString(claim.text)
    if (text) details.push(`Inferred: ${text}`)
  }
  for (const claim of guidance.slice(0, 2)) {
    const text = readString(claim.text)
    if (text) details.push(`Guidance: ${text}`)
  }
  for (const claim of unknown.slice(0, 2)) {
    const text = readString(claim.text)
    if (text) details.push(`Unknown: ${text}`)
  }
  for (const claim of limitations.slice(0, 2)) {
    const text = readString(claim.text)
    if (text) details.push(`Data-quality limitation: ${text}`)
  }
  if (missingData.length > 0) {
    details.push(`Data needed to answer this: ${missingData.join(', ')}.`)
  }
  return details
}

function schedulingDetails(response: Record<string, unknown>) {
  const details: string[] = []
  const summary = asRecord(response.summary)
  const summaryItems = readArray(summary.items)
  const analysis = asRecord(response.analysis)
  const snapshot = asRecord(analysis.snapshot)
  const counts = asRecord(snapshot.counts)
  const conflicts = readArray(analysis.conflicts)
  const workload = readArray(analysis.workload).map(asRecord)

  if (
    summaryItems.length === 0 &&
    readString(summary.summary)?.toLowerCase().includes('no scheduled')
  ) {
    details.push('No scheduled assignments were found for the selected range.')
  }
  if (summaryItems.length > 0) {
    details.push(
      `${summaryItems.length} assignment${summaryItems.length === 1 ? '' : 's'} returned in the visible result.`,
    )
  }
  const eventCount = readNumber(counts.events)
  if (eventCount !== undefined) {
    details.push(
      `${eventCount} scheduling event${eventCount === 1 ? '' : 's'} are present in the workspace context.`,
    )
  }
  const blockingConflicts = conflicts
    .map(asRecord)
    .filter(
      (conflict) =>
        conflict.blocking === true ||
        (readString(conflict.conflictType) === 'busy' &&
          readString(conflict.severity) === 'blocking'),
    )
  const informationalConflicts = conflicts.length - blockingConflicts.length
  const conflictCount = blockingConflicts.length
  if (conflictCount === 0) {
    details.push(
      'No active scheduling conflicts were detected in the analyzed range.',
    )
  } else if (conflictCount > 0) {
    const conflictTypes = summarizeConflictTypes(blockingConflicts)
    details.push(
      conflictTypes.length
        ? `${conflictCount} active blocking scheduling conflict${conflictCount === 1 ? '' : 's'} were detected: ${conflictTypes.join(', ')}.`
        : `${conflictCount} active blocking scheduling conflict${conflictCount === 1 ? '' : 's'} were detected.`,
    )
  }
  if (informationalConflicts > 0) {
    details.push(
      `${informationalConflicts} informational availability constraint${informationalConflicts === 1 ? '' : 's'} were separated from active blocking conflicts.`,
    )
  }
  if (workload.length > 0) {
    const overloaded = workload.filter((item) => item.overloaded === true)
    if (overloaded.length === 0) {
      details.push(
        'No members or teams are marked overloaded in the returned workload data.',
      )
    } else {
      details.push(
        `${overloaded.length} assignee${overloaded.length === 1 ? ' is' : 's are'} overloaded.`,
      )
    }
    const busyMinutes = workload.reduce(
      (total, item) => total + (readNumber(item.busyMinutes) ?? 0),
      0,
    )
    if (busyMinutes > 0) {
      details.push(
        `${busyMinutes} busy minute${busyMinutes === 1 ? '' : 's'} were returned across analyzed assignees.`,
      )
    }
  }
  for (const item of summaryItems.slice(0, 5).map(asRecord)) {
    const label = readString(item.label)
    const status = readString(item.status)
    if (label) details.push(status ? `${label} · ${status}` : label)
  }
  return details
}

function crmDetails(response: Record<string, unknown>) {
  if (crmHasNoAuthoritativeRecords(response)) {
    return [
      'No persisted lead records are available to the CRM Knowledge Provider.',
      'No persisted opportunity records are available to the CRM Knowledge Provider.',
      'No persisted client records are available to the CRM Knowledge Provider.',
    ]
  }
  const summaryText = readString(asRecord(response.summary).summary)
  return summaryText
    ? summaryText
        .split(/(?<=\.)\s+/)
        .filter(Boolean)
        .slice(0, 6)
    : []
}

function normalizeRecommendations(
  value: unknown,
): AIPlaygroundReadableRecommendation[] {
  return readArray(value).map((item, index) => {
    const record = asRecord(item)
    const subject = asRecord(record.subject)
    const provenance = asRecord(record.provenance)
    const metadata = asRecord(record.metadata)
    const crmRecommendation = asRecord(metadata.crmRecommendation)
    const title =
      readString(record.title) ??
      readString(record.label) ??
      readString(crmRecommendation.title) ??
      readString(subject.label) ??
      `Recommendation ${index + 1}`
    const targetLabel =
      readString(subject.label) ??
      readString(record.targetLabel) ??
      readString(crmRecommendation.targetLabel)
    const explanation =
      readString(record.summary) ??
      readString(crmRecommendation.summary) ??
      readString(record.explanation)
    return {
      id: readString(record.id) ?? `recommendation-${index}`,
      title,
      targetLabel: targetLabel === title ? undefined : targetLabel,
      explanation,
      confidence: readString(record.confidence),
      scoreLabel: formatRecommendationScoreLabel(record.score),
      reasons: [
        ...readReasonLabels(record.reasons),
        ...readStringArray(crmRecommendation.reasonCodes),
        ...readStringArray(crmRecommendation.supportingFacts),
      ].slice(0, 6),
      warnings: readWarningMessages(record.warnings).slice(0, 4),
      source:
        readString(provenance.sourceEngine) ??
        readString(asRecord(crmRecommendation.source).engine) ??
        'Knowledge Provider',
      deterministic: provenance.deterministic !== false,
      approvalRequired:
        asRecord(crmRecommendation.suggestedAction).approvalRequired === true,
    }
  })
}

function normalizeProposalPlans(
  value: unknown,
): AIPlaygroundReadableProposalPlan[] {
  return readArray(value).map((item, index) => {
    const record = asRecord(item)
    const validation = asRecord(record.validation)
    const approval = asRecord(record.approval)
    const steps = readArray(record.steps).map((step, stepIndex) => {
      const stepRecord = asRecord(step)
      const target = asRecord(stepRecord.target)
      return {
        id:
          readString(stepRecord.id) ??
          `proposal-plan-${index}-step-${stepIndex}`,
        order: readNumber(stepRecord.order) ?? stepIndex + 1,
        actionType: readString(stepRecord.actionType) ?? 'Action',
        target: readString(target.label) ?? readString(stepRecord.targetLabel),
        currentState: readString(stepRecord.currentState),
        proposedState: readString(stepRecord.proposedState),
        reason:
          readString(stepRecord.reason) ?? readString(stepRecord.explanation),
        dependencies: readStringArray(stepRecord.dependencies),
        approvalStatus:
          readString(asRecord(stepRecord.approval).status) ??
          readString(stepRecord.approvalStatus),
        executionStatus:
          readString(asRecord(stepRecord.execution).status) ??
          readString(stepRecord.executionStatus) ??
          'not-executed',
      }
    })

    return {
      id: readString(record.id) ?? `proposal-plan-${index}`,
      title:
        readString(record.title) ??
        readString(record.objective) ??
        `Proposal plan ${index + 1}`,
      objective:
        readString(record.objective) ??
        readString(record.summary) ??
        'Coordinated proposal plan.',
      affectedRecords: readStringArray(record.targetRecordIds),
      expectedImpact: readStringArray(record.expectedImpact),
      warnings: readStringArray(record.warnings),
      riskLevel: readString(record.riskLevel),
      approvalRequired:
        approval.status === 'pending' ||
        record.approvalMode === 'required' ||
        record.executionBoundary === 'proposal-only',
      executionStatus:
        readString(record.executionStatus) ??
        readString(asRecord(record.execution).status) ??
        'not-executed',
      validationStatus: normalizeProposalValidationStatus(validation.status),
      validationMessage: readString(validation.message),
      steps,
    }
  })
}

function normalizeProposals(value: unknown): AIPlaygroundReadableProposal[] {
  return readArray(value).map((item, index) => {
    const record = asRecord(item)
    const target = asRecord(record.target)
    const validation = asRecord(record.validation)
    const approval = asRecord(record.approval)
    const validationStatus = normalizeProposalValidationStatus(
      validation.status,
    )
    return {
      id: readString(record.id) ?? `proposal-${index}`,
      title:
        readString(record.label) ??
        readString(record.actionType) ??
        `Action proposal ${index + 1}`,
      target: readString(target.label) ?? readString(record.targetProviderId),
      targetDetail: readString(target.detail),
      summary: readString(record.summary),
      currentState: readString(record.currentState),
      proposedState: readString(record.proposedState),
      reasons: readStringArray(record.reasonCodes),
      expectedImpact: readStringArray(record.expectedImpact),
      warnings: readStringArray(record.warnings),
      explanation:
        readString(record.explanation) ?? 'Proposed only. Not executed.',
      approvalRequired:
        approval.status === 'pending' ||
        record.executionBoundary === 'proposal-only',
      executionStatus: readString(record.executionBoundary) ?? 'proposal-only',
      validationStatus,
      validationMessage: readString(validation.message),
    }
  })
}

function normalizeWarnings(values: unknown[]): AIPlaygroundReadableWarning[] {
  const warnings = values
    .map((item, index) => {
      const record = asRecord(item)
      const code = readString(record.code) ?? readString(record.id)
      const message =
        code === 'invalid-citation'
          ? 'One supporting reference could not be validated.'
          : (readString(record.message) ??
            readString(record.label) ??
            readString(record.explanation))
      if (!message) return null
      return {
        id: code ?? `warning-${index}`,
        message,
        severity: normalizeSeverity(record.severity),
      }
    })
    .filter(Boolean) as AIPlaygroundReadableWarning[]
  return [
    ...new Map(warnings.map((warning) => [warning.message, warning])).values(),
  ]
}

function domainEmptyWarnings({
  domain,
  response,
}: {
  domain: 'scheduling' | 'crm' | 'workspace'
  response: Record<string, unknown>
}) {
  if (domain === 'crm' && crmHasNoAuthoritativeRecords(response)) {
    return [
      {
        code: 'crm-records-unavailable',
        message:
          'No authoritative persisted CRM records are available to the Playground for this workspace.',
        severity: 'info',
      },
    ]
  }
  return []
}

function emptyStateFor({
  domain,
  response,
  recommendations,
  summary,
}: {
  domain: 'scheduling' | 'crm' | 'workspace'
  response: Record<string, unknown>
  recommendations: AIPlaygroundReadableRecommendation[]
  summary: string
}) {
  if (domain === 'crm' && crmHasNoAuthoritativeRecords(response)) {
    return {
      title: 'No authoritative CRM records available',
      message:
        'The CRM Knowledge Provider is registered, but no persisted CRM records are available for this workspace.',
    }
  }
  if (
    recommendations.length === 0 &&
    readString(response.responseKind)?.startsWith('recommend') &&
    /no eligible|no matching/i.test(summary)
  ) {
    return {
      title: 'No recommendation candidate found',
      message: summary,
    }
  }
  const summaryRecord = asRecord(response.summary)
  if (
    readArray(summaryRecord.items).length === 0 &&
    /no scheduled assignments/i.test(readString(summaryRecord.summary) ?? '')
  ) {
    return {
      title: 'No scheduled work found',
      message:
        'The selected context contains no scheduled assignments for the current range.',
    }
  }
  return undefined
}

function crmHasNoAuthoritativeRecords(response: Record<string, unknown>) {
  const summary = readString(asRecord(response.summary).summary) ?? ''
  const recommendations = readArray(response.recommendations)
  return (
    recommendations.length === 0 &&
    /0 active leads/i.test(summary) &&
    /0 open opportunities/i.test(summary)
  )
}

function fallbackSummary(domain: 'scheduling' | 'crm' | 'workspace') {
  return domain === 'crm'
    ? 'CRM Knowledge completed without a displayable persisted-record summary.'
    : domain === 'workspace'
      ? 'Workspace investigation completed without a displayable summary.'
      : 'Scheduling AI completed without a displayable summary.'
}

function readReasonLabels(value: unknown) {
  return readArray(value)
    .map((item) => {
      const record = asRecord(item)
      return readString(record.label) ?? readString(record.code)
    })
    .filter(Boolean) as string[]
}

function readWarningMessages(value: unknown) {
  return readArray(value)
    .map((item) => {
      const record = asRecord(item)
      return readString(record.message) ?? readString(record.label)
    })
    .filter(Boolean) as string[]
}

function normalizeSeverity(
  value: unknown,
): AIPlaygroundReadableWarning['severity'] {
  return value === 'blocking' || value === 'warning' || value === 'info'
    ? value
    : 'warning'
}

function normalizeProposalValidationStatus(value: unknown) {
  return value === 'valid' || value === 'incomplete' ? value : 'unknown'
}

function summarizeConflictTypes(conflicts: unknown[]) {
  const labels = new Map<string, number>()
  for (const conflict of conflicts.map(asRecord)) {
    const type = readString(conflict.conflictType) ?? 'conflict'
    const label = conflictTypeLabel(type)
    labels.set(label, (labels.get(label) ?? 0) + 1)
  }
  return [...labels.entries()].map(
    ([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`,
  )
}

function conflictTypeLabel(type: string) {
  if (type === 'timeOff') return 'time-off overlap'
  if (type === 'busy') return 'busy overlap'
  if (type === 'externalAvailability') return 'external busy overlap'
  if (type === 'outsideWorkingHours') return 'outside-working-hours finding'
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function isCRMIntent(value?: string) {
  return Boolean(
    value &&
    [
      'prioritizeLeads',
      'analyzeFollowUps',
      'analyzeOpportunities',
      'analyzePipeline',
      'analyzeDataQuality',
      'crmOverview',
      'explainLead',
      'explainOpportunityRisk',
      'recommendNextActions',
    ].includes(value),
  )
}

function firstRecord(value: unknown) {
  return asRecord(readArray(value)[0])
}

function readStringArray(value: unknown) {
  return readArray(value).filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  )
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

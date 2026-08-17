import {
  CalendarConnectionApprovalStatus,
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
  CalendarPurposeClassificationSource,
  CalendarConnectionStatus,
  CalendarSyncDirection,
  CalendarWatchChannelStatus,
  ExternalCalendarVisibilityMode,
  PersonalCalendarAvailabilityBehavior,
  PersonalCalendarBusyDisplayMode,
  type CalendarConnection,
  type Prisma,
  type WorkspaceMember,
} from '@prisma/client'
import {
  normalizeSchedulingSettings,
  normalizeWorkspaceCalendarConnectionPolicy,
} from '@/lib/scheduling/normalizeSchedulingSettings'
import type {
  WorkspaceCalendarConnectionPolicy,
  ExternalCalendarVisibilityMode as SchedulingVisibilityMode,
} from '@/lib/scheduling/types'
import type { ProviderEventPayload } from '@/lib/scheduling/providers/types'

async function getPrisma() {
  const { prisma } = await import('@/lib/db')
  return prisma
}

export type CalendarConnectionEligibilityReason =
  | 'eligible'
  | 'connectionDisabled'
  | 'connectionDisconnected'
  | 'classificationPending'
  | 'approvalPending'
  | 'approvalRejected'
  | 'approvalNeedsReview'
  | 'ownerInactive'
  | 'ownerRemoved'
  | 'memberConnectionsDisabled'
  | 'memberReadOnlySyncDisabled'
  | 'memberWriteSyncDisabled'
  | 'personalCalendarAccessDenied'
  | 'personalCalendarIgnored'
  | 'providerUnavailable'

export type CalendarConnectionSyncEligibility = {
  canDiscoverCalendars: boolean
  canPull: boolean
  canPush: boolean
  contributesToBusy: boolean
  exposesTitle: boolean
  exposesFullDetails: boolean
  reasonCode: CalendarConnectionEligibilityReason
}

type GovernedConnection = Pick<
  CalendarConnection,
  | 'ownershipType'
  | 'visibilityMode'
  | 'approvalStatus'
  | 'syncStatus'
  | 'disabledAt'
  | 'disabledReason'
  | 'ownerInactiveAt'
  | 'disconnectedAt'
> &
  Partial<
    Pick<
      CalendarConnection,
      | 'connectionPurpose'
      | 'availabilityBehavior'
      | 'busyDisplayMode'
      | 'metadata'
    >
  >

type GovernedMember =
  | ({ id: string; role?: WorkspaceMember['role'] } & {
      workspaceOwnerUserId?: string
    })
  | null
  | undefined

type WorkspaceRoleKey = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'

const consumerEmailDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
])

const purposeLabels: Record<CalendarConnectionPurpose, string> = {
  PERSONAL: 'Personal calendar',
  INDIVIDUAL_WORK: 'Individual work calendar',
  WORKSPACE_SHARED: 'Shared workspace calendar',
  RESOURCE: 'Resource calendar',
  UNKNOWN: 'Needs classification',
}

function toPrismaVisibility(
  value: SchedulingVisibilityMode,
): ExternalCalendarVisibilityMode {
  if (value === 'FULL_DETAILS')
    return ExternalCalendarVisibilityMode.FULL_DETAILS
  if (value === 'TITLE_ONLY') return ExternalCalendarVisibilityMode.TITLE_ONLY
  return ExternalCalendarVisibilityMode.BUSY_ONLY
}

export function toPersonalCalendarAvailabilityBehaviorPrisma(
  value: WorkspaceCalendarConnectionPolicy['personalCalendarAvailabilityBehavior'],
): PersonalCalendarAvailabilityBehavior {
  if (value === 'BLOCK_AVAILABILITY') {
    return PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY
  }
  if (value === 'SUGGEST_CONFLICTS') {
    return PersonalCalendarAvailabilityBehavior.SUGGEST_CONFLICTS
  }
  return PersonalCalendarAvailabilityBehavior.IGNORE
}

export function toPersonalCalendarBusyDisplayModePrisma(
  value: WorkspaceCalendarConnectionPolicy['personalCalendarBusyDisplayMode'],
): PersonalCalendarBusyDisplayMode {
  if (value === 'VISIBLE_IN_BUSY') {
    return PersonalCalendarBusyDisplayMode.VISIBLE_IN_BUSY
  }
  if (value === 'EXPANDABLE_EXTERNAL_AVAILABILITY') {
    return PersonalCalendarBusyDisplayMode.EXPANDABLE_EXTERNAL_AVAILABILITY
  }
  if (value === 'MEMBER_DETAIL_ONLY') {
    return PersonalCalendarBusyDisplayMode.MEMBER_DETAIL_ONLY
  }
  return PersonalCalendarBusyDisplayMode.HIDDEN
}

function roleKey(value: unknown): WorkspaceRoleKey {
  const normalized = String(value ?? '').toUpperCase()
  if (normalized === 'OWNER' || normalized === 'ADMIN') return normalized
  return 'MEMBER'
}

function getEmailDomain(email?: string | null) {
  const domain = email?.split('@')[1]?.trim().toLowerCase()
  return domain || null
}

function normalizedDomains(
  domains: WorkspaceCalendarConnectionPolicy['workspaceBusinessDomains'],
) {
  return domains
    .filter(
      (domain) =>
        domain.status === 'verified' || domain.status === 'adminConfirmed',
    )
    .map((domain) => domain.domain.toLowerCase())
}

export type CalendarPurposeClassificationInput = {
  provider?: string
  providerEmail?: string | null
  providerAccountType?: string | null
  tenantMetadata?: unknown
  workspaceBusinessDomains?: WorkspaceCalendarConnectionPolicy['workspaceBusinessDomains']
  providerCalendarMetadata?: unknown
  ownershipType?: CalendarConnectionOwnershipType | 'MEMBER' | 'WORKSPACE'
}

export type CalendarPurposeClassificationResult = {
  purpose: CalendarConnectionPurpose
  source: CalendarPurposeClassificationSource
  confidence: number
  reasonCode: string
  label: string
  requiresConfirmation: boolean
}

export type CalendarClassificationConfirmationStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'NEEDS_REVIEW'

export type CalendarClassificationConfirmationMetadata = {
  status: CalendarClassificationConfirmationStatus
  requestedPurpose: CalendarConnectionPurpose
  suggestedPurpose: CalendarConnectionPurpose
  suggestedSource: CalendarPurposeClassificationSource
  classificationConfidence: number
  reasonCode: string
  mismatchReason?: string
  requiredAt?: string
  confirmedAt?: string
  confirmedByWorkspaceMemberId?: string
}

function recordMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function calendarClassificationMetadata(
  value: unknown,
): CalendarClassificationConfirmationMetadata | null {
  const metadata = recordMetadata(value)
  const raw = recordMetadata(metadata.classificationConfirmation)
  const status = String(raw.status ?? '')
  if (
    status !== 'NOT_REQUIRED' &&
    status !== 'PENDING' &&
    status !== 'CONFIRMED' &&
    status !== 'NEEDS_REVIEW'
  ) {
    return null
  }
  const requestedPurpose = String(raw.requestedPurpose ?? '')
  const suggestedPurpose = String(raw.suggestedPurpose ?? '')
  const suggestedSource = String(raw.suggestedSource ?? '')
  if (
    !(requestedPurpose in CalendarConnectionPurpose) ||
    !(suggestedPurpose in CalendarConnectionPurpose) ||
    !(suggestedSource in CalendarPurposeClassificationSource)
  ) {
    return null
  }
  return {
    status,
    requestedPurpose:
      CalendarConnectionPurpose[
        requestedPurpose as keyof typeof CalendarConnectionPurpose
      ],
    suggestedPurpose:
      CalendarConnectionPurpose[
        suggestedPurpose as keyof typeof CalendarConnectionPurpose
      ],
    suggestedSource:
      CalendarPurposeClassificationSource[
        suggestedSource as keyof typeof CalendarPurposeClassificationSource
      ],
    classificationConfidence:
      typeof raw.classificationConfidence === 'number'
        ? raw.classificationConfidence
        : 0,
    reasonCode: String(raw.reasonCode ?? 'unknown'),
    mismatchReason:
      typeof raw.mismatchReason === 'string' ? raw.mismatchReason : undefined,
    requiredAt: typeof raw.requiredAt === 'string' ? raw.requiredAt : undefined,
    confirmedAt:
      typeof raw.confirmedAt === 'string' ? raw.confirmedAt : undefined,
    confirmedByWorkspaceMemberId:
      typeof raw.confirmedByWorkspaceMemberId === 'string'
        ? raw.confirmedByWorkspaceMemberId
        : undefined,
  }
}

export function getCalendarClassificationConfirmationStatus(metadata: unknown) {
  return calendarClassificationMetadata(metadata)?.status ?? 'NOT_REQUIRED'
}

export function resolveCalendarClassificationConfirmation({
  requestedPurpose,
  suggestedPurpose,
  classificationConfidence,
  suggestedReasonCode,
  workspacePolicy,
  actor,
  ownershipType,
}: {
  requestedPurpose: CalendarConnectionPurpose
  suggestedPurpose: CalendarConnectionPurpose
  classificationConfidence: number
  suggestedReasonCode: string
  workspacePolicy: WorkspaceCalendarConnectionPolicy
  actor?: { id: string; role?: WorkspaceMember['role'] } | null
  ownershipType: CalendarConnectionOwnershipType
}) {
  const role = roleKey(actor?.role)
  const adminActor = role === 'OWNER' || role === 'ADMIN'
  const mismatch = requestedPurpose !== suggestedPurpose
  let mismatchReason: string | undefined
  if (suggestedPurpose === CalendarConnectionPurpose.UNKNOWN) {
    mismatchReason = 'providerPurposeAmbiguous'
  } else if (mismatch) {
    mismatchReason = `${requestedPurpose.toLowerCase()}RequestedBut${suggestedPurpose}`
  }

  const requestedPersonalByBusinessDomain =
    requestedPurpose === CalendarConnectionPurpose.PERSONAL &&
    suggestedPurpose === CalendarConnectionPurpose.INDIVIDUAL_WORK
  const requestedWorkByConsumerDomain =
    requestedPurpose === CalendarConnectionPurpose.INDIVIDUAL_WORK &&
    suggestedPurpose === CalendarConnectionPurpose.PERSONAL
  const bypassesPersonalPolicy =
    requestedPurpose !== CalendarConnectionPurpose.PERSONAL &&
    !resolvePersonalCalendarAccess({
      workspacePolicy,
      workspaceMember: actor,
    }).canRequestConnection

  const confirmationRequired =
    suggestedPurpose === CalendarConnectionPurpose.UNKNOWN ||
    requestedPurpose === CalendarConnectionPurpose.UNKNOWN ||
    mismatch ||
    requestedPersonalByBusinessDomain ||
    requestedWorkByConsumerDomain ||
    bypassesPersonalPolicy ||
    (ownershipType === CalendarConnectionOwnershipType.MEMBER &&
      workspacePolicy.unknownCalendarApprovalRequired)

  const canSkip =
    adminActor &&
    ownershipType === CalendarConnectionOwnershipType.WORKSPACE &&
    (requestedPurpose === CalendarConnectionPurpose.WORKSPACE_SHARED ||
      requestedPurpose === CalendarConnectionPurpose.RESOURCE) &&
    !mismatch

  return {
    required: confirmationRequired && !canSkip,
    status: confirmationRequired && !canSkip ? 'PENDING' : 'NOT_REQUIRED',
    mismatch,
    mismatchReason,
    reasonCode: mismatchReason ?? suggestedReasonCode,
    highConfidenceMismatch: mismatch && classificationConfidence >= 0.7,
  } as const
}

function metadataStringValue(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== 'object') return ''
  const record = metadata as Record<string, unknown>
  return (
    keys
      .map((key) =>
        typeof record[key] === 'string'
          ? String(record[key]).toLowerCase()
          : '',
      )
      .find(Boolean) ?? ''
  )
}

function metadataBooleanValue(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== 'object') return false
  const record = metadata as Record<string, unknown>
  return keys.some(
    (key) => record[key] === true || String(record[key]) === 'true',
  )
}

export function classifyCalendarConnectionPurpose({
  providerEmail,
  providerAccountType,
  tenantMetadata,
  workspaceBusinessDomains = [],
  providerCalendarMetadata,
  ownershipType,
}: CalendarPurposeClassificationInput): CalendarPurposeClassificationResult {
  const accountType = String(providerAccountType ?? '').toLowerCase()
  const tenantType = metadataStringValue(tenantMetadata, [
    'tenantType',
    'accountType',
    'identityType',
    'userType',
  ])
  const calendarType = metadataStringValue(providerCalendarMetadata, [
    'calendarType',
    'type',
    'kind',
  ])
  const resourceSignal = metadataBooleanValue(providerCalendarMetadata, [
    'isResource',
    'resource',
    'isRoom',
    'room',
  ])
  if (
    resourceSignal ||
    ['resource', 'room', 'equipment'].includes(calendarType)
  ) {
    return {
      purpose: CalendarConnectionPurpose.RESOURCE,
      source: CalendarPurposeClassificationSource.PROVIDER_METADATA,
      confidence: 0.9,
      reasonCode: 'providerResourceCalendar',
      label: purposeLabels.RESOURCE,
      requiresConfirmation: true,
    }
  }
  if (ownershipType === CalendarConnectionOwnershipType.WORKSPACE) {
    return {
      purpose: CalendarConnectionPurpose.WORKSPACE_SHARED,
      source: CalendarPurposeClassificationSource.PROVIDER_METADATA,
      confidence: 0.85,
      reasonCode: 'workspaceOwnedConnection',
      label: purposeLabels.WORKSPACE_SHARED,
      requiresConfirmation: true,
    }
  }
  const domain = getEmailDomain(providerEmail)
  if (domain && normalizedDomains(workspaceBusinessDomains).includes(domain)) {
    return {
      purpose: CalendarConnectionPurpose.INDIVIDUAL_WORK,
      source: CalendarPurposeClassificationSource.DOMAIN_HEURISTIC,
      confidence: 0.75,
      reasonCode: 'workspaceBusinessDomainMatch',
      label: purposeLabels.INDIVIDUAL_WORK,
      requiresConfirmation: true,
    }
  }
  if (
    ['organization', 'organizational', 'work', 'google_workspace'].includes(
      accountType,
    ) ||
    ['organization', 'organizational', 'work', 'aad'].includes(tenantType)
  ) {
    return {
      purpose: CalendarConnectionPurpose.INDIVIDUAL_WORK,
      source: CalendarPurposeClassificationSource.PROVIDER_METADATA,
      confidence: 0.7,
      reasonCode: 'providerManagedIdentity',
      label: purposeLabels.INDIVIDUAL_WORK,
      requiresConfirmation: true,
    }
  }
  if (
    ['consumer', 'personal'].includes(accountType) ||
    ['consumer', 'personal', 'msa'].includes(tenantType) ||
    (domain && consumerEmailDomains.has(domain))
  ) {
    return {
      purpose: CalendarConnectionPurpose.PERSONAL,
      source: domain
        ? CalendarPurposeClassificationSource.DOMAIN_HEURISTIC
        : CalendarPurposeClassificationSource.PROVIDER_METADATA,
      confidence: 0.7,
      reasonCode: 'consumerAccountSignal',
      label: purposeLabels.PERSONAL,
      requiresConfirmation: true,
    }
  }
  return {
    purpose: CalendarConnectionPurpose.UNKNOWN,
    source: CalendarPurposeClassificationSource.UNKNOWN,
    confidence: 0.2,
    reasonCode: 'ambiguousCalendarPurpose',
    label: purposeLabels.UNKNOWN,
    requiresConfirmation: true,
  }
}

export type PersonalCalendarAccessDecision = {
  canSeePersonalCalendarOption: boolean
  canRequestConnection: boolean
  canConnectWithoutApproval: boolean
  approvalRequired: boolean
  canApprove: boolean
  availabilityBehavior: WorkspaceCalendarConnectionPolicy['personalCalendarAvailabilityBehavior']
  busyDisplayMode: WorkspaceCalendarConnectionPolicy['personalCalendarBusyDisplayMode']
  reasonCode?: string
}

export function resolvePersonalCalendarApprovalAuthority({
  workspacePolicy,
  workspaceMember,
  targetWorkspaceMemberId,
}: {
  workspacePolicy: WorkspaceCalendarConnectionPolicy
  workspaceMember?: { id: string; role?: WorkspaceMember['role'] } | null
  targetWorkspaceMemberId?: string | null
}) {
  if (!workspaceMember) {
    return {
      canApprove: false,
      selfApprovalBlocked: false,
      reasonCode: 'memberMissing',
    }
  }
  const role = roleKey(workspaceMember.role)
  const isOwner = role === 'OWNER'
  const selfApproval =
    Boolean(targetWorkspaceMemberId) &&
    targetWorkspaceMemberId === workspaceMember.id
  let allowed = isOwner
  if (workspacePolicy.personalCalendarApproverMode === 'OWNERS_AND_ADMINS') {
    allowed = allowed || role === 'ADMIN'
  } else if (
    workspacePolicy.personalCalendarApproverMode === 'SELECTED_ROLES'
  ) {
    allowed =
      allowed || workspacePolicy.personalCalendarApproverRoleKeys.includes(role)
  } else if (
    workspacePolicy.personalCalendarApproverMode === 'SELECTED_MEMBERS'
  ) {
    allowed =
      allowed ||
      workspacePolicy.personalCalendarApproverMemberIds.includes(
        workspaceMember.id,
      )
  }
  const selfApprovalBlocked =
    selfApproval && !workspacePolicy.allowPersonalCalendarSelfApproval
  return {
    canApprove: allowed && !selfApprovalBlocked,
    selfApprovalBlocked,
    reasonCode: !allowed
      ? 'approverNotAllowed'
      : selfApprovalBlocked
        ? 'selfApprovalBlocked'
        : 'eligible',
  }
}

export function resolvePersonalCalendarAccess({
  workspacePolicy,
  workspaceMember,
}: {
  workspacePolicy: WorkspaceCalendarConnectionPolicy
  workspaceMember?: { id: string; role?: WorkspaceMember['role'] } | null
}): PersonalCalendarAccessDecision {
  const blocked = (reasonCode: string): PersonalCalendarAccessDecision => ({
    canSeePersonalCalendarOption:
      !workspacePolicy.hidePersonalCalendarControlsWhenNotAllowed,
    canRequestConnection: false,
    canConnectWithoutApproval: false,
    approvalRequired: true,
    canApprove: resolvePersonalCalendarApprovalAuthority({
      workspacePolicy,
      workspaceMember,
    }).canApprove,
    availabilityBehavior: workspacePolicy.personalCalendarAvailabilityBehavior,
    busyDisplayMode: workspacePolicy.personalCalendarBusyDisplayMode,
    reasonCode,
  })
  if (!workspaceMember) return blocked('memberMissing')
  const role = roleKey(workspaceMember.role)
  const isOwner = role === 'OWNER'
  if (
    workspacePolicy.personalCalendarDeniedMemberIds.includes(workspaceMember.id)
  ) {
    return blocked('memberExplicitlyDenied')
  }
  let allowed = false
  if (
    workspacePolicy.personalCalendarAllowedMemberIds.includes(
      workspaceMember.id,
    )
  ) {
    allowed = true
  } else if (
    workspacePolicy.personalCalendarMode === 'DISABLED' &&
    workspacePolicy.ownerPersonalCalendarAllowed &&
    isOwner
  ) {
    allowed = true
  } else if (workspacePolicy.personalCalendarMode === 'OWNER_ONLY' && isOwner) {
    allowed = true
  } else if (workspacePolicy.personalCalendarMode === 'SELECTED_MEMBERS') {
    allowed = workspacePolicy.personalCalendarAllowedMemberIds.includes(
      workspaceMember.id,
    )
  } else if (workspacePolicy.personalCalendarMode === 'SELECTED_ROLES') {
    allowed = workspacePolicy.personalCalendarAllowedRoleKeys.includes(role)
  } else if (workspacePolicy.personalCalendarMode === 'ALL_MEMBERS') {
    allowed = true
  }
  if (!allowed) return blocked('personalCalendarPolicyDenied')
  const approvalRequired = workspacePolicy.personalCalendarApprovalRequired
  return {
    canSeePersonalCalendarOption: true,
    canRequestConnection:
      workspacePolicy.allowMemberConnections &&
      workspacePolicy.allowMembersToRequestPersonalCalendarAccess,
    canConnectWithoutApproval: !approvalRequired,
    approvalRequired,
    canApprove: resolvePersonalCalendarApprovalAuthority({
      workspacePolicy,
      workspaceMember,
    }).canApprove,
    availabilityBehavior: workspacePolicy.personalCalendarAvailabilityBehavior,
    busyDisplayMode: workspacePolicy.personalCalendarBusyDisplayMode,
    reasonCode: 'eligible',
  }
}

export async function getWorkspaceCalendarConnectionPolicy(
  workspaceId: string,
) {
  const prisma = await getPrisma()
  const [workspace, settingsRecord] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    }),
    prisma.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { scheduling: true },
    }),
  ])
  return normalizeSchedulingSettings({
    businessModel: workspace?.businessModel ?? 'consultative',
    settings:
      settingsRecord?.scheduling &&
      typeof settingsRecord.scheduling === 'object'
        ? (settingsRecord.scheduling as object)
        : undefined,
  }).calendarConnectionPolicy
}

export function getMemberConnectionInitialGovernance(
  policy: WorkspaceCalendarConnectionPolicy,
  purpose: CalendarConnectionPurpose = CalendarConnectionPurpose.PERSONAL,
) {
  const approvalRequired =
    purpose === CalendarConnectionPurpose.PERSONAL
      ? policy.personalCalendarApprovalRequired
      : purpose === CalendarConnectionPurpose.INDIVIDUAL_WORK
        ? policy.workCalendarApprovalRequired
        : policy.unknownCalendarApprovalRequired
  return {
    approvalStatus: approvalRequired
      ? CalendarConnectionApprovalStatus.PENDING
      : CalendarConnectionApprovalStatus.APPROVED,
    visibilityMode: toPrismaVisibility(
      purpose === CalendarConnectionPurpose.PERSONAL
        ? policy.personalCalendarDefaultVisibilityMode
        : policy.defaultMemberVisibilityMode,
    ),
    availabilityBehavior:
      purpose === CalendarConnectionPurpose.PERSONAL
        ? toPersonalCalendarAvailabilityBehaviorPrisma(
            policy.personalCalendarAvailabilityBehavior,
          )
        : PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY,
    busyDisplayMode:
      purpose === CalendarConnectionPurpose.PERSONAL
        ? toPersonalCalendarBusyDisplayModePrisma(
            policy.personalCalendarBusyDisplayMode,
          )
        : PersonalCalendarBusyDisplayMode.VISIBLE_IN_BUSY,
  }
}

export function getWorkspaceConnectionInitialGovernance(
  policy: WorkspaceCalendarConnectionPolicy,
) {
  return {
    approvalStatus: CalendarConnectionApprovalStatus.APPROVED,
    visibilityMode: toPrismaVisibility(policy.defaultWorkspaceVisibilityMode),
    availabilityBehavior:
      PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY,
    busyDisplayMode: PersonalCalendarBusyDisplayMode.VISIBLE_IN_BUSY,
  }
}

export function allowedCalendarDirectionsForConnection({
  connection,
  policy,
}: {
  connection: Pick<CalendarConnection, 'ownershipType'>
  policy: WorkspaceCalendarConnectionPolicy
}) {
  if (connection.ownershipType === CalendarConnectionOwnershipType.WORKSPACE) {
    return new Set<CalendarSyncDirection>([
      CalendarSyncDirection.IMPORT_ONLY,
      CalendarSyncDirection.EXPORT_ONLY,
      CalendarSyncDirection.TWO_WAY,
      CalendarSyncDirection.AVAILABILITY_ONLY,
      CalendarSyncDirection.DISABLED,
    ])
  }
  const directions = new Set<CalendarSyncDirection>([
    CalendarSyncDirection.DISABLED,
  ])
  if (policy.allowMemberReadOnlySync) {
    directions.add(CalendarSyncDirection.IMPORT_ONLY)
    directions.add(CalendarSyncDirection.AVAILABILITY_ONLY)
  }
  if (policy.allowMemberWriteOnlySync) {
    directions.add(CalendarSyncDirection.EXPORT_ONLY)
  }
  if (policy.allowMemberTwoWaySync) {
    directions.add(CalendarSyncDirection.TWO_WAY)
  }
  return directions
}

export function coerceCalendarSyncDirectionForPolicy({
  direction,
  connection,
  policy,
}: {
  direction: CalendarSyncDirection
  connection: Pick<CalendarConnection, 'ownershipType'>
  policy: WorkspaceCalendarConnectionPolicy
}) {
  const allowed = allowedCalendarDirectionsForConnection({ connection, policy })
  if (allowed.has(direction)) return direction
  if (allowed.has(CalendarSyncDirection.AVAILABILITY_ONLY)) {
    return CalendarSyncDirection.AVAILABILITY_ONLY
  }
  if (allowed.has(CalendarSyncDirection.IMPORT_ONLY)) {
    return CalendarSyncDirection.IMPORT_ONLY
  }
  return CalendarSyncDirection.DISABLED
}

export function resolveCalendarConnectionSyncEligibility({
  connection,
  workspacePolicy,
  ownerMember,
  providerHealth = 'available',
}: {
  connection: GovernedConnection
  workspacePolicy: WorkspaceCalendarConnectionPolicy
  ownerMember?: GovernedMember
  providerHealth?: string
}): CalendarConnectionSyncEligibility {
  const visibilityMode = String(connection.visibilityMode)
  const exposesTitle =
    visibilityMode === ExternalCalendarVisibilityMode.TITLE_ONLY ||
    visibilityMode === ExternalCalendarVisibilityMode.FULL_DETAILS
  const exposesFullDetails =
    visibilityMode === ExternalCalendarVisibilityMode.FULL_DETAILS
  const blocked = (
    reasonCode: CalendarConnectionEligibilityReason,
  ): CalendarConnectionSyncEligibility => ({
    canDiscoverCalendars: false,
    canPull: false,
    canPush: false,
    contributesToBusy: false,
    exposesTitle: false,
    exposesFullDetails: false,
    reasonCode,
  })

  if (providerHealth !== 'available') return blocked('providerUnavailable')
  if (connection.disconnectedAt) return blocked('connectionDisconnected')
  if (
    getCalendarClassificationConfirmationStatus(connection.metadata) ===
      'PENDING' ||
    getCalendarClassificationConfirmationStatus(connection.metadata) ===
      'NEEDS_REVIEW'
  ) {
    return blocked('classificationPending')
  }
  if (connection.disabledAt) return blocked('connectionDisabled')
  if (connection.ownerInactiveAt) return blocked('ownerInactive')
  if (connection.syncStatus === CalendarConnectionStatus.DISCONNECTED) {
    return blocked('connectionDisconnected')
  }
  if (
    connection.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMemberConnections
  ) {
    return blocked('memberConnectionsDisabled')
  }
  if (
    connection.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    connection.connectionPurpose === CalendarConnectionPurpose.PERSONAL
  ) {
    const personalAccess = resolvePersonalCalendarAccess({
      workspacePolicy,
      workspaceMember: ownerMember,
    })
    if (!personalAccess.canRequestConnection) {
      return blocked('personalCalendarAccessDenied')
    }
  }
  if (
    connection.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !ownerMember
  ) {
    return blocked('ownerRemoved')
  }
  if (connection.approvalStatus === CalendarConnectionApprovalStatus.PENDING) {
    return blocked('approvalPending')
  }
  if (connection.approvalStatus === CalendarConnectionApprovalStatus.REJECTED) {
    return blocked('approvalRejected')
  }
  if (
    connection.approvalStatus === CalendarConnectionApprovalStatus.NEEDS_REVIEW
  ) {
    return blocked('approvalNeedsReview')
  }

  const member =
    connection.ownershipType === CalendarConnectionOwnershipType.MEMBER
  const personal =
    member &&
    connection.connectionPurpose === CalendarConnectionPurpose.PERSONAL
  const personalIgnored =
    personal &&
    connection.availabilityBehavior ===
      PersonalCalendarAvailabilityBehavior.IGNORE
  const canPull = member ? workspacePolicy.allowMemberReadOnlySync : true
  const canPush = member
    ? workspacePolicy.allowMemberTwoWaySync ||
      workspacePolicy.allowMemberWriteOnlySync
    : true
  return {
    canDiscoverCalendars: true,
    canPull,
    canPush,
    contributesToBusy:
      canPull &&
      (!member ||
        (workspacePolicy.includeMemberCalendarsInBusy &&
          !personalIgnored &&
          (!personal ||
            connection.busyDisplayMode !==
              PersonalCalendarBusyDisplayMode.HIDDEN))),
    exposesTitle,
    exposesFullDetails,
    reasonCode:
      personalIgnored && !canPush
        ? 'personalCalendarIgnored'
        : canPull || canPush
          ? 'eligible'
          : 'memberReadOnlySyncDisabled',
  }
}

function isPrivateProviderEvent(providerEvent: ProviderEventPayload) {
  return (
    providerEvent.visibility === 'private' ||
    providerEvent.visibility === 'busyOnly' ||
    (providerEvent.raw &&
      typeof providerEvent.raw === 'object' &&
      'sensitivity' in providerEvent.raw &&
      String((providerEvent.raw as { sensitivity?: unknown }).sensitivity) ===
        'private')
  )
}

export function sanitizeExternalCalendarEvent({
  providerEvent,
  visibilityMode,
}: {
  providerEvent: ProviderEventPayload
  visibilityMode: ExternalCalendarVisibilityMode | SchedulingVisibilityMode
}) {
  const privateEvent = isPrivateProviderEvent(providerEvent)
  const mode = privateEvent
    ? ExternalCalendarVisibilityMode.BUSY_ONLY
    : visibilityMode
  if (mode === ExternalCalendarVisibilityMode.FULL_DETAILS) {
    return { ...providerEvent }
  }
  if (mode === ExternalCalendarVisibilityMode.TITLE_ONLY) {
    return {
      ...providerEvent,
      description: undefined,
      location: undefined,
      attendees: [],
      raw:
        providerEvent.raw && typeof providerEvent.raw === 'object'
          ? {
              id: providerEvent.id,
              calendarId: providerEvent.calendarId,
              providerUpdatedAt: providerEvent.providerUpdatedAt,
              visibility: providerEvent.visibility,
            }
          : providerEvent.raw,
    }
  }
  return {
    ...providerEvent,
    title: providerEvent.allDay ? 'Unavailable' : 'Busy',
    description: undefined,
    location: undefined,
    attendees: [],
    raw:
      providerEvent.raw && typeof providerEvent.raw === 'object'
        ? {
            id: providerEvent.id,
            calendarId: providerEvent.calendarId,
            providerUpdatedAt: providerEvent.providerUpdatedAt,
            visibility: providerEvent.visibility,
          }
        : providerEvent.raw,
  }
}

export async function writeCalendarGovernanceOutboxEvent({
  workspaceId,
  topic,
  aggregateId,
  payload,
}: {
  workspaceId: string
  topic:
    | 'scheduling.calendar_policy.updated'
    | 'scheduling.calendar_connection.approval_updated'
    | 'scheduling.calendar_connection.disabled'
    | 'scheduling.calendar_connection.owner_inactive'
    | 'scheduling.personal_calendar.access_policy_updated'
    | 'scheduling.personal_calendar.connection_requested'
    | 'scheduling.personal_calendar.approved'
    | 'scheduling.personal_calendar.rejected'
    | 'scheduling.personal_calendar.disabled'
    | 'scheduling.personal_calendar.reclassification_requested'
    | 'scheduling.personal_calendar.purpose_changed'
    | 'scheduling.personal_calendar.availability_behavior_changed'
    | 'scheduling.personal_calendar.approver_policy_updated'
    | 'scheduling.calendar_connection.classification_required'
    | 'scheduling.calendar_connection.classification_confirmed'
    | 'scheduling.calendar_connection.classification_mismatch'
    | 'scheduling.calendar_connection.approval_requested'
    | 'scheduling.calendar_connection.approved_with_restrictions'
    | 'scheduling.calendar_connection.reclassified'
    | 'scheduling.external_availability.conflict_detected'
    | 'scheduling.external_availability.conflict_acknowledged'
    | 'scheduling.external_availability.conflict_overridden'
  aggregateId: string
  payload: Record<string, unknown>
}) {
  const prisma = await getPrisma()
  await prisma.domainOutboxEvent.create({
    data: {
      workspaceId,
      topic,
      aggregateType: 'CalendarConnection',
      aggregateId,
      payload: payload as Prisma.InputJsonObject,
    },
  })
}

export async function updateCalendarConnectionApproval({
  workspaceId,
  connectionId,
  action,
  actorMemberId,
  purpose,
  reason,
}: {
  workspaceId: string
  connectionId: string
  action:
    | 'approve'
    | 'approveReadOnly'
    | 'approveBusyOnly'
    | 'approveSuggestion'
    | 'approveBlocking'
    | 'approveWork'
    | 'reclassify'
    | 'requestChanges'
    | 'reject'
  actorMemberId: string
  purpose?: CalendarConnectionPurpose
  reason?: string
}) {
  const prisma = await getPrisma()
  const [policy, actor] = await Promise.all([
    getWorkspaceCalendarConnectionPolicy(workspaceId),
    prisma.workspaceMember.findFirst({
      where: { workspaceId, id: actorMemberId },
      select: { id: true, role: true },
    }),
  ])
  const existing = await prisma.calendarConnection.findFirst({
    where: { workspaceId, id: connectionId },
    select: {
      id: true,
      workspaceMemberId: true,
      connectionPurpose: true,
      ownershipType: true,
      metadata: true,
    },
  })
  if (!existing) {
    throw new Error('Calendar connection was not found.')
  }
  if (existing.connectionPurpose === CalendarConnectionPurpose.PERSONAL) {
    const authority = resolvePersonalCalendarApprovalAuthority({
      workspacePolicy: policy,
      workspaceMember: actor,
      targetWorkspaceMemberId: existing.workspaceMemberId,
    })
    if (!authority.canApprove) {
      throw new Error(
        authority.selfApprovalBlocked
          ? 'Another eligible approver must approve this personal calendar.'
          : 'You are not allowed to approve personal calendar connections.',
      )
    }
  }
  const nextPurpose =
    action === 'approveWork'
      ? CalendarConnectionPurpose.INDIVIDUAL_WORK
      : action === 'reclassify' && purpose
        ? purpose
        : existing.connectionPurpose
  const visibilityMode =
    action === 'approve' ? undefined : ExternalCalendarVisibilityMode.BUSY_ONLY
  const availabilityBehavior =
    action === 'approveBusyOnly' ||
    action === 'approveReadOnly' ||
    action === 'approveSuggestion'
      ? PersonalCalendarAvailabilityBehavior.SUGGEST_CONFLICTS
      : action === 'approveBlocking'
        ? PersonalCalendarAvailabilityBehavior.BLOCK_AVAILABILITY
        : action === 'approve'
          ? undefined
          : PersonalCalendarAvailabilityBehavior.IGNORE
  const busyDisplayMode =
    action === 'approveBusyOnly' || action === 'approveBlocking'
      ? PersonalCalendarBusyDisplayMode.HIDDEN
      : action === 'approve'
        ? undefined
        : PersonalCalendarBusyDisplayMode.HIDDEN
  const approvalStatus =
    action === 'reject'
      ? CalendarConnectionApprovalStatus.REJECTED
      : action === 'requestChanges'
        ? CalendarConnectionApprovalStatus.NEEDS_REVIEW
        : CalendarConnectionApprovalStatus.APPROVED
  const disabledAt = action === 'reject' ? new Date() : null
  const previousMetadata = recordMetadata(existing.metadata)
  const classificationConfirmation = calendarClassificationMetadata(
    existing.metadata,
  )
  const metadata = {
    ...previousMetadata,
    classificationConfirmation: classificationConfirmation
      ? {
          ...classificationConfirmation,
          status:
            action === 'requestChanges'
              ? 'NEEDS_REVIEW'
              : action === 'reject'
                ? classificationConfirmation.status
                : 'CONFIRMED',
          confirmedAt:
            action === 'reject' || action === 'requestChanges'
              ? classificationConfirmation.confirmedAt
              : new Date().toISOString(),
          confirmedByWorkspaceMemberId:
            action === 'reject' || action === 'requestChanges'
              ? classificationConfirmation.confirmedByWorkspaceMemberId
              : actorMemberId,
        }
      : undefined,
    approvalUpdatedAt: new Date().toISOString(),
    approvalAction: action,
    approvalActorMemberId: actorMemberId,
    approvalReason: reason,
  }
  const connection = await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      approvalStatus,
      connectionPurpose: nextPurpose,
      classificationSource:
        action === 'approve' ||
        action === 'approveReadOnly' ||
        action === 'approveBusyOnly' ||
        action === 'approveSuggestion' ||
        action === 'approveBlocking' ||
        action === 'approveWork' ||
        action === 'reclassify'
          ? CalendarPurposeClassificationSource.ADMIN_CONFIRMED
          : undefined,
      classificationConfidence:
        action === 'reject' || action === 'requestChanges' ? undefined : 1,
      classifiedAt:
        action === 'reject' || action === 'requestChanges'
          ? undefined
          : new Date(),
      classifiedByWorkspaceMemberId:
        action === 'reject' || action === 'requestChanges'
          ? undefined
          : actorMemberId,
      ...(visibilityMode ? { visibilityMode } : {}),
      ...(availabilityBehavior ? { availabilityBehavior } : {}),
      ...(busyDisplayMode ? { busyDisplayMode } : {}),
      disabledAt,
      disabledReason: action === 'reject' ? 'APPROVAL_REJECTED' : null,
      ownerInactiveAt: null,
      adminConfirmedAt: action === 'reject' ? undefined : new Date(),
      adminConfirmedByWorkspaceMemberId:
        action === 'reject' ? undefined : actorMemberId,
      metadata: metadata as Prisma.InputJsonObject,
    },
  })
  const nextDirection =
    action === 'approveBusyOnly'
      ? CalendarSyncDirection.AVAILABILITY_ONLY
      : action === 'approveReadOnly'
        ? CalendarSyncDirection.IMPORT_ONLY
        : null
  if (nextDirection) {
    await prisma.connectedCalendar.updateMany({
      where: { workspaceId, connectionId },
      data: {
        syncDirection: coerceCalendarSyncDirectionForPolicy({
          direction: nextDirection,
          connection,
          policy,
        }),
        exportEnabled: false,
        importEnabled: true,
      },
    })
  }
  await writeCalendarGovernanceOutboxEvent({
    workspaceId,
    topic:
      connection.connectionPurpose === CalendarConnectionPurpose.PERSONAL
        ? action === 'reject'
          ? 'scheduling.personal_calendar.rejected'
          : 'scheduling.personal_calendar.approved'
        : action === 'reclassify'
          ? 'scheduling.calendar_connection.reclassified'
          : action === 'approveReadOnly' ||
              action === 'approveBusyOnly' ||
              action === 'approveSuggestion' ||
              action === 'approveBlocking'
            ? 'scheduling.calendar_connection.approved_with_restrictions'
            : 'scheduling.calendar_connection.approval_updated',
    aggregateId: connectionId,
    payload: {
      action,
      approvalStatus,
      actorMemberId,
      purpose: nextPurpose,
      reason,
    },
  })
  return connection
}

export async function confirmCalendarConnectionClassification({
  workspaceId,
  connectionId,
  actorMemberId,
  selectedPurpose,
}: {
  workspaceId: string
  connectionId: string
  actorMemberId: string
  selectedPurpose: CalendarConnectionPurpose
}) {
  const prisma = await getPrisma()
  const [policy, actor, existing] = await Promise.all([
    getWorkspaceCalendarConnectionPolicy(workspaceId),
    prisma.workspaceMember.findFirst({
      where: { workspaceId, id: actorMemberId },
      select: { id: true, role: true },
    }),
    prisma.calendarConnection.findFirst({
      where: { workspaceId, id: connectionId, disconnectedAt: null },
      select: {
        id: true,
        workspaceMemberId: true,
        ownershipType: true,
        connectionPurpose: true,
        metadata: true,
      },
    }),
  ])
  if (!actor || !existing) {
    throw new Error('Calendar connection classification could not be verified.')
  }
  if (
    existing.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    existing.workspaceMemberId !== actor.id
  ) {
    const authority = resolvePersonalCalendarApprovalAuthority({
      workspacePolicy: policy,
      workspaceMember: actor,
      targetWorkspaceMemberId: existing.workspaceMemberId,
    })
    if (!authority.canApprove) {
      throw new Error('You cannot confirm another member calendar connection.')
    }
  }
  if (
    existing.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    (selectedPurpose === CalendarConnectionPurpose.WORKSPACE_SHARED ||
      selectedPurpose === CalendarConnectionPurpose.RESOURCE)
  ) {
    const authority = resolvePersonalCalendarApprovalAuthority({
      workspacePolicy: policy,
      workspaceMember: actor,
      targetWorkspaceMemberId: existing.workspaceMemberId,
    })
    if (!authority.canApprove) {
      throw new Error(
        'Only an eligible workspace approver can classify a member connection as shared workspace or resource.',
      )
    }
  }
  if (selectedPurpose === CalendarConnectionPurpose.PERSONAL) {
    const access = resolvePersonalCalendarAccess({
      workspacePolicy: policy,
      workspaceMember: actor,
    })
    if (
      !access.canRequestConnection &&
      existing.workspaceMemberId === actor.id
    ) {
      throw new Error(
        'This workspace does not currently allow you to connect a personal calendar.',
      )
    }
  }
  const classification = calendarClassificationMetadata(existing.metadata)
  const highConfidenceMismatch =
    Boolean(classification) &&
    selectedPurpose !== classification!.suggestedPurpose &&
    classification!.classificationConfidence >= 0.7
  const governance =
    existing.ownershipType === CalendarConnectionOwnershipType.MEMBER
      ? getMemberConnectionInitialGovernance(policy, selectedPurpose)
      : getWorkspaceConnectionInitialGovernance(policy)
  const approvalStatus = highConfidenceMismatch
    ? CalendarConnectionApprovalStatus.NEEDS_REVIEW
    : governance.approvalStatus
  const metadata = {
    ...recordMetadata(existing.metadata),
    classificationConfirmation: {
      ...(classification ?? {}),
      requestedPurpose: existing.connectionPurpose,
      suggestedPurpose:
        classification?.suggestedPurpose ?? CalendarConnectionPurpose.UNKNOWN,
      status: highConfidenceMismatch
        ? 'NEEDS_REVIEW'
        : ('CONFIRMED' as CalendarClassificationConfirmationStatus),
      confirmedPurpose: selectedPurpose,
      confirmedAt: new Date().toISOString(),
      confirmedByWorkspaceMemberId: actorMemberId,
      mismatchReason: highConfidenceMismatch
        ? 'confirmedPurposeConflictsWithProviderSuggestion'
        : classification?.mismatchReason,
    },
  }
  const updated = await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      connectionPurpose: selectedPurpose,
      classificationSource:
        actor.id === existing.workspaceMemberId
          ? CalendarPurposeClassificationSource.MEMBER_SELECTED
          : CalendarPurposeClassificationSource.ADMIN_CONFIRMED,
      classificationConfidence: 1,
      classifiedAt: new Date(),
      classifiedByWorkspaceMemberId: actorMemberId,
      adminConfirmedAt:
        actor.id === existing.workspaceMemberId ? undefined : new Date(),
      adminConfirmedByWorkspaceMemberId:
        actor.id === existing.workspaceMemberId ? undefined : actorMemberId,
      approvalStatus,
      visibilityMode: governance.visibilityMode,
      availabilityBehavior: governance.availabilityBehavior,
      busyDisplayMode: governance.busyDisplayMode,
      syncStatus: CalendarConnectionStatus.CONNECTED,
      nextSyncAt:
        approvalStatus === CalendarConnectionApprovalStatus.APPROVED
          ? new Date()
          : null,
      metadata: metadata as Prisma.InputJsonObject,
    },
  })
  await writeCalendarGovernanceOutboxEvent({
    workspaceId,
    topic: highConfidenceMismatch
      ? 'scheduling.calendar_connection.classification_mismatch'
      : 'scheduling.calendar_connection.classification_confirmed',
    aggregateId: connectionId,
    payload: {
      actorMemberId,
      selectedPurpose,
      approvalStatus,
      highConfidenceMismatch,
    },
  })
  if (approvalStatus !== CalendarConnectionApprovalStatus.APPROVED) {
    await writeCalendarGovernanceOutboxEvent({
      workspaceId,
      topic: 'scheduling.calendar_connection.approval_requested',
      aggregateId: connectionId,
      payload: { actorMemberId, selectedPurpose, approvalStatus },
    })
  }
  return updated
}

export async function disconnectUnconfirmedCalendarConnection({
  workspaceId,
  connectionId,
  actorMemberId,
}: {
  workspaceId: string
  connectionId: string
  actorMemberId: string
}) {
  const prisma = await getPrisma()
  const connection = await prisma.calendarConnection.findFirst({
    where: { workspaceId, id: connectionId, disconnectedAt: null },
    select: {
      id: true,
      workspaceMemberId: true,
      metadata: true,
    },
  })
  if (!connection) throw new Error('Calendar connection was not found.')
  if (connection.workspaceMemberId !== actorMemberId) {
    throw new Error('Only the connection owner can cancel this confirmation.')
  }
  const status = getCalendarClassificationConfirmationStatus(
    connection.metadata,
  )
  if (status !== 'PENDING' && status !== 'NEEDS_REVIEW') {
    throw new Error('This calendar connection is not waiting for confirmation.')
  }
  return prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      disconnectedAt: new Date(),
      syncStatus: CalendarConnectionStatus.DISCONNECTED,
      tokenStatus: 'classificationCanceled',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      metadata: {
        ...recordMetadata(connection.metadata),
        classificationCanceledAt: new Date().toISOString(),
        classificationCanceledByWorkspaceMemberId: actorMemberId,
      } as Prisma.InputJsonObject,
    },
  })
}

export async function listCalendarConnectionApprovalRequests({
  workspaceId,
  status,
  provider,
  purpose,
  memberId,
  actionRequiredOnly = false,
}: {
  workspaceId: string
  status?: string | null
  provider?: string | null
  purpose?: string | null
  memberId?: string | null
  actionRequiredOnly?: boolean
}) {
  const prisma = await getPrisma()
  const where: Prisma.CalendarConnectionWhereInput = {
    workspaceId,
    disconnectedAt: null,
    ...(provider ? { provider: provider as any } : {}),
    ...(memberId ? { workspaceMemberId: memberId } : {}),
    ...(purpose && purpose in CalendarConnectionPurpose
      ? {
          connectionPurpose:
            CalendarConnectionPurpose[
              purpose as keyof typeof CalendarConnectionPurpose
            ],
        }
      : {}),
  }
  if (actionRequiredOnly) {
    where.approvalStatus = {
      in: [
        CalendarConnectionApprovalStatus.PENDING,
        CalendarConnectionApprovalStatus.NEEDS_REVIEW,
      ],
    }
  } else if (status && status in CalendarConnectionApprovalStatus) {
    where.approvalStatus =
      CalendarConnectionApprovalStatus[
        status as keyof typeof CalendarConnectionApprovalStatus
      ]
  }
  const connections = await prisma.calendarConnection.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      workspaceMember: {
        select: {
          id: true,
          role: true,
          user: { select: { fullName: true, email: true } },
        },
      },
      connectedByWorkspaceMember: {
        select: {
          id: true,
          user: { select: { fullName: true, email: true } },
        },
      },
      calendars: {
        select: {
          id: true,
          name: true,
          selectedForSync: true,
          calendarPurpose: true,
          classificationConfidence: true,
        },
      },
    },
  })
  return connections.map((connection) => {
    const classification = calendarClassificationMetadata(connection.metadata)
    const selectedCalendars = connection.calendars.filter(
      (calendar) => calendar.selectedForSync,
    )
    return {
      id: connection.id,
      provider: connection.provider,
      member: connection.workspaceMember
        ? {
            id: connection.workspaceMember.id,
            name:
              connection.workspaceMember.user.fullName ??
              connection.workspaceMember.user.email ??
              'Workspace member',
            email: connection.workspaceMember.user.email,
            role: connection.workspaceMember.role,
          }
        : null,
      connectedBy: connection.connectedByWorkspaceMember
        ? {
            id: connection.connectedByWorkspaceMember.id,
            name:
              connection.connectedByWorkspaceMember.user.fullName ??
              connection.connectedByWorkspaceMember.user.email ??
              'Workspace member',
          }
        : null,
      accountEmail: connection.accountEmail,
      displayName: connection.displayName,
      ownershipType: connection.ownershipType,
      purpose: connection.connectionPurpose,
      approvalStatus: connection.approvalStatus,
      availabilityBehavior: connection.availabilityBehavior,
      busyDisplayMode: connection.busyDisplayMode,
      visibilityMode: connection.visibilityMode,
      classificationSource: connection.classificationSource,
      classificationConfidence: connection.classificationConfidence,
      classificationConfirmation: classification,
      selectedCalendarCount: selectedCalendars.length,
      selectedCalendarNames:
        connection.connectionPurpose === CalendarConnectionPurpose.PERSONAL
          ? []
          : selectedCalendars.map((calendar) => calendar.name),
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      disabledAt: connection.disabledAt?.toISOString() ?? null,
      disabledReason: connection.disabledReason,
    }
  })
}

export async function countActionRequiredCalendarApprovals(
  workspaceId: string,
) {
  const prisma = await getPrisma()
  return prisma.calendarConnection.count({
    where: {
      workspaceId,
      disconnectedAt: null,
      approvalStatus: {
        in: [
          CalendarConnectionApprovalStatus.PENDING,
          CalendarConnectionApprovalStatus.NEEDS_REVIEW,
        ],
      },
    },
  })
}

export async function setCalendarConnectionDisabled({
  workspaceId,
  connectionId,
  disabled,
  reason,
  actorMemberId,
}: {
  workspaceId: string
  connectionId: string
  disabled: boolean
  reason: string
  actorMemberId: string
}) {
  const prisma = await getPrisma()
  const connection = await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      disabledAt: disabled ? new Date() : null,
      disabledReason: disabled ? reason : null,
      approvalStatus: disabled
        ? undefined
        : CalendarConnectionApprovalStatus.NEEDS_REVIEW,
      metadata: {
        disabledUpdatedAt: new Date().toISOString(),
        disabled,
        reason,
        actorMemberId,
      },
    },
  })
  await writeCalendarGovernanceOutboxEvent({
    workspaceId,
    topic: 'scheduling.calendar_connection.disabled',
    aggregateId: connectionId,
    payload: { disabled, reason, actorMemberId },
  })
  return connection
}

export async function reconcilePersonalCalendarPolicy({
  workspaceId,
  policy,
  actorMemberId,
}: {
  workspaceId: string
  policy: WorkspaceCalendarConnectionPolicy
  actorMemberId: string
}) {
  const prisma = await getPrisma()
  const connections = await prisma.calendarConnection.findMany({
    where: {
      workspaceId,
      ownershipType: CalendarConnectionOwnershipType.MEMBER,
      connectionPurpose: CalendarConnectionPurpose.PERSONAL,
      disconnectedAt: null,
    },
    include: {
      workspaceMember: { select: { id: true, role: true } },
    },
  })
  const now = new Date()
  const disabledConnectionIds: string[] = []
  const needsReviewConnectionIds: string[] = []
  for (const connection of connections) {
    const access = resolvePersonalCalendarAccess({
      workspacePolicy: policy,
      workspaceMember: connection.workspaceMember,
    })
    if (!access.canRequestConnection) {
      disabledConnectionIds.push(connection.id)
    } else if (
      policy.personalCalendarApprovalRequired &&
      connection.approvalStatus === CalendarConnectionApprovalStatus.APPROVED
    ) {
      needsReviewConnectionIds.push(connection.id)
    }
  }
  const transactions: Prisma.PrismaPromise<unknown>[] = []
  if (disabledConnectionIds.length) {
    transactions.push(
      prisma.calendarWatchChannel.updateMany({
        where: {
          workspaceId,
          connectionId: { in: disabledConnectionIds },
          status: CalendarWatchChannelStatus.ACTIVE,
        },
        data: { status: CalendarWatchChannelStatus.STOPPED, stoppedAt: now },
      }),
      prisma.calendarConnection.updateMany({
        where: { workspaceId, id: { in: disabledConnectionIds } },
        data: {
          disabledAt: now,
          disabledReason: 'PERSONAL_CALENDAR_POLICY_DENIED',
          approvalStatus: CalendarConnectionApprovalStatus.NEEDS_REVIEW,
          syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
          nextSyncAt: null,
          availabilityBehavior: PersonalCalendarAvailabilityBehavior.IGNORE,
          busyDisplayMode: PersonalCalendarBusyDisplayMode.HIDDEN,
        },
      }),
      prisma.connectedCalendar.updateMany({
        where: { workspaceId, connectionId: { in: disabledConnectionIds } },
        data: {
          availabilityEnabled: false,
          syncDirection: CalendarSyncDirection.DISABLED,
          availabilityBehavior: PersonalCalendarAvailabilityBehavior.IGNORE,
          busyDisplayMode: PersonalCalendarBusyDisplayMode.HIDDEN,
        },
      }),
    )
  }
  if (needsReviewConnectionIds.length) {
    transactions.push(
      prisma.calendarConnection.updateMany({
        where: { workspaceId, id: { in: needsReviewConnectionIds } },
        data: {
          approvalStatus: CalendarConnectionApprovalStatus.NEEDS_REVIEW,
          nextSyncAt: null,
        },
      }),
    )
  }
  if (transactions.length) await prisma.$transaction(transactions)
  await writeCalendarGovernanceOutboxEvent({
    workspaceId,
    topic: 'scheduling.personal_calendar.access_policy_updated',
    aggregateId: workspaceId,
    payload: {
      actorMemberId,
      disabledConnectionIds,
      needsReviewConnectionIds,
      availabilityBehavior: policy.personalCalendarAvailabilityBehavior,
      busyDisplayMode: policy.personalCalendarBusyDisplayMode,
    },
  })
  return {
    disabled: disabledConnectionIds.length,
    needsReview: needsReviewConnectionIds.length,
  }
}

export async function handleWorkspaceMemberCalendarConnectionLifecycle({
  workspaceId,
  workspaceMemberId,
  transition,
  actor,
}: {
  workspaceId: string
  workspaceMemberId: string
  transition: 'removed' | 'deactivated' | 'reactivated'
  actor?: { workspaceMemberId?: string; userId?: string } | null
}) {
  const prisma = await getPrisma()
  const now = new Date()
  if (transition === 'reactivated') {
    const result = await prisma.calendarConnection.updateMany({
      where: {
        workspaceId,
        workspaceMemberId,
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
        disconnectedAt: null,
        ownerInactiveAt: { not: null },
      },
      data: {
        approvalStatus: CalendarConnectionApprovalStatus.NEEDS_REVIEW,
      },
    })
    return { affected: result.count }
  }
  const disabledReason =
    transition === 'removed' ? 'OWNER_REMOVED' : 'OWNER_INACTIVE'
  const connections = await prisma.calendarConnection.findMany({
    where: {
      workspaceId,
      workspaceMemberId,
      ownershipType: CalendarConnectionOwnershipType.MEMBER,
      disconnectedAt: null,
    },
    select: { id: true },
  })
  if (!connections.length) return { affected: 0 }
  await prisma.$transaction([
    prisma.calendarWatchChannel.updateMany({
      where: {
        workspaceId,
        connectionId: { in: connections.map((connection) => connection.id) },
        status: CalendarWatchChannelStatus.ACTIVE,
      },
      data: { status: CalendarWatchChannelStatus.STOPPED, stoppedAt: now },
    }),
    prisma.calendarConnection.updateMany({
      where: {
        workspaceId,
        id: { in: connections.map((connection) => connection.id) },
      },
      data: {
        disabledAt: now,
        disabledReason,
        ownerInactiveAt: now,
        approvalStatus: CalendarConnectionApprovalStatus.NEEDS_REVIEW,
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        nextSyncAt: null,
      },
    }),
  ])
  await Promise.all(
    connections.map((connection) =>
      writeCalendarGovernanceOutboxEvent({
        workspaceId,
        topic: 'scheduling.calendar_connection.owner_inactive',
        aggregateId: connection.id,
        payload: {
          transition,
          disabledReason,
          workspaceMemberId,
          actor,
        },
      }),
    ),
  )
  return { affected: connections.length }
}

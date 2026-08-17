'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronLeft, X } from 'lucide-react'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  SetupStatusBadge,
  setupStatusLabel,
} from '@/components/workspaces/SetupStatusBadge'
import { cn } from '@/lib/utils'
import type {
  LeadIntakeCardStatus,
  LeadIntakeSourceCard,
} from '@/lib/integrations/leadIntake'
import { resolveWorkspaceReadiness } from '@/lib/readiness/workspaceReadiness'
import {
  getWorkspaceRoleLabel,
  inviteRoleOptions,
  normalizeWorkspaceRole,
} from '@/lib/workspaces/workspaceRoles'
import {
  getWorkspaceSetupStorageKey,
  getWorkspaceSetupSummary,
  normalizeWorkspaceSetupProgress,
  workspaceSetupSteps,
  type WorkspaceSetupProgress,
  type WorkspaceSetupStepId,
} from '@/lib/workspaces/workspaceSetup'

type WorkspaceSetupProps = {
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  initialBusinessType?: string | null
  canManageSetup?: boolean
  showLauncher?: boolean
  leadIntakeSources?: LeadIntakeSourceCard[]
}

type SetupMemberDraft = {
  id: string
  email: string
  role: 'MEMBER' | 'MANAGER' | 'ADMIN'
  teamId?: string
  locationId?: string
  status?: 'draft' | 'sent' | 'failed'
  resultMessage?: string
}

type SetupTeamDraft = {
  id: string
  name: string
  memberIds: string[]
  primaryLocationId?: string
  persistedId?: string
}

type SetupLocationDraft = {
  id: string
  name: string
  memberIds: string[]
  teamIds: string[]
  persistedId?: string
}

type WorkspaceSetupDraft = {
  businessType: string
  workingDays: string[]
  workingStartsAt: string
  workingEndsAt: string
  workspaceTimezone: string
  memberRows: SetupMemberDraft[]
  teamRows: SetupTeamDraft[]
  locationRows: SetupLocationDraft[]
  calendarProvider: '' | 'google' | 'microsoft' | 'caldav'
  calendarConnectionStarted: boolean
  calendarConnected: boolean
  aiEnabled: boolean
  aiBusinessSummary: string
  aiProductsAndServices: string
  aiOperatingGuidelines: string
  aiBrandVoice: string
  aiCustomerPolicies: string
  websiteIntakeEnabled: boolean
  websiteSourceLabel: string
  manualLeadIntakeSelected: boolean
  notificationsSaved: boolean
  notificationsInApp: boolean
  notificationsEmail: boolean
  notificationReminderMinutes: string
  notifyAssignedMembers: boolean
  notifyCustomers: boolean
  finishCompleted: boolean
}

const memberRoles = inviteRoleOptions

const weekdayOptions = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
]

const weekdayToSchedulingDay: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const setupErrorFallbacks: Partial<Record<WorkspaceSetupStepId, string>> = {
  workingHours:
    'Working Hours could not be saved. Confirm the selected days, times, and timezone.',
  notifications:
    'Notification preferences could not be saved. Confirm the selected channels.',
  calendars:
    'Calendar connection could not be started. Check provider configuration.',
}

const defaultSetupDraft: WorkspaceSetupDraft = {
  businessType: '',
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  workingStartsAt: '09:00',
  workingEndsAt: '17:00',
  workspaceTimezone: 'America/New_York',
  memberRows: [createMemberRow()],
  teamRows: [createTeamRow()],
  locationRows: [createLocationRow()],
  calendarProvider: '',
  calendarConnectionStarted: false,
  calendarConnected: false,
  aiEnabled: false,
  aiBusinessSummary: '',
  aiProductsAndServices: '',
  aiOperatingGuidelines: '',
  aiBrandVoice: '',
  aiCustomerPolicies: '',
  websiteIntakeEnabled: false,
  websiteSourceLabel: 'Website Form',
  manualLeadIntakeSelected: false,
  notificationsSaved: false,
  notificationsInApp: true,
  notificationsEmail: false,
  notificationReminderMinutes: '30',
  notifyAssignedMembers: true,
  notifyCustomers: false,
  finishCompleted: false,
}

function createRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createMemberRow(): SetupMemberDraft {
  return { id: createRowId('member'), email: '', role: 'MEMBER' }
}

function createTeamRow(): SetupTeamDraft {
  return { id: createRowId('team'), name: '', memberIds: [] }
}

function createLocationRow(): SetupLocationDraft {
  return { id: createRowId('location'), name: '', memberIds: [], teamIds: [] }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
}

function cleanRows<T extends { id: string }>(
  rows: T[] | undefined,
  fallback: () => T,
) {
  return Array.isArray(rows) && rows.length > 0 ? rows : [fallback()]
}

function normalizeDraft(value: unknown): WorkspaceSetupDraft {
  if (!value || typeof value !== 'object') return defaultSetupDraft
  const partial = value as Partial<WorkspaceSetupDraft> & {
    memberEmail?: string
    memberRole?: string
    teamName?: string
    locationName?: string
    aiSummary?: string
    notificationsEmail?: boolean
  }
  return {
    ...defaultSetupDraft,
    ...partial,
    memberRows: cleanRows(
      partial.memberRows ??
        (partial.memberEmail
          ? [
              {
                id: createRowId('member'),
                email: partial.memberEmail,
                role:
                  partial.memberRole === 'ADMIN' ||
                  partial.memberRole === 'MANAGER'
                    ? partial.memberRole
                    : 'MEMBER',
              },
            ]
          : undefined),
      createMemberRow,
    ),
    teamRows: cleanRows(
      partial.teamRows ??
        (partial.teamName
          ? [{ id: createRowId('team'), name: partial.teamName, memberIds: [] }]
          : undefined),
      createTeamRow,
    ),
    locationRows: cleanRows(
      partial.locationRows ??
        (partial.locationName
          ? [
              {
                id: createRowId('location'),
                name: partial.locationName,
                memberIds: [],
                teamIds: [],
              },
            ]
          : undefined),
      createLocationRow,
    ),
    aiBusinessSummary: partial.aiBusinessSummary ?? partial.aiSummary ?? '',
    notificationsEmail:
      typeof partial.notificationsEmail === 'boolean'
        ? partial.notificationsEmail
        : defaultSetupDraft.notificationsEmail,
  }
}

function readProgress(workspaceSlug: string): WorkspaceSetupProgress {
  if (typeof window === 'undefined') {
    return normalizeWorkspaceSetupProgress(null)
  }

  try {
    const raw = window.localStorage.getItem(
      getWorkspaceSetupStorageKey(workspaceSlug),
    )
    return normalizeWorkspaceSetupProgress(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeWorkspaceSetupProgress(null)
  }
}

function writeProgress(
  workspaceSlug: string,
  progress: WorkspaceSetupProgress,
) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    getWorkspaceSetupStorageKey(workspaceSlug),
    JSON.stringify(progress),
  )
}

function getDraftStorageKey(workspaceSlug: string) {
  return `${getWorkspaceSetupStorageKey(workspaceSlug)}:draft`
}

function readDraft(workspaceSlug: string): WorkspaceSetupDraft {
  if (typeof window === 'undefined') return defaultSetupDraft
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(workspaceSlug))
    if (!raw) return defaultSetupDraft
    const parsed = JSON.parse(raw) as Partial<WorkspaceSetupDraft>
    delete parsed.memberRows
    return normalizeDraft(parsed)
  } catch {
    return defaultSetupDraft
  }
}

function readDraftWithInitialBusinessType(
  workspaceSlug: string,
  initialBusinessType?: string | null,
): WorkspaceSetupDraft {
  const nextDraft = readDraft(workspaceSlug)
  const trimmedBusinessType = initialBusinessType?.trim()
  if (trimmedBusinessType && !nextDraft.businessType.trim()) {
    return { ...nextDraft, businessType: trimmedBusinessType }
  }
  return nextDraft
}

function getPersistableDraft(draft: WorkspaceSetupDraft): WorkspaceSetupDraft {
  return {
    ...draft,
    memberRows: [createMemberRow()],
  }
}

function isBusinessInformationComplete({
  businessName,
  businessType,
}: {
  businessName: string
  businessType: string
}) {
  return Boolean(businessName.trim() && businessType.trim())
}

function writeDraft(workspaceSlug: string, draft: WorkspaceSetupDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    getDraftStorageKey(workspaceSlug),
    JSON.stringify(getPersistableDraft(draft)),
  )
}

function getSetupDismissalStorageKey(workspaceSlug: string) {
  return `${getWorkspaceSetupStorageKey(workspaceSlug)}:readiness-dismissed`
}

function completedMemberRows(rows: SetupMemberDraft[]) {
  return rows
    .map((row) => ({ ...row, email: normalizeEmail(row.email) }))
    .filter((row) => row.email)
}

function completedTeamRows(rows: SetupTeamDraft[]) {
  return rows
    .map((row) => ({ ...row, name: row.name.trim() }))
    .filter((row) => row.name)
}

function completedLocationRows(rows: SetupLocationDraft[]) {
  return rows
    .map((row) => ({ ...row, name: row.name.trim() }))
    .filter((row) => row.name)
}

function hasDuplicateValues(values: string[]) {
  return new Set(values).size !== values.length
}

function humanProvider(provider: WorkspaceSetupDraft['calendarProvider']) {
  if (provider === 'google') return 'Google Calendar'
  if (provider === 'microsoft') return 'Microsoft Outlook'
  if (provider === 'caldav') return 'Apple Calendar / CalDAV'
  return 'No provider selected'
}

function leadIntakeStatusVariant(status: LeadIntakeCardStatus): BadgeVariant {
  if (status === 'connected' || status === 'ready') return 'green'
  if (status === 'selected') return 'brand'
  if (
    status === 'partial' ||
    status === 'configurationRequired' ||
    status === 'actionRequired'
  ) {
    return 'yellow'
  }
  if (status === 'comingSoon') return 'purple'
  return 'gray'
}

function updateManualLeadIntakeCard(
  card: LeadIntakeSourceCard,
  manualSelected: boolean,
): LeadIntakeSourceCard {
  if (card.id !== 'manualEntry') return card
  return {
    ...card,
    status: manualSelected ? 'selected' : 'ready',
    statusLabel: manualSelected ? 'Selected fallback' : 'Ready',
    summary: manualSelected
      ? 'Manual lead creation is selected as the fallback intake method. Automated source setup remains optional.'
      : 'Manual lead creation is available from the Leads page and can be selected as the fallback intake method.',
    action: {
      label: manualSelected ? 'Selected fallback' : 'Use Manual Entry',
      kind: 'selectManual',
      disabled: manualSelected,
    },
  }
}

function setupStepFromDestination(
  destination: string | undefined,
): WorkspaceSetupStepId | null {
  if (!destination) return null
  try {
    const url = new URL(destination, 'https://skillify.local')
    const setupStep = url.searchParams.get('setupStep')
    return workspaceSetupSteps.some((step) => step.id === setupStep)
      ? (setupStep as WorkspaceSetupStepId)
      : null
  } catch {
    return null
  }
}

export function WorkspaceSetup({
  workspaceId,
  workspaceSlug,
  workspaceName,
  initialBusinessType,
  canManageSetup = true,
  showLauncher = true,
  leadIntakeSources,
}: WorkspaceSetupProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamString = searchParams.toString()
  const [progress, setProgress] = useState<WorkspaceSetupProgress>(() =>
    normalizeWorkspaceSetupProgress(null),
  )
  const [loaded, setLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeStepId, setActiveStepId] =
    useState<WorkspaceSetupStepId>('business')
  const [businessName, setBusinessName] = useState(workspaceName)
  const [draft, setDraft] = useState<WorkspaceSetupDraft>(defaultSetupDraft)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishMessage, setFinishMessage] = useState<string | null>(null)
  const [setupReadinessDismissed, setSetupReadinessDismissed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(searchParamString)
    const nextProgress = readProgress(workspaceSlug)
    const nextDraft = readDraftWithInitialBusinessType(
      workspaceSlug,
      initialBusinessType,
    )
    const googleCalendar = params.get('googleCalendar')
    const microsoftCalendar = params.get('microsoftCalendar')
    if (googleCalendar === 'connected' || microsoftCalendar === 'connected') {
      nextDraft.calendarConnected = true
      nextDraft.calendarConnectionStarted = true
      nextDraft.calendarProvider =
        googleCalendar === 'connected' ? 'google' : 'microsoft'
      nextProgress.calendars = 'complete'
    } else if (googleCalendar === 'error' || microsoftCalendar === 'error') {
      nextDraft.calendarConnectionStarted = true
      nextProgress.calendars = 'connectionError'
    }
    if (
      nextProgress.business !== 'complete' &&
      isBusinessInformationComplete({
        businessName: workspaceName,
        businessType: nextDraft.businessType,
      })
    ) {
      nextProgress.business = 'complete'
    }
    setDraft(nextDraft)
    setProgress(nextProgress)
    setSetupReadinessDismissed(
      window.localStorage.getItem(
        getSetupDismissalStorageKey(workspaceSlug),
      ) === '1',
    )
    setLoaded(true)
  }, [initialBusinessType, searchParamString, workspaceName, workspaceSlug])

  useEffect(() => {
    const params = new URLSearchParams(searchParamString)
    const requestedStep = params.get('setupStep') as WorkspaceSetupStepId | null
    if (params.get('setup') === '1') {
      if (
        requestedStep &&
        workspaceSetupSteps.some((step) => step.id === requestedStep)
      ) {
        setActiveStepId(requestedStep)
      } else {
        const firstIncomplete =
          workspaceSetupSteps.find(
            (step) => progress[step.id] !== 'complete',
          ) ?? workspaceSetupSteps[0]
        setActiveStepId(firstIncomplete.id)
      }
      setIsOpen(true)
    }
  }, [progress, searchParamString])

  const closeSetup = () => {
    setIsOpen(false)
    const nextParams = new URLSearchParams(searchParamString)
    nextParams.delete('setup')
    nextParams.delete('setupStep')
    const nextSearch = nextParams.toString()
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
      scroll: false,
    })
    router.refresh()
  }

  const closeSetupAfterFinish = () => {
    setIsOpen(false)
    const nextParams = new URLSearchParams(searchParamString)
    nextParams.delete('setup')
    nextParams.delete('setupStep')
    nextParams.set('setupComplete', '1')
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
    router.refresh()
  }

  useEffect(() => {
    if (!loaded) return
    writeProgress(workspaceSlug, progress)
  }, [loaded, progress, workspaceSlug])

  useEffect(() => {
    if (!loaded) return
    writeDraft(workspaceSlug, draft)
  }, [draft, loaded, workspaceSlug])

  const summary = useMemo(() => getWorkspaceSetupSummary(progress), [progress])
  const activeStepIndex = workspaceSetupSteps.findIndex(
    (step) => step.id === activeStepId,
  )
  const activeStep =
    workspaceSetupSteps[activeStepIndex] ?? workspaceSetupSteps[0]
  const stagedMembers = completedMemberRows(draft.memberRows)
  const savedTeams = completedTeamRows(draft.teamRows)
  const savedLocations = completedLocationRows(draft.locationRows)
  const readiness = useMemo(
    () =>
      resolveWorkspaceReadiness({
        workspaceId,
        workspaceSlug,
        setupProgress: progress,
        businessInformationComplete:
          progress.business === 'complete' ||
          isBusinessInformationComplete({
            businessName,
            businessType: draft.businessType,
          }),
        validWorkingHoursExist: progress.workingHours === 'complete',
        ownerAccessValid: true,
        memberCount: stagedMembers.length + 1,
        teamCount: savedTeams.length,
        locationCount: savedLocations.length,
        calendarConnections: draft.calendarConnected
          ? [
              {
                id: `setup:${draft.calendarProvider || 'calendar'}`,
                workspaceId,
                providerId:
                  draft.calendarProvider === 'microsoft'
                    ? 'microsoftCalendar'
                    : draft.calendarProvider === 'google'
                      ? 'googleCalendar'
                      : 'caldav',
                category: 'calendar',
                ownershipType: 'workspaceOAuth',
                status: 'connected',
                externalAccountId: null,
                externalAccountLabel: humanProvider(draft.calendarProvider),
                credentialHint: null,
                grantedScopes: null,
                tokenExpiresAt: null,
                refreshStatus: null,
                providerMetadata: null,
                connectedByUserId: null,
                connectedByWorkspaceMemberId: null,
                connectedAt: null,
                lastValidatedAt: null,
                lastSuccessfulSyncAt: null,
                lastErrorCode: null,
                lastErrorAt: null,
                disabledAt: null,
                revokedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]
          : [],
        notificationChannelsConfigured: progress.notifications === 'complete',
        manualLeadCreationAvailable: true,
        automatedLeadSourceConfigured: draft.websiteIntakeEnabled,
        workspaceAiConfigured: progress.ai === 'complete',
        workflowBuilderAvailable: true,
      }),
    [
      draft.calendarConnected,
      draft.calendarProvider,
      draft.businessType,
      draft.websiteIntakeEnabled,
      businessName,
      progress,
      savedLocations.length,
      savedTeams.length,
      stagedMembers.length,
      workspaceId,
      workspaceSlug,
    ],
  )
  const resolvedLeadIntakeSources = useMemo(() => {
    const sources = leadIntakeSources ?? []
    return sources.map((source) =>
      updateManualLeadIntakeCard(source, draft.manualLeadIntakeSelected),
    )
  }, [draft.manualLeadIntakeSelected, leadIntakeSources])

  const setStepStatus = (
    stepId: WorkspaceSetupStepId,
    status: WorkspaceSetupProgress[WorkspaceSetupStepId],
  ) => {
    setProgress((current) => ({ ...current, [stepId]: status }))
  }

  const goToStep = (stepId: WorkspaceSetupStepId) => {
    setError(null)
    setFinishMessage(null)
    setActiveStepId(stepId)
    setIsOpen(true)
  }

  const goNext = () => {
    const nextStep = workspaceSetupSteps[activeStepIndex + 1]
    if (nextStep) {
      setActiveStepId(nextStep.id)
      setError(null)
      return
    }
    closeSetup()
  }

  const updateDraft = (updates: Partial<WorkspaceSetupDraft>) => {
    setDraft((current) => ({ ...current, ...updates }))
    setError(null)
    setFinishMessage(null)
  }

  const dismissPostSetupReadiness = async () => {
    if (!draft.finishCompleted) return
    setSetupReadinessDismissed(true)
    window.localStorage.setItem(getSetupDismissalStorageKey(workspaceSlug), '1')
    await fetch('/api/dashboard/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        layout: {
          workspaceSetupReadinessDismissedAt: new Date().toISOString(),
        },
      }),
    }).catch(() => undefined)
  }

  const updateMemberRow = (
    rowId: string,
    updates: Partial<SetupMemberDraft>,
  ) => {
    updateDraft({
      memberRows: normalizeAppendMemberRow(
        draft.memberRows.map((row) =>
          row.id === rowId ? { ...row, ...updates, status: 'draft' } : row,
        ),
      ),
    })
  }

  const updateTeamRow = (rowId: string, updates: Partial<SetupTeamDraft>) => {
    updateDraft({
      teamRows: normalizeAppendTeamRow(
        draft.teamRows.map((row) =>
          row.id === rowId ? { ...row, ...updates } : row,
        ),
      ),
    })
  }

  const updateLocationRow = (
    rowId: string,
    updates: Partial<SetupLocationDraft>,
  ) => {
    updateDraft({
      locationRows: normalizeAppendLocationRow(
        draft.locationRows.map((row) =>
          row.id === rowId ? { ...row, ...updates } : row,
        ),
      ),
    })
  }

  const postJson = async (url: string, body: unknown, method = 'POST') => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
        safeMessage?: string
      }
      throw new Error(
        data.safeMessage ??
          data.message ??
          data.error ??
          setupErrorFallbacks[activeStep.id] ??
          'This setup step could not be saved.',
      )
    }
    return response.json().catch(() => ({}))
  }

  const getJson = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        setupErrorFallbacks[activeStep.id] ??
          'This setup step could not be loaded.',
      )
    }
    return response.json().catch(() => ({}))
  }

  const buildWorkingHoursRecord = () => ({
    kind: 'workingHours',
    scope: 'workspace',
    memberId: '',
    memberName: 'Business Hours',
    scheduleMode: 'custom',
    daysOfWeek: draft.workingDays
      .map((day) => weekdayToSchedulingDay[day])
      .filter((day): day is number => typeof day === 'number')
      .sort((a, b) => a - b),
    startsAt: draft.workingStartsAt,
    endsAt: draft.workingEndsAt,
    timezone: draft.workspaceTimezone,
  })

  const saveWorkingHours = async () => {
    const record = buildWorkingHoursRecord()
    const current = (await getJson(
      `/api/workspaces/${workspaceId}/scheduling/availability`,
    )) as {
      value?: {
        availability?: Array<{
          id: string
          kind: string
          scope?: string
          memberId?: string
          workspaceMemberId?: string | null
          teamId?: string | null
          locationId?: string | null
        }>
      }
      availability?: Array<{
        id: string
        kind: string
        scope?: string
        memberId?: string
        workspaceMemberId?: string | null
        teamId?: string | null
        locationId?: string | null
      }>
    }
    const availability =
      current.value?.availability ?? current.availability ?? []
    const existing = availability.find(
      (item) =>
        item.kind === 'workingHours' &&
        (item.scope === 'workspace' ||
          (!item.memberId &&
            !item.workspaceMemberId &&
            !item.teamId &&
            !item.locationId)),
    )
    if (existing) {
      await postJson(
        `/api/workspaces/${workspaceId}/scheduling/availability/${existing.id}`,
        { record },
        'PATCH',
      )
      return
    }
    await postJson(`/api/workspaces/${workspaceId}/scheduling/availability`, {
      record,
    })
  }

  const validateMembers = () => {
    const rows = completedMemberRows(draft.memberRows)
    const emails = rows.map((row) => row.email)
    if (rows.some((row) => !isValidEmail(row.email))) {
      return 'Enter a valid email address for each staged invitation.'
    }
    const unsupportedRole = rows.find(
      (row) => !normalizeWorkspaceRole(row.role),
    )
    if (unsupportedRole) {
      return `Unsupported role selected for ${unsupportedRole.email || 'a teammate'}. Choose Member, Manager, or Admin.`
    }
    if (hasDuplicateValues(emails)) {
      return 'Remove duplicate teammate emails before continuing.'
    }
    return null
  }

  const validateStructure = () => {
    const teams = completedTeamRows(draft.teamRows)
    const locations = completedLocationRows(draft.locationRows)
    if (hasDuplicateValues(teams.map((team) => team.name.toLowerCase()))) {
      return 'Team names must be unique.'
    }
    if (
      hasDuplicateValues(
        locations.map((location) => location.name.toLowerCase()),
      )
    ) {
      return 'Business location names must be unique.'
    }
    return null
  }

  const connectCalendar = async (provider: 'google' | 'microsoft') => {
    try {
      setSaving(true)
      setError(null)
      updateDraft({
        calendarProvider: provider,
        calendarConnectionStarted: true,
      })
      setStepStatus('calendars', 'inProgress')
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/${provider}/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownershipType: 'MEMBER',
            connectionPurpose: 'PERSONAL',
            returnToSetup: true,
            setupStep: 'calendars',
          }),
        },
      )
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        authorizationUrl?: string
        value?: { authorizationUrl?: string }
        code?: string
        message?: string
        safeMessage?: string
      }
      if (!response.ok) {
        const detail = result.safeMessage ?? result.message ?? result.code
        if (
          response.status === 503 ||
          result.code === 'configurationRequired' ||
          result.code === 'unavailable'
        ) {
          updateDraft({
            calendarProvider: provider,
            calendarConnectionStarted: true,
          })
          setStepStatus('calendars', 'configurationRequired')
          setError(
            detail ??
              `${humanProvider(provider)} requires Skillify deployment configuration. Native Scheduling still works without an external calendar.`,
          )
          return
        }
        throw new Error(
          detail ??
            `${humanProvider(provider)} connection could not be started.`,
        )
      }
      const authorizationUrl =
        result.authorizationUrl ?? result.value?.authorizationUrl
      if (!authorizationUrl) {
        const detail = result.safeMessage ?? result.message ?? result.code
        throw new Error(
          detail
            ? `${humanProvider(provider)} connection unavailable: ${detail}`
            : `${humanProvider(provider)} connection unavailable. Skillify deployment configuration may be required.`,
        )
      }
      window.location.assign(authorizationUrl)
    } catch (connectError) {
      setStepStatus('calendars', 'connectionError')
      setError(
        connectError instanceof Error
          ? connectError.message
          : 'Calendar connection could not be started.',
      )
    } finally {
      setSaving(false)
    }
  }

  const finishSetup = async () => {
    if (saving) return
    const memberValidation = validateMembers()
    if (memberValidation) {
      setError(memberValidation)
      setStepStatus('members', 'actionRequired')
      goToStep('members')
      return
    }
    try {
      setSaving(true)
      setError(null)
      setFinishMessage(null)
      const nextRows: SetupMemberDraft[] = []
      let failed = 0
      let sent = 0
      for (const row of draft.memberRows) {
        const email = normalizeEmail(row.email)
        if (!email) {
          nextRows.push(row)
          continue
        }
        if (row.status === 'sent') {
          nextRows.push(row)
          continue
        }
        try {
          await postJson(`/api/workspaces/${workspaceId}/invite`, {
            email,
            role: row.role,
          })
          sent += 1
          nextRows.push({
            ...row,
            email,
            status: 'sent',
            resultMessage: `Pending ${getWorkspaceRoleLabel(row.role)} invitation created.`,
          })
        } catch (inviteError) {
          failed += 1
          nextRows.push({
            ...row,
            email,
            status: 'failed',
            resultMessage:
              inviteError instanceof Error
                ? inviteError.message
                : 'Invitation could not be sent.',
          })
        }
      }
      setDraft((current) => ({
        ...current,
        memberRows: nextRows,
        finishCompleted: failed === 0,
      }))
      if (failed > 0) {
        setStepStatus('members', 'actionRequired')
        setError(
          `${failed} invitation${failed === 1 ? '' : 's'} need attention. Successful setup data was preserved.`,
        )
        return
      }
      const finishedProgress = {
        ...progress,
        members: stagedMembers.length > 0 ? 'complete' : progress.members,
        review: 'complete',
      } satisfies WorkspaceSetupProgress
      setProgress(finishedProgress)
      writeProgress(workspaceSlug, finishedProgress)
      setFinishMessage(
        sent > 0
          ? `Setup finished. ${sent} pending invitation${sent === 1 ? '' : 's'} created.`
          : 'Setup finished. No staged invitations needed to be sent.',
      )
      closeSetupAfterFinish()
    } finally {
      setSaving(false)
    }
  }

  const saveAndContinue = async () => {
    if (saving) return
    if (activeStep.id === 'business' && !businessName.trim()) {
      setError('Enter a business or workspace name before continuing.')
      return
    }
    if (activeStep.id === 'members') {
      const validation = validateMembers()
      if (validation) {
        setError(validation)
        return
      }
    }
    if (activeStep.id === 'structure') {
      const validation = validateStructure()
      if (validation) {
        setError(validation)
        return
      }
    }
    if (activeStep.id === 'workingHours') {
      if (draft.workingDays.length === 0) {
        setError('Choose at least one working day, or choose Skip for now.')
        return
      }
      if (!draft.workingStartsAt || !draft.workingEndsAt) {
        setError('Enter valid start and end times.')
        return
      }
      if (draft.workingEndsAt <= draft.workingStartsAt) {
        setError('End time must be later than start time.')
        return
      }
    }
    if (activeStep.id === 'calendars') {
      if (!draft.calendarConnected) {
        setStepStatus(
          'calendars',
          draft.calendarConnectionStarted ? 'actionRequired' : 'notStarted',
        )
        setError(
          'Connect a supported calendar or choose Skip for now. Selecting a provider alone does not complete this step.',
        )
        return
      }
    }
    if (
      activeStep.id === 'ai' &&
      !draft.aiEnabled &&
      !draft.aiBusinessSummary.trim() &&
      !draft.aiProductsAndServices.trim() &&
      !draft.aiOperatingGuidelines.trim() &&
      !draft.aiBrandVoice.trim() &&
      !draft.aiCustomerPolicies.trim()
    ) {
      setError(
        'Enable Workspace AI, add structured business context, or Skip for now.',
      )
      return
    }
    if (
      activeStep.id === 'leadIntake' &&
      !draft.websiteIntakeEnabled &&
      !draft.manualLeadIntakeSelected
    ) {
      setError(
        'Configure a supported lead source or choose Skip for now. Coming-soon providers do not complete setup.',
      )
      return
    }
    try {
      setSaving(true)
      setError(null)
      setStepStatus(activeStep.id, 'inProgress')

      if (activeStep.id === 'business') {
        await postJson(
          `/api/workspaces/${workspaceId}`,
          {
            businessName: businessName.trim(),
            industry: draft.businessType.trim(),
          },
          'PATCH',
        )
      }

      if (activeStep.id === 'structure') {
        for (const team of completedTeamRows(draft.teamRows)) {
          if (team.persistedId) continue
          await postJson(`/api/workspaces/${workspaceId}/teams`, {
            team: { name: team.name, teamType: 'general', memberIds: [] },
          })
        }
        for (const location of completedLocationRows(draft.locationRows)) {
          if (location.persistedId) continue
          await postJson(`/api/workspaces/${workspaceId}/locations`, {
            location: {
              name: location.name,
              locationType: 'office',
              timezone: draft.workspaceTimezone,
              isDefault: false,
            },
          })
        }
      }

      if (activeStep.id === 'workingHours') {
        await saveWorkingHours()
      }

      if (activeStep.id === 'ai') {
        await postJson(
          `/api/workspaces/${workspaceId}/settings/ai-profile`,
          {
            enabled: draft.aiEnabled,
            businessSummary: draft.aiBusinessSummary.trim() || null,
            productsAndServices: draft.aiProductsAndServices.trim() || null,
            operatingGuidelines: draft.aiOperatingGuidelines.trim() || null,
            brandVoice: draft.aiBrandVoice.trim() || null,
            customerPolicies: draft.aiCustomerPolicies.trim() || null,
          },
          'PATCH',
        )
      }

      if (activeStep.id === 'notifications') {
        await postJson(
          `/api/workspaces/${workspaceId}/scheduling/notification-preferences`,
          {
            scope: 'workspace',
            preferences: {
              schedulingEnabled: true,
              inAppEnabled: draft.notificationsInApp,
              emailEnabled: draft.notificationsEmail,
              defaultReminders: [
                {
                  offsetMinutes: Number(draft.notificationReminderMinutes),
                  channel: draft.notificationsEmail ? 'email' : 'inApp',
                  recipientGroup: draft.notifyAssignedMembers
                    ? 'assignedMembers'
                    : 'organizer',
                },
              ],
              externalAttendeesEnabled: draft.notifyCustomers,
              linkedClientsEnabled: draft.notifyCustomers,
            },
          },
          'PATCH',
        )
        setDraft((current) => ({ ...current, notificationsSaved: true }))
      }

      setStepStatus(
        activeStep.id,
        activeStep.id === 'members' &&
          completedMemberRows(draft.memberRows).length > 0
          ? 'inProgress'
          : 'complete',
      )
      goNext()
    } catch (saveError) {
      setStepStatus(
        activeStep.id,
        activeStep.id === 'calendars' ? 'connectionError' : 'inProgress',
      )
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'This setup step could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  const skipStep = () => {
    if (activeStep.required) {
      setError('This step is required before setup can be marked complete.')
      return
    }
    setError(null)
    setStepStatus(activeStep.id, 'skipped')
    goNext()
  }

  const back = () => {
    const previous = workspaceSetupSteps[activeStepIndex - 1]
    if (previous) {
      setActiveStepId(previous.id)
      setError(null)
      return
    }
    closeSetup()
  }

  const hasBlockingReadiness = readiness.issues.some((issue) =>
    ['blocking', 'error'].includes(issue.severity),
  )
  const prioritizedReadinessIssues = [...readiness.issues].sort((a, b) => {
    const priority = { blocking: 0, error: 1, warning: 2, info: 3 }
    return priority[a.severity] - priority[b.severity]
  })
  const firstBlockingSetupStep =
    prioritizedReadinessIssues
      .map((issue) => setupStepFromDestination(issue.destination))
      .find((stepId): stepId is WorkspaceSetupStepId => Boolean(stepId)) ?? null
  const firstIncompleteRequiredStep =
    workspaceSetupSteps.find(
      (step) => step.required && progress[step.id] !== 'complete',
    ) ?? null
  const firstIncompleteStep =
    firstBlockingSetupStep ??
    firstIncompleteRequiredStep?.id ??
    workspaceSetupSteps.find((step) => progress[step.id] !== 'complete')?.id ??
    workspaceSetupSteps[0].id
  const optionalIssueCount = readiness.issues.filter(
    (issue) => !['blocking', 'error'].includes(issue.severity),
  ).length
  const showPostSetupBanner =
    draft.finishCompleted || !summary.requiredComplete || hasBlockingReadiness

  if (
    showLauncher &&
    draft.finishCompleted &&
    setupReadinessDismissed &&
    !hasBlockingReadiness
  ) {
    return null
  }

  const compactTitle = draft.finishCompleted
    ? hasBlockingReadiness
      ? 'Workspace Needs Attention'
      : optionalIssueCount
        ? 'Workspace Ready with Warnings'
        : 'Setup Complete'
    : 'Workspace Setup Required'
  const compactBadge = draft.finishCompleted
    ? hasBlockingReadiness
      ? 'Action Required'
      : optionalIssueCount
        ? `${optionalIssueCount} optional remaining`
        : 'Ready'
    : `${summary.completed} of ${summary.total} complete`
  const compactBadgeVariant: BadgeVariant = draft.finishCompleted
    ? hasBlockingReadiness
      ? 'yellow'
      : 'green'
    : 'brand'
  const launcherCard =
    showLauncher && showPostSetupBanner ? (
      <Card
        className={cn(
          'p-4',
          draft.finishCompleted
            ? 'border-emerald-300/20 bg-emerald-300/[0.045]'
            : 'border-cyan-300/15 bg-cyan-300/[0.035]',
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-100">
                {compactTitle}
              </h2>
              <Badge variant={compactBadgeVariant}>{compactBadge}</Badge>
            </div>
            <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
              {draft.finishCompleted
                ? 'Required setup is complete. You can review setup and readiness later in Settings - Workspace Setup & Readiness.'
                : 'Finish the required setup steps to keep this workspace ready for real operations.'}
            </p>
            {prioritizedReadinessIssues.length ? (
              <ul className="text-neutral-text-secondary mt-2 space-y-1 text-xs">
                {prioritizedReadinessIssues.slice(0, 3).map((item) => (
                  <li key={item.code}>{item.title}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!draft.finishCompleted ? (
              <Button
                type="button"
                onClick={() => goToStep(firstIncompleteStep)}
                disabled={!canManageSetup}
              >
                Continue Setup
              </Button>
            ) : null}
            <Link
              href={`/dashboard/${workspaceSlug}/settings/setup`}
              className="text-neutral-text-primary focus-visible:ring-brand-primary/70 inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-transparent px-3 text-xs font-medium transition-colors hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Review Readiness
            </Link>
            {!hasBlockingReadiness ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissPostSetupReadiness}
              >
                Dismiss
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    ) : null

  return (
    <>
      {launcherCard}
      {isOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-setup-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSetup()
          }}
        >
          <div className="flex max-h-[calc(100vh-32px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070A12] text-white shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/70">
                  Step {activeStepIndex + 1} of {workspaceSetupSteps.length}
                </p>
                <h2
                  id="workspace-setup-title"
                  className="mt-1 text-xl font-semibold"
                >
                  {activeStep.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  {activeStep.description}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSetup}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                aria-label="Exit workspace setup"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
              <nav
                aria-label="Workspace setup steps"
                className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r"
              >
                <div className="grid gap-1">
                  {workspaceSetupSteps.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => goToStep(step.id)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                        step.id === activeStep.id
                          ? 'bg-cyan-300/10 text-cyan-100'
                          : 'text-white/68 hover:bg-white/[0.04] hover:text-white',
                      )}
                      aria-current={
                        step.id === activeStep.id ? 'step' : undefined
                      }
                    >
                      <span>{step.shortTitle}</span>
                      <SetupStatusBadge
                        status={progress[step.id]}
                        className="shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </nav>

              <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                    <p className="text-sm font-semibold text-neutral-100">
                      Why this matters
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
                      {activeStep.whyItMatters}
                    </p>
                  </div>

                  {activeStep.id === 'business' ? (
                    <BusinessInformationStep
                      businessName={businessName}
                      businessType={draft.businessType}
                      onBusinessNameChange={setBusinessName}
                      onBusinessTypeChange={(businessType) =>
                        updateDraft({ businessType })
                      }
                      hasError={Boolean(error)}
                    />
                  ) : activeStep.id === 'workingHours' ? (
                    <WorkingHoursStep draft={draft} onChange={updateDraft} />
                  ) : activeStep.id === 'members' ? (
                    <MembersStep
                      rows={draft.memberRows}
                      onChange={updateMemberRow}
                      onRemove={(rowId) =>
                        updateDraft({
                          memberRows:
                            draft.memberRows.length === 1
                              ? [createMemberRow()]
                              : draft.memberRows.filter(
                                  (row) => row.id !== rowId,
                                ),
                        })
                      }
                    />
                  ) : activeStep.id === 'structure' ? (
                    <StructureStep
                      members={stagedMembers}
                      teams={draft.teamRows}
                      locations={draft.locationRows}
                      onTeamChange={updateTeamRow}
                      onLocationChange={updateLocationRow}
                      onRemoveTeam={(rowId) =>
                        updateDraft({
                          teamRows:
                            draft.teamRows.length === 1
                              ? [createTeamRow()]
                              : draft.teamRows.filter(
                                  (row) => row.id !== rowId,
                                ),
                        })
                      }
                      onRemoveLocation={(rowId) =>
                        updateDraft({
                          locationRows:
                            draft.locationRows.length === 1
                              ? [createLocationRow()]
                              : draft.locationRows.filter(
                                  (row) => row.id !== rowId,
                                ),
                        })
                      }
                    />
                  ) : activeStep.id === 'calendars' ? (
                    <CalendarConnectionsStep
                      draft={draft}
                      status={progress.calendars}
                      saving={saving}
                      onProviderChange={(calendarProvider) =>
                        updateDraft({ calendarProvider })
                      }
                      onConnect={connectCalendar}
                    />
                  ) : activeStep.id === 'ai' ? (
                    <WorkspaceAIStep draft={draft} onChange={updateDraft} />
                  ) : activeStep.id === 'leadIntake' ? (
                    <LeadIntakeStep
                      draft={draft}
                      sources={resolvedLeadIntakeSources}
                      onChange={updateDraft}
                    />
                  ) : activeStep.id === 'notifications' ? (
                    <NotificationsStep draft={draft} onChange={updateDraft} />
                  ) : activeStep.id === 'review' ? (
                    <ReviewStep
                      progress={progress}
                      draft={draft}
                      businessName={businessName}
                      stagedMembers={stagedMembers}
                      teams={savedTeams}
                      locations={savedLocations}
                      onEdit={goToStep}
                    />
                  ) : null}

                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                    <p className="text-sm font-medium text-cyan-100">
                      You can update this anytime in{' '}
                      <Link
                        href={activeStep.href(workspaceSlug)}
                        className="underline decoration-cyan-100/40 underline-offset-2 hover:text-cyan-50"
                      >
                        {activeStep.laterLabel}
                      </Link>
                      .
                    </p>
                  </div>

                  {error ? (
                    <p
                      className="rounded-xl border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-100"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                  {finishMessage ? (
                    <p
                      className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2 text-sm text-emerald-100"
                      role="status"
                    >
                      {finishMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                leftIcon={
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                }
                onClick={back}
              >
                Back
              </Button>
              <div className="flex flex-wrap justify-end gap-2">
                {!activeStep.required ? (
                  <Button type="button" variant="outline" onClick={skipStep}>
                    Skip for now
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={
                    activeStep.id === 'review' ? finishSetup : saveAndContinue
                  }
                  disabled={saving}
                >
                  {activeStep.id === 'review'
                    ? 'Finish Setup'
                    : 'Save and Continue'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function normalizeAppendMemberRow(rows: SetupMemberDraft[]) {
  const next = rows.length ? rows : [createMemberRow()]
  const last = next[next.length - 1]
  if (last.email.trim() && isValidEmail(last.email))
    return [...next, createMemberRow()]
  return next
}

function normalizeAppendTeamRow(rows: SetupTeamDraft[]) {
  const next = rows.length ? rows : [createTeamRow()]
  const last = next[next.length - 1]
  if (last.name.trim()) return [...next, createTeamRow()]
  return next
}

function normalizeAppendLocationRow(rows: SetupLocationDraft[]) {
  const next = rows.length ? rows : [createLocationRow()]
  const last = next[next.length - 1]
  if (last.name.trim()) return [...next, createLocationRow()]
  return next
}

function BusinessInformationStep({
  businessName,
  businessType,
  onBusinessNameChange,
  onBusinessTypeChange,
  hasError,
}: {
  businessName: string
  businessType: string
  onBusinessNameChange: (value: string) => void
  onBusinessTypeChange: (value: string) => void
  hasError: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        <span className="font-medium text-white/85">
          Business or workspace name *
        </span>
        <Input
          value={businessName}
          onChange={(event) => onBusinessNameChange(event.target.value)}
          placeholder="Commonwealth Gas"
          aria-invalid={hasError}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-white/85">Business type</span>
        <Input
          value={businessType}
          onChange={(event) => onBusinessTypeChange(event.target.value)}
          placeholder="Home services, agency, retail..."
        />
      </label>
    </div>
  )
}

function WorkingHoursStep({
  draft,
  onChange,
}: {
  draft: WorkspaceSetupDraft
  onChange: (updates: Partial<WorkspaceSetupDraft>) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-neutral-text-secondary text-sm leading-6">
        These hours become the baseline for Skillify Scheduling. Closed days
        stay unchecked.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-white/85">Workspace timezone</span>
        <Select
          value={draft.workspaceTimezone}
          onChange={(event) =>
            onChange({ workspaceTimezone: event.target.value })
          }
        >
          <option value="America/New_York">Eastern Time - New York</option>
          <option value="America/Chicago">Central Time - Chicago</option>
          <option value="America/Denver">Mountain Time - Denver</option>
          <option value="America/Los_Angeles">
            Pacific Time - Los Angeles
          </option>
          <option value="UTC">UTC</option>
        </Select>
      </label>
      <div>
        <p className="text-sm font-medium text-white/85">Enabled workdays</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {weekdayOptions.map((day) => {
            const checked = draft.workingDays.includes(day.value)
            return (
              <label
                key={day.value}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                  checked
                    ? 'border-cyan-300/45 bg-cyan-300/[0.08] text-cyan-100'
                    : 'border-slate-800 bg-slate-950/45 text-white/65 hover:border-cyan-300/30',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    onChange({
                      workingDays: event.target.checked
                        ? [...draft.workingDays, day.value]
                        : draft.workingDays.filter(
                            (value) => value !== day.value,
                          ),
                    })
                  }}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
                />
                {day.label}
              </label>
            )
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-white/85">Start time</span>
          <Input
            type="time"
            value={draft.workingStartsAt}
            onChange={(event) =>
              onChange({ workingStartsAt: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-white/85">End time</span>
          <Input
            type="time"
            value={draft.workingEndsAt}
            onChange={(event) =>
              onChange({ workingEndsAt: event.target.value })
            }
          />
        </label>
      </div>
    </div>
  )
}

function MembersStep({
  rows,
  onChange,
  onRemove,
}: {
  rows: SetupMemberDraft[]
  onChange: (rowId: string, updates: Partial<SetupMemberDraft>) => void
  onRemove: (rowId: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-neutral-text-secondary text-sm leading-6">
        Add teammates now, then review and send all pending invitations on the
        final step. No invitation is sent from this step.
      </p>
      {rows.map((row, index) => (
        <div
          key={row.id}
          className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-100">
              Teammate {index + 1}
            </p>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => onRemove(row.id)}
            >
              Remove
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-white/85">Teammate email</span>
              <Input
                type="email"
                value={row.email}
                onChange={(event) =>
                  onChange(row.id, { email: event.target.value })
                }
                placeholder="employee@example.com"
                aria-invalid={Boolean(row.email && !isValidEmail(row.email))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-white/85">Role</span>
              <Select
                value={row.role}
                onChange={(event) =>
                  onChange(row.id, {
                    role: event.target.value as SetupMemberDraft['role'],
                  })
                }
              >
                {memberRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {row.status ? (
            <p className="text-neutral-text-secondary mt-2 text-xs">
              {row.resultMessage ??
                setupStatusLabel(
                  row.status === 'sent' ? 'complete' : 'actionRequired',
                )}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function StructureStep({
  members,
  teams,
  locations,
  onTeamChange,
  onLocationChange,
  onRemoveTeam,
  onRemoveLocation,
}: {
  members: SetupMemberDraft[]
  teams: SetupTeamDraft[]
  locations: SetupLocationDraft[]
  onTeamChange: (rowId: string, updates: Partial<SetupTeamDraft>) => void
  onLocationChange: (
    rowId: string,
    updates: Partial<SetupLocationDraft>,
  ) => void
  onRemoveTeam: (rowId: string) => void
  onRemoveLocation: (rowId: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-100">
            Teams and crews
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
            Add one or more groups such as Service Team, Installation Team, or
            Emergency Team.
          </p>
        </div>
        {teams.map((team, index) => (
          <div
            key={team.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-100">
                Team or Crew {index + 1}
              </p>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => onRemoveTeam(team.id)}
              >
                Remove
              </Button>
            </div>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="font-medium text-white/85">Team name</span>
              <Input
                value={team.name}
                onChange={(event) =>
                  onTeamChange(team.id, { name: event.target.value })
                }
                placeholder="Service Team"
              />
            </label>
            {members.length ? (
              <p className="text-neutral-text-secondary mt-2 text-xs">
                Staged members available for assignment after invitations are
                accepted: {members.map((member) => member.email).join(', ')}.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-100">
            Business Locations - Optional
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
            Leave this empty for mobile, remote, residential, or single-location
            businesses.
          </p>
        </div>
        {locations.map((location, index) => (
          <div
            key={location.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-100">
                Business Location {index + 1}
              </p>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => onRemoveLocation(location.id)}
              >
                Remove
              </Button>
            </div>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="font-medium text-white/85">Location name</span>
              <Input
                value={location.name}
                onChange={(event) =>
                  onLocationChange(location.id, { name: event.target.value })
                }
                placeholder="Main Office"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarConnectionsStep({
  draft,
  status,
  saving,
  onProviderChange,
  onConnect,
}: {
  draft: WorkspaceSetupDraft
  status: WorkspaceSetupProgress['calendars']
  saving: boolean
  onProviderChange: (provider: WorkspaceSetupDraft['calendarProvider']) => void
  onConnect: (provider: 'google' | 'microsoft') => void
}) {
  const providerStatus = draft.calendarConnected
    ? 'Connected'
    : status === 'configurationRequired'
      ? 'Configuration Required'
      : draft.calendarConnectionStarted
        ? 'Action Required'
        : 'Not connected'
  return (
    <div className="space-y-4">
      <p className="text-neutral-text-secondary text-sm leading-6">
        Skillify Scheduling works without an external calendar. Connecting one
        helps prevent double booking and adds availability context.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <ProviderCard
          title="Google Calendar"
          status={
            draft.calendarProvider === 'google'
              ? providerStatus
              : 'Not connected'
          }
          description={
            status === 'configurationRequired' &&
            draft.calendarProvider === 'google'
              ? 'Google Calendar requires Skillify deployment configuration. Native Scheduling still works without an external calendar.'
              : 'Connect a Google Calendar account through the existing Scheduling provider OAuth flow.'
          }
          action={
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => onConnect('google')}
            >
              Connect Google Calendar
            </Button>
          }
        />
        <ProviderCard
          title="Microsoft Outlook"
          status={
            draft.calendarProvider === 'microsoft'
              ? providerStatus
              : 'Not connected'
          }
          description={
            status === 'configurationRequired' &&
            draft.calendarProvider === 'microsoft'
              ? 'Microsoft Outlook Calendar requires Skillify deployment configuration. Native Scheduling still works without an external calendar.'
              : 'Connect a Microsoft 365 calendar account through the existing Scheduling provider OAuth flow.'
          }
          action={
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => onConnect('microsoft')}
            >
              Connect Microsoft Calendar
            </Button>
          }
        />
        <ProviderCard
          title="Apple Calendar / CalDAV"
          status="Manual setup"
          description="CalDAV is supported from Scheduling Settings because it needs server URL, username, and app password fields."
          action={
            <Select
              value={draft.calendarProvider}
              onChange={(event) =>
                onProviderChange(
                  event.target.value as WorkspaceSetupDraft['calendarProvider'],
                )
              }
            >
              <option value="">No manual provider selected</option>
              <option value="caldav">Plan to configure CalDAV later</option>
            </Select>
          }
        />
        <ProviderCard
          title="Provider status"
          status={providerStatus}
          description={
            status === 'configurationRequired'
              ? 'This is expected when deployment OAuth credentials are missing. Skip for now or configure external calendars later from Scheduling Settings.'
              : 'Selecting a provider alone does not complete this step. OAuth must finish or the step should be skipped.'
          }
        />
      </div>
    </div>
  )
}

function WorkspaceAIStep({
  draft,
  onChange,
}: {
  draft: WorkspaceSetupDraft
  onChange: (updates: Partial<WorkspaceSetupDraft>) => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <label className="flex items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            checked={draft.aiEnabled}
            onChange={(event) => onChange({ aiEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
          />
          <span>
            <span className="block font-medium">Enable Workspace AI</span>
            <span className="text-neutral-text-secondary mt-1 block text-xs leading-5">
              Saved context is used only when an AI feature is invoked. Provider
              keys are never entered here.
            </span>
          </span>
        </label>
      </div>

      <div>
        <p className="text-sm font-semibold text-neutral-100">
          Business Context
        </p>
        <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
          These fields map to Settings {'->'} Workspace AI without AI inference.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SetupTextarea
          label="Business description"
          value={draft.aiBusinessSummary}
          onChange={(value) => onChange({ aiBusinessSummary: value })}
          placeholder="What does this business do?"
        />
        <SetupTextarea
          label="Products and services"
          value={draft.aiProductsAndServices}
          onChange={(value) => onChange({ aiProductsAndServices: value })}
          placeholder="Installation, repair, maintenance..."
        />
        <SetupTextarea
          label="Operating guidelines"
          value={draft.aiOperatingGuidelines}
          onChange={(value) => onChange({ aiOperatingGuidelines: value })}
          placeholder="Scheduling, assignment, escalation, or service rules."
        />
        <SetupTextarea
          label="Brand voice"
          value={draft.aiBrandVoice}
          onChange={(value) => onChange({ aiBrandVoice: value })}
          placeholder="Direct, friendly, professional..."
        />
        <SetupTextarea
          label="Customer policies"
          value={draft.aiCustomerPolicies}
          onChange={(value) => onChange({ aiCustomerPolicies: value })}
          placeholder="Deposits, cancellations, warranty, after-hours policy..."
        />
      </div>
    </div>
  )
}

function LeadIntakeStep({
  draft,
  sources,
  onChange,
}: {
  draft: WorkspaceSetupDraft
  sources: LeadIntakeSourceCard[]
  onChange: (updates: Partial<WorkspaceSetupDraft>) => void
}) {
  const orderedSources = useMemo(
    () =>
      [...sources].sort((a, b) =>
        a.id === 'manualEntry' ? -1 : b.id === 'manualEntry' ? 1 : 0,
      ),
    [sources],
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {orderedSources.map((source) => (
          <ProviderCard
            key={source.id}
            title={source.title}
            status={source.statusLabel}
            statusVariant={leadIntakeStatusVariant(source.status)}
            description={source.summary}
            action={
              source.action?.kind === 'selectManual' ? (
                <Button
                  type="button"
                  size="sm"
                  variant={
                    draft.manualLeadIntakeSelected ? 'subtle' : 'secondary'
                  }
                  disabled={source.action.disabled}
                  onClick={() =>
                    onChange({
                      manualLeadIntakeSelected: true,
                      websiteIntakeEnabled: false,
                    })
                  }
                >
                  {source.action.label}
                </Button>
              ) : source.action?.href ? (
                <Link
                  href={source.action.href}
                  className={cn(
                    'focus-visible:ring-brand-primary/70 inline-flex h-8 items-center justify-center rounded-xl border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                    source.status === 'ready'
                      ? 'border-brand-primary/80 hover:bg-brand-primary/90 bg-brand-primary text-white'
                      : 'text-neutral-text-primary border-slate-700 bg-slate-900 hover:bg-slate-800',
                  )}
                >
                  {source.action.label}
                </Link>
              ) : null
            }
          />
        ))}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-white/85">
          Default lead source label
        </span>
        <Input
          value={draft.websiteSourceLabel}
          onChange={(event) =>
            onChange({ websiteSourceLabel: event.target.value })
          }
          placeholder="Website Form"
        />
      </label>
    </div>
  )
}

function NotificationsStep({
  draft,
  onChange,
}: {
  draft: WorkspaceSetupDraft
  onChange: (updates: Partial<WorkspaceSetupDraft>) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-neutral-text-secondary text-sm leading-6">
        These notifications apply to events created in Skillify Scheduling.
        External calendar connections are optional.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-white/85">
            <input
              type="checkbox"
              checked={draft.notificationsInApp}
              onChange={(event) =>
                onChange({
                  notificationsInApp: event.target.checked,
                  notificationsSaved: true,
                })
              }
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
            />
            In-app notifications
          </span>
          <span className="text-neutral-text-secondary mt-1 block text-xs">
            Available for workspace members.
          </span>
        </label>
        <label className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-white/85">
            <input
              type="checkbox"
              checked={draft.notificationsEmail}
              onChange={(event) =>
                onChange({
                  notificationsEmail: event.target.checked,
                  notificationsSaved: true,
                })
              }
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
            />
            Email notifications
          </span>
          <span className="text-neutral-text-secondary mt-1 block text-xs">
            Uses the Scheduling notification email provider when configured.
          </span>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-white/85">Reminder timing</span>
          <Select
            value={draft.notificationReminderMinutes}
            onChange={(event) =>
              onChange({
                notificationReminderMinutes: event.target.value,
                notificationsSaved: true,
              })
            }
          >
            <option value="15">15 min before</option>
            <option value="30">30 min before</option>
            <option value="60">1 hr before</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm text-white/85">
          <input
            type="checkbox"
            checked={draft.notifyAssignedMembers}
            onChange={(event) =>
              onChange({
                notifyAssignedMembers: event.target.checked,
                notificationsSaved: true,
              })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
          />
          Assignee notifications
        </label>
        <label className="flex items-center gap-2 text-sm text-white/85">
          <input
            type="checkbox"
            checked={draft.notifyCustomers}
            onChange={(event) =>
              onChange({
                notifyCustomers: event.target.checked,
                notificationsSaved: true,
              })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-300"
          />
          Customer notifications
        </label>
      </div>
      <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/85">
        SMS and Slack delivery are not enabled by the current Scheduling
        notification preferences API. They are not offered as setup toggles
        here.
      </p>
    </div>
  )
}

function ReviewStep({
  progress,
  draft,
  businessName,
  stagedMembers,
  teams,
  locations,
  onEdit,
}: {
  progress: WorkspaceSetupProgress
  draft: WorkspaceSetupDraft
  businessName: string
  stagedMembers: SetupMemberDraft[]
  teams: SetupTeamDraft[]
  locations: SetupLocationDraft[]
  onEdit: (stepId: WorkspaceSetupStepId) => void
}) {
  const reviewIssues = workspaceSetupSteps.filter((step) =>
    ['actionRequired', 'connectionError'].includes(progress[step.id]),
  )
  const warningCount = workspaceSetupSteps.filter((step) =>
    ['skipped', 'configurationRequired', 'unavailable', 'inProgress'].includes(
      progress[step.id],
    ),
  ).length
  const readyState = reviewIssues.length
    ? 'Action Required'
    : warningCount
      ? 'Ready with Warnings'
      : 'Ready to Finish'
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-cyan-100">{readyState}</p>
          {reviewIssues.length ? (
            <SetupStatusBadge status="actionRequired" />
          ) : warningCount ? (
            <SetupStatusBadge status="configurationRequired" />
          ) : (
            <SetupStatusBadge status="complete" />
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-cyan-100/75">
          {reviewIssues.length
            ? 'Resolve the highlighted setup items before finishing.'
            : warningCount
              ? `${warningCount} optional setup item${warningCount === 1 ? '' : 's'} can be finished later from Settings -> Workspace Setup & Readiness.`
              : 'Required setup is complete. Finish Setup will create staged invitations once.'}
        </p>
      </div>
      <ReviewCard
        title="Business Information"
        stepId="business"
        status={progress.business}
        onEdit={onEdit}
      >
        {businessName || 'No business name entered'}{' '}
        {draft.businessType ? `- ${draft.businessType}` : ''}
      </ReviewCard>
      <ReviewCard
        title="Working Hours"
        stepId="workingHours"
        status={progress.workingHours}
        onEdit={onEdit}
      >
        {draft.workingDays.length} workdays · {draft.workingStartsAt}-
        {draft.workingEndsAt} · {draft.workspaceTimezone}
      </ReviewCard>
      <ReviewCard
        title="Members and Roles"
        stepId="members"
        status={progress.members}
        onEdit={onEdit}
      >
        {stagedMembers.length
          ? stagedMembers
              .map(
                (member) =>
                  `${member.email} (${getWorkspaceRoleLabel(member.role)})`,
              )
              .join(', ')
          : 'No staged invitations.'}
      </ReviewCard>
      <ReviewCard
        title="Teams and Business Locations"
        stepId="structure"
        status={progress.structure}
        onEdit={onEdit}
      >
        {teams.length
          ? `${teams.length} team${teams.length === 1 ? '' : 's'}`
          : 'No teams'}{' '}
        ·{' '}
        {locations.length
          ? `${locations.length} location${locations.length === 1 ? '' : 's'}`
          : 'No locations'}
      </ReviewCard>
      <ReviewCard
        title="Calendar Connections"
        stepId="calendars"
        status={progress.calendars}
        onEdit={onEdit}
      >
        {draft.calendarConnected
          ? `${humanProvider(draft.calendarProvider)} connected`
          : setupStatusLabel(progress.calendars)}
      </ReviewCard>
      <ReviewCard
        title="Workspace AI"
        stepId="ai"
        status={progress.ai}
        onEdit={onEdit}
      >
        {draft.aiEnabled ? 'Enabled' : 'Not enabled'} · Structured fields saved
        through Workspace AI profile.
      </ReviewCard>
      <ReviewCard
        title="Website and Lead Intake"
        stepId="leadIntake"
        status={progress.leadIntake}
        onEdit={onEdit}
      >
        {draft.manualLeadIntakeSelected
          ? `Manual fallback selected · ${draft.websiteSourceLabel}`
          : draft.websiteIntakeEnabled
            ? `Automated lead intake selected · ${draft.websiteSourceLabel}`
            : setupStatusLabel(progress.leadIntake)}
      </ReviewCard>
      <ReviewCard
        title="Notifications"
        stepId="notifications"
        status={progress.notifications}
        onEdit={onEdit}
      >
        {draft.notificationsSaved
          ? `${draft.notificationsInApp ? 'In-app' : 'No in-app'} · ${draft.notificationsEmail ? 'Email' : 'No email'}`
          : setupStatusLabel(progress.notifications)}
      </ReviewCard>
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-sm leading-6 text-cyan-100">
        Finish Setup sends staged invitations once. Successfully saved teams,
        locations, AI settings, working hours, and notification preferences are
        preserved if an invitation fails.
      </div>
    </div>
  )
}

function ProviderCard({
  title,
  status,
  statusVariant = 'slate',
  description,
  action,
}: {
  title: string
  status: string
  statusVariant?: BadgeVariant
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-100">{title}</p>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>
      <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
        {description}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

function SetupTextarea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-white/85">{label}</span>
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function ReviewCard({
  title,
  stepId,
  status,
  children,
  onEdit,
}: {
  title: string
  stepId: WorkspaceSetupStepId
  status: WorkspaceSetupProgress[WorkspaceSetupStepId]
  children: React.ReactNode
  onEdit: (stepId: WorkspaceSetupStepId) => void
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-950/45 px-3 py-2',
        status === 'connectionError'
          ? 'border-rose-300/30'
          : status === 'actionRequired'
            ? 'border-amber-300/35'
            : status === 'configurationRequired' || status === 'unavailable'
              ? 'border-violet-300/25'
              : 'border-slate-800',
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-neutral-100">{title}</p>
          <SetupStatusBadge status={status} />
        </div>
        <p className="text-neutral-text-secondary text-xs leading-5">
          {children}
        </p>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => onEdit(stepId)}
      >
        Edit
      </Button>
    </div>
  )
}

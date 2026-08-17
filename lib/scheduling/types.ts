export type SchedulingPreset = 'service' | 'consultative' | 'commerce'

export type SchedulingSectionKey =
  | 'calendar'
  | 'appointments'
  | 'crmMeetings'
  | 'scheduledJobs'
  | 'recurringServices'
  | 'pickupDelivery'
  | 'installationService'
  | 'recurringDeliveries'
  | 'teamAvailability'
  | 'internalMeetings'

export type SchedulingCalendarView = 'day' | 'week' | 'month' | 'agenda'

export type SchedulingEventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'inProgress'
  | 'completed'
  | 'canceled'
  | 'missed'

export type SchedulingEventType =
  | 'serviceAppointment'
  | 'estimate'
  | 'siteVisit'
  | 'scheduledJob'
  | 'recurringServiceVisit'
  | 'discoveryCall'
  | 'consultation'
  | 'opportunityFollowUp'
  | 'proposalReview'
  | 'projectMeeting'
  | 'customerPickup'
  | 'deliveryWindow'
  | 'installationAppointment'
  | 'productDemonstration'
  | 'supplierMeeting'
  | 'inventoryCount'
  | 'launchEvent'
  | 'recurringDelivery'
  | 'internalMeeting'
  | 'blockedTime'

export type SchedulingLinkedRecordType =
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'client'
  | 'serviceRequest'
  | 'customer'
  | 'order'
  | 'fulfillment'
  | 'product'
  | 'job'

export type SchedulingLinkedRecordRequirement =
  | 'notAllowed'
  | 'optional'
  | 'required'

export type SchedulingLocationRequirement =
  | 'notAllowed'
  | 'optional'
  | 'required'

export type SchedulingLocationType =
  | 'none'
  | 'toBeDetermined'
  | 'physicalAddress'
  | 'customerLocation'
  | 'workspaceLocation'
  | 'videoMeeting'
  | 'phoneCall'
  | 'other'

export type SchedulingRecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export type SchedulingRecurrenceRule = {
  frequency: SchedulingRecurrenceFrequency
  interval: number
  daysOfWeek?: number[]
  endType: 'never' | 'onDate' | 'afterOccurrences'
  endDate?: string
  occurrenceCount?: number
}

export type SchedulingOccurrenceState =
  | 'master'
  | 'generated'
  | 'overridden'
  | 'canceled'
  | 'completed'
  | 'detached'
  | 'superseded'
  | 'deleted'

export type SchedulingRecurrenceSeriesStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'canceled'

export type SchedulingRecurrenceActionScope =
  | 'thisOccurrence'
  | 'thisAndFollowing'
  | 'entireSeries'

export type SchedulingRecurringAction =
  | 'edit'
  | 'reschedule'
  | 'cancel'
  | 'delete'
  | 'complete'
  | 'statusChange'
  | 'assignmentChange'
  | 'linkedRecordChange'
  | 'recurrenceRuleChange'

export type SchedulingRecurrenceMutationKind =
  | 'materialize'
  | 'updateOccurrence'
  | 'updateEntireSeries'
  | 'splitSeries'
  | 'cancelOccurrence'
  | 'cancelFollowing'
  | 'cancelSeries'
  | 'deleteOccurrence'
  | 'deleteFollowing'
  | 'deleteSeries'
  | 'pauseSeries'
  | 'resumeSeries'
  | 'completeOccurrence'
  | 'repairSeries'

export type SchedulingNotificationChannel = 'inApp' | 'email' | 'sms' | 'push'

export type SchedulingNotificationCategory =
  | 'eventCreated'
  | 'assignment'
  | 'reassignment'
  | 'eventUpdated'
  | 'rescheduled'
  | 'canceled'
  | 'completed'
  | 'missed'
  | 'reminder'
  | 'recurringSeriesChanged'
  | 'recurringSeriesCanceled'
  | 'timeOff'
  | 'availabilityException'
  | 'conflict'
  | 'deliveryFailure'

export type SchedulingNotificationPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'

export type SchedulingReminderStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'canceled'
  | 'skipped'
  | 'failed'
  | 'permanentlyFailed'

export type SchedulingReminderRecipientGroup =
  | 'assignedMembers'
  | 'organizer'
  | 'externalAttendees'
  | 'linkedContact'

export type SchedulingReminderInput = {
  offsetMinutes: number
  channel: Extract<SchedulingNotificationChannel, 'inApp' | 'email'>
  recipientGroup: SchedulingReminderRecipientGroup
}

export type SchedulingQuietHours = {
  enabled: boolean
  startTime: string
  endTime: string
  timezone?: string
  allowUrgentBypass?: boolean
}

export type SchedulingNotificationCategorySettings = Partial<
  Record<
    SchedulingNotificationCategory,
    {
      enabled?: boolean
      inAppEnabled?: boolean
      emailEnabled?: boolean
    }
  >
>

export type WorkspaceSchedulingNotificationPreferences = {
  schedulingEnabled: boolean
  inAppEnabled: boolean
  emailEnabled: boolean
  categorySettings?: SchedulingNotificationCategorySettings
  quietHours?: SchedulingQuietHours
  defaultReminders?: SchedulingReminderInput[]
  externalAttendeesEnabled: boolean
  linkedClientsEnabled: boolean
  organizerCopiesEnabled: boolean
  deliveryFailureAlertsEnabled: boolean
  notificationSystemActivatedAt?: string
}

export type MemberSchedulingNotificationPreferences = {
  schedulingEnabled?: boolean
  inAppEnabled?: boolean
  emailEnabled?: boolean
  categorySettings?: SchedulingNotificationCategorySettings
  quietHours?: SchedulingQuietHours
  timezone?: string
  selfNotifications?: boolean
  defaultReminders?: SchedulingReminderInput[]
}

export type SchedulingRecurrenceOption =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'everyTwoWeeks'
  | 'monthly'
  | 'custom'

export type SchedulingFormErrorKey =
  | 'form'
  | 'type'
  | 'title'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'timezone'
  | 'location'
  | 'assignedMemberIds'
  | 'linkedRecord'
  | 'customInterval'
  | 'customWeekdays'
  | 'customEndDate'
  | 'customCount'

export type SchedulingEvent = {
  id: string
  workspaceId: string
  title: string
  description?: string
  type: SchedulingEventType
  status: SchedulingEventStatus
  startsAt: string
  endsAt: string
  allDay: boolean
  timezone: string
  location?: string
  locationType?: SchedulingLocationType
  locationLabel?: string
  locationAddress?: string
  meetingUrl?: string
  phoneNumber?: string
  assignedMemberIds: string[]
  linkedRecord?: {
    recordType: SchedulingLinkedRecordType
    recordId: string
    label: string
  }
  recurrenceSeriesId?: string
  recurrenceRule?: SchedulingRecurrenceRule
  occurrenceOriginalAt?: string
  occurrenceState?: SchedulingOccurrenceState
  reminderPolicy?: {
    mode: 'workspaceDefault' | 'none' | 'custom'
    reminders?: SchedulingReminderInput[]
  }
  sourceEventId?: string
  externalCalendarState?:
    | 'notConnected'
    | 'pending'
    | 'synced'
    | 'conflict'
    | 'error'
  createdAt: string
  updatedAt: string
}

export type SchedulingOccurrence = SchedulingEvent & {
  occurrenceId: string
  sourceEventId: string
  occurrenceStartsAt: string
  occurrenceEndsAt: string
  isRecurringOccurrence: boolean
}

export type WorkingHoursScope = 'workspace' | 'location' | 'team' | 'member'
export type WorkingHoursScheduleMode = 'inherit' | 'custom'

export type TeamAvailabilityRecord =
  | {
      id: string
      workspaceId: string
      kind: 'workingHours'
      scope?: WorkingHoursScope
      locationId?: string | null
      locationName?: string | null
      teamId?: string | null
      teamName?: string | null
      workspaceMemberId?: string | null
      memberId?: string
      memberName?: string
      scheduleMode?: WorkingHoursScheduleMode
      daysOfWeek?: number[]
      startsAt?: string
      endsAt?: string
      timezone?: string
      effectiveFrom?: string | null
      effectiveUntil?: string | null
      createdAt?: string
      updatedAt?: string
    }
  | {
      id: string
      workspaceId: string
      kind: 'timeOff'
      memberId: string
      memberName: string
      category?: TimeOffCategory
      title?: string
      reason: string
      startsAt: string
      endsAt: string
      allDay: boolean
      timezone?: string
      notes?: string
      createdByUserId?: string
      createdAt?: string
      updatedAt?: string
    }
  | {
      id: string
      workspaceId: string
      kind: 'blockedTime'
      memberId: string
      memberName: string
      title: string
      startsAt: string
      endsAt: string
    }
  | AvailabilityExceptionRecord

export type AvailabilityExceptionRecord = {
  id: string
  workspaceId: string
  kind: 'availabilityException'
  memberId?: string
  memberName?: string
  teamId?: string
  teamName?: string
  scope: 'member' | 'team' | 'workspace'
  exceptionType: 'closed' | 'customHours'
  title?: string
  date: string
  allDayClosed: boolean
  startTime?: string
  endTime?: string
  timezone?: string
  recurrenceRule?: SchedulingRecurrenceRule
  notes?: string
  createdAt: string
  updatedAt: string
}

export type SchedulingSeries = {
  id: string
  workspaceId: string
  title: string
  eventType: Extract<
    SchedulingEventType,
    'recurringServiceVisit' | 'recurringDelivery'
  >
  recurrenceRule: SchedulingRecurrenceRule
  nextOccurrenceAt: string
  status: SchedulingRecurrenceSeriesStatus | 'ended'
  assignedMemberIds: string[]
  linkedRecord?: SchedulingEvent['linkedRecord']
  pricePerVisit?: number
  createdAt: string
  updatedAt: string
}

export type TimeOffCategory =
  | 'vacation'
  | 'sick'
  | 'personal'
  | 'appointment'
  | 'unavailable'
  | 'other'

export type CalendarProvider =
  | 'google'
  | 'microsoft'
  | 'apple'
  | 'caldav'
  | 'ics'

export type CalendarConnectionStatus =
  | 'notConnected'
  | 'connecting'
  | 'connected'
  | 'error'

export type ExternalCalendarConnection = {
  id: string
  workspaceId: string
  userId: string
  provider: CalendarProvider
  status: CalendarConnectionStatus
  externalCalendarId?: string
  syncDirection?: 'skillifyToExternal' | 'externalToSkillify' | 'twoWay'
  lastSyncedAt?: string
}

export type WorkspaceSchedulingEventTypePreference = {
  key: SchedulingEventType
  isVisible: boolean
  sortOrder: number
  defaultDurationMinutes?: number
}

export type WorkspaceSchedulingCustomEventType = {
  id: string
  workspaceId: string
  key: string
  label: string
  description?: string
  presetScope: SchedulingPreset[]
  sectionKeys: SchedulingSectionKey[]
  defaultDurationMinutes?: number
  blocksAvailability: boolean
  requiresLinkedRecord: boolean
  linkedRecordRequirement?: SchedulingLinkedRecordRequirement
  warnWhenUnlinked?: boolean
  supportedLinkedRecordTypes: SchedulingLinkedRecordType[]
  locationRequirement?: SchedulingLocationRequirement
  allowedLocationTypes?: SchedulingLocationType[]
  defaultLocationType?: SchedulingLocationType
  allowUndeterminedLocation?: boolean
  isActive: boolean
  isSystem: false
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ExternalCalendarVisibilityMode =
  | 'BUSY_ONLY'
  | 'TITLE_ONLY'
  | 'FULL_DETAILS'

export type CalendarConnectionPurpose =
  | 'PERSONAL'
  | 'INDIVIDUAL_WORK'
  | 'WORKSPACE_SHARED'
  | 'RESOURCE'
  | 'UNKNOWN'

export type CalendarPurposeClassificationSource =
  | 'MEMBER_SELECTED'
  | 'ADMIN_CONFIRMED'
  | 'PROVIDER_METADATA'
  | 'DOMAIN_HEURISTIC'
  | 'MIGRATION'
  | 'UNKNOWN'

export type PersonalCalendarPolicyMode =
  | 'DISABLED'
  | 'OWNER_ONLY'
  | 'SELECTED_MEMBERS'
  | 'SELECTED_ROLES'
  | 'ALL_MEMBERS'

export type PersonalCalendarAvailabilityBehavior =
  | 'IGNORE'
  | 'SUGGEST_CONFLICTS'
  | 'BLOCK_AVAILABILITY'

export type PersonalCalendarBusyDisplayMode =
  | 'HIDDEN'
  | 'MEMBER_DETAIL_ONLY'
  | 'EXPANDABLE_EXTERNAL_AVAILABILITY'
  | 'VISIBLE_IN_BUSY'

export type PersonalCalendarApproverMode =
  | 'OWNER_ONLY'
  | 'OWNERS_AND_ADMINS'
  | 'SELECTED_ROLES'
  | 'SELECTED_MEMBERS'

export type WorkspaceBusinessDomainStatus =
  | 'verified'
  | 'adminConfirmed'
  | 'unverified'

export type WorkspaceBusinessDomain = {
  domain: string
  status: WorkspaceBusinessDomainStatus
  primary?: boolean
}

export type WorkspaceCalendarConnectionPolicy = {
  allowMemberConnections: boolean
  allowMultipleAccountsPerMember: boolean
  allowWorkspaceConnections: boolean
  requireMemberConnectionApproval: boolean
  allowMemberTwoWaySync: boolean
  allowMemberWriteOnlySync: boolean
  allowMemberReadOnlySync: boolean
  includeMemberCalendarsInBusy: boolean
  defaultMemberVisibilityMode: ExternalCalendarVisibilityMode
  defaultWorkspaceVisibilityMode: ExternalCalendarVisibilityMode
  allowMemberVisibilityOverride: boolean
  allowAdminDisableMemberConnections: boolean
  notifyAdminsOnConnectionRequest: boolean
  notifyAdminsOnOwnerDeparture: boolean
  personalCalendarMode: PersonalCalendarPolicyMode
  personalCalendarAllowedMemberIds: string[]
  personalCalendarAllowedRoleKeys: string[]
  personalCalendarDeniedMemberIds: string[]
  personalCalendarApprovalRequired: boolean
  personalCalendarApproverMode: PersonalCalendarApproverMode
  personalCalendarApproverMemberIds: string[]
  personalCalendarApproverRoleKeys: string[]
  ownerPersonalCalendarAllowed: boolean
  allowPersonalCalendarSelfApproval: boolean
  personalCalendarAvailabilityBehavior: PersonalCalendarAvailabilityBehavior
  personalCalendarBusyDisplayMode: PersonalCalendarBusyDisplayMode
  personalCalendarDefaultVisibilityMode: ExternalCalendarVisibilityMode
  allowMembersToRequestPersonalCalendarAccess: boolean
  hidePersonalCalendarControlsWhenNotAllowed: boolean
  treatPersonalEventsAsOfficialTimeOff: false
  workCalendarApprovalRequired: boolean
  requireVerifiedBusinessDomainForWorkCalendars: boolean
  unknownCalendarApprovalRequired: boolean
  workspaceBusinessDomains: WorkspaceBusinessDomain[]
}

export type WorkspaceSchedulingSettings = {
  enabled: boolean
  preset: SchedulingPreset
  visibleSections: SchedulingSectionKey[]
  sectionLabelOverrides?: Partial<Record<SchedulingSectionKey, string>>
  defaultCalendarView: SchedulingCalendarView
  weekStartsOn: 0 | 1
  timezone: string
  timeFormat?: '12hour' | '24hour'
  eventTypePreferences?: WorkspaceSchedulingEventTypePreference[]
  customEventTypes?: WorkspaceSchedulingCustomEventType[]
  notificationPreferences?: WorkspaceSchedulingNotificationPreferences
  calendarConnectionPolicy: WorkspaceCalendarConnectionPolicy
}

export type SchedulingCapabilities = {
  enabled: boolean
  preset: SchedulingPreset
  supportedSections: SchedulingSectionKey[]
  defaultVisibleSections: SchedulingSectionKey[]
  visibleSections: SchedulingSectionKey[]
  supportedEventTypes: SchedulingEventType[]
  supportsCustomerLinks: boolean
  supportsClientLinks: boolean
  supportsLeadLinks: boolean
  supportsOpportunityLinks: boolean
  supportsSaleLinks: boolean
  supportsOrderLinks: boolean
  supportsFulfillmentLinks: boolean
  supportsProductLinks: boolean
  supportsJobLinks: boolean
  supportsRecurringSeries: boolean
  supportsPickupWindows: boolean
  supportsDeliveryWindows: boolean
  supportsExternalCalendarSync: boolean
}

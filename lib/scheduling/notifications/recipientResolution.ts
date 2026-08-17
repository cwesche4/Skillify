import type {
  SchedulingNotificationCategory,
  SchedulingReminderRecipientGroup,
} from '@/lib/scheduling/types'

export type SchedulingNotificationRecipient =
  | {
      type: 'workspaceMember'
      id: string
      workspaceMemberId: string
      userId?: string
      email?: string
      displayName?: string
      reason: string
    }
  | {
      type: 'externalAttendee'
      id: string
      attendeeId: string
      email: string
      displayName?: string
      reason: string
    }
  | {
      type: 'linkedContact'
      id: string
      contactId: string
      email: string
      displayName?: string
      reason: string
    }

export type WorkspaceMemberRecipientSource = {
  workspaceMemberId: string
  userId?: string | null
  label: string
  email?: string | null
  active?: boolean
}

export type WorkspaceTeamRecipientSource = {
  teamId: string
  label: string
  active?: boolean
  memberIds: string[]
}

export type SchedulingAttendeeRecipientSource = {
  attendeeId: string
  email: string
  displayName?: string | null
  isOrganizer?: boolean
}

export function resolveSchedulingNotificationRecipients({
  assignedMemberIds = [],
  assignedTeamIds = [],
  removedMemberIds = [],
  organizerUserId,
  members,
  teams = [],
  attendees = [],
  category,
  actorUserId,
  includeActor = false,
  includeExternalAttendees = false,
  linkedContacts = [],
  includeLinkedContacts = false,
  reminderRecipientGroup,
}: {
  assignedMemberIds?: string[]
  assignedTeamIds?: string[]
  removedMemberIds?: string[]
  organizerUserId?: string | null
  members: WorkspaceMemberRecipientSource[]
  teams?: WorkspaceTeamRecipientSource[]
  attendees?: SchedulingAttendeeRecipientSource[]
  category: SchedulingNotificationCategory
  actorUserId?: string | null
  includeActor?: boolean
  includeExternalAttendees?: boolean
  linkedContacts?: Array<{
    contactId: string
    email?: string | null
    displayName?: string | null
  }>
  includeLinkedContacts?: boolean
  reminderRecipientGroup?: SchedulingReminderRecipientGroup
}): SchedulingNotificationRecipient[] {
  const recipients = new Map<string, SchedulingNotificationRecipient>()
  const memberById = new Map(
    members
      .filter((member) => member.active !== false)
      .map((member) => [member.workspaceMemberId, member]),
  )

  function addMember(workspaceMemberId: string, reason: string) {
    const member = memberById.get(workspaceMemberId)
    if (!member) return
    if (!includeActor && actorUserId && member.userId === actorUserId) return
    recipients.set(`workspaceMember:${workspaceMemberId}`, {
      type: 'workspaceMember',
      id: workspaceMemberId,
      workspaceMemberId,
      userId: member.userId ?? undefined,
      email: member.email ?? undefined,
      displayName: member.label,
      reason,
    })
  }

  if (!reminderRecipientGroup || reminderRecipientGroup === 'assignedMembers') {
    for (const memberId of assignedMemberIds) {
      addMember(memberId, category === 'reminder' ? 'reminder' : 'assigned')
    }
    for (const teamId of assignedTeamIds) {
      const team = teams.find(
        (candidate) =>
          candidate.teamId === teamId && candidate.active !== false,
      )
      if (!team) continue
      for (const memberId of team.memberIds) {
        addMember(memberId, `team:${teamId}`)
      }
    }
  }

  if (category === 'reassignment') {
    for (const memberId of removedMemberIds) {
      addMember(memberId, 'removedAssignment')
    }
  }

  if (
    organizerUserId &&
    (!reminderRecipientGroup || reminderRecipientGroup === 'organizer')
  ) {
    const organizerMember = members.find(
      (member) => member.userId === organizerUserId && member.active !== false,
    )
    if (organizerMember)
      addMember(organizerMember.workspaceMemberId, 'organizer')
  }

  if (
    includeExternalAttendees &&
    (!reminderRecipientGroup ||
      reminderRecipientGroup === 'externalAttendees' ||
      category === 'canceled' ||
      category === 'rescheduled')
  ) {
    for (const attendee of attendees) {
      const email = attendee.email.trim().toLowerCase()
      if (!email) continue
      recipients.set(`externalAttendee:${attendee.attendeeId}`, {
        type: 'externalAttendee',
        id: attendee.attendeeId,
        attendeeId: attendee.attendeeId,
        email,
        displayName: attendee.displayName ?? undefined,
        reason: 'externalAttendee',
      })
    }
  }

  if (
    includeLinkedContacts &&
    (!reminderRecipientGroup || reminderRecipientGroup === 'linkedContact')
  ) {
    for (const contact of linkedContacts) {
      const email = contact.email?.trim().toLowerCase()
      if (!email) continue
      recipients.set(`linkedContact:${contact.contactId}`, {
        type: 'linkedContact',
        id: contact.contactId,
        contactId: contact.contactId,
        email,
        displayName: contact.displayName ?? undefined,
        reason: 'linkedContact',
      })
    }
  }

  return [...recipients.values()]
}

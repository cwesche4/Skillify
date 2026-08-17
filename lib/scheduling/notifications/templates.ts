import {
  formatDateTime,
  formatTimeOnly,
} from '@/lib/scheduling/schedulingFormatters'
import type {
  SchedulingNotificationCategory,
  SchedulingNotificationPriority,
} from '@/lib/scheduling/types'

export type SchedulingNotificationTemplateInput = {
  category: SchedulingNotificationCategory
  recipientType: 'workspaceMember' | 'externalAttendee' | 'linkedContact'
  workspaceName: string
  eventTitle: string
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  timezone: string
  location?: string | null
  meetingUrl?: string | null
  recurrenceSummary?: string | null
  actionUrl?: string | null
  previousTime?: string | null
  newTime?: string | null
  scopeSummary?: string | null
  priority?: SchedulingNotificationPriority
}

export type SchedulingNotificationRenderedTemplate = {
  title: string
  body: string
  subject: string
  html: string
  text: string
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatWhen(input: SchedulingNotificationTemplateInput) {
  if (!input.startsAt) return 'Time to be determined'
  const start = formatDateTime(String(input.startsAt), input.timezone)
  const end = input.endsAt
    ? formatTimeOnly(String(input.endsAt), input.timezone)
    : null
  return end ? `${start}-${end}` : start
}

function categoryCopy(category: SchedulingNotificationCategory) {
  const copy: Record<
    SchedulingNotificationCategory,
    { title: string; verb: string; subject: string }
  > = {
    eventCreated: {
      title: 'Scheduling event created',
      verb: 'was created',
      subject: 'New scheduling event',
    },
    assignment: {
      title: 'You were assigned',
      verb: 'was assigned to you',
      subject: 'You were assigned to an event',
    },
    reassignment: {
      title: 'Scheduling assignment changed',
      verb: 'has an assignment change',
      subject: 'Scheduling assignment changed',
    },
    eventUpdated: {
      title: 'Scheduling event updated',
      verb: 'was updated',
      subject: 'Scheduling event updated',
    },
    rescheduled: {
      title: 'Scheduling event rescheduled',
      verb: 'was rescheduled',
      subject: 'Scheduling event rescheduled',
    },
    canceled: {
      title: 'Scheduling event canceled',
      verb: 'was canceled',
      subject: 'Scheduling event canceled',
    },
    completed: {
      title: 'Scheduling event completed',
      verb: 'was completed',
      subject: 'Scheduling event completed',
    },
    missed: {
      title: 'Scheduling event missed',
      verb: 'was marked missed',
      subject: 'Scheduling event missed',
    },
    reminder: {
      title: 'Scheduling reminder',
      verb: 'is coming up',
      subject: 'Scheduling reminder',
    },
    recurringSeriesChanged: {
      title: 'Recurring schedule changed',
      verb: 'has a recurring schedule change',
      subject: 'Recurring schedule changed',
    },
    recurringSeriesCanceled: {
      title: 'Recurring schedule canceled',
      verb: 'has been canceled',
      subject: 'Recurring schedule canceled',
    },
    timeOff: {
      title: 'Time off updated',
      verb: 'was updated',
      subject: 'Time off updated',
    },
    availabilityException: {
      title: 'Availability exception updated',
      verb: 'was updated',
      subject: 'Availability exception updated',
    },
    conflict: {
      title: 'Scheduling conflict',
      verb: 'has a scheduling conflict',
      subject: 'Scheduling conflict',
    },
    deliveryFailure: {
      title: 'Scheduling delivery failure',
      verb: 'could not be delivered',
      subject: 'Scheduling delivery failure',
    },
  }
  return copy[category]
}

export function renderSchedulingNotificationTemplate(
  input: SchedulingNotificationTemplateInput,
): SchedulingNotificationRenderedTemplate {
  const copy = categoryCopy(input.category)
  const when = formatWhen(input)
  const eventTitle = input.eventTitle || 'Untitled event'
  const title =
    input.category === 'assignment'
      ? `${eventTitle} was assigned to you`
      : copy.title
  const publicLocation =
    input.meetingUrl || input.location
      ? input.meetingUrl || input.location
      : null
  const recurrence = input.recurrenceSummary
    ? ` Recurrence: ${input.recurrenceSummary}.`
    : ''
  const scope = input.scopeSummary ? ` ${input.scopeSummary}` : ''
  const body =
    input.category === 'rescheduled' && input.previousTime && input.newTime
      ? `${eventTitle} moved from ${input.previousTime} to ${input.newTime}.${scope}`
      : `${eventTitle} ${copy.verb} for ${when}.${scope}${recurrence}`
  const externalBody =
    input.recipientType === 'workspaceMember'
      ? body
      : `${eventTitle} ${copy.verb} for ${when}.`
  const safeBody =
    input.recipientType === 'workspaceMember' ? body : externalBody
  const internalActionUrl =
    input.recipientType === 'workspaceMember' ? input.actionUrl : null
  const cta = internalActionUrl
    ? `<p><a href="${escapeHtml(internalActionUrl)}" style="display:inline-block;border-radius:8px;background:#0891b2;color:white;padding:10px 14px;text-decoration:none;">Open in Skillify</a></p>`
    : ''
  const locationLine = publicLocation
    ? `<p><strong>Location:</strong> ${escapeHtml(publicLocation)}</p>`
    : ''
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;">${escapeHtml(
        input.workspaceName,
      )}</p>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(safeBody)}</p>
      <p><strong>When:</strong> ${escapeHtml(when)} ${escapeHtml(input.timezone)}</p>
      ${locationLine}
      ${input.recipientType === 'workspaceMember' && input.recurrenceSummary ? `<p><strong>Repeats:</strong> ${escapeHtml(input.recurrenceSummary)}</p>` : ''}
      ${cta}
      <p style="font-size:12px;color:#64748b;">This is an operational Skillify Scheduling notification.</p>
    </div>
  `
  const text = [
    input.workspaceName,
    title,
    safeBody,
    `When: ${when} ${input.timezone}`,
    publicLocation ? `Location: ${publicLocation}` : null,
    internalActionUrl ? `Open: ${internalActionUrl}` : null,
    'This is an operational Skillify Scheduling notification.',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title,
    body: safeBody,
    subject: `${copy.subject}: ${eventTitle}`,
    html,
    text,
  }
}

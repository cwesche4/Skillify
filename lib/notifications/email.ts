// lib/notifications/email.ts

import { Resend } from 'resend'

const resendKey = process.env.RESEND_API_KEY
const defaultFrom =
  process.env.EMAIL_FROM || 'Skillify <no-reply@skillify.tech>'

// Init only if key exists
const resend = resendKey ? new Resend(resendKey) : null

export type EmailTemplate =
  | 'enterprise-consult-confirmation'
  | 'enterprise-consult-internal'
  | 'demo-booking-confirmation'
  | 'demo-booking-internal'
  | 'lead-follow-up'
  | 'lead-no-show'
  | 'lead-reschedule'
  | 'lead-we-missed-you'

interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
}

/* -----------------------------------------------------
   SEND EMAIL (Primary API)
------------------------------------------------------ */
export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  if (!resend) {
    console.warn('[Email] Resend not configured, skipping send')
    return
  }

  try {
    await resend.emails.send({
      from: defaultFrom,
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[Email] Failed to send email', err)
  }
}

/* -----------------------------------------------------
   TEMPLATE RENDERER
------------------------------------------------------ */
export function renderTemplate(
  template: EmailTemplate,
  data: Record<string, any>,
): string {
  switch (template) {
    case 'enterprise-consult-confirmation':
      return `
        <h2>Thanks for reaching out to Skillify Enterprise</h2>
        <p>Hi ${data.name || 'there'},</p>
        <p>We’ve received your request for an enterprise consult. Our team will follow up shortly.</p>
        <p><strong>Project goal:</strong> ${data.projectGoal ?? 'Not specified'}</p>
        <p><strong>Company size:</strong> ${data.companySize ?? 'Not specified'}</p>
        <p>We’ll get back to <strong>${data.email}</strong>.</p>
        <p>– Skillify Team</p>
      `

    case 'enterprise-consult-internal':
      return `
        <h2>New Enterprise Consult Request</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone ?? 'N/A'}</p>
        <p><strong>Company size:</strong> ${data.companySize ?? 'N/A'}</p>
        <p><strong>Project goal:</strong> ${data.projectGoal ?? 'N/A'}</p>
        <p><strong>Description:</strong><br />${data.description ?? 'N/A'}</p>
        <p><strong>AI score:</strong> ${data.aiScore ?? 'N/A'}</p>
      `

    case 'demo-booking-confirmation':
      return `
        <h2>Your Skillify demo is booked</h2>
        <p>Hi ${data.guestName || 'there'},</p>
        <p>Your demo is scheduled for <strong>${data.startFormatted}</strong> (${data.timezone}).</p>
        <p>If you need to reschedule or cancel, use this link:</p>
        <p><a href="${data.manageUrl}">${data.manageUrl}</a></p>
        <p>– Skillify Team</p>
      `

    case 'demo-booking-internal':
      return `
        <h2>New Demo Booking</h2>
        <p><strong>Name:</strong> ${data.guestName}</p>
        <p><strong>Email:</strong> ${data.guestEmail}</p>
        <p><strong>Score:</strong> ${data.aiScore ?? 'N/A'}</p>
        <p><strong>When:</strong> ${data.startFormatted} (${data.timezone})</p>
        <p><strong>Notes:</strong><br />${data.notes ?? 'N/A'}</p>
      `

    case 'lead-follow-up':
      return `
        <h2>Thanks for speaking with Skillify</h2>
        <p>${data.nextSteps ?? 'We’ll follow up with a summary shortly.'}</p>
      `

    case 'lead-no-show':
      return `
        <h2>We missed you</h2>
        <p>We noticed you weren’t able to make the scheduled call.</p>
        <p><a href="${data.rescheduleUrl}">Reschedule here</a></p>
      `

    case 'lead-reschedule':
      return `
        <h2>Your call has been rescheduled</h2>
        <p>New date: <strong>${data.startFormatted}</strong> (${data.timezone})</p>
      `

    case 'lead-we-missed-you':
      return `
        <h2>Still interested in Skillify?</h2>
        <p>If you're still exploring automation, book a time that works for you:</p>
        <p><a href="${data.demoUrl}">Book a demo</a></p>
      `

    default:
      return `<p>Hello from Skillify.</p>`
  }
}

// lib/notifications/notifyUpsell.ts

import { Buffer } from 'node:buffer'

type MicroUpsellPayload = {
  workspaceId?: string | null
  userEmail?: string | null
  feature: string
  description: string
  priceHint?: string | null
}

type EnterpriseConsultPayload = {
  workspaceId?: string | null
  name: string
  email: string
  phone?: string | null
  companySize?: string | null
  projectGoal?: string | null
  description: string
}

const NOTIFY_EMAIL_TO = process.env.NOTIFY_EMAIL_TO
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const NOTIFY_SMS_TO = process.env.NOTIFY_SMS_TO
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER
const RESEND_API_KEY = process.env.RESEND_API_KEY

async function sendSlackMessage(text: string) {
  if (!SLACK_WEBHOOK_URL) return
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (err) {
    console.error('Failed to send Slack notification', err)
  }
}

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL_TO) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Skillify <no-reply@skillify.tech>',
        to: [NOTIFY_EMAIL_TO],
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('Failed to send email notification', err)
  }
}

async function sendSms(body: string) {
  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN ||
    !TWILIO_FROM_NUMBER ||
    !NOTIFY_SMS_TO
  )
    return

  const params = new URLSearchParams()
  params.append('To', NOTIFY_SMS_TO)
  params.append('From', TWILIO_FROM_NUMBER)
  params.append('Body', body)

  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
  ).toString('base64')

  try {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )
  } catch (err) {
    console.error('Failed to send SMS notification', err)
  }
}

export async function notifyMicroUpsellRequest(payload: MicroUpsellPayload) {
  const title = 'New micro upsell request'
  const summary = `
Workspace: ${payload.workspaceId ?? 'public/unknown'}
User email: ${payload.userEmail ?? 'unknown'}
Feature: ${payload.feature}
Price hint: ${payload.priceHint ?? 'N/A'}

Description:
${payload.description}
  `.trim()

  await Promise.all([
    sendSlackMessage(`:sparkles: ${title}\n${summary}`),
    sendEmail(title, `<pre>${summary}</pre>`),
    sendSms(`${title} – ${payload.feature}`),
  ])
}

export async function notifyEnterpriseConsultRequest(
  payload: EnterpriseConsultPayload,
) {
  const title = 'New enterprise consult request'
  const summary = `
Workspace: ${payload.workspaceId ?? 'public/unknown'}

Name: ${payload.name}
Email: ${payload.email}
Phone: ${payload.phone ?? 'N/A'}
Company size: ${payload.companySize ?? 'N/A'}
Project goal: ${payload.projectGoal ?? 'N/A'}

Description:
${payload.description}
  `.trim()

  await Promise.all([
    sendSlackMessage(`:building_construction: ${title}\n${summary}`),
    sendEmail(title, `<pre>${summary}</pre>`),
    sendSms(`${title} – ${payload.name}`),
  ])
}

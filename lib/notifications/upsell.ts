import { sendEmail } from '@/lib/notifications/email'
/* --------------------------------------------------------
   Shared Base Types
-------------------------------------------------------- */

type BaseContext = {
  workspaceId?: string | null
  workspaceName?: string
  userId?: string
  userEmail?: string
}

const formatWorkspace = (id?: string | null) => (id ? id : 'public/marketing')

/* --------------------------------------------------------
   MICRO UPSELL
-------------------------------------------------------- */

type MicroUpsellContext = BaseContext & {
  feature: string
  description: string
  automationId?: string | null
}

export async function notifyMicroUpsellRequest(ctx: MicroUpsellContext) {
  const subject = `[Skillify] Micro Upsell Request — ${ctx.feature}`

  const html = `
    <h2>New Micro Upsell Request</h2>
    <p><strong>Workspace:</strong> ${formatWorkspace(ctx.workspaceId)}</p>
    <p><strong>User Email:</strong> ${ctx.userEmail ?? ctx.userId ?? 'N/A'}</p>
    <p><strong>Feature:</strong> ${ctx.feature}</p>
    ${ctx.automationId ? `<p><strong>Automation:</strong> ${ctx.automationId}</p>` : ''}
    <p><strong>Description:</strong></p>
    <pre>${ctx.description}</pre>
  `.trim()

  // ✅ FIXED — now uses object form
  await sendEmail({
    to: process.env.UPSELL_NOTIFY_EMAIL ?? 'founder@skillify.tech',
    subject,
    html,
  })

  await sendSlackMessage(
    `🔔 Micro Upsell\nWorkspace: ${formatWorkspace(
      ctx.workspaceId,
    )}\nUser: ${ctx.userEmail ?? ctx.userId ?? 'N/A'}\nFeature: ${
      ctx.feature
    }\nAutomation: ${ctx.automationId ?? 'N/A'}\nDescription: ${ctx.description.slice(0, 400)}`,
  )

  await sendSmsMessage(
    `Skillify Micro Upsell • ${ctx.feature} • Workspace: ${formatWorkspace(
      ctx.workspaceId,
    )} • User: ${ctx.userEmail ?? ctx.userId}`,
  )
}

/* --------------------------------------------------------
   ENTERPRISE CONSULT
-------------------------------------------------------- */

type EnterpriseConsultContext = BaseContext & {
  name: string
  email: string
  phone?: string | null
  companySize?: string | null
  projectGoal?: string | null
  description: string
}

export async function notifyEnterpriseConsultRequest(
  ctx: EnterpriseConsultContext,
) {
  const subject = `[Skillify] Enterprise Consult Request — ${ctx.name}`

  const html = `
    <h2>New Enterprise Consult Request</h2>
    <p><strong>Name:</strong> ${ctx.name}</p>
    <p><strong>Email:</strong> ${ctx.email}</p>
    <p><strong>Phone:</strong> ${ctx.phone ?? 'N/A'}</p>
    <p><strong>Workspace:</strong> ${formatWorkspace(ctx.workspaceId)}</p>
    <p><strong>Company Size:</strong> ${ctx.companySize ?? 'N/A'}</p>
    <p><strong>Goal:</strong> ${ctx.projectGoal ?? 'N/A'}</p>
    <p><strong>Description:</strong></p>
    <pre>${ctx.description}</pre>
  `.trim()

  // ✅ FIXED
  await sendEmail({
    to: process.env.UPSELL_NOTIFY_EMAIL ?? 'founder@skillify.tech',
    subject,
    html,
  })

  await sendSlackMessage(
    `🏢 Enterprise Consult\nName: ${ctx.name}\nEmail: ${ctx.email}\nPhone: ${
      ctx.phone ?? 'N/A'
    }\nWorkspace: ${formatWorkspace(ctx.workspaceId)}\nCompany size: ${
      ctx.companySize ?? 'N/A'
    }\nGoal: ${ctx.projectGoal ?? 'N/A'}`,
  )

  await sendSmsMessage(
    `Skillify Enterprise Lead • ${ctx.name} • ${ctx.email} • Workspace: ${formatWorkspace(
      ctx.workspaceId,
    )}`,
  )
}

/* --------------------------------------------------------
   BUILD REQUEST (FULL PROJECT)
-------------------------------------------------------- */

type BuildUpsellContext = BaseContext & {
  name?: string
  email?: string
  phone?: string | null
  company?: string | null
  website?: string | null
  size?: string | null

  projectType?: string | null
  projectSummary?: string
  automationCount?: number | null
  budgetRange?: string | null
  timeline?: string | null

  raw?: any
}

export async function notifyBuildUpsellRequest(ctx: BuildUpsellContext) {
  const subject = `[Skillify] Build Request — ${ctx.name ?? 'New Lead'}`

  const html = `
    <h2>New FULL BUILD Request</h2>

    <p><strong>Workspace:</strong> ${formatWorkspace(ctx.workspaceId)}</p>

    <p><strong>Name:</strong> ${ctx.name ?? 'N/A'}</p>
    <p><strong>Email:</strong> ${ctx.email ?? 'N/A'}</p>
    <p><strong>Phone:</strong> ${ctx.phone ?? 'N/A'}</p>

    <p><strong>Company:</strong> ${ctx.company ?? 'N/A'}</p>
    <p><strong>Website:</strong> ${ctx.website ?? 'N/A'}</p>
    <p><strong>Team Size:</strong> ${ctx.size ?? 'N/A'}</p>

    <p><strong>Project Type:</strong> ${ctx.projectType ?? 'N/A'}</p>
    <p><strong>Automations:</strong> ${ctx.automationCount ?? 'N/A'}</p>
    <p><strong>Budget:</strong> ${ctx.budgetRange ?? 'N/A'}</p>
    <p><strong>Timeline:</strong> ${ctx.timeline ?? 'N/A'}</p>

    <p><strong>Project Summary:</strong></p>
    <pre>${ctx.projectSummary ?? 'N/A'}</pre>
  `.trim()

  // ✅ FIXED
  await sendEmail({
    to: process.env.UPSELL_NOTIFY_EMAIL ?? 'founder@skillify.tech',
    subject,
    html,
  })

  await sendSlackMessage(
    `🚀 BUILD REQUEST\nWorkspace: ${formatWorkspace(ctx.workspaceId)}\nName: ${
      ctx.name ?? 'N/A'
    }\nEmail: ${ctx.email ?? 'N/A'}\nCompany: ${ctx.company ?? 'N/A'}\nBudget: ${
      ctx.budgetRange ?? 'N/A'
    }\nTimeline: ${ctx.timeline ?? 'N/A'}\nProject: ${ctx.projectSummary ?? 'N/A'}`,
  )

  await sendSmsMessage(
    `Skillify BUILD Lead • ${ctx.name ?? 'N/A'} • Budget: ${ctx.budgetRange ?? 'N/A'}`,
  )
}

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */

async function sendSlackMessage(text: string) {
  const webhook = process.env.SLACK_UPSELL_WEBHOOK_URL
  if (!webhook) return

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (err) {
    console.error('[UPSELL][SLACK] Failed to send', err)
  }
}

async function sendSmsMessage(message: string) {
  const smsApiUrl = process.env.SMS_UPSELL_API_URL
  const smsApiKey = process.env.SMS_UPSELL_API_KEY
  if (!smsApiUrl || !smsApiKey) return

  try {
    await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${smsApiKey}`,
      },
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    console.error('[UPSELL][SMS] Failed to send', err)
  }
}

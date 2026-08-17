import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { isIntegrationEncryptionConfigured } from '@/lib/integrations/crypto'
import {
  disconnectWorkspaceIntegrationConnection,
  upsertWorkspaceApiKeyConnection,
} from '@/lib/integrations/workspaceConnections'

type RouteContext = { params: { workspaceId: string } }

function isManager(role: string) {
  return role === 'OWNER' || role === 'ADMIN'
}

async function getActor(workspaceId: string) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null
  const profile = await prisma.userProfile.findUnique({ where: { clerkId } })
  if (!profile) return null
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId,
      },
    },
    select: { id: true, role: true },
  })
  if (!membership || !isManager(membership.role)) return null
  return { profile, membership }
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(params.workspaceId)
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isIntegrationEncryptionConfigured()) {
    return NextResponse.json(
      {
        error: 'configurationRequired',
        message:
          'Integration encryption must be configured before storing workspace email credentials.',
      },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const apiKey = normalizeText(body.apiKey)
  const sendingDomain = normalizeText(body.sendingDomain).toLowerCase()
  const fromName = normalizeText(body.fromName)
  const fromEmail = normalizeEmail(body.fromEmail)
  const replyTo = normalizeEmail(body.replyTo)

  if (!apiKey || apiKey.length < 12) {
    return NextResponse.json(
      { error: 'invalidApiKey', message: 'Enter a valid Resend API key.' },
      { status: 400 },
    )
  }
  if (!sendingDomain || !sendingDomain.includes('.')) {
    return NextResponse.json(
      { error: 'invalidDomain', message: 'Enter a valid sending domain.' },
      { status: 400 },
    )
  }
  if (!fromEmail || !fromEmail.includes('@')) {
    return NextResponse.json(
      { error: 'invalidFromEmail', message: 'Enter a valid From email.' },
      { status: 400 },
    )
  }

  const connection = await upsertWorkspaceApiKeyConnection({
    workspaceId: params.workspaceId,
    providerId: 'resend',
    apiKey,
    externalAccountId: sendingDomain,
    externalAccountLabel: fromEmail,
    connectedByUserId: actor.profile.id,
    connectedByWorkspaceMemberId: actor.membership.id,
    status: 'actionRequired',
    providerMetadata: {
      sendingDomain,
      fromName: fromName || undefined,
      fromEmail,
      replyTo: replyTo || undefined,
      domainStatus: 'verificationPending',
      guidance:
        'Verify this domain in Resend before Skillify uses it for workspace business email.',
    },
  })

  return NextResponse.json({ ok: true, connection })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(params.workspaceId)
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    connectionId?: string
  }
  if (!body.connectionId) {
    return NextResponse.json(
      { error: 'connectionId required' },
      { status: 400 },
    )
  }
  const connection = await disconnectWorkspaceIntegrationConnection({
    workspaceId: params.workspaceId,
    connectionId: body.connectionId,
  })
  if (!connection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, connection })
}

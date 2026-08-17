import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { completeGoogleCalendarOAuth } from '@/lib/scheduling/providers/googleService'
import { upsertCalendarWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const stateParam = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  let workspaceId: string | null = null
  let workspaceMemberId: string | null = null
  let state: string | null = null
  let returnToSetup = false
  let setupStep: string | null = null
  if (stateParam) {
    try {
      const parsed = JSON.parse(stateParam) as {
        workspaceId?: string
        workspaceMemberId?: string
        state?: string
        returnToSetup?: boolean
        setupStep?: string
      }
      workspaceId = parsed.workspaceId ?? null
      workspaceMemberId = parsed.workspaceMemberId ?? null
      state = parsed.state ?? null
      returnToSetup = parsed.returnToSetup === true
      setupStep = typeof parsed.setupStep === 'string' ? parsed.setupStep : null
    } catch {
      return NextResponse.json(
        { ok: false, code: 'INVALID_STATE' },
        { status: 400 },
      )
    }
  }

  if (!workspaceId || !state || !code || error) {
    return NextResponse.json(
      {
        ok: false,
        code: error ?? 'MISSING_OAUTH_PARAMETERS',
      },
      { status: 400 },
    )
  }

  const result = await completeGoogleCalendarOAuth({
    workspaceId,
    workspaceMemberId,
    state,
    code,
  })
  if (result.ok) {
    await upsertCalendarWorkspaceIntegrationConnection({
      workspaceId,
      providerId: 'googleCalendar',
      calendarConnectionId: result.value.connectionId,
    })
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  })
  const redirect = new URL(
    workspace
      ? returnToSetup
        ? `/dashboard/${workspace.slug}`
        : `/dashboard/${workspace.slug}/scheduling/settings`
      : '/dashboard',
    url.origin,
  )
  if (workspace && returnToSetup) {
    redirect.searchParams.set('setup', '1')
    redirect.searchParams.set('setupStep', setupStep ?? 'calendars')
  }
  redirect.searchParams.set(
    'googleCalendar',
    result.ok && result.value.classificationConfirmationRequired
      ? 'classification'
      : result.ok
        ? 'connected'
        : 'error',
  )
  if (result.ok && result.value.classificationConfirmationRequired) {
    redirect.searchParams.set('connectionId', result.value.connectionId)
  }
  if (!result.ok) redirect.searchParams.set('code', result.code)
  return NextResponse.redirect(redirect)
}

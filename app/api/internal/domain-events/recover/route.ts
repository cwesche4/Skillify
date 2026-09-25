import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { authenticateServiceToken } from '@/lib/auth/serviceToken'
import { recoverTerminalDomainEvent } from '@/lib/operations/simpleAutomationOperations'

export const dynamic = 'force-dynamic'

const recoveryRequestSchema = z
  .object({
    eventId: z.string().min(1),
    workspaceId: z.string().min(1),
  })
  .strict()

export async function POST(request: NextRequest) {
  const authorization = await authenticateServiceToken(
    request,
    'AUTOMATION_OPERATIONS',
  )
  if (!authorization.ok) return authorization.response

  const body = recoveryRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!body.success) {
    return Response.json(
      { ok: false, error: 'Event and workspace identity are required.' },
      { status: 400 },
    )
  }
  const result = await recoverTerminalDomainEvent({
    ...body.data,
    operatorSystem: authorization.system,
  })
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, error: result.message },
      { status: result.status },
    )
  }
  return Response.json(result)
}

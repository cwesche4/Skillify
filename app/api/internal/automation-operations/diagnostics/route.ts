import { type NextRequest } from 'next/server'

import { authenticateServiceToken } from '@/lib/auth/serviceToken'
import { getSimpleAutomationOperationsHealth } from '@/lib/operations/simpleAutomationOperations'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authorization = await authenticateServiceToken(
    request,
    'AUTOMATION_OPERATIONS',
  )
  if (!authorization.ok) return authorization.response
  return Response.json({
    ok: true,
    health: await getSimpleAutomationOperationsHealth(),
  })
}

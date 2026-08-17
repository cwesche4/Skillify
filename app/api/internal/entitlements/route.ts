import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateServiceToken } from '@/lib/auth/serviceToken'

const BodySchema = z
  .object({
    workspaceId: z.string().trim().min(1),
    entitlementKey: z.string().trim().min(1),
    action: z.enum(['GRANTED', 'REVOKED', 'EXPIRED']),
    source: z.string().trim().min(1),
    effectiveAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  const authResult = await authenticateServiceToken(req, 'ENTITLEMENT_ADMIN')
  if (!authResult.ok) return authResult.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.format() },
      { status: 400 },
    )
  }
  return NextResponse.json({
    ok: false,
    enabled: false,
    reason: 'Enterprise entitlement storage not configured',
  })
}

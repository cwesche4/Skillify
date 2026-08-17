import { NextResponse } from 'next/server'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider } from '@/lib/integrations/types'
import { processWebhookPayload } from '@/lib/integrations/webhookProcessor'

ensureIntegrationAdapters()

export async function POST(
  req: Request,
  { params }: { params: { provider: string } },
) {
  try {
    const provider = params.provider as IntegrationProvider
    const adapter = getIntegrationAdapter(provider)
    if (!adapter)
      return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })

    const payload = await adapter.verifyWebhook(req)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
    }

    const result = await processWebhookPayload(provider, payload)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }

    return NextResponse.json({ ok: true, triggered: result.triggered })
  } catch (err) {
    console.error('CRM webhook handler error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

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

    const verified = await adapter.verifyWebhook(req)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
    }

    const payloads = Array.isArray(verified) ? verified : [verified]
    let triggered = 0
    let accepted = 0
    for (const payload of payloads) {
      const result = await processWebhookPayload(provider, payload, {
        durableAcceptance: provider === 'hubspot',
      })
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        )
      }
      triggered += result.triggered
      accepted += result.accepted ?? 0
    }

    return NextResponse.json({ ok: true, triggered, accepted })
  } catch (err) {
    console.error('CRM webhook handler error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

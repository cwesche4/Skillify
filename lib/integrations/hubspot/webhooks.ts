import type { IntegrationWebhookPayload } from '../baseAdapter'

export async function parseHubSpotWebhook(
  _req: Request,
): Promise<IntegrationWebhookPayload | null> {
  // TODO: verify signature and normalize payload
  return null
}

import { type NextRequest } from 'next/server'

import { recordGoogleWebhookNotification } from '@/lib/scheduling/providers/googleService'

export async function POST(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id')
  const resourceId = request.headers.get('x-goog-resource-id')
  const messageNumber = request.headers.get('x-goog-message-number')
  const resourceState = request.headers.get('x-goog-resource-state')

  if (!channelId) {
    return Response.json(
      {
        ok: false,
        code: 'MISSING_CHANNEL_ID',
        message: 'Google Calendar webhook channel is missing.',
      },
      { status: 400 },
    )
  }

  const result = await recordGoogleWebhookNotification({
    channelId,
    resourceId,
    messageNumber,
    resourceState,
  })
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        code: result.code,
        message: result.safeMessage,
      },
      { status: result.retryable ? 503 : 400 },
    )
  }
  return Response.json({ ok: true, ...result.value })
}

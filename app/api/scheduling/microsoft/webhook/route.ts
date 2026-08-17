import { type NextRequest } from 'next/server'

import { recordMicrosoftWebhookNotification } from '@/lib/scheduling/providers/microsoftService'

export async function POST(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const body = await request.json().catch(() => ({}))
  const notification = Array.isArray(body.value) ? body.value[0] : null
  const channelId =
    request.headers.get('x-ms-subscription-id') ??
    (typeof notification?.subscriptionId === 'string'
      ? notification.subscriptionId
      : null)
  const resourceId =
    request.headers.get('x-ms-resource') ??
    (typeof notification?.resource === 'string' ? notification.resource : null)
  const messageNumber =
    request.headers.get('x-ms-sequence-number') ??
    (typeof notification?.sequenceNumber === 'number'
      ? String(notification.sequenceNumber)
      : typeof notification?.id === 'string'
        ? notification.id
        : null)
  const resourceState =
    request.headers.get('x-ms-change-type') ??
    (typeof notification?.changeType === 'string'
      ? notification.changeType
      : null)

  if (!channelId) {
    return Response.json(
      {
        ok: false,
        code: 'MISSING_CHANNEL_ID',
        message: 'Microsoft Outlook webhook channel is missing.',
      },
      { status: 400 },
    )
  }

  const result = await recordMicrosoftWebhookNotification({
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

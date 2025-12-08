// lib/notifications/slack.ts

export type SlackChannel = 'enterprise' | 'sales' | 'alerts'

function getWebhookForChannel(channel: SlackChannel) {
  switch (channel) {
    case 'enterprise':
      return process.env.SLACK_ENTERPRISE_WEBHOOK_URL
    case 'sales':
      return (
        process.env.SLACK_SALES_WEBHOOK_URL ??
        process.env.SLACK_ENTERPRISE_WEBHOOK_URL
      )
    case 'alerts':
      return (
        process.env.SLACK_ALERTS_WEBHOOK_URL ??
        process.env.SLACK_ENTERPRISE_WEBHOOK_URL
      )
    default:
      return process.env.SLACK_ENTERPRISE_WEBHOOK_URL
  }
}

export async function sendSlackMessage(args: {
  channel: SlackChannel
  title: string
  text?: string
  fields?: { label: string; value: string }[]
  color?: string
}) {
  const webhook = getWebhookForChannel(args.channel)
  if (!webhook) {
    console.warn('[Slack] Missing webhook URL for channel', args.channel)
    return
  }

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${args.title}*`,
      },
    },
  ]

  if (args.text) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: args.text.slice(0, 2500),
      },
    })
  }

  if (args.fields?.length) {
    blocks.push({
      type: 'section',
      fields: args.fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${f.label}*\n${f.value}`,
      })),
    })
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color: args.color ?? '#2563eb',
            blocks,
          },
        ],
      }),
    })
  } catch (err) {
    console.error('[Slack] Error', err)
  }
}

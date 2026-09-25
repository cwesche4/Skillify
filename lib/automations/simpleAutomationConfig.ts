import { z } from 'zod'

import type { SimpleAutomationKey } from '@/lib/automations/simpleAutomationCatalog'

const newLeadAlertConfigSchema = z
  .object({
    'notification-channel': z.enum(['in-app', 'email']),
    recipient: z.enum(['workspace-owner', 'team-member']),
  })
  .strict()

const leadFollowUpConfigSchema = z
  .object({
    'notification-channel': z.literal('in-app'),
    recipient: z.enum(['lead-assignee-or-owner', 'workspace-owner']),
  })
  .strict()

const estimateFollowUpConfigSchema = z
  .object({
    'estimate-delay': z.enum(['1-day', '3-days', '7-days']),
  })
  .strict()

const appointmentReminderConfigSchema = z
  .object({
    'reminder-offset': z.enum([
      '15-minutes',
      '30-minutes',
      '1-hour',
      '1-day',
    ]),
    'notification-channel': z.literal('in-app'),
    recipient: z.literal('appointment-assignees-or-owner'),
  })
  .strict()

const scheduleChangeNotificationConfigSchema = z
  .object({
    changes: z
      .array(z.enum(['time', 'assignment', 'canceled']))
      .min(1, 'Choose at least one schedule change.')
      .refine((values) => new Set(values).size === values.length, {
        message: 'Schedule changes must be unique.',
      }),
    'notification-channel': z.literal('in-app'),
    recipient: z.literal('appointment-assignees-or-owner'),
  })
  .strict()

const jobCompletionMessageConfigSchema = z
  .object({
    'notification-channel': z.literal('in-app'),
    recipient: z.enum(['job-assignee-or-owner', 'workspace-owner']),
  })
  .strict()

export const SIMPLE_AUTOMATION_CONFIG_SCHEMAS = {
  'new-lead-alert': newLeadAlertConfigSchema,
  'lead-follow-up': leadFollowUpConfigSchema,
  'estimate-follow-up': estimateFollowUpConfigSchema,
  'appointment-reminder': appointmentReminderConfigSchema,
  'schedule-change-notification': scheduleChangeNotificationConfigSchema,
  'job-completion-message': jobCompletionMessageConfigSchema,
} satisfies Record<SimpleAutomationKey, z.ZodTypeAny>

export type SimpleAutomationConfig = Record<string, string | string[] | boolean>

export function parseSimpleAutomationConfig(
  definitionKey: SimpleAutomationKey,
  config: unknown,
) {
  return SIMPLE_AUTOMATION_CONFIG_SCHEMAS[definitionKey].safeParse(config)
}

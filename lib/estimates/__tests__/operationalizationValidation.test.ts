import { describe, expect, it } from 'vitest'

import {
  estimateOperationalizationSchema,
  type EstimateOperationalizationInput,
} from '@/lib/estimates/operationalizationValidation'
import { hashEstimateOperationalizationRequest } from '@/lib/estimates/operationalizationHash'

const UUID = '11111111-1111-4111-8111-111111111111'

function validInput(): EstimateOperationalizationInput {
  return {
    expectedVersion: 3,
    idempotencyKey: UUID,
    oneTime: {
      title: 'Spring cleanup',
      notes: null,
      priority: 'NORMAL',
      assignments: [
        { assignmentType: 'TEAM', teamId: 'team-a' },
        { assignmentType: 'MEMBER', workspaceMemberId: 'member-a' },
      ],
      lineItems: [
        {
          estimateLineItemId: 'line-b',
          createJobStep: false,
        },
        {
          estimateLineItemId: 'line-a',
          createJobStep: true,
          stepTitle: 'Clean up',
        },
      ],
    },
    recurring: [
      {
        estimateLineItemId: 'line-c',
        serviceInstructions: 'Close the gate.',
        priority: 'NORMAL',
        stepTemplates: [{ title: 'Mow', description: null }],
        schedule: {
          startsAt: '2026-10-05T13:00:00.000Z',
          endsAt: '2026-10-05T14:00:00.000Z',
          timezone: 'America/New_York',
          recurrenceRule: {
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: [5, 1],
            endType: 'never',
          },
          locationType: 'customerLocation',
          assignments: [
            { assignmentType: 'MEMBER', workspaceMemberId: 'member-a' },
          ],
        },
      },
    ],
  }
}

describe('Estimate operationalization request validation', () => {
  it('accepts explicit one-time and recurring configuration', () => {
    expect(
      estimateOperationalizationSchema.safeParse(validInput()).success,
    ).toBe(true)
  })

  it('rejects forged commercial fields and weak idempotency identifiers', () => {
    expect(
      estimateOperationalizationSchema.safeParse({
        ...validInput(),
        idempotencyKey: 'retry-1',
        currency: 'USD',
      }).success,
    ).toBe(false)
  })

  it('requires assignments for scheduled and recurring work', () => {
    const input = validInput()
    input.oneTime!.scheduledStartAt = '2026-10-05T13:00:00.000Z'
    input.oneTime!.scheduledEndAt = '2026-10-05T14:00:00.000Z'
    input.oneTime!.assignments = []
    input.recurring[0].schedule.assignments = []
    expect(estimateOperationalizationSchema.safeParse(input).success).toBe(
      false,
    )
  })

  it('bounds atomic recurring-service creation to a realistic transaction size', () => {
    const input = validInput()
    input.recurring = Array.from({ length: 51 }, (_, index) => ({
      ...input.recurring[0],
      estimateLineItemId: `line-${index}`,
    }))
    expect(estimateOperationalizationSchema.safeParse(input).success).toBe(
      false,
    )
  })

  it('canonicalizes unordered identity sets for deterministic retry hashes', () => {
    const first = validInput()
    const second = validInput()
    second.oneTime!.assignments.reverse()
    second.oneTime!.lineItems.reverse()
    second.recurring[0].schedule.recurrenceRule.daysOfWeek!.reverse()
    second.idempotencyKey = '22222222-2222-4222-8222-222222222222'
    expect(hashEstimateOperationalizationRequest(first)).toBe(
      hashEstimateOperationalizationRequest(second),
    )
  })

  it('changes the retry hash when operational configuration changes', () => {
    const baseline = validInput()
    const changedPriority = validInput()
    changedPriority.oneTime!.priority = 'HIGH'
    const changedSchedule = validInput()
    changedSchedule.recurring[0].schedule.recurrenceRule.interval = 2
    const changedTemplate = validInput()
    changedTemplate.recurring[0].stepTemplates[0].title = 'Trim'

    const baselineHash = hashEstimateOperationalizationRequest(baseline)
    expect(hashEstimateOperationalizationRequest(changedPriority)).not.toBe(
      baselineHash,
    )
    expect(hashEstimateOperationalizationRequest(changedSchedule)).not.toBe(
      baselineHash,
    )
    expect(hashEstimateOperationalizationRequest(changedTemplate)).not.toBe(
      baselineHash,
    )
  })
})

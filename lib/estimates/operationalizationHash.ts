import { createHash } from 'crypto'

import type { EstimateOperationalizationInput } from '@/lib/estimates/operationalizationValidation'
import type { JobAssignmentTarget } from '@/lib/jobs/types'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

function normalizedForHash(input: EstimateOperationalizationInput) {
  const assignmentKey = (assignment: JobAssignmentTarget) =>
    assignment.assignmentType === 'MEMBER'
      ? `MEMBER:${assignment.workspaceMemberId}`
      : `TEAM:${assignment.teamId}`
  return {
    expectedVersion: input.expectedVersion,
    oneTime: input.oneTime
      ? {
          ...input.oneTime,
          assignments: [...input.oneTime.assignments].sort((a, b) =>
            assignmentKey(a).localeCompare(assignmentKey(b)),
          ),
          lineItems: [...input.oneTime.lineItems].sort((a, b) =>
            a.estimateLineItemId.localeCompare(b.estimateLineItemId),
          ),
        }
      : undefined,
    recurring: [...input.recurring]
      .map((entry) => ({
        ...entry,
        schedule: {
          ...entry.schedule,
          assignments: [...entry.schedule.assignments].sort((a, b) =>
            assignmentKey(a).localeCompare(assignmentKey(b)),
          ),
          recurrenceRule: {
            ...entry.schedule.recurrenceRule,
            daysOfWeek: entry.schedule.recurrenceRule.daysOfWeek
              ? [...entry.schedule.recurrenceRule.daysOfWeek].sort(
                  (a, b) => a - b,
                )
              : undefined,
          },
        },
      }))
      .sort((a, b) => a.estimateLineItemId.localeCompare(b.estimateLineItemId)),
  }
}

export function hashEstimateOperationalizationRequest(
  input: EstimateOperationalizationInput,
) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(normalizedForHash(input))))
    .digest('hex')
}

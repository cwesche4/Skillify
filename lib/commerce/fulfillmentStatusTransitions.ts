import {
  COMMERCE_FULFILLMENT_STATUS_OPTIONS,
  getCommerceStatusLabel,
} from '@/lib/commerce/commerceRegistry'
import {
  getPreviewFulfillment,
  syncOrderFulfillmentStatusFromFulfillment,
  updatePreviewFulfillment,
} from '@/lib/commerce/previewCommerceStorage'
import {
  createFulfillmentStatusLifecycleEvent,
  type CommerceLifecycleEvent,
} from '@/lib/commerce/commerceLifecycleEvents'
import type {
  CommerceFulfillment,
  CommerceFulfillmentStatus,
} from '@/lib/commerce/types'

type FulfillmentTransitionResult = {
  fulfillment: CommerceFulfillment | null
  errors: Record<string, string>
  events?: CommerceLifecycleEvent[]
}

export function applyFulfillmentLifecycleEffects({
  previousFulfillment: _previousFulfillment,
  updatedFulfillment: _updatedFulfillment,
}: {
  previousFulfillment: CommerceFulfillment
  updatedFulfillment: CommerceFulfillment
}) {
  // Future deterministic fulfillment lifecycle effects belong here:
  // inventory reservation/deduction, shipment creation, customer notifications,
  // carrier label workflows, and automation trigger dispatch. Phase 5.4 remains
  // preview/local and intentionally performs no external side effects.
}

function getFulfillmentStatusOption(status: CommerceFulfillmentStatus) {
  return COMMERCE_FULFILLMENT_STATUS_OPTIONS.find(
    (option) => option.value === status,
  )
}

function normalizeErrors(errors: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  )
}

function resolveFulfillmentTransitionActivity(
  previous: CommerceFulfillment,
  status: CommerceFulfillmentStatus,
) {
  const nextLabel = getCommerceStatusLabel(status)
  if (status === 'PICKING' && previous.status !== 'PICKING') {
    return { title: 'Picking started', description: nextLabel }
  }
  if (status === 'PACKING' && previous.status !== 'PACKING') {
    return { title: 'Packing started', description: nextLabel }
  }
  if (status === 'READY_TO_SHIP' && previous.status !== 'READY_TO_SHIP') {
    return { title: 'Marked Ready to Ship', description: nextLabel }
  }
  if (status === 'SHIPPED' && previous.status !== 'SHIPPED') {
    return { title: 'Marked Shipped', description: nextLabel }
  }
  if (status === 'DELIVERED' && previous.status !== 'DELIVERED') {
    return { title: 'Marked Delivered', description: nextLabel }
  }
  if (status === 'RETURNED' && previous.status !== 'RETURNED') {
    return { title: 'Returned', description: nextLabel }
  }
  if (status === 'CANCELLED' && previous.status !== 'CANCELLED') {
    return { title: 'Fulfillment cancelled', description: nextLabel }
  }
  return {
    title: 'Fulfillment status updated',
    description: `${getCommerceStatusLabel(previous.status)} → ${nextLabel}`,
  }
}

export function updateCommerceFulfillmentRecordStatus({
  workspaceId,
  fulfillmentId,
  status,
  storage,
}: {
  workspaceId: string
  fulfillmentId: string
  status: CommerceFulfillmentStatus
  storage?: Storage | null
}): FulfillmentTransitionResult {
  const option = getFulfillmentStatusOption(status)
  if (!option) {
    return {
      fulfillment: null,
      errors: { status: 'Invalid fulfillment status.' },
    }
  }
  const previousFulfillment = getPreviewFulfillment(
    workspaceId,
    fulfillmentId,
    storage,
  )
  if (!previousFulfillment) {
    return {
      fulfillment: null,
      errors: { fulfillment: 'Fulfillment not found.' },
    }
  }
  if (previousFulfillment.status === status) {
    return { fulfillment: previousFulfillment, errors: {}, events: [] }
  }

  const now = new Date().toISOString()
  const changes = {
    status,
    ...(status === 'SHIPPED'
      ? { shippedAt: previousFulfillment.shippedAt ?? now }
      : {}),
    ...(status === 'DELIVERED'
      ? { deliveredAt: previousFulfillment.deliveredAt ?? now }
      : {}),
  }
  const result = updatePreviewFulfillment({
    workspaceId,
    fulfillmentId,
    changes,
    activity: resolveFulfillmentTransitionActivity(previousFulfillment, status),
    storage,
  })
  if (result.fulfillment) {
    syncOrderFulfillmentStatusFromFulfillment({
      workspaceId,
      fulfillmentId,
      storage,
    })
    applyFulfillmentLifecycleEffects({
      previousFulfillment,
      updatedFulfillment: result.fulfillment,
    })
  }
  return {
    fulfillment: result.fulfillment,
    errors: normalizeErrors(result.errors),
    events: result.fulfillment
      ? [
          createFulfillmentStatusLifecycleEvent({
            workspaceId,
            fulfillmentId,
            previousValue: previousFulfillment.status,
            nextValue: status,
            createdAt: now,
          }),
        ]
      : [],
  }
}

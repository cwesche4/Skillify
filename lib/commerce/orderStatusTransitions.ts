import {
  COMMERCE_FULFILLMENT_STATUS_OPTIONS,
  COMMERCE_ORDER_STATUS_OPTIONS,
  COMMERCE_PAYMENT_STATUS_OPTIONS,
} from '@/lib/commerce/commerceRegistry'
import {
  appendCommerceActivity,
  createOrderActivity,
  getActivePreviewFulfillmentsForOrder,
  getPreviewOrders,
  syncSingleFulfillmentStatusFromOrder,
  updatePreviewOrder,
} from '@/lib/commerce/previewCommerceStorage'
import {
  createFulfillmentStatusLifecycleEvent,
  createOrderStatusLifecycleEvent,
  createPaymentStatusLifecycleEvent,
  type CommerceLifecycleEvent,
} from '@/lib/commerce/commerceLifecycleEvents'
import type {
  CommerceFulfillmentStatus,
  CommerceOrder,
  CommerceOrderStatus,
  CommercePaymentStatus,
} from '@/lib/commerce/types'

type TransitionDomain = 'order' | 'payment' | 'fulfillment'

type TransitionResult = {
  order: CommerceOrder | null
  errors: Record<string, string>
  events?: CommerceLifecycleEvent[]
}

const statusOptions = {
  order: COMMERCE_ORDER_STATUS_OPTIONS,
  payment: COMMERCE_PAYMENT_STATUS_OPTIONS,
  fulfillment: COMMERCE_FULFILLMENT_STATUS_OPTIONS,
}

const transitionTitles: Record<TransitionDomain, string> = {
  order: 'Order status updated',
  payment: 'Payment status updated',
  fulfillment: 'Fulfillment status updated',
}

export function applyCommerceLifecycleEffects({
  previousOrder: _previousOrder,
  updatedOrder: _updatedOrder,
  changedDomain: _changedDomain,
}: {
  previousOrder: CommerceOrder
  updatedOrder: CommerceOrder
  changedDomain: TransitionDomain
}) {
  // Future native lifecycle consequences belong here. User automations should
  // respond to lifecycle events, not become the source of truth for transitions.
}

function getStatusOption<TValue extends string>(
  domain: TransitionDomain,
  value: TValue,
) {
  return statusOptions[domain].find((option) => option.value === value)
}

function formatTransitionDescription({
  domain,
  previousValue,
  nextValue,
}: {
  domain: TransitionDomain
  previousValue: string
  nextValue: string
}) {
  const previousLabel =
    getStatusOption(domain, previousValue)?.label ?? previousValue
  const nextLabel = getStatusOption(domain, nextValue)?.label ?? nextValue
  return `${previousLabel} → ${nextLabel}`
}

function updateCommerceStatus({
  workspaceId,
  orderId,
  domain,
  value,
  storage,
}: {
  workspaceId: string
  orderId: string
  domain: TransitionDomain
  value: string
  storage?: Storage | null
}): TransitionResult {
  if (!getStatusOption(domain, value)) {
    return {
      order: null,
      errors: { status: `Invalid ${domain} status.` },
    }
  }
  const previousOrder =
    getPreviewOrders(workspaceId, storage).find(
      (order) => order.id === orderId,
    ) ?? null
  if (!previousOrder)
    return { order: null, errors: { order: 'Order not found.' } }

  const previousValue =
    domain === 'order'
      ? previousOrder.status
      : domain === 'payment'
        ? previousOrder.paymentStatus
        : previousOrder.fulfillmentStatus

  if (previousValue === value) return { order: previousOrder, errors: {} }

  const changes =
    domain === 'order'
      ? { status: value as CommerceOrderStatus }
      : domain === 'payment'
        ? { paymentStatus: value as CommercePaymentStatus }
        : { fulfillmentStatus: value as CommerceFulfillmentStatus }

  const result = updatePreviewOrder({
    workspaceId,
    orderId,
    changes,
    activity: {
      title: transitionTitles[domain],
      description: formatTransitionDescription({
        domain,
        previousValue,
        nextValue: value,
      }),
    },
    storage,
  })

  if (result.order) {
    if (domain === 'fulfillment') {
      syncSingleFulfillmentStatusFromOrder({ workspaceId, orderId, storage })
    }
    applyCommerceLifecycleEffects({
      previousOrder,
      updatedOrder: result.order,
      changedDomain: domain,
    })
  }

  return result
}

export function updateCommerceOrderQuickStatuses({
  workspaceId,
  orderId,
  statuses,
  storage,
}: {
  workspaceId: string
  orderId: string
  statuses: {
    status: CommerceOrderStatus
    paymentStatus: CommercePaymentStatus
    fulfillmentStatus: CommerceFulfillmentStatus
  }
  storage?: Storage | null
}): TransitionResult {
  const previousOrder =
    getPreviewOrders(workspaceId, storage).find(
      (order) => order.id === orderId,
    ) ?? null
  if (!previousOrder)
    return { order: null, errors: { order: 'Order not found.' } }

  const domains: Array<{
    domain: TransitionDomain
    previousValue: string
    nextValue: string
  }> = [
    {
      domain: 'order',
      previousValue: previousOrder.status,
      nextValue: statuses.status,
    },
    {
      domain: 'payment',
      previousValue: previousOrder.paymentStatus,
      nextValue: statuses.paymentStatus,
    },
    {
      domain: 'fulfillment',
      previousValue: previousOrder.fulfillmentStatus,
      nextValue: statuses.fulfillmentStatus,
    },
  ]

  for (const item of domains) {
    if (!getStatusOption(item.domain, item.nextValue)) {
      return {
        order: null,
        errors: { status: `Invalid ${item.domain} status.` },
      }
    }
  }

  const changed = domains.filter(
    (item) => item.previousValue !== item.nextValue,
  )
  if (changed.length === 0)
    return { order: previousOrder, errors: {}, events: [] }

  const fulfillmentChanged = changed.some(
    (item) => item.domain === 'fulfillment',
  )
  if (fulfillmentChanged) {
    const activeFulfillments = getActivePreviewFulfillmentsForOrder(
      workspaceId,
      orderId,
      storage,
    )
    if (activeFulfillments.length > 1) {
      return {
        order: null,
        errors: {
          fulfillment:
            'Multiple active fulfillment records are connected to this order.',
        },
      }
    }
  }

  const result = updatePreviewOrder({
    workspaceId,
    orderId,
    changes: statuses,
    activity: false,
    storage,
  })
  if (!result.order) return result

  const createdAt = new Date().toISOString()
  const events: CommerceLifecycleEvent[] = []
  for (const item of changed) {
    appendCommerceActivity(
      workspaceId,
      createOrderActivity({
        workspaceId,
        orderId,
        title: transitionTitles[item.domain],
        description: `${getStatusOption(item.domain, item.previousValue)?.label ?? item.previousValue} changed to ${
          getStatusOption(item.domain, item.nextValue)?.label ?? item.nextValue
        }.`,
      }),
      storage,
    )
    if (item.domain === 'order') {
      events.push(
        createOrderStatusLifecycleEvent({
          workspaceId,
          orderId,
          previousValue: item.previousValue as CommerceOrderStatus,
          nextValue: item.nextValue as CommerceOrderStatus,
          createdAt,
        }),
      )
    }
    if (item.domain === 'payment') {
      events.push(
        createPaymentStatusLifecycleEvent({
          workspaceId,
          orderId,
          previousValue: item.previousValue as CommercePaymentStatus,
          nextValue: item.nextValue as CommercePaymentStatus,
          createdAt,
        }),
      )
    }
    if (item.domain === 'fulfillment') {
      const activeFulfillment = getActivePreviewFulfillmentsForOrder(
        workspaceId,
        orderId,
        storage,
      )[0]
      if (activeFulfillment) {
        events.push(
          createFulfillmentStatusLifecycleEvent({
            workspaceId,
            fulfillmentId: activeFulfillment.id,
            previousValue: item.previousValue as CommerceFulfillmentStatus,
            nextValue: item.nextValue as CommerceFulfillmentStatus,
            createdAt,
          }),
        )
      }
    }
  }

  if (fulfillmentChanged) {
    syncSingleFulfillmentStatusFromOrder({ workspaceId, orderId, storage })
  }
  // Cross-status synchronization is reserved for the Commerce Lifecycle Engine.
  return { order: result.order, errors: {}, events }
}

export function updateCommerceOrderStatus({
  workspaceId,
  orderId,
  status,
  storage,
}: {
  workspaceId: string
  orderId: string
  status: CommerceOrderStatus
  storage?: Storage | null
}) {
  return updateCommerceStatus({
    workspaceId,
    orderId,
    domain: 'order',
    value: status,
    storage,
  })
}

export function updateCommercePaymentStatus({
  workspaceId,
  orderId,
  status,
  storage,
}: {
  workspaceId: string
  orderId: string
  status: CommercePaymentStatus
  storage?: Storage | null
}) {
  return updateCommerceStatus({
    workspaceId,
    orderId,
    domain: 'payment',
    value: status,
    storage,
  })
}

export function updateCommerceFulfillmentStatus({
  workspaceId,
  orderId,
  status,
  storage,
}: {
  workspaceId: string
  orderId: string
  status: CommerceFulfillmentStatus
  storage?: Storage | null
}) {
  return updateCommerceStatus({
    workspaceId,
    orderId,
    domain: 'fulfillment',
    value: status,
    storage,
  })
}

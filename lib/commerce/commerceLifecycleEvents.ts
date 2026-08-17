import type {
  CommerceFulfillmentStatus,
  CommerceOrderStatus,
  CommercePaymentStatus,
} from '@/lib/commerce/types'

export type CommerceLifecycleEventType =
  | 'commerce.order.status_changed'
  | 'commerce.payment.status_changed'
  | 'commerce.fulfillment.status_changed'

export type CommerceLifecycleEvent = {
  type: CommerceLifecycleEventType
  workspaceId: string
  recordId: string
  previousValue: string
  nextValue: string
  createdAt: string
}

export function createOrderStatusLifecycleEvent({
  workspaceId,
  orderId,
  previousValue,
  nextValue,
  createdAt,
}: {
  workspaceId: string
  orderId: string
  previousValue: CommerceOrderStatus
  nextValue: CommerceOrderStatus
  createdAt: string
}): CommerceLifecycleEvent {
  return {
    type: 'commerce.order.status_changed',
    workspaceId,
    recordId: orderId,
    previousValue,
    nextValue,
    createdAt,
  }
}

export function createPaymentStatusLifecycleEvent({
  workspaceId,
  orderId,
  previousValue,
  nextValue,
  createdAt,
}: {
  workspaceId: string
  orderId: string
  previousValue: CommercePaymentStatus
  nextValue: CommercePaymentStatus
  createdAt: string
}): CommerceLifecycleEvent {
  return {
    type: 'commerce.payment.status_changed',
    workspaceId,
    recordId: orderId,
    previousValue,
    nextValue,
    createdAt,
  }
}

export function createFulfillmentStatusLifecycleEvent({
  workspaceId,
  fulfillmentId,
  previousValue,
  nextValue,
  createdAt,
}: {
  workspaceId: string
  fulfillmentId: string
  previousValue: CommerceFulfillmentStatus
  nextValue: CommerceFulfillmentStatus
  createdAt: string
}): CommerceLifecycleEvent {
  return {
    type: 'commerce.fulfillment.status_changed',
    workspaceId,
    recordId: fulfillmentId,
    previousValue,
    nextValue,
    createdAt,
  }
}

import type { CRMTrigger, IntegrationProvider, CRMObjectType } from './types'

// Normalize strings for deterministic matching
export function normalizeProvider(
  value: string | undefined,
): IntegrationProvider | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v === 'hubspot') return 'hubspot'
  if (v === 'salesforce') return 'salesforce'
  if (v === 'pipedrive') return 'pipedrive'
  return null
}

export function normalizeObjectType(
  value: string | undefined,
): CRMObjectType | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v === 'contact' || v === 'contacts') return 'contact'
  if (v === 'deal' || v === 'deals') return 'deal'
  if (v === 'company' || v === 'companies') return 'company'
  if (v === 'owner' || v === 'owners') return 'owner'
  return null
}

export function normalizeEvent(value: string | undefined): CRMTrigger | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('stage_changed')) return 'deal.stage_changed'
  if (v.includes('stage') && v.includes('change')) return 'deal.stage_changed'
  if (v.includes('created')) {
    if (v.includes('contact')) return 'contact.created'
    if (v.includes('deal')) return 'deal.created'
    if (v.includes('company')) return 'company.created'
    return 'created'
  }
  if (v.includes('updated') || v.includes('propertychange')) {
    if (v.includes('contact')) return 'contact.updated'
    if (v.includes('company')) return 'company.updated'
    return 'updated'
  }
  if (v.includes('deleted')) {
    if (v.includes('contact')) return 'contact.deleted'
    if (v.includes('deal')) return 'deal.deleted'
    if (v.includes('company')) return 'company.deleted'
    return 'deleted'
  }
  if (v.includes('assigned')) return 'lead.assigned'
  return null
}

/**
 * Use this to compare triggers deterministically.
 */
export function matchTriggerNode({
  nodeProvider,
  nodeObjectType,
  nodeEvent,
  eventProvider,
  eventObjectType,
  eventName,
}: {
  nodeProvider?: string
  nodeObjectType?: string
  nodeEvent?: string
  eventProvider: string
  eventObjectType: string
  eventName: string
}): boolean {
  const pNode = normalizeProvider(nodeProvider)
  const pEvt = normalizeProvider(eventProvider)
  const oNode = normalizeObjectType(nodeObjectType)
  const oEvt = normalizeObjectType(eventObjectType)
  const eNode = normalizeEvent(nodeEvent)
  const eEvt = normalizeEvent(eventName)

  return (
    !!pNode &&
    !!pEvt &&
    pNode === pEvt &&
    !!oNode &&
    !!oEvt &&
    oNode === oEvt &&
    !!eNode &&
    !!eEvt &&
    eNode === eEvt
  )
}

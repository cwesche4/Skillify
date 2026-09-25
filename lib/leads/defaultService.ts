import { prismaLeadsStore } from '@/lib/leads/prismaStore'
import { createLeadService } from '@/lib/leads/service'
import { processDomainEvent } from '@/lib/domain-events/processor'

export const leadService = createLeadService(prismaLeadsStore, {
  processCommittedEvent: processDomainEvent,
  onEventProcessingError(error) {
    console.error('Immediate native Lead event processing failed.', error)
  },
})

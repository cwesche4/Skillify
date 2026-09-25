import { prismaJobsStore } from '@/lib/jobs/prismaStore'
import { createOperationsService } from '@/lib/jobs/service'
import { processDomainEvent } from '@/lib/domain-events/processor'

export const operationsService = createOperationsService(prismaJobsStore, {
  processCommittedEvent: processDomainEvent,
  onEventProcessingError(error) {
    console.error('Immediate native Job event processing failed.', error)
  },
})

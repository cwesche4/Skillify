import { prismaRecurringServiceStore } from '@/lib/recurring-services/prismaStore'
import { createRecurringServiceService } from '@/lib/recurring-services/service'

export const recurringServiceService = createRecurringServiceService(
  prismaRecurringServiceStore,
)

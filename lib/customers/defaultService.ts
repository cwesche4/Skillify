import { prismaCustomerStore } from '@/lib/customers/prismaStore'
import { createCustomerService } from '@/lib/customers/service'

export const customerService = createCustomerService(prismaCustomerStore)

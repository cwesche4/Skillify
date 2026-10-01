import { prismaEstimateStore } from '@/lib/estimates/prismaStore'
import { createEstimateService } from '@/lib/estimates/service'

export const estimateService = createEstimateService(prismaEstimateStore)

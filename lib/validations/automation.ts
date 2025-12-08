// lib/validations/automation.ts
import { z } from 'zod'

export const createAutomationSchema = z.object({
  name: z.string().min(3).max(100),
  workspaceId: z.string().min(1),
  description: z.string().max(500).optional().nullable(),
})

export const updateAutomationSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['INACTIVE', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
})

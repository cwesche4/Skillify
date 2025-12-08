// lib/validations/workspace.ts
import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(3).max(50),
})

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
})

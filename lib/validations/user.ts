// lib/validations/user.ts
import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
})

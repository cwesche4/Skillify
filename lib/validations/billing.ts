import { z } from "zod"

export const updatePlanSchema = z.object({
  plan: z.enum(["free", "pro", "business"]),
})

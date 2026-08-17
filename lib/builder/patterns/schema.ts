import { z } from 'zod'

export const microPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  nodes: z.any(),
  edges: z.any(),
  createdAt: z.string(),
})

export type MicroPatternMeta = z.infer<typeof microPatternSchema>

// Micro-patterns.
// Static snapshots only.
// No inference, no execution behavior.

// lib/validations/automation.ts
import { z } from 'zod'

export const createAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    workspaceId: z.string().min(1),
    description: z.string().max(500).optional().nullable(),
  })
  .strict()

export const createWorkspaceAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    flow: z
      .object({
        nodes: z.array(z.unknown()),
        edges: z.array(z.unknown()),
      })
      .passthrough()
      .optional(),
  })
  .strict()

export const updateAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    status: z.enum(['INACTIVE', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  })
  .strict()

export const renameAutomationSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict()

export const automationFlowSchema = z
  .object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  })
  .passthrough()

export const runAutomationSchema = z
  .object({ payload: z.unknown().optional() })
  .strict()

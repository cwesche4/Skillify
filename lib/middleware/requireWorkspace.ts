// lib/middleware/requireWorkspace.ts
import type { NextRequest } from 'next/server'
import { getActiveWorkspace } from '@/lib/workspace'

/**
 * Simple helper for API route handlers:
 * Ensures there is a valid active workspace or throws.
 *
 * Usage inside an API route:
 *
 *   import { requireWorkspace } from "@/lib/middleware/requireWorkspace"
 *
 *   export async function GET(req: NextRequest) {
 *     const workspace = await requireWorkspace(req)
 *     // ... use workspace.id, workspace.slug, etc.
 *   }
 */
export async function requireWorkspace(req: NextRequest) {
  const workspace = await getActiveWorkspace(req as unknown as Request)

  if (!workspace) {
    throw new Error('Workspace not found or you do not have access.')
  }

  return workspace
}

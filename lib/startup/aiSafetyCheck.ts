import { prisma } from '@/lib/db'
import { checkAiActionRate } from '@/lib/rate-limit/aiActions'

let initialized: Promise<void> | null = null

async function runChecks() {
  // Read-only table probe to ensure audit table exists/reachable.
  await prisma.aiActionAudit.findFirst({ select: { id: true } })

  // Ensure rate limiter module is initialized.
  checkAiActionRate({ workspaceId: '__startup__', userId: '__startup__' })
}

export function ensureAiSafetyReady() {
  if (!initialized) {
    initialized = runChecks()
  }
  return initialized
}

import { prisma } from '@/lib/db'

export type SelfAuditResult = {
  ok: boolean
  issues: string[]
}

export async function runGovernanceSelfAudit(): Promise<SelfAuditResult> {
  const issues: string[] = []

  if (typeof process.env.AI_ACTIONS_GLOBALLY_DISABLED === 'undefined') {
    issues.push('AI_ACTIONS_GLOBALLY_DISABLED env is not set')
  }

  // Workspace settings table reachability
  try {
    await prisma.workspaceSettings.findFirst({ select: { id: true } })
  } catch (err: any) {
    issues.push(
      `WorkspaceSettings unreachable: ${err?.message ?? 'unknown error'}`,
    )
  }

  // Audit writes still succeed and integrity hashes present (read-only check of latest)
  try {
    const latest = await prisma.aiActionAudit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, integrityHash: true },
    })
    if (latest && !latest.integrityHash) {
      issues.push('AiActionAudit.latest missing integrityHash')
    }
  } catch (err: any) {
    issues.push(
      `AiActionAudit check failed: ${err?.message ?? 'unknown error'}`,
    )
  }

  return { ok: issues.length === 0, issues }
}

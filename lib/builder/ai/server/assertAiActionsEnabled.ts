import { NextResponse } from 'next/server'
import { getWorkspaceSettings } from '@/lib/workspaces/settings'
import { ensureAiSafetyReady } from '@/lib/startup/aiSafetyCheck'

const DISABLED_RESPONSE = NextResponse.json(
  { error: 'AI actions are disabled for this workspace.' },
  { status: 403 },
)

/**
 * Enforce workspace AI-actions kill switch.
 * - Deny by default (missing workspace or missing settings).
 * - Server-side only; callers must return the Response when provided.
 */
export async function assertAiActionsEnabled(workspaceId: string | null) {
  const globallyDisabled = process.env.AI_ACTIONS_GLOBALLY_DISABLED !== 'false'

  if (globallyDisabled) {
    return NextResponse.json(
      { error: 'AI actions are globally disabled.' },
      { status: 503 },
    )
  }

  if (!workspaceId) return DISABLED_RESPONSE

  await ensureAiSafetyReady()

  const settings = await getWorkspaceSettings(workspaceId)
  if (!settings?.aiActionsEnabled) return DISABLED_RESPONSE

  return null
}

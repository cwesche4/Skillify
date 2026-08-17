import type { AuditEvent } from './types'

/**
 * Append-only ledger writer.
 * No edits or deletes; caller ensures actor attribution.
 */
export async function writeAuditEvent(event: AuditEvent) {
  return {
    ...event,
    payload: event.payload ?? {},
    createdAt: new Date(event.createdAt),
  }
}

/**
 * Read-only fetch for audit viewer/export.
 */
export async function listAuditEvents(runId: string) {
  return []
}

import type { WorkspaceKnowledgeReference } from '@/lib/intelligence/workspaceIntelligence'

export type NormalizedCitationResult = {
  citations: WorkspaceKnowledgeReference[]
  invalidCitationIds: string[]
  invalidCitationCount: number
}

export function normalizeValidatedCitationIds({
  citations,
  allowedReferences,
}: {
  citations: unknown
  allowedReferences: WorkspaceKnowledgeReference[]
}): NormalizedCitationResult {
  const allowed = new Map(
    allowedReferences
      .filter((reference) => isValidCitationId(reference.id))
      .map((reference) => [reference.id, reference]),
  )
  const normalized: WorkspaceKnowledgeReference[] = []
  const invalidCitationIds: string[] = []
  const seen = new Set<string>()

  for (const citation of Array.isArray(citations) ? citations : []) {
    const id = citationId(citation)
    if (!isValidCitationId(id)) {
      invalidCitationIds.push('invalid-citation-id')
      continue
    }
    const reference = allowed.get(id)
    if (!reference) {
      invalidCitationIds.push(id)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    normalized.push(reference)
  }

  return {
    citations: normalized,
    invalidCitationIds: [...new Set(invalidCitationIds)],
    invalidCitationCount: invalidCitationIds.length,
  }
}

export function isValidCitationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().toLowerCase() !== 'undefined' &&
    value.trim().toLowerCase() !== 'null'
  )
}

function citationId(citation: unknown) {
  if (typeof citation === 'string') return citation.trim()
  if (citation && typeof citation === 'object' && 'id' in citation) {
    return (citation as { id?: unknown }).id
  }
  return undefined
}

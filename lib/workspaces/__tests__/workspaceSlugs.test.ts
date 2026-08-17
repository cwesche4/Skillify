import { describe, expect, it } from 'vitest'

import {
  findAvailableWorkspaceSlug,
  getWorkspaceSlugCandidate,
  isMachineGeneratedWorkspaceSlug,
  normalizeWorkspaceSlugBase,
} from '@/lib/workspaces/workspaceSlugs'

describe('workspace slug helpers', () => {
  it('normalizes workspace names into readable URL-safe slugs', () => {
    expect(normalizeWorkspaceSlugBase('Skillify HQ')).toBe('skillify-hq')
    expect(normalizeWorkspaceSlugBase('Commonwealth Gas & Well LLC')).toBe(
      'commonwealth-gas-and-well-llc',
    )
    expect(normalizeWorkspaceSlugBase('Johnson Plumbing')).toBe(
      'johnson-plumbing',
    )
  })

  it('normalizes punctuation, repeated separators, unicode marks, and reserved words', () => {
    expect(normalizeWorkspaceSlugBase('  Café + Repair!!!  ')).toBe(
      'cafe-repair',
    )
    expect(normalizeWorkspaceSlugBase('API')).toBe('api-workspace')
    expect(normalizeWorkspaceSlugBase('!!!')).toBe('workspace')
  })

  it('creates readable numeric candidates without user or member identifiers', () => {
    expect(getWorkspaceSlugCandidate('Skillify HQ', 0)).toBe('skillify-hq')
    expect(getWorkspaceSlugCandidate('Skillify HQ', 1)).toBe('skillify-hq-2')
    expect(getWorkspaceSlugCandidate('Skillify HQ', 2)).toBe('skillify-hq-3')
  })

  it('finds the next available readable slug', async () => {
    const unavailable = new Set(['skillify-hq', 'skillify-hq-2'])
    await expect(
      findAvailableWorkspaceSlug({
        name: 'Skillify HQ',
        isAvailable: async (slug) => !unavailable.has(slug),
      }),
    ).resolves.toBe('skillify-hq-3')
  })

  it('detects machine-generated workspace slugs for explicit conversion only', () => {
    expect(
      isMachineGeneratedWorkspaceSlug('workspace-cmjounji600008n9k5c0wzca7'),
    ).toBe(true)
    expect(isMachineGeneratedWorkspaceSlug('workspace-user_123')).toBe(true)
    expect(isMachineGeneratedWorkspaceSlug('skillify-hq')).toBe(false)
    expect(isMachineGeneratedWorkspaceSlug('commonwealth-gas-well')).toBe(false)
  })
})

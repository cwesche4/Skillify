type ControlEntry = {
  id: string
  description: string
  enforcement: string[]
}

/**
 * Static SOC2 control evidence map. Pure metadata, no runtime side effects.
 */
export const CONTROL_REGISTRY: ControlEntry[] = [
  {
    id: 'CC6.1',
    description: 'Workspace-level AI actions kill switch enforced server-side.',
    enforcement: ['lib/builder/ai/server/assertAiActionsEnabled.ts'],
  },
  {
    id: 'CC7.2',
    description: 'AI action rate limiting to mitigate abuse.',
    enforcement: ['lib/rate-limit/aiActions.ts'],
  },
  {
    id: 'CC8.1',
    description:
      'AI action audit immutability with integrity hashes and append-only writes.',
    enforcement: [
      'prisma/schema.prisma (AiActionAudit.integrityHash)',
      'lib/builder/ai/server/audit.ts',
    ],
  },
  {
    id: 'CC9.1',
    description: 'AI action audit querying and export for oversight.',
    enforcement: [
      'app/api/workspaces/[workspaceId]/ai-actions/audit/route.ts',
      'app/api/workspaces/[workspaceId]/ai-actions/audit/export/route.ts',
    ],
  },
  {
    id: 'CC7.3',
    description:
      'AI action abnormal usage alerts (denials, rate limits, undo conflicts).',
    enforcement: [
      'lib/observability/aiAlerts.ts',
      'lib/observability/aiMetrics.ts',
    ],
  },
]

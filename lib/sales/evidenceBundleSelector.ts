type Industry =
  | 'fintech'
  | 'healthcare'
  | 'saas'
  | 'enterprise'
  | 'public-sector'

type ReviewType = 'procurement' | 'soc2' | 'incident'

type Bundle = {
  name: string
  ndaRequired: boolean
  source: string
}

export function selectEvidenceBundles(params: {
  industry: Industry
  reviewType: ReviewType
  workspaceId?: string
}): { bundles: Bundle[] } {
  const bundles: Bundle[] = []

  if (params.reviewType === 'soc2') {
    bundles.push({
      name: 'SOC-2 AI Controls Bundle',
      ndaRequired: true,
      source: 'docs/compliance/',
    })
  }

  if (params.reviewType === 'incident') {
    bundles.push({
      name: 'Incident Readiness Bundle',
      ndaRequired: false,
      source: 'docs/runbooks/',
    })
  }

  // Procurement or general AI governance
  bundles.push({
    name: 'AI Governance Evidence Bundle',
    ndaRequired: true,
    source: 'docs/sales/ai-governance-evidence-bundles.md',
  })

  if (params.reviewType !== 'incident') {
    bundles.push({
      name: 'Audit & Integrity Bundle',
      ndaRequired: true,
      source: 'docs/sales/ai-governance-evidence-bundles.md',
    })
  }

  return { bundles }
}

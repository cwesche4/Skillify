type Context = 'evidence' | 'soc2' | 'clarification'

type TrustLink = { label: string; url: string }

const BASE_LINKS: Record<Context, TrustLink[]> = {
  evidence: [
    { label: 'Trust Center', url: '/trust' },
    { label: 'Audit & Evidence', url: '/trust/audit-and-evidence' },
    { label: 'AI Governance', url: '/trust/ai-governance' },
  ],
  soc2: [
    { label: 'Trust Center', url: '/trust' },
    { label: 'Compliance', url: '/trust/compliance' },
    { label: 'Audit & Evidence', url: '/trust/audit-and-evidence' },
  ],
  clarification: [
    { label: 'Trust Center', url: '/trust' },
    { label: 'AI Governance', url: '/trust/ai-governance' },
    { label: 'Security Controls', url: '/trust/security-controls' },
  ],
}

export function resolveTrustLinks(context: Context): { links: TrustLink[] } {
  return { links: BASE_LINKS[context] }
}

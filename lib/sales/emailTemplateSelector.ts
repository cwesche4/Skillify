import { promises as fs } from 'fs'
import path from 'path'

type Industry =
  | 'fintech'
  | 'healthcare'
  | 'saas'
  | 'enterprise'
  | 'public-sector'

type Context =
  | 'evidence delivery'
  | 'soc2 escalation'
  | 'governance clarification'

type TemplateSelection = {
  templateFile: string
  section: string
  content: string
}

const FILE_MAP: Record<Industry, string> = {
  fintech: 'docs/sales/security-review-email-fintech.md',
  healthcare: 'docs/sales/security-review-email-healthcare.md',
  saas: 'docs/sales/security-review-email-saas.md',
  enterprise: 'docs/sales/security-review-email-enterprise.md',
  'public-sector': 'docs/sales/security-review-email-public-sector.md',
}

const SECTION_MAP: Record<Industry, Record<Context, string>> = {
  fintech: {
    'evidence delivery': 'Evidence Delivery (Audit CSV / Evidence Bundle)',
    'soc2 escalation': 'SOC-2 / Risk Committee Escalation',
    'governance clarification':
      'AI Governance Clarification (Kill Switch, Audits, Rate Limits)',
  },
  healthcare: {
    'evidence delivery': 'Evidence Delivery',
    'soc2 escalation': 'Security Questionnaire Follow-Up',
    'governance clarification': 'AI Governance Clarification',
  },
  saas: {
    'evidence delivery': 'Initial Evidence Delivery',
    'soc2 escalation': 'Follow-Up After Questionnaire',
    'governance clarification': 'AI Governance Clarification',
  },
  enterprise: {
    'evidence delivery': 'Evidence Package Delivery',
    'soc2 escalation': 'SOC-2 / Audit Escalation',
    'governance clarification': 'Follow-Up After Security Review',
  },
  'public-sector': {
    'evidence delivery': 'Evidence Delivery',
    'soc2 escalation': 'Governance Clarification',
    'governance clarification': 'Governance Clarification',
  },
}

function extractSection(markdown: string, sectionHeading: string) {
  const escaped = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `^##\\s+${escaped}\\s*$([\\s\\S]*?)(^##\\s+|\\Z)`,
    'm',
  )
  const match = markdown.match(pattern)
  return match ? match[1].trim() : ''
}

export async function selectEmailTemplate(
  industry: Industry,
  context: Context,
): Promise<TemplateSelection> {
  const templateFile = FILE_MAP[industry]
  const section = SECTION_MAP[industry][context]

  const fullPath = path.join(process.cwd(), templateFile)
  const contentRaw = await fs.readFile(fullPath, 'utf-8')
  const sectionContent = extractSection(contentRaw, section)

  if (!sectionContent) {
    throw new Error(
      `Section "${section}" not found in template "${templateFile}"`,
    )
  }

  return {
    templateFile,
    section,
    content: sectionContent,
  }
}

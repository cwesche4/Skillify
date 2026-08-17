type Industry = 'fintech' | 'healthcare' | 'saas' | 'enterprise' | 'public'

type Input = {
  companyName?: string | null
  industryField?: string | null
  customerType?: string | null
  salesMetadata?: Record<string, any>
}

type Result = {
  industry: Industry
  confidence: number
  fallbackUsed: boolean
}

const KEYWORDS: Record<Industry, string[]> = {
  fintech: [
    'bank',
    'fintech',
    'finance',
    'financial',
    'payments',
    'payment',
    'lending',
    'credit',
    'card',
    'broker',
    'exchange',
    'trading',
    'wealth',
  ],
  healthcare: [
    'health',
    'healthcare',
    'clinic',
    'hospital',
    'med',
    'pharma',
    'bio',
    'care',
    'ehr',
  ],
  saas: ['saas', 'software', 'b2b', 'tech', 'cloud'],
  enterprise: ['enterprise', 'regulated'],
  public: [
    'government',
    'public',
    'education',
    'university',
    'school',
    'agency',
  ],
}

function normalize(value?: string | null) {
  return (value ?? '').toLowerCase()
}

function scoreIndustry(text: string, industry: Industry) {
  const keywords = KEYWORDS[industry]
  return keywords.reduce((score, kw) => {
    if (text.includes(kw)) return score + 1
    return score
  }, 0)
}

/**
 * Deterministically select industry classification with explainable scoring.
 */
export function selectIndustry(input: Input): Result {
  const fields = [
    normalize(input.companyName),
    normalize(input.industryField),
    normalize(input.customerType),
    normalize(
      typeof input.salesMetadata?.industry === 'string'
        ? input.salesMetadata.industry
        : '',
    ),
  ]
  const corpus = fields.filter(Boolean).join(' ')

  const scores: Record<Industry, number> = {
    fintech: scoreIndustry(corpus, 'fintech'),
    healthcare: scoreIndustry(corpus, 'healthcare'),
    saas: scoreIndustry(corpus, 'saas'),
    enterprise: scoreIndustry(corpus, 'enterprise'),
    public: scoreIndustry(corpus, 'public'),
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topIndustry, topScore] = ranked[0] as [Industry, number]

  const fallback = !topScore
  const industry: Industry = fallback ? 'enterprise' : topIndustry
  const confidence =
    topScore === 0 ? 0.2 : Math.min(1, topScore / (fields.length || 1))

  return {
    industry,
    confidence: Number(confidence.toFixed(2)),
    fallbackUsed: fallback,
  }
}

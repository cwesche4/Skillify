// lib/enterprise/leadScoring.ts

type LeadInput = {
  companySize?: string
  budgetRange?: string
  industry?: string
  timeline?: string
  useCase?: string
  notes?: string
}

export type LeadScoreResult = {
  score: number // 0–100
  tier: 'low' | 'medium' | 'high'
  reasons: string[]
}

// Simple rules + optional AI enhancement
export async function scoreLead(input: LeadInput): Promise<LeadScoreResult> {
  let score = 50
  const reasons: string[] = []

  const size = (input.companySize || '').toLowerCase()
  if (
    size.includes('100+') ||
    size.includes('200') ||
    size.includes('enterprise')
  ) {
    score += 20
    reasons.push('Larger team / enterprise size')
  } else if (size.includes('10-50') || size.includes('50-100')) {
    score += 10
    reasons.push('Growing team size')
  }

  const budget = (input.budgetRange || '').toLowerCase()
  if (
    budget.includes('5k') ||
    budget.includes('10k') ||
    budget.includes('20k')
  ) {
    score += 15
    reasons.push('Strong monthly budget')
  }

  const timeline = (input.timeline || '').toLowerCase()
  if (timeline.includes('this month') || timeline.includes('immediately')) {
    score += 10
    reasons.push('Near-term implementation timeline')
  } else if (timeline.includes('this quarter')) {
    score += 5
    reasons.push('Mid-term implementation timeline')
  }

  if (input.useCase?.toLowerCase().includes('multi-workspace')) {
    score += 5
    reasons.push('Complex multi-workspace use case')
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  let tier: LeadScoreResult['tier'] = 'medium'
  if (score >= 75) tier = 'high'
  else if (score <= 40) tier = 'low'

  return { score, tier, reasons }
}

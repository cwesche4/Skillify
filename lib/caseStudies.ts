// lib/caseStudies.ts

export type CaseStudy = {
  slug: string
  customer: string
  title: string
  industry: string
  headlineStat: string
  summary: string
  logoText?: string
  tags: string[]
  metrics: { label: string; value: string; caption?: string }[]
  sections: { heading: string; body: string }[]
  quote?: {
    text: string
    person: string
    role: string
  }
}

// Verified customer evidence will be added after the controlled-launch cohort.
// Keep this empty rather than publishing fictional names, metrics, or outcomes.
export const caseStudies: CaseStudy[] = []

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug)
}

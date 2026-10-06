// lib/marketing/caseStudies.ts

export type CaseStudy = {
  slug: string
  title: string
  subtitle: string
  industry: string
  headlineMetric: string
  headlineMetricLabel: string
  summary: string
  logoText: string
  challenges: string[]
  solutions: string[]
  results: { label: string; value: string }[]
  quote: {
    text: string
    name: string
    role: string
  }
}

// Verified customer evidence will be added after the controlled-launch cohort.
// Keep this empty rather than publishing fictional names, metrics, or outcomes.
export const caseStudies: CaseStudy[] = []

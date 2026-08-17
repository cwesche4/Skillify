import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

export type IndustryLayoutHint = {
  model:
    | typeof WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
    | typeof WorkspaceBusinessModel.CONSULTATIVE_SALES
    | typeof WorkspaceBusinessModel.DIRECT_SALES
    | typeof WorkspaceBusinessModel.PRODUCT_COMMERCE
  confidence: 'HIGH' | 'MEDIUM'
  label: string
  reason: string
} | null

const PRODUCT_COMMERCE = [
  'ecom',
  'ecommerce',
  'e commerce',
  'online store',
  'retail',
  'wholesale',
  'wholesaler',
  'clothing brand',
  'product brand',
  'consumer products',
  'product sales',
  'distributor',
  'subscription box',
]

const CONSULTATIVE_SALES = [
  'consulting',
  'consultant',
  'agency',
  'marketing agency',
  'business consulting',
  'professional services firm',
  'architecture',
  'design consulting',
  'commercial consulting',
  'custom software development',
  'law firm',
  'legal services',
  'engineering firm',
]

const SIMPLE_SERVICE = [
  'lawn care',
  'lawn service',
  'lawn services',
  'lawn mowing',
  'landscaping',
  'landscape maintenance',
  'plumbing',
  'plumber',
  'hvac',
  'heating and cooling',
  'air conditioning',
  'electrical',
  'electrician',
  'handyman',
  'pressure washing',
  'power washing',
  'house cleaning',
  'cleaning service',
  'pest control',
  'pool service',
  'appliance repair',
  'home services',
  'field service',
  'garage door service',
  'tree service',
  'roofing',
]

const SALES_AND_SERVICES = [
  'dedicated sales',
  'quote driven services',
  'quote driven sales',
  'high ticket sales',
  'sales and installation',
  'contract based sales',
]

const AMBIGUOUS = new Set([
  'construction',
  'manufacturing',
  'technology',
  'healthcare',
  'real estate',
  'professional services',
  'other',
])

export function normalizeIndustry(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[.,/#!$%^*;:{}=_`~()[\]-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesIndustry(normalized: string, phrases: string[]) {
  return phrases.some((phrase) => {
    if (normalized === phrase) return true
    return normalized.includes(phrase)
  })
}

export function getIndustryLayoutHint(
  industry?: string | null,
): IndustryLayoutHint {
  const normalized = normalizeIndustry(industry ?? '')
  if (!normalized || AMBIGUOUS.has(normalized)) return null

  if (matchesIndustry(normalized, PRODUCT_COMMERCE)) {
    return {
      model: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      confidence: 'HIGH',
      label: 'Product & Commerce',
      reason: `Recommended for ${industry?.trim() || 'this industry'}`,
    }
  }

  if (matchesIndustry(normalized, CONSULTATIVE_SALES)) {
    return {
      model: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      confidence: 'HIGH',
      label: 'Consultative Sales',
      reason: `Recommended for ${industry?.trim() || 'this industry'}`,
    }
  }

  if (matchesIndustry(normalized, SIMPLE_SERVICE)) {
    return {
      model: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      confidence: 'HIGH',
      label: 'Service Business',
      reason: `Recommended for ${industry?.trim() || 'this industry'}`,
    }
  }

  if (matchesIndustry(normalized, SALES_AND_SERVICES)) {
    return {
      model: WorkspaceBusinessModel.DIRECT_SALES,
      confidence: 'MEDIUM',
      label: 'Sales & Services',
      reason: `May fit ${industry?.trim() || 'this industry'}`,
    }
  }

  return null
}

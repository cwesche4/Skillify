import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

export type BusinessModelQuestionnaireAnswers = {
  prePurchaseContact: 'USUALLY' | 'SOMETIMES' | 'RARELY'
  consultativeProcess: 'OFTEN' | 'SOMETIMES' | 'RARELY'
  customProposalOrNegotiation: 'OFTEN' | 'SOMETIMES' | 'RARELY'
  directPurchaseFlow: 'USUALLY' | 'SOMETIMES' | 'RARELY'
  commerceOperations: 'PRIMARY' | 'PARTIAL' | 'NO'
}

export type BusinessModelRecommendation = {
  model:
    | typeof WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
    | typeof WorkspaceBusinessModel.CONSULTATIVE_SALES
    | typeof WorkspaceBusinessModel.DIRECT_SALES
    | typeof WorkspaceBusinessModel.PRODUCT_COMMERCE
  confidence: 'HIGH' | 'MEDIUM'
  reasons: string[]
}

export type BusinessModelRecommendationInput = {
  answers: BusinessModelQuestionnaireAnswers
  businessName?: string
  industry?: string
}

type ScoredModel = BusinessModelRecommendation['model']

const TIE_BREAK_ORDER: ScoredModel[] = [
  WorkspaceBusinessModel.PRODUCT_COMMERCE,
  WorkspaceBusinessModel.CONSULTATIVE_SALES,
  WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
  WorkspaceBusinessModel.DIRECT_SALES,
]

function addScore(
  scores: Record<ScoredModel, number>,
  reasons: Record<ScoredModel, string[]>,
  model: ScoredModel,
  points: number,
  reason: string,
) {
  scores[model] += points
  if (points >= 4) {
    reasons[model].unshift(reason)
  } else {
    reasons[model].push(reason)
  }
}

export function recommendBusinessModel({
  answers,
}: BusinessModelRecommendationInput): BusinessModelRecommendation {
  const scores: Record<ScoredModel, number> = {
    [WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS]: 0,
    [WorkspaceBusinessModel.CONSULTATIVE_SALES]: 0,
    [WorkspaceBusinessModel.DIRECT_SALES]: 0,
    [WorkspaceBusinessModel.PRODUCT_COMMERCE]: 0,
  }
  const reasons: Record<ScoredModel, string[]> = {
    [WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS]: [],
    [WorkspaceBusinessModel.CONSULTATIVE_SALES]: [],
    [WorkspaceBusinessModel.DIRECT_SALES]: [],
    [WorkspaceBusinessModel.PRODUCT_COMMERCE]: [],
  }

  if (answers.commerceOperations === 'PRIMARY') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
      8,
      'Products, orders, fulfillment, or repeat purchasing are a primary part of the business.',
    )
  } else if (answers.commerceOperations === 'PARTIAL') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
      2,
      'Products, orders, or fulfillment are part of the business model.',
    )
  } else {
    scores[WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS] += 1
  }

  if (answers.prePurchaseContact === 'USUALLY') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      2,
      'Customers usually start as inquiries before becoming customers.',
    )
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      2,
      'Customers usually contact the business before buying.',
    )
  } else if (answers.prePurchaseContact === 'RARELY') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
      1,
      'Customers rarely need direct contact before purchasing.',
    )
  }

  if (answers.consultativeProcess === 'OFTEN') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      4,
      'Discovery, consultations, site visits, or scoping are common.',
    )
  } else if (answers.consultativeProcess === 'SOMETIMES') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      1,
      'Some sales involve discovery, consultation, or scoping.',
    )
  } else {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      2,
      'Most work does not require a separate consultative sales process.',
    )
  }

  if (answers.customProposalOrNegotiation === 'OFTEN') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      4,
      'Custom proposals, scopes, estimates, or negotiation are prominent.',
    )
  } else if (answers.customProposalOrNegotiation === 'SOMETIMES') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      1,
      'Some deals involve custom estimates, proposals, or negotiation.',
    )
  } else {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      2,
      'Pricing and terms are usually straightforward.',
    )
  }

  if (answers.directPurchaseFlow === 'USUALLY') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      1,
      'Customers can usually move directly from inquiry to customer.',
    )
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.DIRECT_SALES,
      2,
      'Customers can usually move directly from inquiry to quote, booking, or purchase.',
    )
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.PRODUCT_COMMERCE,
      1,
      'A direct purchase flow can also support commerce operations.',
    )
  } else if (answers.directPurchaseFlow === 'SOMETIMES') {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.DIRECT_SALES,
      1,
      'Some customers can move directly into a quote, booking, or purchase.',
    )
  } else {
    addScore(
      scores,
      reasons,
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
      2,
      'Customers usually need a separate opportunity stage before purchase.',
    )
  }

  // Ties resolve in a fixed order: Product Commerce, then Consultative Sales,
  // then Simple Service, then Direct Sales. This prefers explicit operating-model
  // signals over the more general direct-sales default and keeps recommendations
  // deterministic.
  const sorted = TIE_BREAK_ORDER.slice().sort((a, b) => scores[b] - scores[a])
  const model = sorted[0]
  const runnerUp = sorted[1]
  const margin = scores[model] - scores[runnerUp]
  const confidence = margin >= 3 || scores[model] >= 7 ? 'HIGH' : 'MEDIUM'

  return {
    model,
    confidence,
    reasons: reasons[model].slice(0, 3),
  }
}

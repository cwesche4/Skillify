import { describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  recommendBusinessModel,
  type BusinessModelQuestionnaireAnswers,
} from '@/lib/workspaces/recommendBusinessModel'

const directAnswers: BusinessModelQuestionnaireAnswers = {
  prePurchaseContact: 'SOMETIMES',
  consultativeProcess: 'RARELY',
  customProposalOrNegotiation: 'RARELY',
  directPurchaseFlow: 'USUALLY',
  commerceOperations: 'NO',
}

describe('recommendBusinessModel', () => {
  it('recommends Product and Commerce for strong commerce signals', () => {
    const recommendation = recommendBusinessModel({
      answers: {
        prePurchaseContact: 'RARELY',
        consultativeProcess: 'RARELY',
        customProposalOrNegotiation: 'RARELY',
        directPurchaseFlow: 'USUALLY',
        commerceOperations: 'PRIMARY',
      },
    })

    expect(recommendation.model).toBe(WorkspaceBusinessModel.PRODUCT_COMMERCE)
    expect(recommendation.confidence).toBe('HIGH')
    expect(recommendation.reasons.join(' ')).toMatch(/product|orders|commerce/i)
  })

  it('recommends Consultative Sales for discovery and proposal signals', () => {
    const recommendation = recommendBusinessModel({
      answers: {
        prePurchaseContact: 'USUALLY',
        consultativeProcess: 'OFTEN',
        customProposalOrNegotiation: 'OFTEN',
        directPurchaseFlow: 'RARELY',
        commerceOperations: 'NO',
      },
    })

    expect(recommendation.model).toBe(WorkspaceBusinessModel.CONSULTATIVE_SALES)
    expect(recommendation.confidence).toBe('HIGH')
    expect(recommendation.reasons.join(' ')).toMatch(/discovery|proposal/i)
  })

  it('recommends Simple Service Business for direct inquiry-to-customer answers', () => {
    const recommendation = recommendBusinessModel({ answers: directAnswers })

    expect(recommendation.model).toBe(
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    )
    expect(recommendation.reasons.join(' ')).toMatch(
      /inquiries|customer|straightforward/i,
    )
  })

  it('resolves mixed answers predictably', () => {
    const recommendation = recommendBusinessModel({
      answers: {
        prePurchaseContact: 'USUALLY',
        consultativeProcess: 'SOMETIMES',
        customProposalOrNegotiation: 'SOMETIMES',
        directPurchaseFlow: 'USUALLY',
        commerceOperations: 'PARTIAL',
      },
    })

    expect(recommendation.model).toBe(WorkspaceBusinessModel.CONSULTATIVE_SALES)
    expect(recommendation.confidence).toBe('MEDIUM')
  })

  it('uses the documented fallback order for ties', () => {
    const recommendation = recommendBusinessModel({
      answers: {
        prePurchaseContact: 'RARELY',
        consultativeProcess: 'RARELY',
        customProposalOrNegotiation: 'SOMETIMES',
        directPurchaseFlow: 'SOMETIMES',
        commerceOperations: 'PARTIAL',
      },
    })

    expect(recommendation.model).toBe(WorkspaceBusinessModel.PRODUCT_COMMERCE)
  })

  it('returns reasons that correspond to the winning answer signals', () => {
    const recommendation = recommendBusinessModel({ answers: directAnswers })

    expect(recommendation.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/customer/i),
        expect.stringMatching(/straightforward/i),
      ]),
    )
  })

  it('is deterministic for the same input', () => {
    const first = recommendBusinessModel({ answers: directAnswers })
    const second = recommendBusinessModel({ answers: directAnswers })

    expect(second).toEqual(first)
  })
})

import type {
  AIPlaygroundContextReference,
  AIPlaygroundDomainId,
  AIPlaygroundIntent,
} from '@/lib/ai/playground/aiPlayground'

export type AIPlaygroundConversationRole = 'user' | 'assistant'

export type AIPlaygroundConversationTurn = {
  id: string
  role: AIPlaygroundConversationRole
  domain: AIPlaygroundDomainId
  intent: AIPlaygroundIntent
  prompt: string
  createdAt: string
  responseSummary?: string
  referenceIds?: string[]
  proposedActionIds?: string[]
  warningSummaries?: string[]
}

export type AIPlaygroundConversationContext = {
  currentTurnId?: string
  priorTurns: AIPlaygroundConversationTurn[]
  selectedContext: AIPlaygroundContextReference[]
}

export const AI_PLAYGROUND_CONVERSATION_TURN_LIMIT = 8

export function buildAIPlaygroundConversationContext({
  currentTurnId,
  priorTurns,
  selectedContext,
}: AIPlaygroundConversationContext): AIPlaygroundConversationContext {
  return {
    currentTurnId,
    priorTurns: priorTurns
      .filter((turn) => turn.prompt.trim().length > 0)
      .slice(-AI_PLAYGROUND_CONVERSATION_TURN_LIMIT),
    selectedContext,
  }
}

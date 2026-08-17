import {
  aiEmbeddingProviderRegistry,
  type AIEmbeddingProviderRegistry,
} from '@/lib/ai/providers/aiProviderLayer'

export type SemanticSearchItem = {
  label?: string
}

export type SemanticSearchOptions = {
  embeddingProviders?: AIEmbeddingProviderRegistry
  providerId?: string
}

export async function semanticSearch<TItem extends SemanticSearchItem>(
  query: string,
  items: TItem[],
  {
    embeddingProviders = aiEmbeddingProviderRegistry,
    providerId,
  }: SemanticSearchOptions = {},
): Promise<Array<TItem & { score?: number }>> {
  if (!query.trim()) return items

  const provider = embeddingProviders.get(providerId)
  if (!provider) return items

  const labels = items.map((item) => item.label ?? '')
  const embedding = await provider.embed({
    id: 'semantic-search-query',
    input: [query],
  })
  const itemEmbeddings = await provider.embed({
    id: 'semantic-search-items',
    input: labels,
  })
  const queryVector = embedding.embeddings[0] ?? []

  return items
    .map((item, index) => ({
      ...item,
      score: cosineSimilarity(
        queryVector,
        itemEmbeddings.embeddings[index] ?? [],
      ),
    }))
    .sort((first, second) => (second.score ?? 0) - (first.score ?? 0))
}

export function cosineSimilarity(first: number[], second: number[]) {
  const length = Math.min(first.length, second.length)
  if (length === 0) return 0

  let dot = 0
  let firstMagnitude = 0
  let secondMagnitude = 0
  for (let index = 0; index < length; index += 1) {
    const firstValue = first[index] ?? 0
    const secondValue = second[index] ?? 0
    dot += firstValue * secondValue
    firstMagnitude += firstValue ** 2
    secondMagnitude += secondValue ** 2
  }

  if (firstMagnitude === 0 || secondMagnitude === 0) return 0
  return dot / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude))
}

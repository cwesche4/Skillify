// lib/ai/search.ts
import OpenAI from 'openai'

// If no API key is configured, fall back to returning items unchanged.
const openAiApiKey = process.env.OPENAI_API_KEY
const client = openAiApiKey
  ? new OpenAI({ apiKey: openAiApiKey })
  : null

export async function semanticSearch(query: string, items: any[]) {
  if (!query.trim()) return items
  if (!client) return items

  // 1. Embed the query
  const embedding = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })

  const queryVector = embedding.data[0].embedding

  // 2. Embed each item label
  const itemEmbeddings = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: items.map((item) => item.label),
  })

  // 3. Calculate cosine similarity
  const scored = items.map((item, i) => {
    const vec = itemEmbeddings.data[i].embedding

    let score = 0
    for (let j = 0; j < vec.length; j++) {
      score += vec[j] * queryVector[j]
    }

    return { ...item, score }
  })

  // 4. Rank by semantic similarity
  return scored.sort((a, b) => b.score - a.score)
}

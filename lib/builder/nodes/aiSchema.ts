export type AiOutputField = {
  name: string
  label: string
  description?: string
}

export type AiNodeConfig = {
  prompt: string
  inputs: { from: string; to: string }[]
  outputs: AiOutputField[]
}

// AI node ergonomics.
// Explicit inputs and outputs only.
// No inference, autonomy, or prediction.
export function buildDefaultAiConfig(): AiNodeConfig {
  return {
    prompt: '',
    inputs: [],
    outputs: [],
  }
}

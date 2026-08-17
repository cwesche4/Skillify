// ---------------------------------------------------------------
// FILE: lib/builder/types.ts
// ---------------------------------------------------------------

export type { Node } from 'reactflow'

export type BuilderNodeType =
  | 'trigger'
  | 'delay'
  | 'webhook'
  | 'ai-llm'
  | 'ai-classifier'
  | 'ai-decision'
  | 'ai-transform'
  | 'ai-splitter'
  | 'group'
  | 'or-path'

export interface PaletteItem {
  id: string
  type: BuilderNodeType
  label: string
  description: string
}

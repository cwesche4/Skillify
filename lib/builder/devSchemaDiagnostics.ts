'use client'

import type { Node } from 'reactflow'

import { getNodeSchema, UnknownNodeSchema } from './node-schemas'
import type { BuilderNodeType, NodeData } from './node-types'

export function getMissingNodeSchemas(nodes: Node<NodeData>[]) {
  const missingSchemas = new Set<string>()
  nodes.forEach((n) => {
    const schema = getNodeSchema(n.type as BuilderNodeType)
    if (schema === UnknownNodeSchema) {
      missingSchemas.add(n.type as string)
    }
  })
  return Array.from(missingSchemas)
}

export function formatSchemaStub(type: string) {
  return `// Stub schema for ${type}
export const ${type.replace(/[-]/g, '_')}Schema = z.object({
  label: z.string().trim().default('${type}'),
  // description?: z.string(),
  // config?: z.record(z.any()).default({}),
})

export const ${type.replace(/[-]/g, '_')}Definition = {
  type: '${type}',
  label: '${type}',
  category: 'Experimental',
  description: 'Describe this node',
  defaultData: {},
}`
}

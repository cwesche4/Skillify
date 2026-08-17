export type WorkflowVariableToken =
  | {
      kind: 'node'
      nodeId: string
      path: string
      raw: string
    }
  | {
      kind: 'workspace'
      path: string
      raw: string
    }
  | {
      kind: 'legacy'
      path: string
      raw: string
    }

export const VARIABLE_TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g

export function buildNodeVariableToken(nodeId: string, outputPath: string) {
  return `{{nodes.${nodeId}.${outputPath}}}`
}

export function buildWorkspaceVariableToken(path: string) {
  return `{{workspace.${path}}}`
}

export function parseVariableToken(raw: string): WorkflowVariableToken | null {
  const match = raw.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)
  if (!match) return null
  const key = match[1].trim()
  const lowerKey = key.toLowerCase()
  if (lowerKey.startsWith('nodes.')) {
    const [, nodeId, ...pathParts] = key.split('.')
    if (!nodeId || !pathParts.length) return null
    return {
      kind: 'node',
      nodeId,
      path: pathParts.join('.'),
      raw,
    }
  }
  if (lowerKey.startsWith('workspace.')) {
    return {
      kind: 'workspace',
      path: key.slice(key.indexOf('.') + 1),
      raw,
    }
  }
  return {
    kind: 'legacy',
    path: key,
    raw,
  }
}

const CANONICAL_NAMESPACE_ALIASES = new Set([
  'client',
  'customer',
  'lead',
  'contact',
  'workspace',
  'owner',
  'automation',
  'task',
  'opportunity',
  'serviceRequest',
  'service_request',
])

function canonicalizeTokenKey(key: string) {
  const parts = key.trim().split('.')
  if (!parts.length) return key
  const namespace = parts[0]
  const lowerNamespace = namespace.toLowerCase()
  const canonicalPathPart = (part: string) => {
    const lower = part.toLowerCase()
    const common: Record<string, string> = {
      email: 'email',
      phone: 'phone',
      name: 'name',
      id: 'id',
      status: 'status',
      fullName: 'fullName',
      fullname: 'fullName',
      firstName: 'firstName',
      firstname: 'firstName',
      lastName: 'lastName',
      lastname: 'lastName',
      supportEmail: 'supportEmail',
      supportemail: 'supportEmail',
      currentTime: 'currentTime',
      currenttime: 'currentTime',
      lead: 'lead',
      client: 'client',
      customer: 'client',
      workspace: 'workspace',
      owner: 'owner',
      automation: 'automation',
      task: 'task',
      message: 'message',
      recipient: 'recipient',
      record: 'record',
    }
    return common[part] ?? common[lower] ?? part
  }

  if (lowerNamespace === 'nodes') {
    if (parts.length < 3) return key
    return ['nodes', parts[1], ...parts.slice(2).map(canonicalPathPart)].join(
      '.',
    )
  }

  const matchedNamespace = Array.from(CANONICAL_NAMESPACE_ALIASES).find(
    (candidate) => candidate.toLowerCase() === lowerNamespace,
  )
  if (!matchedNamespace) return key

  const canonicalNamespace =
    matchedNamespace === 'customer' ? 'client' : matchedNamespace
  return [canonicalNamespace, ...parts.slice(1).map(canonicalPathPart)].join(
    '.',
  )
}

export function canonicalizeVariableTokens(value: string) {
  return value.replace(VARIABLE_TOKEN_PATTERN, (raw) => {
    const match = raw.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)
    if (!match) return raw
    const canonical = canonicalizeTokenKey(match[1])
    return canonical === match[1].trim() ? raw : `{{${canonical}}}`
  })
}

export function findVariableTokens(value: unknown): WorkflowVariableToken[] {
  if (typeof value !== 'string') return []
  return Array.from(value.matchAll(VARIABLE_TOKEN_PATTERN))
    .map((match) => parseVariableToken(match[0]))
    .filter((token): token is WorkflowVariableToken => Boolean(token))
}

export function replaceNodeIdsInVariableTokens(
  value: unknown,
  idMap: Map<string, string>,
): unknown {
  if (typeof value !== 'string') return value
  return value.replace(VARIABLE_TOKEN_PATTERN, (raw) => {
    const token = parseVariableToken(raw)
    if (token?.kind !== 'node') return raw
    const nextId = idMap.get(token.nodeId)
    return nextId ? buildNodeVariableToken(nextId, token.path) : raw
  })
}

export function replaceNodeIdsInConfigValue(
  value: unknown,
  idMap: Map<string, string>,
): unknown {
  if (typeof value === 'string')
    return replaceNodeIdsInVariableTokens(value, idMap)
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return replaceNodeIdsInConfigValue(item, idMap)
      }
      return replaceNodeIdsInVariableTokens(item, idMap)
    })
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        replaceNodeIdsInConfigValue(item, idMap),
      ]),
    )
  }
  return value
}

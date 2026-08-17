import { describe, expect, it } from 'vitest'

import { insertTextAtCursor } from '@/lib/workflows/textInsertion'
import { canonicalizeVariableTokens } from '@/lib/workflows/variableTokens'

describe('workflow variable token UX helpers', () => {
  it('canonicalizes recognized mixed-case aliases without changing ordinary text', () => {
    expect(
      canonicalizeVariableTokens(
        'Email {{Client.name}} using {{Lead.Email}} from {{Workspace.SupportEmail}}.',
      ),
    ).toBe(
      'Email {{client.name}} using {{lead.email}} from {{workspace.supportEmail}}.',
    )
  })

  it('canonicalizes canonical node token namespace and common output paths', () => {
    expect(canonicalizeVariableTokens('{{Nodes.node-1.Lead.Email}}')).toBe(
      '{{nodes.node-1.lead.email}}',
    )
  })

  it('preserves unknown tokens so validation can report them', () => {
    expect(canonicalizeVariableTokens('Hello {{Mystery.Value}}')).toBe(
      'Hello {{Mystery.Value}}',
    )
  })

  it('inserts inline workflow data at the cursor without replacing surrounding text', () => {
    expect(
      insertTextAtCursor({
        value: 'Follow up with today',
        insert: '{{client.name}}',
        selectionStart: 15,
        selectionEnd: 15,
      }),
    ).toEqual({
      value: 'Follow up with {{client.name}} today',
      cursor: 31,
    })
  })
})

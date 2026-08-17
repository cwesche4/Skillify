module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow TemplateCategory usage in server-side logic',
    },
    messages: {
      forbidden:
        'TemplateCategory is UI-only and must not be used in server or execution logic.',
    },
  },
  create(context) {
    const filename = context.getFilename()
    const isServerFile =
      filename.includes('/api/') ||
      filename.includes('/lib/') ||
      filename.includes('/server/')

    if (!isServerFile) return {}

    return {
      Identifier(node) {
        if (node.name === 'TemplateCategory') {
          context.report({ node, messageId: 'forbidden' })
        }
      },
    }
  },
}

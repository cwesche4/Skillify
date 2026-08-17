const needsEscape = /[",\n]/

function escapeCell(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (!needsEscape.test(str)) return str
  return `"${str.replace(/"/g, '""')}"`
}

export function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const headerLine = headers.join(',')
  const body = rows
    .map((row) => headers.map((h) => escapeCell(row[h])).join(','))
    .join('\n')
  return [headerLine, body].filter(Boolean).join('\n')
}

export function appendCsvFooter(
  csv: string,
  meta: { generatedAt: string; workspaceId: string; exportedBy: string },
) {
  const footer = [
    `# GeneratedAt: ${meta.generatedAt}`,
    `# WorkspaceId: ${meta.workspaceId}`,
    `# ExportedBy: ${meta.exportedBy}`,
  ].join('\n')

  return [csv, footer].filter(Boolean).join('\n')
}

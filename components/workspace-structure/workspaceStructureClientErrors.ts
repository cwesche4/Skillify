export type WorkspaceStructureApiError = {
  ok?: boolean
  code?: string
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export function getWorkspaceStructureErrorMessage({
  data,
  fallback,
}: {
  data: WorkspaceStructureApiError
  fallback: string
}) {
  if (data.message) return data.message
  if (data.error) return data.error
  switch (data.code) {
    case 'WORKSPACE_STRUCTURE_SCHEMA_NOT_READY':
      return 'Workspace Teams and Locations are not ready because the latest database migration has not been applied.'
    case 'DATABASE_UNAVAILABLE':
      return 'Skillify could not connect to the workspace database.'
    case 'FORBIDDEN':
      return 'You do not have permission to manage workspace structure.'
    default:
      return fallback
  }
}

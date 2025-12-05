export function canManageWorkspace(role: string) {
  return role === "OWNER" || role === "ADMIN"
}

export function isOwner(role: string) {
  return role === "OWNER"
}

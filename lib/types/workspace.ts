export interface WorkspaceWithMembers {
  id: string
  name: string
  createdAt: Date
  members: {
    id: string
    userId: string
    role: 'OWNER' | 'ADMIN' | 'MEMBER'
  }[]
}

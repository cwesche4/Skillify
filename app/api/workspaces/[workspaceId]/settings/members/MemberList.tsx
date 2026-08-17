type Member = {
  id: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
  user: {
    fullName: string | null
    email: string | null
  }
}

export default function MemberList({ members }: { members: Member[] }) {
  // This list is intentionally empty in this context; UI handled elsewhere.
  void members
  return null
}

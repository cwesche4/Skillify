import { DELETE as removeWorkspaceMember } from '../route'

export async function POST(req: Request, { params }: any) {
  const body = await req.json().catch(() => ({}))
  const url = new URL(req.url)
  const memberId = (body as { memberId?: unknown }).memberId
  if (typeof memberId === 'string') url.searchParams.set('memberId', memberId)
  const response = await removeWorkspaceMember(
    new Request(url, { method: 'DELETE' }),
    {
      params: { workspaceId: params.workspaceId },
    },
  )
  if (!response.ok) return response
  return Response.json({ success: true, data: { removed: true } })
}

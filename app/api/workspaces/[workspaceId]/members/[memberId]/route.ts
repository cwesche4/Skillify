import { DELETE as removeWorkspaceMember } from '../route'

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string; memberId: string } },
) {
  const url = new URL(req.url)
  url.searchParams.set('memberId', params.memberId)
  const response = await removeWorkspaceMember(
    new Request(url, { method: 'DELETE', headers: req.headers }),
    {
      params: { workspaceId: params.workspaceId },
    },
  )
  if (!response.ok) return response
  return Response.json({ success: true })
}

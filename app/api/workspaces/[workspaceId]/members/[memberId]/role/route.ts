import { PATCH as updateWorkspaceMemberRole } from '../../route'

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string; memberId: string } },
) {
  const body = await req.json().catch(() => ({}))
  const response = await updateWorkspaceMemberRole(
    new Request(req.url, {
      method: 'PATCH',
      headers: req.headers,
      body: JSON.stringify({
        memberId: params.memberId,
        role: (body as { role?: unknown }).role,
      }),
    }),
    { params: { workspaceId: params.workspaceId } },
  )
  if (!response.ok) return response
  return Response.json({ success: true })
}

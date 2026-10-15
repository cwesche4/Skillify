import { PATCH as updateWorkspaceMemberRole } from '../route'

export async function POST(req: Request, { params }: any) {
  const body = await req.json().catch(() => ({}))
  const response = await updateWorkspaceMemberRole(
    new Request(req.url, {
      method: 'PATCH',
      headers: req.headers,
      body: JSON.stringify(body),
    }),
    { params: { workspaceId: params.workspaceId } },
  )
  if (!response.ok) return response
  const payload = (await response.json()) as { member?: unknown }
  return Response.json({ success: true, data: payload.member ?? null })
}

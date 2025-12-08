// lib/api/responses.ts
export function ok(data: any = null) {
  return Response.json({ success: true, data })
}

export function fail(message: string, status: number = 400) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function unauthorized(message = 'Unauthorized.') {
  return fail(message, 401)
}

export function forbidden(message = 'Forbidden.') {
  return fail(message, 403)
}

export function notFound(message = 'Not found.') {
  return fail(message, 404)
}

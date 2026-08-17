'use server'

import { NextResponse } from 'next/server'
import type {
  CollaborationSession,
  Collaborator,
  PresenceCursor,
} from '@/lib/collaboration/types'

/*
  In-memory presence store (per workspace+automation).
  DESIGN: polling-first, read-only overlay; no persistence, no websockets.
*/
const store = new Map<string, CollaborationSession>()

const TTL_MS = 30_000 // expire cursors not updated within 30s

function key(workspaceId: string, automationId: string) {
  return `${workspaceId}:${automationId}`
}

function prune(session: CollaborationSession) {
  const now = Date.now()
  session.cursors = session.cursors.filter((c) => now - c.updatedAt <= TTL_MS)
  session.collaborators = session.collaborators.map((c) => {
    const cursor = session.cursors.find((cur) => cur.userId === c.userId)
    if (!cursor) return { ...c, lastSeenAt: now }
    return { ...c, lastSeenAt: cursor.updatedAt }
  })
}

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const { workspaceId, automationId } = params
  if (!workspaceId || !automationId) {
    return NextResponse.json(
      { error: 'workspaceId and automationId required' },
      { status: 400 },
    )
  }

  const k = key(workspaceId, automationId)
  const session = store.get(k) ?? {
    automationId,
    workspaceId,
    collaborators: [],
    cursors: [],
    locks: [],
  }
  prune(session)
  store.set(k, session)

  return NextResponse.json({ session })
}

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string; automationId: string } },
) {
  const { workspaceId, automationId } = params
  if (!workspaceId || !automationId) {
    return NextResponse.json(
      { error: 'workspaceId and automationId required' },
      { status: 400 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const { userId, name, cursor } = body as {
    userId?: string
    name?: string
    cursor?: { x: number; y: number; viewport?: any }
    mode?: 'view' | 'edit'
  }

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const k = key(workspaceId, automationId)
  const session: CollaborationSession = store.get(k) ?? {
    automationId,
    workspaceId,
    collaborators: [],
    cursors: [],
    locks: [],
  }

  const now = Date.now()
  const collaborator: Collaborator = {
    userId,
    name: name || 'Guest',
    lastSeenAt: now,
  }

  // upsert collaborator
  const existingIdx = session.collaborators.findIndex(
    (c) => c.userId === userId,
  )
  if (existingIdx >= 0)
    session.collaborators[existingIdx] = {
      ...session.collaborators[existingIdx],
      ...collaborator,
    }
  else session.collaborators.push(collaborator)

  // upsert cursor
  if (cursor?.x !== undefined && cursor?.y !== undefined) {
    const c: PresenceCursor = {
      userId,
      x: Number(cursor.x) || 0,
      y: Number(cursor.y) || 0,
      viewport: cursor.viewport,
      updatedAt: now,
    }
    const existingCursorIdx = session.cursors.findIndex(
      (cur) => cur.userId === userId,
    )
    if (existingCursorIdx >= 0) session.cursors[existingCursorIdx] = c
    else session.cursors.push(c)
  }

  prune(session)
  store.set(k, session)
  return NextResponse.json({ ok: true })
}

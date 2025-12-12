// app/api/webhooks/clerk/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'

import { prisma } from '@/lib/db'

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const payload = await req.json()
  const h = headers()

  const svixHeaders = {
    'svix-id': h.get('svix-id') ?? '',
    'svix-timestamp': h.get('svix-timestamp') ?? '',
    'svix-signature': h.get('svix-signature') ?? '',
  }

  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: any
  try {
    evt = wh.verify(JSON.stringify(payload), svixHeaders)
  } catch (err) {
    console.error('❌ Clerk webhook signature failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = evt

  // ---------------------------------------------------------
  // USER CREATED → Create UserProfile + Default Workspace
  // ---------------------------------------------------------
  if (type === 'user.created') {
    const clerkId = data.id
    const email = data.email_addresses?.[0]?.email_address ?? 'unknown'
    const fullName =
      data.first_name || data.last_name
        ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
        : data.username ?? null

    // 1) Avoid duplicate creation on Clerk retries
    let user = await prisma.userProfile.findUnique({
      where: { clerkId },
    })

    if (!user) {
      user = await prisma.userProfile.create({
        data: {
          clerkId,
          role: 'user',
          fullName,
          email: email === 'unknown' ? null : email,
        },
      })
    } else if (!user.fullName || !user.email) {
      user = await prisma.userProfile.update({
        where: { clerkId },
        data: {
          fullName: user.fullName || fullName,
          email: user.email || (email === 'unknown' ? null : email),
        },
      })
    }

    // 2) Create default workspace if not created already
    const existingWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
    })

    if (!existingWorkspace) {
      const baseName = data.first_name
        ? `${data.first_name}'s Workspace`
        : 'My Workspace'

      const slugBase = slugify(baseName)
      const slug = `${slugBase}-${user.id.slice(0, 6)}`

      await prisma.workspace.create({
        data: {
          name: baseName,
          slug,
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      })
    }

    console.log(`✅ Workspace + UserProfile created for ${email}`)
  }

  // (Optional later: user.updated, user.deleted)

  return NextResponse.json({ ok: true })
}

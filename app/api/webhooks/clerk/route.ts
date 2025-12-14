// app/api/webhooks/clerk/route.ts

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/db'

// ----------------------------------------
// ENV CHECK
// ----------------------------------------
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET as string
if (!WEBHOOK_SECRET || WEBHOOK_SECRET.length === 0) {
  throw new Error('❌ Missing CLERK_WEBHOOK_SECRET in environment')
}

// ----------------------------------------
// HELPERS
// ----------------------------------------
function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function generateWorkspaceSlug(base: string) {
  const raw = slugify(base)
  let slug = raw
  let counter = 1

  // Ensure uniqueness
  while (true) {
    const exists = await prisma.workspace.findUnique({
      where: { slug },
    })
    if (!exists) return slug
    counter++
    slug = `${raw}-${counter}`
  }
}

// ----------------------------------------
// WEBHOOK HANDLER
// ----------------------------------------
export async function POST(req: Request) {
  const payload = await req.text()
  const h = headers()

  const svixHeaders = {
    'svix-id': h.get('svix-id') ?? '',
    'svix-timestamp': h.get('svix-timestamp') ?? '',
    'svix-signature': h.get('svix-signature') ?? '',
  }

  let event: any
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(payload, svixHeaders)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  // ---------------------------------------------------------
  // USER CREATED
  // ---------------------------------------------------------
  if (type === 'user.created') {
    const clerkId = data.id

    const email = data.email_addresses?.[0]?.email_address ?? null

    const fullName =
      data.first_name || data.last_name
        ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
        : (data.username ?? null)

    // 1️⃣ Create or update UserProfile safely
    let user = await prisma.userProfile.findUnique({
      where: { clerkId },
    })

    if (!user) {
      user = await prisma.userProfile.create({
        data: {
          clerkId,
          role: 'user',
          fullName: fullName || null,
          email,
        },
      })
    } else {
      // Only fill missing fields
      const updateData: any = {}
      if (!user.fullName && fullName) updateData.fullName = fullName
      if (!user.email && email) updateData.email = email

      if (Object.keys(updateData).length > 0) {
        user = await prisma.userProfile.update({
          where: { clerkId },
          data: updateData,
        })
      }
    }

    // 2️⃣ Ensure default workspace exists
    const existing = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
    })

    if (!existing) {
      const baseName = fullName ? `${fullName}'s Workspace` : 'My Workspace'
      const slug = await generateWorkspaceSlug(baseName)

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

    console.log(`✅ User + Workspace synced for ${email ?? clerkId}`)
  }

  // ---------------------------------------------------------
  // (Optional: handle 'user.updated' in future)
  // ---------------------------------------------------------

  return NextResponse.json({ success: true })
}

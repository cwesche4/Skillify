import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const { userId: clerkId } = auth()
  if (!clerkId) return Response.json({ isAdmin: false })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })

  return Response.json({
    isAdmin: profile?.role === 'admin',
  })
}

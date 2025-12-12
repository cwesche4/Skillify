// app/onboarding/create-workspace/page.tsx
import { redirect } from 'next/navigation'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export default async function CreateWorkspacePage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  // Ensure the user has a profile record; new sign-ins may not have one yet
  let profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })

  if (!profile) {
    const clerkUser = await clerkClient.users.getUser(userId)
    const fullName =
      clerkUser.fullName ||
      `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() ||
      null
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? null

    profile = await prisma.userProfile.create({
      data: { clerkId: userId, role: 'user', fullName, email },
    })
  }

  // If user already has a workspace, send them there
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: profile.id },
    include: { workspace: true },
  })

  if (membership?.workspace) {
    redirect(`/dashboard/${membership.workspace.slug}`)
  }

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Create your workspace</h1>
      <p className="text-neutral-text-secondary mb-6">
        Let’s set up your workspace to get started.
      </p>

      <form
        action="/api/workspaces/bootstrap"
        method="POST"
        className="space-y-4"
      >
        <button
          type="submit"
          className="rounded-lg bg-brand-primary px-6 py-3 font-medium text-white"
        >
          Create Workspace
        </button>
      </form>
    </div>
  )
}

// app/api/onboarding/progress/route.ts
import {
  getOnboardingStatusForUser,
  setOnboardingTaskCompletion,
  type OnboardingTaskId,
} from "@/lib/command-center/onboarding"
import { prisma } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

type PostBody = {
  taskId: OnboardingTaskId
  completed?: boolean
}

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ completedTasks: [] }, { status: 200 })
  }

  const userProfile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })

  if (!userProfile) {
    return NextResponse.json({ completedTasks: [] }, { status: 200 })
  }

  const status = await getOnboardingStatusForUser(userProfile.id)

  return NextResponse.json({
    completedTasks: status.completedTasks,
  })
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userProfile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })

  if (!userProfile) {
    return NextResponse.json({ error: "UserProfile missing" }, { status: 400 })
  }

  const body = (await req.json()) as PostBody
  const completed = body.completed ?? true

  const status = await setOnboardingTaskCompletion(userProfile.id, body.taskId, completed)

  return NextResponse.json({
    completedTasks: status.completedTasks,
  })
}

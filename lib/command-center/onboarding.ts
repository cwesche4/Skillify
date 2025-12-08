// lib/command-center/onboarding.ts
import { prisma } from '@/lib/db'

export type OnboardingTaskId =
  | 'automations'
  | 'analytics'
  | 'ai-coach'
  | 'invite'

export interface OnboardingStatus {
  completedTasks: OnboardingTaskId[]
  completed: boolean
}

export async function getOnboardingStatusForUser(
  userId: string,
): Promise<OnboardingStatus> {
  const existing = await prisma.onboardingProgress.findUnique({
    where: { userId },
  })

  if (!existing) {
    return { completedTasks: [], completed: false }
  }

  const steps = (existing.steps ?? []) as OnboardingTaskId[]
  return {
    completedTasks: steps,
    completed: existing.completed,
  }
}

export async function setOnboardingTaskCompletion(
  userId: string,
  taskId: OnboardingTaskId,
  done: boolean,
): Promise<OnboardingStatus> {
  const current = await getOnboardingStatusForUser(userId)

  const has = current.completedTasks.includes(taskId)
  let next = current.completedTasks

  if (done && !has) next = [...next, taskId]
  if (!done && has) next = next.filter((t) => t !== taskId)

  const completed = next.length >= 4

  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: {
      userId,
      steps: next,
      completed,
    },
    update: {
      steps: next,
      completed,
    },
  })

  return { completedTasks: next, completed }
}

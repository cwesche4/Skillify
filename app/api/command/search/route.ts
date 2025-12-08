// app/api/command/search/route.ts

import type { CommandItem } from '@/components/command-center/types'
import {
  COMMAND_ACTIONS,
  HELP_ARTICLES,
  searchAutomations,
  searchMembers,
  searchWorkspaces,
} from '@/lib/command-center/models' // ⬅️ FIXED PATH
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const query = q.toLowerCase()

  const items: CommandItem[] = []

  /* ============================================================
     PUBLIC MODE: Not logged in → Only show help articles
  ============================================================ */
  if (!clerkId) {
    HELP_ARTICLES.forEach((h) => {
      items.push({
        id: `help-${h.id}`,
        type: 'help',
        label: h.title,
        subtitle: h.tags.join(', '),
        group: 'Help',
        icon: 'help',
        meta: { id: h.id },
      })
    })

    return NextResponse.json({ items })
  }

  /* ============================================================
     AUTHENTICATED USER → Load User + Workspaces
  ============================================================ */
  const userProfile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: {
      memberships: {
        include: { workspace: true },
      },
      ownedWorkspaces: true,
    },
  })

  if (!userProfile) {
    return NextResponse.json({ items: [] })
  }

  const workspaces = [
    ...userProfile.ownedWorkspaces,
    ...userProfile.memberships.map((m) => m.workspace),
  ]

  const defaultWorkspace = workspaces[0] ?? null

  /* ============================================================
     WORKSPACE SEARCH
  ============================================================ */
  const wsResults = await searchWorkspaces(userProfile.id, query || '')

  wsResults.forEach((w) => {
    items.push({
      id: `workspace-${w.id}`,
      type: 'workspace',
      label: w.name,
      subtitle: `Workspace • ${w.slug}`,
      href: `/dashboard?workspace=${w.slug}`,
      group: 'Workspaces',
      icon: 'dashboard',
    })
  })

  /* ============================================================
     AUTOMATIONS + MEMBERS SEARCH (only if query exists)
  ============================================================ */
  if (defaultWorkspace && query) {
    const [autoResults, memberResults] = await Promise.all([
      searchAutomations(defaultWorkspace.id, query),
      searchMembers(defaultWorkspace.id, query),
    ])

    /* ---------- Automations ---------- */
    autoResults.forEach((a) => {
      items.push({
        id: `automation-${a.id}`,
        type: 'automation',
        label: a.name,
        subtitle: `Automation • ${a.status}`,
        href: `/dashboard/automations/${a.id}`,
        group: 'Automations',
        icon: 'automations',
      })
    })

    /* ---------- Members ---------- */
    memberResults.forEach((m) => {
      const user = m.user
      items.push({
        id: `member-${m.id}`,
        type: 'member',
        label: user.clerkId ?? 'Member',
        subtitle: `Member in ${defaultWorkspace.name}`,
        group: 'Members',
        icon: 'team',
      })
    })
  }

  /* ============================================================
     STATIC COMMAND ACTIONS (Create Automation, Open Analytics…)
  ============================================================ */
  COMMAND_ACTIONS.forEach((c) => {
    if (query && !`${c.label} ${c.route}`.toLowerCase().includes(query)) {
      return
    }

    items.push({
      id: `command-${c.id}`,
      type: 'command',
      label: c.label,
      subtitle: c.route,
      href: c.route,
      group: 'Commands',
      icon: 'settings',
      shortcut: c.id === 'open_analytics' ? '⌘ ⇧ A' : undefined,
    })
  })

  /* ============================================================
     HELP ARTICLES
  ============================================================ */
  HELP_ARTICLES.forEach((h) => {
    if (
      query &&
      !`${h.title} ${h.tags.join(' ')}`.toLowerCase().includes(query)
    ) {
      return
    }

    items.push({
      id: `help-${h.id}`,
      type: 'help',
      label: h.title,
      subtitle: h.tags.join(', '),
      group: 'Help',
      icon: 'help',
    })
  })

  /* ============================================================
     OPEN ONBOARDING
  ============================================================ */
  items.push({
    id: 'onboarding-open',
    type: 'onboarding',
    label: 'Open onboarding',
    subtitle: 'Review setup steps for your workspace',
    group: 'Onboarding',
    icon: 'help',
    meta: {
      action: 'open_onboarding',
    },
  })

  /* ============================================================
     RETURN RESULTS
  ============================================================ */
  return NextResponse.json({ items })
}

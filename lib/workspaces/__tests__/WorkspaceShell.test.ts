import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import WorkspaceShell from '@/app/dashboard/[workspaceSlug]/layout.client'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/acme/scheduling',
  useRouter: () => ({
    replace: navigationMocks.replace,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({
    isLoaded: true,
    user: {
      id: 'user-1',
      fullName: 'Corbin Wesche',
      username: 'corbin',
      imageUrl: '',
      primaryEmailAddress: { emailAddress: 'corbin@example.com' },
    },
  }),
}))

vi.mock('@/components/branding/BrandLogo', () => ({
  BrandLogo: ({ alt }: { alt: string }) =>
    React.createElement('span', { 'aria-label': alt }, alt),
}))

vi.mock('@/components/workspaces/WorkspaceSwitcher', () => ({
  default: () =>
    React.createElement('button', { type: 'button' }, 'Acme workspace'),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('WorkspaceShell sidebar', () => {
  const shellProps: React.ComponentProps<typeof WorkspaceShell> = {
    workspaceSlug: 'acme',
    workspaces: [
      {
        id: 'workspace-1',
        name: 'Acme',
        slug: 'acme',
        memberRole: 'OWNER',
      },
    ],
    currentWorkspace: {
      id: 'workspace-1',
      name: 'Acme',
      slug: 'acme',
      memberRole: 'OWNER',
    },
    capabilities: getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      commerceEnabled: true,
    }),
    role: 'owner',
    globalRole: 'user',
    plan: 'pro',
    children: React.createElement('main', null, 'Workspace content'),
  }

  it('keeps the full sidebar body as one connected scroll surface', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false })),
    )

    render(React.createElement(WorkspaceShell, shellProps))

    const sidebarScroller = screen.getByTestId('workspace-sidebar-body-scroll')
    const sidebarNavigation = screen.getByTestId('workspace-sidebar-navigation')
    const sidebarSupport = screen.getByTestId('workspace-sidebar-support')
    const sidebarFooter = screen.getByTestId('workspace-sidebar-footer')

    expect(sidebarScroller.className).toContain('overflow-y-auto')
    expect(sidebarScroller.className).toContain('overflow-x-hidden')
    expect(sidebarScroller.className).toContain('overscroll-contain')
    expect(sidebarScroller.className).toContain('sidebar-body-scroll')
    expect(sidebarScroller.className).toContain('w-full')
    expect(sidebarScroller.className).toContain('px-2')
    expect(sidebarScroller.className).toContain('pr-3')
    expect(sidebarScroller.className).toContain('[scrollbar-gutter:auto]')
    expect(sidebarScroller.className).toContain(
      '[scrollbar-color:transparent_transparent]',
    )
    expect(sidebarScroller.className).toContain('[scrollbar-width:none]')
    expect(sidebarScroller.className).toContain('[&::-webkit-scrollbar]:w-0')
    expect(sidebarScroller.className).toContain(
      '[&::-webkit-scrollbar-track]:bg-transparent',
    )
    expect(sidebarNavigation.className).toContain('w-full')
    expect(sidebarScroller.contains(sidebarNavigation)).toBe(true)
    expect(sidebarScroller.contains(sidebarSupport)).toBe(true)
    expect(sidebarScroller.contains(sidebarFooter)).toBe(true)
    expect(
      sidebarScroller.querySelector(
        '[data-testid="workspace-sidebar-nav-scroll"]',
      ),
    ).toBeNull()
    expect(sidebarNavigation.className).not.toContain('overflow-y-auto')
    expect(sidebarSupport.className).not.toContain('overflow-y-auto')
    expect(sidebarFooter.className).not.toContain('overflow-y-auto')

    const indicator = screen.getByTestId('workspace-sidebar-scroll-indicator')
    expect(indicator.className).toContain('right-1')
    expect(indicator.className).toContain('w-1')
    expect(indicator.className).toContain('opacity-0')
    expect(screen.queryByTestId('workspace-sidebar-scroll-thumb')).toBeNull()

    Object.defineProperty(sidebarScroller, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(sidebarScroller, 'scrollHeight', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(sidebarScroller, 'scrollTop', {
      configurable: true,
      value: 50,
    })

    fireEvent.scroll(sidebarScroller)

    expect(indicator.className).toContain('opacity-100')
    const thumb = screen.getByTestId('workspace-sidebar-scroll-thumb')
    expect(thumb.style.height).toBe('24px')
    expect(thumb.style.transform).toBe('translateY(10px)')
    expect(thumb.className).toContain('bg-[color:var(--text-muted)]/40')
    expect(thumb.className).toContain('rounded-full')
    expect(
      screen.getByRole('link', { name: 'Help & Docs' }).className,
    ).toContain('rounded-xl')
    expect(screen.getByRole('link', { name: 'Help & Docs' })).toBeTruthy()
    expect(screen.getByText('Powered by Skillify')).toBeTruthy()
  })

  it('shows collapsed sidebar tooltips quickly without native title delays', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T12:00:00-04:00'))
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false })),
    )

    render(React.createElement(WorkspaceShell, shellProps))

    fireEvent.click(screen.getByTitle('Collapse sidebar'))

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboardLink.getAttribute('title')).toBeNull()

    const dashboardTooltipTarget = dashboardLink.parentElement
    expect(dashboardTooltipTarget).not.toBeNull()

    fireEvent.mouseEnter(dashboardTooltipTarget as HTMLElement)
    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('Dashboard')

    fireEvent.mouseLeave(dashboardTooltipTarget as HTMLElement)
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('Dashboard')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    const customersLink = screen.getByRole('link', { name: 'Customers' })
    const customersTooltipTarget = customersLink.parentElement
    expect(customersTooltipTarget).not.toBeNull()

    fireEvent.mouseEnter(customersTooltipTarget as HTMLElement)
    act(() => {
      vi.advanceTimersByTime(99)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('Customers')

    fireEvent.mouseLeave(customersTooltipTarget as HTMLElement)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(dashboardLink)
    expect(screen.getByRole('tooltip').textContent).toBe('Dashboard')
  })

  it('separates collapsed groups with dividers and keeps utilities at the bottom', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false })),
    )

    render(React.createElement(WorkspaceShell, shellProps))

    fireEvent.click(screen.getByTitle('Collapse sidebar'))

    const collapsedLayout = screen.getByTestId(
      'workspace-sidebar-collapsed-layout',
    )
    const primaryScrollWrap = screen.getByTestId(
      'workspace-sidebar-primary-scroll-wrap',
    )
    const primaryScroll = screen.getByTestId('workspace-sidebar-primary-scroll')
    const bottomUtility = screen.getByTestId('workspace-sidebar-bottom-utility')
    const sidebarNavigation = screen.getByTestId('workspace-sidebar-navigation')
    const sidebarSupport = screen.getByTestId('workspace-sidebar-support')
    const footerMark = screen.getByTestId('workspace-sidebar-footer-mark')
    const helpLink = screen.getByRole('link', { name: 'Help & Docs' })

    expect(collapsedLayout.className).toContain('flex-col')
    expect(primaryScrollWrap.className).toContain('flex-1')
    expect(primaryScroll.className).toContain('overflow-y-auto')
    expect(primaryScroll.contains(sidebarNavigation)).toBe(true)
    expect(primaryScroll.contains(sidebarSupport)).toBe(false)
    expect(bottomUtility.contains(sidebarSupport)).toBe(true)
    expect(bottomUtility.contains(helpLink)).toBe(true)
    expect(bottomUtility.contains(footerMark)).toBe(true)
    expect(sidebarSupport.className).toContain('border-t')
    expect(sidebarSupport.className).toContain('pb-4')

    const navGroups = screen.getAllByTestId('workspace-sidebar-nav-group')
    expect(navGroups.length).toBeGreaterThan(1)
    expect(navGroups[0].className).not.toContain('border-t')
    expect(navGroups[1].className).toContain('mt-2')
    expect(navGroups[1].className).toContain('border-t')
    expect(navGroups[1].className).toContain('pt-2')
    expect(within(sidebarNavigation).queryAllByRole('button')).toHaveLength(0)

    expect(footerMark.getAttribute('aria-hidden')).toBe('true')
    expect(footerMark.getAttribute('tabindex')).toBeNull()
    expect(footerMark.closest('a,button')).toBeNull()
    expect(
      helpLink.compareDocumentPosition(footerMark) &
        window.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

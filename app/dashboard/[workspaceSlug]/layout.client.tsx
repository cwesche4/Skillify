'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { SkillifyUserMenu } from '@/components/auth/SkillifyUserMenu'
import { Notifications } from '@/components/ui/Notifications'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { WorkspaceSetup } from '@/components/workspaces/WorkspaceSetup'
import WorkspaceSwitcher from '@/components/workspaces/WorkspaceSwitcher'
import {
  canAccessSalesPipeline,
  canAccessServiceRequests,
} from '@/lib/permissions/workspace'
import {
  LayoutDashboard,
  Workflow,
  History,
  Layers,
  BarChart3,
  FileBarChart,
  BriefcaseBusiness,
  Box,
  ListChecks,
  Users,
  Bot,
  Settings,
  HelpCircle,
  ChevronDown,
  PanelLeft,
  UserPlus,
  BadgeDollarSign,
  KanbanSquare,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  ShoppingCart,
  CalendarDays,
} from 'lucide-react'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import {
  buildWorkspaceNavigation,
  type WorkspaceNavigationGroup,
} from '@/lib/workspaces/workspaceNavigation'
import { canManageWorkspace } from '@/lib/workspaces/workspaceRoles'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { schedulingSettingsChangedEvent } from '@/lib/scheduling/settingsEvents'
import type { WorkspaceSchedulingSettings } from '@/lib/scheduling/types'
import type { LeadIntakeSourceCard } from '@/lib/integrations/leadIntake'

type WorkspaceLite = {
  id: string
  name: string
  slug: string
  businessName?: string | null
  industry?: string | null
  memberRole?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
  plan?: string
}
type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member'
type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  roles?: WorkspaceRole[]
}
type NavGroup = {
  section: string
  items: NavItem[]
}

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  leads: UserPlus,
  opportunities: BadgeDollarSign,
  salesPipeline: KanbanSquare,
  automations: Workflow,
  executions: History,
  templates: Layers,
  analytics: BarChart3,
  reports: FileBarChart,
  clients: BriefcaseBusiness,
  customers: BriefcaseBusiness,
  products: Box,
  orders: ShoppingCart,
  fulfillment: PackageCheck,
  inventory: PackageOpen,
  scheduling: CalendarDays,
  tasks: ListChecks,
  serviceRequests: ClipboardList,
  team: Users,
  ai: Bot,
  settings: Settings,
}

const COLLAPSED_SIDEBAR_TOOLTIP_INITIAL_DELAY_MS = 400
const COLLAPSED_SIDEBAR_TOOLTIP_QUICK_DELAY_MS = 100
const COLLAPSED_SIDEBAR_TOOLTIP_HIDE_DELAY_MS = 150
const COLLAPSED_SIDEBAR_TOOLTIP_QUICK_WINDOW_MS = 900

let collapsedSidebarTooltipIsActive = false
let collapsedSidebarTooltipQuickUntil = 0

function CollapsedSidebarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setPosition({
      left: rect.right + 12,
      top: rect.top + rect.height / 2,
    })
  }, [])

  const showTooltip = useCallback(
    (delay: number) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      showTimerRef.current = setTimeout(() => {
        updatePosition()
        collapsedSidebarTooltipIsActive = true
        collapsedSidebarTooltipQuickUntil =
          window.Date.now() + COLLAPSED_SIDEBAR_TOOLTIP_QUICK_WINDOW_MS
        setOpen(true)
      }, delay)
    },
    [updatePosition],
  )

  const showTooltipImmediately = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    updatePosition()
    collapsedSidebarTooltipIsActive = true
    collapsedSidebarTooltipQuickUntil =
      window.Date.now() + COLLAPSED_SIDEBAR_TOOLTIP_QUICK_WINDOW_MS
    setOpen(true)
  }, [updatePosition])

  const hideTooltip = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      collapsedSidebarTooltipIsActive = false
      collapsedSidebarTooltipQuickUntil =
        window.Date.now() + COLLAPSED_SIDEBAR_TOOLTIP_QUICK_WINDOW_MS
      setOpen(false)
    }, COLLAPSED_SIDEBAR_TOOLTIP_HIDE_DELAY_MS)
  }, [])

  const handleMouseEnter = () => {
    const delay =
      collapsedSidebarTooltipIsActive ||
      window.Date.now() < collapsedSidebarTooltipQuickUntil
        ? COLLAPSED_SIDEBAR_TOOLTIP_QUICK_DELAY_MS
        : COLLAPSED_SIDEBAR_TOOLTIP_INITIAL_DELAY_MS
    showTooltip(delay)
  }

  const handleFocus = () => {
    showTooltipImmediately()
  }

  return (
    <span
      ref={triggerRef}
      className="block overflow-visible"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hideTooltip}
      onFocusCapture={handleFocus}
      onBlurCapture={hideTooltip}
    >
      {children}
      {mounted && open
        ? createPortal(
            <span
              role="tooltip"
              className="border-app bg-app-surface-raised text-app-primary pointer-events-none fixed z-[1000] -translate-y-1/2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium opacity-100 shadow-2xl shadow-black/20 backdrop-blur transition duration-150"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
              }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

export default function WorkspaceShell({
  children,
  workspaceSlug,
  workspaces,
  currentWorkspace,
  capabilities,
  role,
  globalRole,
  plan,
  leadIntakeSources = [],
}: {
  children: React.ReactNode
  workspaceSlug: string
  workspaces: WorkspaceLite[]
  currentWorkspace: WorkspaceLite
  capabilities: WorkspaceCapabilities
  role: 'owner' | 'admin' | 'manager' | 'member'
  globalRole: 'user' | 'admin' | 'security' | 'legal' | 'grc'
  plan: string
  leadIntakeSources?: LeadIntakeSourceCard[]
}) {
  const pathname = usePathname()
  const { user } = useUser()
  const isBuilderRoute = pathname?.includes('/builder') ?? false

  const [collapsed, setCollapsed] = useState(false)
  const [sidebarScrolling, setSidebarScrolling] = useState(false)
  const [sidebarInteracting, setSidebarInteracting] = useState(false)
  const [sidebarScrollThumb, setSidebarScrollThumb] = useState({
    height: 0,
    top: 0,
    visible: false,
  })
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const sidebarScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const [schedulingSettings, setSchedulingSettings] =
    useState<WorkspaceSchedulingSettings | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({})
  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const sectionStorageKey = useMemo(
    () =>
      `skillify.sidebarSections:${user?.id ?? 'workspace'}:${workspaceSlug}`,
    [user?.id, workspaceSlug],
  )

  useEffect(() => {
    const saved = window.localStorage.getItem('skillify.sidebarCollapsed')
    if (saved === '1') setCollapsed(true)
  }, [])

  useEffect(
    () => () => {
      if (sidebarScrollTimeoutRef.current) {
        clearTimeout(sidebarScrollTimeoutRef.current)
      }
    },
    [],
  )

  function toggleSidebar() {
    setCollapsed((v) => {
      const next = !v
      window.localStorage.setItem('skillify.sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    async function loadSchedulingSettings() {
      try {
        const response = await fetch(
          `/api/workspaces/${currentWorkspace.id}/scheduling/settings`,
          { cache: 'no-store' },
        )
        if (!response.ok) return
        const data = (await response.json()) as {
          settings?: WorkspaceSchedulingSettings
        }
        if (!cancelled) setSchedulingSettings(data.settings ?? null)
      } catch {
        if (!cancelled) setSchedulingSettings(null)
      }
    }
    loadSchedulingSettings()
    function onSchedulingSettingsChanged(event?: Event) {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (detail?.workspaceId && detail.workspaceId !== currentWorkspace.id)
        return
      loadSchedulingSettings()
    }
    window.addEventListener(
      schedulingSettingsChangedEvent,
      onSchedulingSettingsChanged,
    )
    return () => {
      cancelled = true
      window.removeEventListener(
        schedulingSettingsChangedEvent,
        onSchedulingSettingsChanged,
      )
    }
  }, [currentWorkspace.id])

  const capabilitiesForNav = useMemo<WorkspaceCapabilities>(
    () => ({
      ...capabilities,
      scheduling: getWorkspaceSchedulingCapabilities({
        businessModel: capabilities.businessModel,
        settings: schedulingSettings,
      }),
    }),
    [capabilities, schedulingSettings],
  )

  const nav = useMemo<NavGroup[]>(() => {
    const canViewSalesPipeline = canAccessSalesPipeline({
      workspaceRole: role,
      globalRole,
    })
    const canViewServiceRequests = canAccessServiceRequests({
      workspaceRole: role,
      globalRole,
    })

    return buildWorkspaceNavigation({
      capabilities: capabilitiesForNav,
      workspaceSlug,
      role,
      canViewSalesPipeline,
      canViewServiceRequests,
      schedulingSettings,
    }).map((group: WorkspaceNavigationGroup) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        icon: NAV_ICONS[item.icon],
      })),
    }))
  }, [capabilitiesForNav, globalRole, role, schedulingSettings, workspaceSlug])

  const customerLinks = useMemo(
    () => [
      {
        label: 'Build Requests',
        href: `/dashboard/${workspaceSlug}/build-requests`,
      },
    ],
    [workspaceSlug],
  )

  const adminLinks = useMemo(
    () =>
      globalRole === 'admin'
        ? [{ label: 'Admin', href: '/dashboard/admin' }]
        : [],
    [globalRole],
  )

  const rightNav = useMemo(
    () => [...customerLinks, ...adminLinks],
    [adminLinks, customerLinks],
  )
  const helpHref = `/dashboard/${workspaceSlug}/help`
  const helpActive =
    pathname === helpHref || pathname.startsWith(`${helpHref}/`)
  const activeSection = useMemo(
    () =>
      nav.find((group) =>
        group.items.some(
          (item) =>
            pathname === item.href || pathname.startsWith(item.href + '/'),
        ),
      )?.section,
    [nav, pathname],
  )

  useEffect(() => {
    setSectionsLoaded(false)
    try {
      const saved = window.localStorage.getItem(sectionStorageKey)
      setCollapsedSections(saved ? JSON.parse(saved) : {})
    } catch {
      setCollapsedSections({})
    }
    setSectionsLoaded(true)
  }, [sectionStorageKey])

  useEffect(() => {
    if (!sectionsLoaded) return
    try {
      window.localStorage.setItem(
        sectionStorageKey,
        JSON.stringify(collapsedSections),
      )
    } catch {
      // Sidebar section preferences are optional; ignore storage failures.
    }
  }, [collapsedSections, sectionStorageKey, sectionsLoaded])

  useEffect(() => {
    if (!activeSection) return
    setCollapsedSections((current) => {
      if (!current[activeSection]) return current
      return { ...current, [activeSection]: false }
    })
  }, [activeSection])

  const isGroupActive = (group: NavGroup) =>
    group.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
    )

  const toggleSection = (section: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const updateSidebarScrollThumb = useCallback(() => {
    const element = sidebarScrollRef.current
    if (!element) return
    const { clientHeight, scrollHeight, scrollTop } = element
    const visible = scrollHeight > clientHeight + 1
    if (!visible || clientHeight <= 0) {
      setSidebarScrollThumb((current) =>
        current.visible || current.height || current.top
          ? { height: 0, top: 0, visible: false }
          : current,
      )
      return
    }
    const height = Math.max(
      24,
      Math.round((clientHeight / scrollHeight) * clientHeight),
    )
    const maxScrollTop = Math.max(1, scrollHeight - clientHeight)
    const top = Math.round(((clientHeight - height) * scrollTop) / maxScrollTop)
    setSidebarScrollThumb((current) =>
      current.visible === visible &&
      current.height === height &&
      current.top === top
        ? current
        : { height, top, visible },
    )
  }, [])

  const handleSidebarScroll = () => {
    updateSidebarScrollThumb()
    if (!sidebarScrolling) setSidebarScrolling(true)
    if (sidebarScrollTimeoutRef.current) {
      clearTimeout(sidebarScrollTimeoutRef.current)
    }
    sidebarScrollTimeoutRef.current = setTimeout(() => {
      setSidebarScrolling(false)
    }, 650)
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateSidebarScrollThumb)
    window.addEventListener('resize', updateSidebarScrollThumb)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateSidebarScrollThumb)
    }
  }, [collapsed, collapsedSections, nav, updateSidebarScrollThumb])

  const showSidebarScrollIndicator =
    sidebarScrollThumb.visible && (sidebarInteracting || sidebarScrolling)

  const sidebarScrollIndicator = (
    <div
      data-testid="workspace-sidebar-scroll-indicator"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute bottom-1 right-1 top-1 w-1 rounded-full transition-opacity duration-150',
        showSidebarScrollIndicator ? 'opacity-100' : 'opacity-0',
      )}
    >
      {sidebarScrollThumb.visible ? (
        <div
          data-testid="workspace-sidebar-scroll-thumb"
          className="bg-[color:var(--text-muted)]/40 w-full rounded-full shadow-sm shadow-black/10"
          style={{
            height: `${sidebarScrollThumb.height}px`,
            transform: `translateY(${sidebarScrollThumb.top}px)`,
          }}
        />
      ) : null}
    </div>
  )

  const sidebarNavigationContent = (
    <nav
      data-testid="workspace-sidebar-navigation"
      className="w-full"
      aria-label="Workspace navigation"
    >
      {nav.map((group, groupIndex) => (
        <div
          key={group.section}
          data-testid="workspace-sidebar-nav-group"
          className={cn(
            collapsed
              ? [groupIndex === 0 ? 'pb-2' : 'border-app mt-2 border-t pt-2']
              : 'mb-3',
          )}
        >
          {!collapsed && (
            <button
              type="button"
              onClick={() => toggleSection(group.section)}
              className="text-app-muted hover:bg-app-surface-hover hover:text-app-secondary group flex w-full items-center justify-between rounded-lg px-2 pb-2 pt-1 text-left text-[10px] font-semibold tracking-widest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-expanded={
                !collapsedSections[group.section] || isGroupActive(group)
              }
              aria-controls={`sidebar-section-${group.section.toLowerCase()}`}
            >
              <span>{group.section}</span>
              <ChevronDown
                className={cn(
                  'text-app-muted group-hover:text-app-secondary h-3 w-3 transition',
                  collapsedSections[group.section] &&
                    !isGroupActive(group) &&
                    '-rotate-90',
                )}
                aria-hidden="true"
              />
            </button>
          )}

          <div
            id={`sidebar-section-${group.section.toLowerCase()}`}
            className="flex flex-col gap-1"
          >
            {(collapsed ||
            !collapsedSections[group.section] ||
            isGroupActive(group)
              ? group.items
              : []
            ).map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    'group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                    active
                      ? 'border-brand-primary/35 text-app-primary bg-gradient-to-r from-blue-500/15 to-indigo-500/10 shadow-sm shadow-blue-500/10'
                      : 'border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? undefined : item.label}
                >
                  <Icon className="h-4 w-4 opacity-90" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )

              return collapsed ? (
                <CollapsedSidebarTooltip key={item.href} label={item.label}>
                  {link}
                </CollapsedSidebarTooltip>
              ) : (
                link
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const sidebarSupportContent = (
    <div
      data-testid="workspace-sidebar-support"
      className={cn(
        'border-app border-t',
        collapsed ? 'px-2 pb-4 pt-3' : 'mt-3 pt-3',
      )}
    >
      {collapsed ? (
        <CollapsedSidebarTooltip label="Help & Docs">
          <Link
            href={helpHref}
            aria-label="Help & Docs"
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
              helpActive
                ? 'border-brand-primary/35 text-app-primary bg-gradient-to-r from-blue-500/15 to-indigo-500/10 shadow-sm shadow-blue-500/10'
                : 'border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary',
              'justify-center px-2',
            )}
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        </CollapsedSidebarTooltip>
      ) : (
        <Link
          href={helpHref}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
            helpActive
              ? 'border-brand-primary/35 text-app-primary bg-gradient-to-r from-blue-500/15 to-indigo-500/10 shadow-sm shadow-blue-500/10'
              : 'border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary',
          )}
          title="Help & Docs"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Docs</span>
        </Link>
      )}

      <div
        data-testid="workspace-sidebar-footer"
        className={cn(
          'text-app-muted flex justify-center px-2 text-[10px]',
          collapsed ? 'mt-3 pb-0 pt-1' : 'mt-6 pb-2 pt-3',
        )}
      >
        {collapsed ? (
          <span
            data-testid="workspace-sidebar-footer-mark"
            aria-hidden="true"
            className="flex h-4 items-center justify-center"
          >
            <BrandLogo
              variant="icon"
              alt=""
              className="mx-auto h-3.5 w-3.5 opacity-50"
            />
          </span>
        ) : (
          <p className="text-app-muted px-1 text-center text-[10px] font-medium">
            Powered by Skillify
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-skillify-dashboard-soft text-app-primary flex h-dvh min-h-screen w-full flex-col overflow-hidden">
      {/* top glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent" />

      {/* Top Bar */}
      <header className="border-app bg-app-surface/80 z-50 h-14 shrink-0 border-b backdrop-blur">
        <div className="flex h-full items-center gap-3 px-3">
          {/* Left: Brand + sidebar toggle */}
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={toggleSidebar}
              className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary inline-flex items-center justify-center rounded-lg border p-2"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <Link
              href={`/dashboard/${workspaceSlug}`}
              className={cn(
                'hover:bg-app-surface-hover group flex items-center justify-start rounded-lg px-1.5 py-1 transition',
                collapsed ? 'justify-center' : 'gap-2.5',
              )}
              title="Skillify"
            >
              <BrandLogo variant="icon" alt="Skillify" className="h-7 w-7" />
              {!collapsed && (
                <span className="text-app-primary translate-y-px font-heading text-[23px] font-semibold leading-none tracking-normal">
                  Skillify
                </span>
              )}
            </Link>
          </div>

          {/* Center: workspace switcher + breadcrumbs-ish */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <span className="text-app-muted text-xs">Workspace</span>
              <WorkspaceSwitcher
                workspaces={workspaces}
                current={currentWorkspace}
                currentSlug={workspaceSlug}
                plan={plan}
              />
            </div>
          </div>

          {/* Right: admin-ish shortcuts + theme + profile */}
          <nav className="hidden items-center gap-1 lg:flex">
            {rightNav.map((i) => {
              const active =
                pathname === i.href || pathname.startsWith(i.href + '/')
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition',
                    active
                      ? 'border-brand-primary/30 text-app-primary bg-blue-500/10'
                      : 'border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover',
                  )}
                >
                  {i.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Notifications workspaceId={currentWorkspace.id} />
            <ThemeToggle />

            <SkillifyUserMenu compact />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'border-app bg-app-surface/75 relative z-40 h-full max-h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden border-r',
            collapsed ? 'w-[76px]' : 'w-[268px]',
          )}
        >
          <div className="relative h-full min-h-0 w-full overflow-hidden">
            {collapsed ? (
              <div
                data-testid="workspace-sidebar-collapsed-layout"
                className="bg-app-surface/75 flex h-full min-h-0 w-full flex-col"
              >
                <div
                  data-testid="workspace-sidebar-primary-scroll-wrap"
                  className="relative min-h-0 flex-1 overflow-hidden"
                >
                  <div
                    ref={sidebarScrollRef}
                    data-testid="workspace-sidebar-primary-scroll"
                    onScroll={handleSidebarScroll}
                    onMouseEnter={() => {
                      setSidebarInteracting(true)
                      updateSidebarScrollThumb()
                    }}
                    onMouseLeave={() => setSidebarInteracting(false)}
                    onFocusCapture={() => {
                      setSidebarInteracting(true)
                      updateSidebarScrollThumb()
                    }}
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setSidebarInteracting(false)
                      }
                    }}
                    className="sidebar-body-scroll h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-4 pt-3 [scrollbar-color:transparent_transparent] [scrollbar-gutter:auto] [scrollbar-width:none] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
                  >
                    {sidebarNavigationContent}
                  </div>
                  {sidebarScrollIndicator}
                </div>

                <div data-testid="workspace-sidebar-bottom-utility">
                  {sidebarSupportContent}
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={sidebarScrollRef}
                  data-testid="workspace-sidebar-body-scroll"
                  onScroll={handleSidebarScroll}
                  onMouseEnter={() => {
                    setSidebarInteracting(true)
                    updateSidebarScrollThumb()
                  }}
                  onMouseLeave={() => setSidebarInteracting(false)}
                  onFocusCapture={() => {
                    setSidebarInteracting(true)
                    updateSidebarScrollThumb()
                  }}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setSidebarInteracting(false)
                    }
                  }}
                  className="sidebar-body-scroll h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-3 pr-3 [scrollbar-color:transparent_transparent] [scrollbar-gutter:auto] [scrollbar-width:none] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
                >
                  {sidebarNavigationContent}
                  {sidebarSupportContent}
                </div>
                {sidebarScrollIndicator}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* IMPORTANT:
      - Builder routes: full-bleed (no padding/max width) so canvas touches sidebar edge.
      - Non-builder routes: keep your nice centered page layout. */}
          {isBuilderRoute ? (
            <div className="h-full w-full overflow-hidden">{children}</div>
          ) : (
            <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
              <div className="mx-auto w-full max-w-[1400px] px-4 py-5 pb-16 lg:px-6">
                {children}
              </div>
            </div>
          )}
        </main>
      </div>
      <WorkspaceSetup
        workspaceId={currentWorkspace.id}
        workspaceSlug={workspaceSlug}
        workspaceName={currentWorkspace.businessName ?? currentWorkspace.name}
        initialBusinessType={currentWorkspace.industry}
        canManageSetup={canManageWorkspace(currentWorkspace.memberRole)}
        showLauncher={false}
        leadIntakeSources={leadIntakeSources}
      />
    </div>
  )
}

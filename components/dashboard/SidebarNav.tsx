"use client"

import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

import CreateWorkspaceModal from "@/components/workspaces/CreateWorkspaceModal"
import type { SidebarItem } from "./sidebar-items"

// ICON SET
import {
  BarChart3,
  Bot,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Users,
  Workflow,
} from "lucide-react"

// Map icon type → Lucide icon component
const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  automations: Workflow,
  analytics: BarChart3,
  settings: Settings,
  team: Users,
  billing: CreditCard,
  ai: Bot,
  help: HelpCircle,
}

export function SidebarNav({
  items,
  role = "MEMBER",
}: {
  items: SidebarItem[]
  role?: "OWNER" | "ADMIN" | "MEMBER"
}) {
  const pathname = usePathname()

  // Group items by section
  const sections = items.reduce<Record<string, SidebarItem[]>>((acc, item) => {
    const key = item.section ?? "General"
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <aside className="bg-neutral-card-dark text-neutral-text-primary flex h-full w-64 select-none flex-col border-r border-neutral-border px-4 py-6">
      {/* LOGO AREA */}
      <div className="mb-8 px-2 text-xl font-semibold tracking-tight">Skillify</div>

      {/* NAVIGATION SECTIONS */}
      <nav className="flex-1 space-y-8 overflow-y-auto pr-2">
        {Object.entries(sections).map(([section, sectionItems]) => (
          <div key={section}>
            {/* SECTION LABEL */}
            <div className="text-neutral-text-secondary/70 mb-2 px-2 text-xs font-semibold uppercase">
              {section}
            </div>

            {/* SECTION ITEMS */}
            <div className="space-y-1">
              {sectionItems.map((item) => {
                // Role-based filtering
                if (item.roles && !item.roles.includes(role)) return null

                const Icon = ICONS[item.icon]
                const active = pathname === item.href

                return (
                  <Link key={item.href} href={item.href}>
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-brand-primary/20 border-brand-primary/40 border text-brand-primary"
                            : "hover:bg-neutral-card-light/10 text-neutral-text-secondary"
                        } `}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span>{item.label}</span>
                      </motion.div>
                    </AnimatePresence>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ================================
          NEW WORKSPACE BUTTON
      ================================= */}
      <div className="mt-6 border-t border-neutral-border pt-4">
        <CreateWorkspaceModal />
      </div>

      {/* ================================
          FOOTER
      ================================= */}
      <div className="text-neutral-text-secondary mt-6 px-2 text-xs opacity-50">
        © {new Date().getFullYear()} Skillify
      </div>
    </aside>
  )
}

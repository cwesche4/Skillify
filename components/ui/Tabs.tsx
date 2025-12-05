// components/ui/Tabs.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const current = value ?? internal

  const setValue = (v: string) => {
    if (!value) setInternal(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={cn("flex flex-col gap-3", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 p-1",
        className,
      )}
      {...props}
    />
  )
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>")

  const active = ctx.value === value

  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-slate-50 text-slate-950 shadow-sm"
          : "text-neutral-text-secondary hover:text-neutral-text-primary hover:bg-slate-800/80",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>")

  if (ctx.value !== value) return null

  return (
    <div className={cn("mt-1", className)} {...props}>
      {children}
    </div>
  )
}

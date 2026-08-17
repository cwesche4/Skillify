'use client'

import React, { useMemo } from 'react'
import type { InspectorTabId } from '@/lib/builder/inspector/layouts'

type Props = {
  activeTabs: InspectorTabId[]
  activeTab: InspectorTabId
  tabLabels: Record<InspectorTabId, string>
  onTabChange: (tab: InspectorTabId) => void
  bodyPadding: string
}

function InspectorTabsComponent({
  activeTabs,
  activeTab,
  tabLabels,
  onTabChange,
  bodyPadding,
}: Props) {
  const tabButtons = useMemo(
    () =>
      activeTabs.map((tab) => (
        <button
          key={tab}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
            activeTab === tab
              ? 'bg-slate-800/80 text-slate-100'
              : 'text-slate-500 hover:text-slate-200'
          }`}
          onClick={() => onTabChange(tab)}
          title={tabLabels[tab]}
        >
          {tabLabels[tab]}
        </button>
      )),
    [activeTabs, activeTab, onTabChange, tabLabels],
  )

  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-dashed border-slate-800/70 bg-slate-950/70 ${bodyPadding} pt-3`}
    >
      {tabButtons}
    </div>
  )
}

export const InspectorTabs = React.memo(InspectorTabsComponent)

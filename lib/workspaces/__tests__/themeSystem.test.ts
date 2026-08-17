import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  applySkillifyThemeToDocument,
  normalizeStoredSkillifyTheme,
  persistSkillifyThemePreference,
  readSkillifyThemePreference,
  SKILLIFY_THEME_STORAGE_KEY,
  SKILLIFY_THEME_VERSION,
  SKILLIFY_THEME_VERSION_KEY,
} from '@/lib/theme/theme'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
})

describe('Skillify theme system', () => {
  it('migrates the old light preference to the official dark navy theme', () => {
    expect(
      normalizeStoredSkillifyTheme({
        storedTheme: 'light',
        storedVersion: null,
      }),
    ).toBe('dark')
  })

  it('preserves v2 light and dark preferences semantically', () => {
    expect(
      normalizeStoredSkillifyTheme({
        storedTheme: 'light',
        storedVersion: SKILLIFY_THEME_VERSION,
      }),
    ).toBe('light')
    expect(
      normalizeStoredSkillifyTheme({
        storedTheme: 'dark',
        storedVersion: SKILLIFY_THEME_VERSION,
      }),
    ).toBe('dark')
  })

  it('persists theme preferences with a version marker', () => {
    persistSkillifyThemePreference(window.localStorage, 'light')

    expect(window.localStorage.getItem(SKILLIFY_THEME_STORAGE_KEY)).toBe(
      'light',
    )
    expect(window.localStorage.getItem(SKILLIFY_THEME_VERSION_KEY)).toBe(
      SKILLIFY_THEME_VERSION,
    )
    expect(readSkillifyThemePreference(window.localStorage)).toBe('light')
  })

  it('applies matching root class and data attributes', () => {
    applySkillifyThemeToDocument(document.documentElement, 'light')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('theme-light')).toBe(
      true,
    )
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    applySkillifyThemeToDocument(document.documentElement, 'dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('exposes shared semantic theme tokens', () => {
    const globals = readFileSync(
      join(process.cwd(), 'app', 'globals.css'),
      'utf8',
    )

    for (const token of [
      '--app-background',
      '--surface',
      '--surface-raised',
      '--surface-muted',
      '--surface-hover',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--border-strong',
      '--primary',
      '--success',
      '--warning',
      '--danger',
      '--ai',
      '--opportunity',
      '--chart-text',
      '--chart-text-muted',
      '--chart-grid',
      '--chart-axis',
      '--chart-track',
      '--chart-surface',
      '--chart-surface-raised',
      '--chart-tooltip-surface',
      '--chart-tooltip-text',
      '--metric-surface',
      '--metric-surface-hover',
      '--metric-border',
      '--metric-text',
      '--metric-muted',
      '--insight-surface',
      '--insight-surface-hover',
      '--insight-border',
      '--insight-text',
      '--insight-muted',
      '--recommendation-surface',
      '--recommendation-surface-hover',
      '--recommendation-border',
      '--drawer-surface',
      '--drawer-header-surface',
      '--drawer-panel-surface',
      '--drawer-panel-muted',
      '--drawer-border',
      '--status-info-surface',
      '--status-success-surface',
      '--status-warning-surface',
      '--status-danger-surface',
      '--status-violet-surface',
    ]) {
      expect(globals).toContain(token)
    }
  })

  it('keeps visualization utilities light-mode contrast aware', () => {
    const globals = readFileSync(
      join(process.cwd(), 'app', 'globals.css'),
      'utf8',
    )

    expect(globals).toContain('.metric-card-surface')
    expect(globals).toContain('.insight-card-surface')
    expect(globals).toContain('.recommendation-card-surface')
    expect(globals).toContain('.bg-chart-track')
    expect(globals).toContain('background-color: var(--chart-track)')
    expect(globals).toContain('color: var(--metric-text)')
    expect(globals).toContain('color: var(--insight-text)')
  })

  it('keeps normal workspace switcher popovers light-mode aware', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'workspaces', 'WorkspaceSwitcher.tsx'),
      'utf8',
    )

    expect(source).toContain('app-popover')
    expect(source).toContain('bg-app-surface-muted')
    expect(source).toContain('text-app-primary')
    expect(source).not.toContain('bg-[#070A12]')
  })

  it('keeps settings option cards on semantic light-aware surfaces', () => {
    const salesSettings = readFileSync(
      join(
        process.cwd(),
        'components',
        'workspaces',
        'SalesProcessSettings.tsx',
      ),
      'utf8',
    )
    const operationsSettings = readFileSync(
      join(
        process.cwd(),
        'components',
        'workspaces',
        'OperationsConfigurationSettings.tsx',
      ),
      'utf8',
    )

    expect(salesSettings).toContain('app-option-card')
    expect(salesSettings).toContain('app-panel-muted')
    expect(operationsSettings).toContain('app-option-card')
    expect(operationsSettings).toContain('app-panel-muted')
    expect(`${salesSettings}\n${operationsSettings}`).not.toContain(
      'bg-slate-950/35',
    )
  })

  it('keeps dashboard metric and activity cards on semantic surfaces', () => {
    const stats = readFileSync(
      join(process.cwd(), 'components', 'dashboard', 'StatCards.tsx'),
      'utf8',
    )
    const activity = readFileSync(
      join(process.cwd(), 'components', 'dashboard', 'ActivityFeed.tsx'),
      'utf8',
    )

    expect(stats).toContain('bg-app-surface-raised')
    expect(stats).toContain('bg-app-surface-muted')
    expect(activity).toContain('bg-app-surface-muted')
    expect(`${stats}\n${activity}`).not.toContain('bg-slate-900/40')
  })

  it('keeps dashboard command-center KPI and chart surfaces readable in light mode', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'command-center',
        'WorkspaceCommandCenter.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('metric-card-surface')
    expect(source).toContain('text-metric')
    expect(source).toContain('var(--chart-tooltip-surface)')
    expect(source).toContain('chartGridStroke')
    expect(source).toContain('recommendation-card-surface')
    expect(source).not.toContain('text-neutral-100')
    expect(source).not.toContain('text-white')
    expect(source).not.toContain('bg-slate-950/45')
    expect(source).not.toContain('bg-slate-950/35 p-3')
  })

  it('keeps insight charts on light chart tracks and readable hover surfaces', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'workspace-insights',
        'WorkspaceInsightCharts.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('bg-chart-track')
    expect(source).toContain('var(--chart-tooltip-surface)')
    expect(source).toContain('recommendation-card-surface')
    expect(source).toContain('text-chart')
    expect(source).toContain('text-metric')
    expect(source).not.toContain('bg-slate-900/80')
    expect(source).not.toContain('bg-slate-950/30')
    expect(source).not.toContain('border-white/10 bg-white/[0.035]')
    expect(source).not.toContain('text-neutral-100')
  })

  it('keeps Jobs KPI cards on semantic metric surfaces in light mode', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'service-requests',
        'ServiceRequestsClient.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('metric-card-surface')
    expect(source).toContain('drawer-surface')
    expect(source).toContain('drawer-panel-surface')
    expect(source).toContain('text-metric')
    expect(source).toContain('text-metric-muted')
    expect(source).toContain('hover:bg-cyan-50')
    expect(source).toContain('hover:bg-rose-50')
    expect(source).toContain('hover:bg-violet-50')
    expect(source).toContain('hover:bg-emerald-50')
    expect(source).not.toContain(
      'rounded-2xl border border-slate-800 bg-slate-900/60 p-4',
    )
  })

  it('keeps commerce customer metrics and table text readable in light mode', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'commerce',
        'CommerceCustomersPage.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('bg-app-background')
    expect(source).toContain('metric-card-surface')
    expect(source).toContain('drawer-surface')
    expect(source).toContain('drawer-panel-surface')
    expect(source).toContain('text-metric')
    expect(source).toContain('text-app-primary')
    expect(source).toContain('text-app-secondary')
    expect(source).not.toContain(
      'rounded-2xl border border-slate-800 bg-slate-900/45 p-4',
    )
  })

  it('keeps CRM customer fulfillment metrics on semantic surfaces', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'clients',
        'ClientsClient.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('Active Fulfillment')
    expect(source).toContain('metric-card-surface')
    expect(source).toContain('drawer-surface')
    expect(source).toContain('text-app-primary')
    expect(source).toContain(
      'className="metric-card-surface rounded-xl border p-3"',
    )
    expect(source).toContain('text-metric')
    expect(source).toContain('text-metric-muted')
  })

  it('keeps Leads and Job Steps drawers on semantic drawer surfaces', () => {
    const leads = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'sales',
        'LeadsClient.tsx',
      ),
      'utf8',
    )
    const tasks = readFileSync(
      join(
        process.cwd(),
        'components',
        'dashboard',
        'tasks',
        'TasksClient.tsx',
      ),
      'utf8',
    )

    expect(leads).toContain('drawer-surface')
    expect(leads).toContain('drawer-panel-surface')
    expect(leads).toContain('text-app-primary')
    expect(tasks).toContain('drawer-surface')
    expect(tasks).toContain('drawer-panel-surface')
    expect(tasks).toContain('text-app-primary')
  })

  it('keeps analytics build-help surfaces light-mode aware', () => {
    const micro = readFileSync(
      join(process.cwd(), 'components', 'upsell', 'UpsellMicroCard.tsx'),
      'utf8',
    )
    const enterprise = readFileSync(
      join(
        process.cwd(),
        'components',
        'upsell',
        'UpsellEnterpriseConsult.tsx',
      ),
      'utf8',
    )
    const buildRequest = readFileSync(
      join(process.cwd(), 'components', 'upsell', 'BuildRequestCallout.tsx'),
      'utf8',
    )

    expect(micro).toContain('bg-status-info-surface')
    expect(enterprise).toContain('bg-status-violet-surface')
    expect(buildRequest).toContain('bg-status-warning-surface')
    expect(`${micro}\n${enterprise}\n${buildRequest}`).toContain(
      'text-app-primary',
    )
    expect(`${micro}\n${enterprise}\n${buildRequest}`).not.toContain(
      'bg-slate-950/80',
    )
  })

  it('keeps Scheduling controls light-aware around the dark calendar canvas', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'scheduling', 'SchedulingPage.tsx'),
      'utf8',
    )

    expect(source).toContain('text-cyan-700')
    expect(source).toContain('bg-app-surface-raised')
    expect(source).toContain('hover:bg-app-surface-hover')
    expect(source).toContain('dark:bg-slate-950/80')
    expect(source).not.toContain(
      'border-slate-700 bg-slate-900/50 text-neutral-300 hover:border-cyan-300/35',
    )
  })

  it('keeps shared status badges readable on light backgrounds', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'ui', 'Badge.tsx'),
      'utf8',
    )

    expect(source).toContain('text-sky-700')
    expect(source).toContain('text-emerald-700')
    expect(source).toContain('text-rose-700')
    expect(source).toContain('dark:text-sky-300')
    expect(source).not.toContain('text-sky-400 border border-sky-500/40')
  })

  it('allows the Workflow Builder canvas to remain intentionally dark', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'app',
        'dashboard',
        '[workspaceSlug]',
        'automations',
        '[automationId]',
        'builder',
        'BuilderInner.tsx',
      ),
      'utf8',
    )

    expect(source).toMatch(/bg-slate-9(00|50)/)
  })

  it('uses accessible toggle labels and updates persisted theme', async () => {
    window.localStorage.setItem(SKILLIFY_THEME_STORAGE_KEY, 'dark')
    window.localStorage.setItem(
      SKILLIFY_THEME_VERSION_KEY,
      SKILLIFY_THEME_VERSION,
    )

    render(React.createElement(ThemeToggle))

    const toggle = await screen.findByRole('button', {
      name: 'Switch to light theme',
    })

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(window.localStorage.getItem(SKILLIFY_THEME_STORAGE_KEY)).toBe(
        'light',
      )
      expect(document.documentElement.dataset.theme).toBe('light')
    })
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeTruthy()
  })
})

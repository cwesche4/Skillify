// lib/theme.ts

import {
  colorTokens,
  spaceTokens,
  radiusTokens,
  shadowTokens,
  typographyTokens,
} from './design-tokens'

/**
 * High-level semantic theme.
 * Map raw tokens into how Skillify actually thinks about UI.
 */

export const skillifyTheme = {
  colors: {
    ...colorTokens,
    surface: {
      // convenience aliases
      page: '#020617', // tailwind slate-950
      panel: '#020617',
      card: colorTokens.neutral.cardLight,
      cardDark: colorTokens.neutral.cardDark,
      borderSubtle: colorTokens.neutral.border,
    },
  },
  space: spaceTokens,
  radii: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
} as const

export type SkillifyTheme = typeof skillifyTheme

/**
 * Component-level tokens.
 * These are Tailwind class strings that your UI components (Button, Card, Badge, etc.)
 * can import, so everything is driven from one place.
 */

export const componentTokens = {
  button: {
    base: 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed',
    primary:
      'bg-brand-primary text-white hover:bg-blue-600 active:scale-[0.98]',
    secondary:
      'bg-neutral-card-dark text-neutral-text-primary border border-neutral-border hover:bg-slate-800',
    subtle: 'bg-slate-900/60 text-neutral-text-secondary hover:bg-slate-800/80',
    ghost:
      'text-neutral-text-secondary hover:text-white hover:bg-slate-800 rounded-xl',
    outline:
      'border border-neutral-border text-neutral-text-primary hover:bg-slate-800',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    // sizes
    sizeSm: 'text-sm px-3 py-1.5',
    sizeMd: 'text-sm px-4 py-2',
    sizeLg: 'text-base px-6 py-3',
    iconOnly: 'p-2 rounded-full',
  },
  card: {
    base: 'bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-soft backdrop-blur',
    hover:
      'hover:-translate-y-0.5 hover:shadow-card transition-all duration-200',
    stat: 'bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2',
    analytics:
      'bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-card',
  },
  badge: {
    base: 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium',
    subtle: 'bg-slate-800 text-slate-200',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
    danger: 'bg-red-500/15 text-red-300',
    info: 'bg-sky-500/15 text-sky-300',
  },
  input: {
    base: 'w-full px-3 py-2 bg-slate-900 text-slate-100 border border-slate-700 rounded-lg outline-none',
    focus: 'border-indigo-500 ring-1 ring-indigo-500',
    error: 'border-red-500 ring-1 ring-red-500',
  },
  layout: {
    page: 'pt-20 px-6',
    section: 'max-w-7xl mx-auto px-6 py-12',
    grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    grid3: 'grid grid-cols-1 md:grid-cols-3 gap-6',
    grid4: 'grid grid-cols-1 md:grid-cols-4 gap-6',
  },
  typography: {
    h1: 'text-4xl font-heading font-semibold tracking-tight',
    h2: 'text-3xl font-heading font-semibold tracking-tight',
    h3: 'text-2xl font-heading font-medium',
    h4: 'text-xl font-heading',
    body: 'text-base text-neutral-text-secondary leading-relaxed',
    label: 'block text-sm font-medium text-neutral-text-secondary',
    meta: 'text-xs text-slate-400',
  },
  // Automation Builder specific tokens
  builder: {
    canvas:
      'flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50 transition-all duration-300',
    sidebar: 'w-64 border-r border-slate-800 bg-slate-950/95 p-4 space-y-4',
    inspector:
      'w-80 border-l border-slate-800 bg-slate-950/95 p-4 flex flex-col',
    nodeBase: 'node-base', // uses CSS class from globals.css
  },
} as const

export type ComponentTokens = typeof componentTokens

// lib/design-tokens.ts

/**
 * Core, brand-agnostic design tokens for Skillify.
 * These are the single source of truth for colors, spacing,
 * typography, radii, and shadows.
 */

export const colorTokens = {
  brand: {
    primary: '#2563eb',
    indigo: '#6366f1',
    teal: '#0ea5e9',
  },
  neutral: {
    light: '#f5f7fa',
    dark: '#0d0f12',
    cardLight: '#ffffff',
    cardDark: '#111315',
    border: '#e5e7eb',
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
  },
  accent: {
    softPurple: '#e0d7ff',
    skyBlue: '#bae6fd',
    mint: '#a0f0e3',
  },
  semantic: {
    success: '#22c55e',
    warning: '#facc15',
    danger: '#ef4444',
    info: '#0ea5e9',
  },
} as const

export type BrandColorKey = keyof typeof colorTokens.brand
export type NeutralColorKey = keyof typeof colorTokens.neutral
export type AccentColorKey = keyof typeof colorTokens.accent
export type SemanticColorKey = keyof typeof colorTokens.semantic

export const spaceTokens = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
} as const

export type SpaceTokenKey = keyof typeof spaceTokens

export const radiusTokens = {
  none: '0px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  full: '9999px',
} as const

export type RadiusTokenKey = keyof typeof radiusTokens

export const shadowTokens = {
  subtle: '0 1px 2px rgba(15,23,42,0.20)',
  card: '0 8px 30px rgba(15,23,42,0.35)',
  focus: '0 0 0 1px rgba(37,99,235,0.8)',
  glowIndigo: '0 0 20px rgba(99,102,241,0.6)',
} as const

export type ShadowTokenKey = keyof typeof shadowTokens

export const typographyTokens = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    heading:
      'var(--font-heading, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif)',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.7,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const

export type FontSizeTokenKey = keyof typeof typographyTokens.fontSize
export type LineHeightTokenKey = keyof typeof typographyTokens.lineHeight
export type FontWeightTokenKey = keyof typeof typographyTokens.fontWeight

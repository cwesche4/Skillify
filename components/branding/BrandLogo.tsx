import React from 'react'

import { cn } from '@/lib/utils'

/* eslint-disable @next/next/no-img-element */

type BrandLogoVariant =
  | 'horizontal'
  | 'dashboard'
  | 'stacked'
  | 'icon'
  | 'powered'
  | 'poweredCompact'
  | 'automated'

type BrandLogoTheme = 'auto' | 'light' | 'dark'
type BrandLogoSize = 'sm' | 'md' | 'lg'

const logoSources: Record<
  BrandLogoVariant,
  { light: string; dark: string; width: number; height: number }
> = {
  horizontal: {
    light: '/branding/logos/skillify-logo-horizontal-light.svg',
    dark: '/branding/logos/skillify-logo-horizontal-dark.svg',
    width: 2000,
    height: 600,
  },
  dashboard: {
    light: '/branding/logos/skillify-logo-dashboard-light.svg',
    dark: '/branding/logos/skillify-logo-dashboard-dark.svg',
    width: 1200,
    height: 1600,
  },
  stacked: {
    light: '/branding/logos/skillify-logo-stacked-light.svg',
    dark: '/branding/logos/skillify-logo-stacked-dark.svg',
    width: 1200,
    height: 1600,
  },
  icon: {
    light: '/branding/logos/skillify-icon-light.svg',
    dark: '/branding/logos/skillify-icon-dark.svg',
    width: 1200,
    height: 1200,
  },
  powered: {
    light: '/branding/logos/powered-by-skillify-light.svg',
    dark: '/branding/logos/powered-by-skillify-dark.svg',
    width: 1600,
    height: 400,
  },
  poweredCompact: {
    light: '/branding/logos/powered-by-skillify-compact-light.svg',
    dark: '/branding/logos/powered-by-skillify-compact-dark.svg',
    width: 1200,
    height: 400,
  },
  automated: {
    light: '/branding/logos/automated-by-skillify-light.svg',
    dark: '/branding/logos/automated-by-skillify-dark.svg',
    width: 1600,
    height: 400,
  },
}

const logoSizes: Record<BrandLogoVariant, Record<BrandLogoSize, string>> = {
  horizontal: {
    sm: 'w-28',
    md: 'w-36',
    lg: 'w-48',
  },
  dashboard: {
    sm: 'w-16',
    md: 'w-24',
    lg: 'w-32',
  },
  stacked: {
    sm: 'w-24',
    md: 'w-32',
    lg: 'w-36',
  },
  icon: {
    sm: 'w-12',
    md: 'w-14',
    lg: 'w-16',
  },
  powered: {
    sm: 'w-64',
    md: 'w-72',
    lg: 'w-80',
  },
  poweredCompact: {
    sm: 'w-40',
    md: 'w-48',
    lg: 'w-56',
  },
  automated: {
    sm: 'w-32',
    md: 'w-40',
    lg: 'w-52',
  },
}

export function BrandLogo({
  variant = 'horizontal',
  theme = 'auto',
  size = 'md',
  alt = 'Skillify',
  className,
  imgClassName,
}: {
  variant?: BrandLogoVariant
  theme?: BrandLogoTheme
  size?: BrandLogoSize
  alt?: string
  className?: string
  imgClassName?: string
}) {
  const source = logoSources[variant]
  const containerClassName = cn(
    'inline-block max-w-full shrink-0 leading-none',
    logoSizes[variant][size],
    className,
  )

  const image = (src: string, visibility?: string) => (
    <img
      src={src}
      alt={alt}
      width={source.width}
      height={source.height}
      className={cn(
        'block h-auto max-h-full w-full max-w-full object-contain',
        visibility,
        imgClassName,
      )}
    />
  )

  if (theme === 'light') {
    return <span className={containerClassName}>{image(source.light)}</span>
  }

  if (theme === 'dark') {
    return <span className={containerClassName}>{image(source.dark)}</span>
  }

  return (
    <span className={containerClassName}>
      {image(source.light, 'dark:hidden')}
      {image(source.dark, 'hidden dark:block')}
    </span>
  )
}

export function BrandIcon({
  theme = 'auto',
  size = 'md',
  alt = 'Skillify',
  className,
}: {
  theme?: BrandLogoTheme
  size?: BrandLogoSize
  alt?: string
  className?: string
}) {
  return (
    <BrandLogo
      variant="icon"
      theme={theme}
      size={size}
      alt={alt}
      className={className}
    />
  )
}

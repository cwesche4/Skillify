// app/layout.tsx
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

import { skillifyClerkAppearance } from '@/lib/auth/clerkAppearance'
import { SKILLIFY_CATEGORY_DESCRIPTOR } from '@/lib/branding/brandMessaging'

import './globals.css'

export const metadata: Metadata = {
  title: 'Skillify',
  description: SKILLIFY_CATEGORY_DESCRIPTOR,
  icons: {
    icon: [{ url: '/branding/favicons/favicon.svg', type: 'image/svg+xml' }],
    shortcut: ['/branding/favicons/favicon.ico'],
    apple: [
      {
        url: '/branding/favicons/apple-touch-icon.svg',
        type: 'image/svg+xml',
      },
    ],
    other: [
      {
        rel: 'icon',
        url: '/branding/favicons/android-chrome-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        rel: 'icon',
        url: '/branding/favicons/android-chrome-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={skillifyClerkAppearance}>
      <html
        lang="en"
        className="theme-dark dark"
        data-theme="dark"
        suppressHydrationWarning
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
(function () {
  try {
    var themeKey = 'skillify.theme';
    var versionKey = 'skillify.theme.version';
    var version = '2';
    var savedTheme = window.localStorage.getItem(themeKey);
    var savedVersion = window.localStorage.getItem(versionKey);
    var theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'dark';
    if (savedVersion !== version && savedTheme === 'light') {
      theme = 'dark';
      window.localStorage.setItem(themeKey, theme);
      window.localStorage.setItem(versionKey, version);
    }
    var isDark = theme === 'dark';
    var root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('theme-light', !isDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (error) {}
})();
              `,
            }}
          />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}

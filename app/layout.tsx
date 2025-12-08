// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import './globals.css'

// ---- Imported Fonts ----
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'

export const metadata: Metadata = {
  title: 'Skillify',
  description: 'Your SaaS platform',
}
import { Toaster } from 'sonner'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="font-inter text-neutral-text-primary dark:text-neutral-text-primary bg-neutral-light dark:bg-neutral-dark">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}

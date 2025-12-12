// app/layout.tsx
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

import './globals.css'

export const metadata: Metadata = {
  title: 'Skillify',
  description: 'Automation & analytics for modern teams',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}

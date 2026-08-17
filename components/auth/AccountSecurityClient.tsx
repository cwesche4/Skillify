'use client'

import React from 'react'
import { UserProfile } from '@clerk/nextjs'

import { skillifyClerkAppearance } from '@/lib/auth/clerkAppearance'

export function AccountSecurityClient() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-slate-950/30 sm:p-6">
      <UserProfile
        routing="path"
        path="/account/security"
        appearance={skillifyClerkAppearance}
      />
    </div>
  )
}

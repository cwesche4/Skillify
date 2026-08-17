import React from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { AccountPageShell } from '@/components/auth/AccountPageShell'
import { AccountSecurityClient } from '@/components/auth/AccountSecurityClient'

export default function AccountSecurityPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  return (
    <AccountPageShell
      title="Account & Security"
      description="Manage sign-in methods, email identities, connected providers, MFA, and active sessions through Clerk-backed controls."
    >
      <AccountSecurityClient />
    </AccountPageShell>
  )
}

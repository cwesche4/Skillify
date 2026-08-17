import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { AccountPageShell } from '@/components/auth/AccountPageShell'
import { AccountProfileClient } from '@/components/auth/AccountProfileClient'

export default async function AccountProfilePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <AccountPageShell
      title="My Profile"
      description="Manage the personal identity used across Skillify. Workspace roles and permissions remain workspace-specific."
    >
      <AccountProfileClient
        initialUser={{
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          username: user.username ?? '',
          fullName: user.fullName ?? '',
          email: user.primaryEmailAddress?.emailAddress ?? '',
          imageUrl: user.imageUrl ?? '',
        }}
      />
    </AccountPageShell>
  )
}

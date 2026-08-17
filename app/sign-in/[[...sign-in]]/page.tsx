// app/sign-in/[[...sign-in]]/page.tsx
import React from 'react'
import { SignIn } from '@clerk/nextjs'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { skillifyClerkAppearance } from '@/lib/auth/clerkAppearance'

export default function SignInPage() {
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
        appearance={skillifyClerkAppearance}
      />
    </AuthPageShell>
  )
}

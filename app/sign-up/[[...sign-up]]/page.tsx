// app/sign-up/[[...sign-up]]/page.tsx
import React from 'react'
import { SignUp } from '@clerk/nextjs'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { skillifyClerkAppearance } from '@/lib/auth/clerkAppearance'

export default function SignUpPage() {
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/dashboard"
        appearance={skillifyClerkAppearance}
      />
    </AuthPageShell>
  )
}

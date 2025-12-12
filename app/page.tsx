import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const { userId } = auth()

  // If signed in → go to dashboard
  if (userId) redirect('/dashboard')

  // If signed out → show sign-in link
  return (
    <div className="flex h-screen items-center justify-center">
      <a
        href="/sign-in"
        className="text-lg font-medium text-blue-600 underline"
      >
        Sign in
      </a>
    </div>
  )
}

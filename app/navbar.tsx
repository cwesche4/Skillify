'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { SkillifyUserMenu } from '@/components/auth/SkillifyUserMenu'
import { BrandLogo } from '@/components/branding/BrandLogo'

export default function Navbar() {
  const { user, isLoaded } = useUser()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user) {
      setIsAdmin(false)
      return
    }

    let cancelled = false
    fetch('/api/auth/is-admin')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin))
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, user])

  if (!isLoaded) return null

  return (
    <nav className="flex w-full items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
      <Link href="/" className="flex items-center">
        <BrandLogo variant="horizontal" alt="Skillify" className="h-9 w-32" />
      </Link>

      <div className="flex items-center gap-6">
        {/* Public Links */}
        <Link href="/dashboard" className="text-sm">
          Dashboard
        </Link>

        {/* Admin Only */}
        {isAdmin && (
          <Link href="/dashboard/admin/users" className="text-sm">
            Users
          </Link>
        )}

        {/* User menu */}
        {user ? (
          <SkillifyUserMenu />
        ) : (
          <Link href="/sign-in" className="text-sm">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}

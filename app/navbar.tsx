"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import Link from "next/link"

export default function Navbar() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) return null

  const role = (user?.publicMetadata as any)?.role

  return (
    <nav className="flex w-full items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
      <Link href="/" className="text-xl font-semibold">
        Skillify
      </Link>

      <div className="flex items-center gap-6">
        {/* Public Links */}
        <Link href="/dashboard" className="text-sm">
          Dashboard
        </Link>

        {/* Manager + Admin */}
        {(role === "manager" || role === "admin") && (
          <Link href="/admin" className="text-sm">
            Admin Panel
          </Link>
        )}

        {/* Admin Only */}
        {role === "admin" && (
          <Link href="/admin/users" className="text-sm">
            Users
          </Link>
        )}

        {/* User menu */}
        {user ? (
          <UserButton />
        ) : (
          <Link href="/sign-in" className="text-sm">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}

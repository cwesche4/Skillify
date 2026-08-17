'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Camera, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type InitialUser = {
  firstName: string
  lastName: string
  username: string
  fullName: string
  email: string
  imageUrl: string
}

function userDisplayName(user: InitialUser) {
  return user.fullName || user.username || user.email || 'Skillify user'
}

function getInitials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'S'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AccountProfileClient({
  initialUser,
}: {
  initialUser: InitialUser
}) {
  const { isLoaded, user } = useUser()
  const [firstName, setFirstName] = useState(initialUser.firstName)
  const [lastName, setLastName] = useState(initialUser.lastName)
  const [username, setUsername] = useState(initialUser.username)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user) return
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
    setUsername(user.username ?? '')
  }, [isLoaded, user])

  const displayUser = useMemo<InitialUser>(() => {
    if (!isLoaded || !user) return initialUser
    return {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      username: user.username ?? '',
      fullName: user.fullName ?? '',
      email: user.primaryEmailAddress?.emailAddress ?? initialUser.email,
      imageUrl: user.imageUrl ?? initialUser.imageUrl,
    }
  }, [initialUser, isLoaded, user])

  const displayName = userDisplayName(displayUser)
  const initials = getInitials(displayName)

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setError('Your account is still loading. Try again in a moment.')
      return
    }

    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      await user.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: username.trim() || undefined,
      })
      await user.reload()
      setStatus('Profile updated.')
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update your profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  const updateAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!user || typeof user.setProfileImage !== 'function') {
      setError('Your account is still loading. Try again in a moment.')
      return
    }

    setUploadingAvatar(true)
    setStatus(null)
    setError(null)
    try {
      await user.setProfileImage({ file })
      await user.reload()
      setStatus('Profile photo updated.')
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Unable to update your profile photo.',
      )
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={saveProfile}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/30 sm:p-6"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500 to-indigo-500 text-xl font-semibold text-white">
              {displayUser.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUser.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </span>
            <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-100 transition focus-within:ring-2 focus-within:ring-cyan-300 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 hover:bg-slate-800">
              <Camera className="h-3.5 w-3.5" />
              {uploadingAvatar ? 'Uploading...' : 'Change photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={updateAvatar}
                disabled={uploadingAvatar}
                aria-label="Change profile photo"
              />
            </label>
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-white">
              {displayName}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-400">
              {displayUser.email || 'No primary email on this account'}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Avatar, email addresses, login providers, and security controls
              are managed by Clerk.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-200">
            First name
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200">
            Last name
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">
            Username
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200 sm:col-span-2">
            Primary email
            <Input value={displayUser.email} readOnly aria-readonly="true" />
          </label>
        </div>

        {status ? (
          <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
          <Link
            href="/account/security"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <ShieldCheck className="h-4 w-4" />
            Account &amp; Security
          </Link>
        </div>
      </form>

      <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
        <h2 className="font-semibold text-white">
          Workspace roles stay separate
        </h2>
        <p className="mt-2">
          This page updates your personal Skillify account. Workspace roles,
          team membership, working hours, and business settings are managed per
          workspace by workspace owners and admins.
        </p>
      </aside>
    </div>
  )
}

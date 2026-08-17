import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const clerkMocks = vi.hoisted(() => {
  const signOut = vi.fn()
  const update = vi.fn()
  const reload = vi.fn()
  const setProfileImage = vi.fn()
  const user = {
    id: 'user-1',
    firstName: 'Corbin',
    lastName: 'Wesche',
    fullName: 'Corbin Wesche',
    username: 'corbin',
    imageUrl: '',
    primaryEmailAddress: { emailAddress: 'corbin@example.com' },
    update,
    reload,
    setProfileImage,
  }

  return {
    signOut,
    update,
    reload,
    setProfileImage,
    user,
  }
})

vi.mock('@clerk/nextjs', () => ({
  SignIn: () =>
    React.createElement(
      'div',
      { 'data-testid': 'clerk-sign-in' },
      React.createElement('button', { type: 'button' }, 'Continue with Google'),
      React.createElement('a', { href: '/sign-up' }, 'Sign up'),
    ),
  SignUp: () =>
    React.createElement(
      'div',
      { 'data-testid': 'clerk-sign-up' },
      React.createElement('button', { type: 'button' }, 'Continue with Google'),
      React.createElement('a', { href: '/sign-in' }, 'Sign in'),
    ),
  UserProfile: ({ path }: { path: string }) =>
    React.createElement(
      'section',
      { 'data-testid': 'clerk-user-profile' },
      `Clerk security controls ${path}`,
    ),
  useClerk: () => ({ signOut: clerkMocks.signOut }),
  useUser: () => ({ isLoaded: true, user: clerkMocks.user }),
}))

vi.mock('@/components/branding/BrandLogo', () => ({
  BrandLogo: ({ alt }: { alt: string }) =>
    React.createElement('span', { 'aria-label': alt }, alt),
}))

import SignInPage from '@/app/sign-in/[[...sign-in]]/page'
import SignUpPage from '@/app/sign-up/[[...sign-up]]/page'
import { AccountProfileClient } from '@/components/auth/AccountProfileClient'
import { AccountSecurityClient } from '@/components/auth/AccountSecurityClient'
import { SkillifyUserMenu } from '@/components/auth/SkillifyUserMenu'
import { SKILLIFY_SHORT_TAGLINE } from '@/lib/branding/brandMessaging'

describe('Skillify auth and account experience', () => {
  beforeEach(() => {
    clerkMocks.signOut.mockClear()
    clerkMocks.update.mockClear()
    clerkMocks.reload.mockClear()
    clerkMocks.setProfileImage.mockClear()
  })

  it('renders a branded Skillify sign-in shell with Clerk SignIn inside it', () => {
    render(React.createElement(SignInPage))

    expect(screen.getByLabelText('Skillify')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Sign in to Skillify' }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Welcome back. Sign in to continue managing your workspace.',
      ),
    ).toBeTruthy()
    expect(screen.getByText(SKILLIFY_SHORT_TAGLINE)).toBeTruthy()
    expect(screen.getByTestId('clerk-sign-in')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Create an account' })
        .getAttribute('href'),
    ).toBe('/sign-up')
  })

  it('renders a matching branded sign-up shell with Clerk SignUp inside it', () => {
    render(React.createElement(SignUpPage))

    expect(screen.getByLabelText('Skillify')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Create your Skillify account' }),
    ).toBeTruthy()
    expect(screen.getByText(SKILLIFY_SHORT_TAGLINE)).toBeTruthy()
    expect(screen.getByTestId('clerk-sign-up')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeTruthy()
    expect(
      screen
        .getAllByRole('link', { name: 'Sign in' })
        .some((link) => link.getAttribute('href') === '/sign-in'),
    ).toBe(true)
  })

  it('opens a Skillify-native profile dropdown and signs out through Clerk', () => {
    render(React.createElement(SkillifyUserMenu))

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))

    expect(screen.getByRole('menu', { name: 'Account menu' })).toBeTruthy()
    expect(screen.getAllByText('Corbin Wesche').length).toBeGreaterThan(0)
    expect(screen.getByText('corbin@example.com')).toBeTruthy()
    expect(
      screen
        .getByRole('menuitem', { name: /My Profile/i })
        .getAttribute('href'),
    ).toBe('/account/profile')
    expect(
      screen
        .getByRole('menuitem', { name: /Account & Security/i })
        .getAttribute('href'),
    ).toBe('/account/security')
    expect(screen.queryByText('Manage account')).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /Sign Out/i }))
    expect(clerkMocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/' })
  })

  it('updates profile fields through Clerk without exposing workspace permissions editing', async () => {
    clerkMocks.update.mockResolvedValue({})
    clerkMocks.reload.mockResolvedValue({})

    render(
      React.createElement(AccountProfileClient, {
        initialUser: {
          firstName: 'Corbin',
          lastName: 'Wesche',
          username: 'corbin',
          fullName: 'Corbin Wesche',
          email: 'corbin@example.com',
          imageUrl: '',
        },
      }),
    )

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Corey' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => {
      expect(clerkMocks.update).toHaveBeenCalledWith({
        firstName: 'Corey',
        lastName: 'Wesche',
        username: 'corbin',
      })
    })
    expect(clerkMocks.reload).toHaveBeenCalled()
    expect(screen.getByText(/Workspace roles stay separate/i)).toBeTruthy()
    expect(screen.queryByText(/Change workspace role/i)).toBeNull()
  })

  it('updates avatar through Clerk without storing a Skillify avatar field', async () => {
    clerkMocks.setProfileImage.mockResolvedValue({})
    clerkMocks.reload.mockResolvedValue({})

    render(
      React.createElement(AccountProfileClient, {
        initialUser: {
          firstName: 'Corbin',
          lastName: 'Wesche',
          username: 'corbin',
          fullName: 'Corbin Wesche',
          email: 'corbin@example.com',
          imageUrl: '',
        },
      }),
    )

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Change profile photo'), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(clerkMocks.setProfileImage).toHaveBeenCalledWith({ file })
    })
    expect(clerkMocks.reload).toHaveBeenCalled()
    expect(screen.queryByText(/Prisma avatar/i)).toBeNull()
  })

  it('embeds Clerk-backed account and security controls inside the Skillify surface', () => {
    render(React.createElement(AccountSecurityClient))

    expect(screen.getByTestId('clerk-user-profile').textContent).toContain(
      'Clerk security controls /account/security',
    )
  })
})

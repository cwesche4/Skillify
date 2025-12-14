// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/'])

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/workspaces(.*)',
])

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()

  // Always attach pathname so Server Components (like protected-layout) can read it
  const headers = new Headers(req.headers)
  headers.set('x-pathname', req.nextUrl.pathname)

  // 1) Allow all public routes (including Clerk auth pages)
  if (isPublicRoute(req)) {
    return NextResponse.next({ request: { headers } })
  }

  // 2) Protect dashboard / onboarding / workspaces
  if (isProtectedRoute(req) && !userId) {
    return auth().redirectToSignIn()
  }

  // 3) Continue
  return NextResponse.next({ request: { headers } })
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/(api|trpc)(.*)'],
}

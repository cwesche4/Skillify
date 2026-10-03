// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/e/(.*)',
  '/api/public/estimates/(.*)',
  '/',
])

const isPublicEstimateRoute = createRouteMatcher([
  '/e/(.*)',
  '/api/public/estimates/(.*)',
])

const isProtectedRoute = createRouteMatcher([
  '/account(.*)',
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
    const response = NextResponse.next({ request: { headers } })
    if (isPublicEstimateRoute(req)) {
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Referrer-Policy', 'no-referrer')
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'",
      )
    }
    return response
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

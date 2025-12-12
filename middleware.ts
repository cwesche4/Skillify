// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that should never trigger Clerk redirects (prevents sign-in loop)
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
])

// Routes that require auth
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/workspaces(.*)',
])

export default clerkMiddleware((auth, req) => {
  // Skip protection for public routes (including Clerk auth pages)
  if (isPublicRoute(req)) {
    return
  }

  // Enforce auth for protected areas — Clerk handles redirect to /sign-in
  if (isProtectedRoute(req)) {
    auth().protect()
  }
})

export const config = {
  // Recommended matcher from Clerk for App Router
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/(api|trpc)(.*)'],
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/workspaces(.*)',
])

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()

  // Allow sign-in + sign-up ALWAYS
  if (req.nextUrl.pathname.startsWith('/sign-in')) return
  if (req.nextUrl.pathname.startsWith('/sign-up')) return

  // If protected route → ensure signed in
  if (isProtectedRoute(req) && !userId) {
    return auth().redirectToSignIn()
  }
})

export const config = {
  matcher: ['/((?!_next|static|favicon.ico|sign-in|sign-up|api).*)'],
}

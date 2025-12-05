import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()
  const url = req.nextUrl
  const path = url.pathname

  const isPublicRoute =
    path === "/" ||
    path === "/pricing" ||
    path === "/about" ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/sso-callback") ||
    path.startsWith("/api/webhooks")

  if (!isPublicRoute && !userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  // Handle onboarding redirect
  if (path === "/dashboard" || path === "/") {
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

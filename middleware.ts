import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default async function middleware(req: Request) {
  const url = new URL(req.url)
  const pathname = url.pathname

  // Admin section
  if (pathname.startsWith('/dashboard') && pathname.includes('/admin')) {
    const { userId } = auth()
    if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*/admin/:path*'],
}

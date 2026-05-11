import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow auth endpoints through
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const auth = request.cookies.get('st-auth')?.value
  const validToken = process.env.AUTH_SECRET
  const isAuthenticated = !!auth && !!validToken && auth === validToken
  const isLoginPage = pathname === '/login'

  if (!isAuthenticated) {
    if (isLoginPage) return NextResponse.next()
    // For API routes return 401 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

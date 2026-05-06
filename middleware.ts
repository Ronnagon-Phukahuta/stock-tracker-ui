import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('st-auth')?.value
  const isLoginPage = request.nextUrl.pathname === '/login'
  
  if (!auth) {
    if (isLoginPage) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}

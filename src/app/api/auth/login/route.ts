import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { password } = await request.json()
  
  if (password === process.env.AUTH_SECRET) {
    const cookieStore = await cookies()
    cookieStore.set('st-auth', process.env.AUTH_SECRET!, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30  // 30 days
    })
    return NextResponse.json({ ok: true })
  }
  
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}

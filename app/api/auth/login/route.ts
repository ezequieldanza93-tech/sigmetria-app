import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email y contraseña son requeridos' },
      { status: 400 },
    )
  }

  let setCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
          setCookies = cookies
        },
      },
    },
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 401 })
    setCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    )
    return response
  }

  try {
    await supabase.rpc('cache_user_permissions')
  } catch {
    // non-critical
  }

  const response = NextResponse.json({ success: true })
  setCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  )
  return response
}

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    let email: string, password: string
    try {
      const body = await request.json()
      email = body.email
      password = body.password
    } catch (parseError) {
      console.error('[API auth/login] JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Formato de solicitud inválido' },
        { status: 400 },
      )
    }

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
      console.error('[API auth/login] Supabase error:', error.message)
      const response = NextResponse.json({ error: error.message }, { status: 401 })
      setCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      )
      return response
    }

    // Auth successful — cache user permissions (non-critical)
    try {
      await supabase.rpc('cache_user_permissions')
    } catch {
      // non-critical
    }

    console.warn('[API auth/login] Login OK for', email)
    const response = NextResponse.json({ success: true })
    setCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    )
    return response
  } catch (e) {
    console.error('[API auth/login] Unhandled error:', e)
    const message = e instanceof Error ? e.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

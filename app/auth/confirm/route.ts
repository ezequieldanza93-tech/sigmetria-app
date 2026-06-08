import { type NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Confirma el OTP de un link de invitación (o cualquier email OTP) y deja la
// sesión en cookies vía @supabase/ssr. El action_link nativo de Supabase deja
// la sesión en el hash fragment (#access_token=...), que el middleware
// cookie-based no puede leer. Por eso el invite apunta acá con el token_hash:
// verifyOtp lo canjea server-side y escribe las cookies de sesión.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/set-password'

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?error=invite_invalid', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=invite_invalid', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}

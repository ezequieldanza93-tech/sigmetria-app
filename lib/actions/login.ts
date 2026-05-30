'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getTestMfaBypassCookie } from '@/lib/auth/test-mfa-bypass'

function buildSupabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs: { name: string; value: string; options: CookieOptions }[]) {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { }
        },
      },
    },
  )
}

export async function signup(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const fullName = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!fullName || !email || !password) return { error: 'Completá todos los campos' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }

  const service = createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'No se pudo crear la cuenta' }

  return { success: true }
}

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos' }
  }

  const cookieStore = await cookies()
  const supabase = buildSupabaseClient(cookieStore)

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  try {
    await supabase.rpc('cache_user_permissions')
  } catch {
    // non-critical
  }

  // TEMP testing bypass — ver lib/auth/test-mfa-bypass.ts
  if (signInData.user) {
    const bypass = await getTestMfaBypassCookie(email, signInData.user.id)
    if (bypass) cookieStore.set(bypass.name, bypass.value, bypass.options)
  }

  redirect('/dashboard/empresas')
}

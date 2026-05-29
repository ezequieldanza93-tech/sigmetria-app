'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

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

  const cookieStore = await cookies()
  const supabase = buildSupabaseClient(cookieStore)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) return { error: error.message }

  // Auto-confirmar el email — herramienta interna, no necesitamos verificación por link
  if (data.user) {
    const service = createServiceClient()
    await service.auth.admin.updateUserById(data.user.id, { email_confirm: true })
  }

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

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  try {
    await supabase.rpc('cache_user_permissions')
  } catch {
    // non-critical
  }

  redirect('/dashboard/empresas')
}

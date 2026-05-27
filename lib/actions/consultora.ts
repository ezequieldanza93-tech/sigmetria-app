'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Consultora } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { uploadAsset, deleteAsset, pathFromUrl } from '@/lib/storage/upload'
import { z } from 'zod'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { headers } from 'next/headers'

const createConsultoraSchema = z.object({
  nombre: z.string().min(1, { message: 'El nombre es obligatorio' }),
  cuit: z.string().nullable().optional(),
  email: z.string().email({ message: 'Email inválido' }).nullable().optional(),
  telefono: z.string().nullable().optional(),
})

const inviteConsultoraAdminSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  full_name: z.string().min(1, { message: 'El nombre es obligatorio' }),
  consultora_id: z.string().uuid({ message: 'ID de consultora inválido' }),
})

export async function createConsultora(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'developer') {
    return { success: false, error: 'Solo developers pueden crear consultoras' }
  }

  const parsed = validateFormData(createConsultoraSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { nombre, cuit, email, telefono } = parsed.data

  const { data, error } = await supabase
    .from('consultoras')
    .insert({ nombre: nombre.trim(), cuit: cuit || null, email: email || null, telefono: telefono || null })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}

export async function inviteConsultoraAdmin(formData: FormData): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'developer') {
    return { success: false, error: 'Solo developers pueden usar esta función' }
  }

  const parsed = validateFormData(inviteConsultoraAdminSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { email, full_name: fullName, consultora_id: consultoraId } = parsed.data

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`

  const response = await fetch(`${baseUrl}/api/admin/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      full_name: fullName,
      role: 'full_access_main',
      consultora_id: consultoraId,
    }),
  })

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Error al invitar usuario' }))
    return { success: false, error }
  }

  return { success: true, data: null }
}

export async function updateConsultora(data: {
  nombre: string
  telefono: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  social_links: Record<string, string> | null
}): Promise<ActionResult<Consultora>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('consultora_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (!membership) return { success: false, error: 'No pertenecés a ninguna consultora' }

  const isSuperAdmin = profile?.is_super_admin === true
  if (!isSuperAdmin && membership.role !== 'full_access_main') {
    return { success: false, error: 'Solo el Admin Principal puede editar la información de la consultora' }
  }

  const { data: updated, error } = await supabase
    .from('consultoras')
    .update({
      nombre: data.nombre,
      telefono: data.telefono,
      email: data.email,
      website: data.website,
      logo_url: data.logo_url,
      social_links: data.social_links,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.consultora_id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracion/consultora')
  return { success: true, data: updated as unknown as Consultora }
}

export async function uploadConsultoraLogo(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'No pertenecés a ninguna consultora' }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Archivo vacío' }

  const { data: current } = await supabase
    .from('consultoras')
    .select('logo_url')
    .eq('id', membership.consultora_id)
    .single()

  const result = await uploadAsset({
    bucket: 'consultora',
    consultoraId: membership.consultora_id,
    entityType: 'consultora',
    entityId: membership.consultora_id,
    kind: 'logo',
    file,
  })

  if (!result.ok) return { success: false, error: result.error }

  if (current?.logo_url && current.logo_url !== result.url) {
    const oldPath = pathFromUrl(current.logo_url, 'consultora')
    if (oldPath) await deleteAsset('consultora', oldPath)
  }

  await supabase
    .from('consultoras')
    .update({ logo_url: result.url, updated_at: new Date().toISOString() })
    .eq('id', membership.consultora_id)

  revalidatePath('/dashboard/configuracion/consultora')
  return { success: true, data: { url: result.url } }
}

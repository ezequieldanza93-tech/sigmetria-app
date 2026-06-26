'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ActionResult, Consultora } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { deleteAsset, pathFromUrl } from '@/lib/storage/upload'
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
  social_links?: Record<string, string> | null
  color_marca_primario?: string | null
  color_marca_secundario?: string | null
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

  const payload: Record<string, unknown> = {
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email,
    website: data.website,
    logo_url: data.logo_url,
    updated_at: new Date().toISOString(),
  }
  // Solo incluimos social_links en el update si fue pasado explícitamente
  if ('social_links' in data) {
    payload.social_links = data.social_links
  }
  // Color de marca (white-label PDF): validamos hex #RRGGBB; vacío/ inválido → null
  // (= verde Sigmetría). El CHECK de la tabla refuerza esto a nivel DB.
  const hexOk = (v: string | null | undefined) => (v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null)
  if ('color_marca_primario' in data) {
    payload.color_marca_primario = hexOk(data.color_marca_primario)
  }
  if ('color_marca_secundario' in data) {
    payload.color_marca_secundario = hexOk(data.color_marca_secundario)
  }

  const { data: updated, error } = await supabase
    .from('consultoras')
    .update(payload)
    .eq('id', membership.consultora_id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracion/consultora')
  revalidatePath('/dashboard/empresas')
  return { success: true, data: updated as unknown as Consultora }
}

export async function uploadConsultoraLogo(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
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
    return { success: false, error: 'Solo el Admin Principal puede cambiar el logo de la consultora' }
  }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Archivo vacío' }

  const { data: current } = await supabase
    .from('consultoras')
    .select('logo_url')
    .eq('id', membership.consultora_id)
    .single()

  const LOGO_MIMES: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  }
  if (file.size > 2 * 1024 * 1024) return { success: false, error: 'El archivo supera 2 MB' }
  if (!LOGO_MIMES[file.type]) return { success: false, error: `Tipo no permitido (${file.type})` }

  const ext = LOGO_MIMES[file.type]
  const logoPath = `${membership.consultora_id}/consultora/${membership.consultora_id}/logo.${ext}`

  // Service client: auth ya fue verificado arriba; evita problemas de RLS en storage desde SSR
  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('consultora')
    .upload(logoPath, file, { upsert: true, contentType: file.type, cacheControl: '3600' })

  if (uploadError) return { success: false, error: uploadError.message }

  const { data: urlData } = service.storage.from('consultora').getPublicUrl(logoPath)
  const logoUrl = urlData.publicUrl

  if (current?.logo_url) {
    const oldPath = current.logo_url.startsWith('http')
      ? pathFromUrl(current.logo_url, 'consultora')
      : current.logo_url
    if (oldPath && oldPath !== logoPath) await deleteAsset('consultora', oldPath)
  }

  const { error: updateError } = await supabase
    .from('consultoras')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', membership.consultora_id)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath('/dashboard/configuracion/consultora')
  revalidatePath('/dashboard/empresas')
  return { success: true, data: { url: logoUrl } }
}

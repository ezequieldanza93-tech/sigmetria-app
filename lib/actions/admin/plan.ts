'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return isNaN(n) ? null : n
}

async function requireSuperAdmin(): Promise<ActionResult<{ userId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) return { success: false, error: 'No autorizado' }

  return { success: true, data: { userId: user.id } }
}

export async function createPlan(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const nombre = formData.get('nombre') as string
  const slugRaw = formData.get('slug') as string
  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const slug = slugRaw?.trim() ? slugify(slugRaw) : slugify(nombre)
  if (!slug) return { success: false, error: 'El slug es inválido' }

  const admin = createAdminClient()

  const { data: existing } = await admin.from('plans').select('id').eq('slug', slug).maybeSingle()
  if (existing) return { success: false, error: `Ya existe un plan con el slug "${slug}"` }

  const precio_mensual_neto = extractNumber(formData.get('precio_mensual_neto'))
  const precio_anual_neto = extractNumber(formData.get('precio_anual_neto'))
  const iva_porcentaje = extractNumber(formData.get('iva_porcentaje')) ?? 21.00
  const max_colaboradores = extractNumber(formData.get('max_colaboradores'))
  const max_empresas = extractNumber(formData.get('max_empresas'))
  const max_establecimientos = extractNumber(formData.get('max_establecimientos'))
  const max_gestiones_registros = extractNumber(formData.get('max_gestiones_registros'))
  const max_horarios_registros = extractNumber(formData.get('max_horarios_registros'))
  const precio_extra_seat_neto = extractNumber(formData.get('precio_extra_seat_neto'))
  const tipo = (formData.get('tipo') as string)?.trim() || slug
  const descripcion_corta = (formData.get('descripcion_corta') as string)?.trim() || null
  const is_visible = formData.get('is_visible') === 'on'
  const destacado = formData.get('destacado') === 'on'

  const { error } = await admin.from('plans').insert({
    nombre: nombre.trim(),
    slug,
    tipo,
    precio_mensual_neto,
    precio_anual_neto,
    iva_porcentaje,
    max_colaboradores,
    max_empresas,
    max_establecimientos,
    max_gestiones_registros,
    max_horarios_registros,
    precio_extra_seat_neto,
    descripcion_corta,
    is_visible,
    destacado,
    is_active: true,
    sort_order: 0,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/admin/planes')
  return { success: true, data: null }
}

export async function updatePlan(
  id: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const nombre = formData.get('nombre') as string
  const slugRaw = formData.get('slug') as string
  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const slug = slugRaw?.trim() ? slugify(slugRaw) : slugify(nombre)
  if (!slug) return { success: false, error: 'El slug es inválido' }

  const admin = createAdminClient()

  const { data: existing } = await admin.from('plans').select('id').eq('slug', slug).neq('id', id).maybeSingle()
  if (existing) return { success: false, error: `Ya existe otro plan con el slug "${slug}"` }

  const precio_mensual_neto = extractNumber(formData.get('precio_mensual_neto'))
  const precio_anual_neto = extractNumber(formData.get('precio_anual_neto'))
  const iva_porcentaje = extractNumber(formData.get('iva_porcentaje')) ?? 21.00
  const max_colaboradores = extractNumber(formData.get('max_colaboradores'))
  const max_empresas = extractNumber(formData.get('max_empresas'))
  const max_establecimientos = extractNumber(formData.get('max_establecimientos'))
  const max_gestiones_registros = extractNumber(formData.get('max_gestiones_registros'))
  const max_horarios_registros = extractNumber(formData.get('max_horarios_registros'))
  const precio_extra_seat_neto = extractNumber(formData.get('precio_extra_seat_neto'))
  const tipo = (formData.get('tipo') as string)?.trim() || slug
  const descripcion_corta = (formData.get('descripcion_corta') as string)?.trim() || null
  const is_visible = formData.get('is_visible') === 'on'
  const destacado = formData.get('destacado') === 'on'
  const is_active = formData.get('is_active') === 'on'

  const { error } = await admin.from('plans').update({
    nombre: nombre.trim(),
    slug,
    tipo,
    precio_mensual_neto,
    precio_anual_neto,
    iva_porcentaje,
    max_colaboradores,
    max_empresas,
    max_establecimientos,
    max_gestiones_registros,
    max_horarios_registros,
    precio_extra_seat_neto,
    descripcion_corta,
    is_visible,
    destacado,
    is_active,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/admin/planes')
  revalidatePath(`/dashboard/admin/planes/${id}`)
  return { success: true, data: null }
}

export async function deletePlan(id: string): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const admin = createAdminClient()

  const { count } = await admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan_id', id)
  if (count && count > 0) {
    const { error } = await admin.from('plans').update({ is_active: false }).eq('id', id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await admin.from('plans').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/admin/planes')
  return { success: true, data: null }
}

export async function togglePlanVisibility(
  id: string,
  isVisible: boolean
): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const admin = createAdminClient()
  const { error } = await admin.from('plans').update({ is_visible: isVisible }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/admin/planes')
  return { success: true, data: null }
}

export async function togglePlanDestacado(
  id: string,
  destacado: boolean
): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const admin = createAdminClient()
  const { error } = await admin.from('plans').update({ destacado }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/admin/planes')
  return { success: true, data: null }
}

export async function reorderPlans(ids: string[]): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const admin = createAdminClient()
  const updates = ids.map((id, i) => ({
    id,
    sort_order: i,
  }))

  for (const u of updates) {
    const { error } = await admin.from('plans').update({ sort_order: u.sort_order }).eq('id', u.id)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/admin/planes')
  return { success: true, data: null }
}

export async function updatePlanFeatures(
  planId: string,
  features: { key: string; enabled: boolean }[]
): Promise<ActionResult<null>> {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth

  const admin = createAdminClient()

  const existing = await admin.from('plan_features').select('feature_key').eq('plan_id', planId)
  const existingKeys = new Set((existing.data ?? []).map(f => f.feature_key))

  for (const f of features) {
    if (existingKeys.has(f.key)) {
      await admin.from('plan_features').update({ habilitado: f.enabled }).eq('plan_id', planId).eq('feature_key', f.key)
    } else {
      await admin.from('plan_features').insert({ plan_id: planId, feature_key: f.key, habilitado: f.enabled })
    }
  }

  revalidatePath('/dashboard/admin/planes')
  revalidatePath(`/dashboard/admin/planes/${planId}`)
  return { success: true, data: null }
}

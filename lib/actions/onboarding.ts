'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { SECTORES_PREDEFINIDOS } from '@/lib/constants'

/**
 * Onboarding autoservicio — Paso 1: el usuario recién registrado crea SU
 * consultora y queda automáticamente como Admin Principal (full_access_main).
 *
 * Se usa el service client a propósito: la membresía inicial NO puede insertarse
 * con el cliente normal porque la RLS de consultoras_members exige ya ser
 * full_access_main de esa consultora (problema de huevo y gallina). El trigger
 * on_consultora_created crea la suscripción trial automáticamente al insertar.
 */
export async function createMyConsultora(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Un usuario que ya pertenece a una consultora no puede crear otra.
  const { data: existing } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (existing) return { success: false, error: 'Ya pertenecés a una consultora' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre de la consultora es obligatorio' }

  const cuit = (formData.get('cuit') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const telefono = (formData.get('telefono') as string)?.trim() || null

  const service = createServiceClient()

  const { data: consultora, error: consultoraError } = await service
    .from('consultoras')
    .insert({ nombre, cuit, email, telefono })
    .select('id')
    .single()
  if (consultoraError) return { success: false, error: consultoraError.message }

  const { error: memberError } = await service
    .from('consultoras_members')
    .insert({
      consultora_id: consultora.id,
      user_id: user.id,
      role: 'full_access_main',
      is_active: true,
      invited_by: user.id,
    })

  if (memberError) {
    // No quedó membresía: borrar la consultora huérfana para no dejar basura.
    await service.from('consultoras').delete().eq('id', consultora.id)
    return { success: false, error: memberError.message }
  }

  // ── Plan elegido en el wizard ────────────────────────────────────────────────
  // FASE DE ARMADO (sin pasarela): elegir el plan funciona como "pago recibido" →
  // se activa la suscripción del plan y el usuario queda como admin de ese plan.
  // El trigger on_consultora_created ya creó una suscripción trial; acá la subimos
  // al plan elegido (si no es trial/gratis).
  const planSlug = (formData.get('plan_slug') as string)?.trim()
  if (planSlug && planSlug !== 'trial') {
    const { data: plan } = await service
      .from('plans')
      .select('id, max_colaboradores, tipo')
      .eq('slug', planSlug)
      .maybeSingle()
    if (plan) {
      const now = new Date()
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      await service
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          estado: 'active',
          periodo: 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('consultora_id', consultora.id)

      // seats_max = admin + colaboradores del plan (null = ilimitado → tope alto).
      const seatsMax = plan.max_colaboradores == null ? 999 : plan.max_colaboradores + 1
      await service
        .from('consultoras')
        .update({
          seats_max: seatsMax,
          tipo: plan.tipo === 'profesional_independiente' ? 'profesional' : 'consultora',
        })
        .eq('id', consultora.id)
    }
  }

  // Refrescar el cache de permisos de la sesión actual.
  try { await supabase.rpc('cache_user_permissions') } catch { /* no crítico */ }

  revalidatePath('/dashboard', 'layout')
  return { success: true, data: { id: consultora.id } }
}

/**
 * Onboarding autoservicio — Paso 2 (opcional): crear la primera empresa cliente.
 * Acá el usuario ya es full_access_main con trial activo, así que la RLS normal
 * permite el insert (no hace falta service client).
 */
export async function createOnboardingEmpresa(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!membership?.consultora_id) return { success: false, error: 'Primero creá tu consultora' }

  const razonSocial = (formData.get('razon_social') as string)?.trim()
  if (!razonSocial) return { success: false, error: 'La razón social es obligatoria' }

  const cuit = (formData.get('cuit') as string)?.trim() || null

  const { data, error } = await supabase
    .from('empresas')
    .insert({ consultora_id: membership.consultora_id, razon_social: razonSocial, cuit })
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/empresas')
  return { success: true, data: { id: data.id } }
}

/**
 * Onboarding autoservicio — Paso 3 (opcional): crear el primer establecimiento
 * de la empresa recién creada. Siembra los sectores predefinidos, igual que
 * createEstablecimiento.
 */
export async function createOnboardingEstablecimiento(
  empresaId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre del establecimiento es obligatorio' }

  const domicilio = (formData.get('domicilio') as string)?.trim() || null

  const { data, error } = await supabase
    .from('establecimientos')
    .insert({ empresa_id: empresaId, nombre, domicilio })
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }

  const sectores = SECTORES_PREDEFINIDOS.map(nombreSector => ({
    establecimiento_id: data.id,
    nombre: nombreSector,
    es_custom: false,
    cantidad_trabajadores: 0,
  }))
  await supabase.from('establecimientos_sectores').insert(sectores)

  revalidatePath(`/dashboard/empresas/${empresaId}`)
  return { success: true, data: { id: data.id } }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRegaloPlanEmail } from '@/lib/email/regalo-plan'
import type { ActionResult } from '@/lib/types'

// ─── Tipos ────────────────────────────────────────────────

export interface GiftedPlanRow {
  id: string
  email: string
  plan_id: string
  plan_nombre: string
  ciclo: 'monthly' | 'annual'
  is_founder: boolean
  estado: 'pendiente' | 'activado' | 'cancelado'
  nota: string | null
  created_at: string
  activated_at: string | null
  consultora_id: string | null
}

interface RegalarPlanInput {
  email: string
  planId: string
  ciclo: 'monthly' | 'annual'
  isFounder: boolean
  nota?: string
}

// ─── Helper: verificar super-admin server-side ─────────────

async function verificarSuperAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) return { ok: false, error: 'No autorizado' }
  return { ok: true, userId: user.id }
}

// ─── Regalar plan ──────────────────────────────────────────

export async function regalarPlan(
  input: RegalarPlanInput,
): Promise<ActionResult<{ giftId: string }>> {
  try {
    const auth = await verificarSuperAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    const { email, planId, ciclo, isFounder, nota } = input

    if (!email || !planId || !ciclo) {
      return { success: false, error: 'Faltan datos obligatorios' }
    }

    const admin = createAdminClient()

    // Validar que el plan exista y sea pago self-serve (no trial, no empresa)
    const { data: plan } = await admin
      .from('plans')
      .select('id, nombre, tipo, is_active')
      .eq('id', planId)
      .single()

    if (!plan) return { success: false, error: 'Plan no encontrado' }
    if (!plan.is_active) return { success: false, error: 'El plan no está activo' }
    if (plan.tipo === 'trial') return { success: false, error: 'No se puede regalar el plan trial' }
    if (plan.tipo === 'empresa') return { success: false, error: 'El plan Empresa es a medida y no se puede regalar desde acá' }

    // Verificar que no haya un regalo pendiente para este email+plan
    const { data: existente } = await admin
      .from('gifted_plans')
      .select('id')
      .eq('plan_id', planId)
      .eq('estado', 'pendiente')
      .ilike('email', email)
      .maybeSingle()

    if (existente) {
      return { success: false, error: 'Ya existe un regalo pendiente para este email con ese plan' }
    }

    const { data: gift, error: insertError } = await admin
      .from('gifted_plans')
      .insert({
        email: email.toLowerCase().trim(),
        plan_id: planId,
        ciclo,
        is_founder: isFounder,
        otorgado_por: auth.userId,
        estado: 'pendiente',
        nota: nota?.trim() || null,
      })
      .select('id')
      .single()

    if (insertError || !gift) {
      return { success: false, error: insertError?.message ?? 'Error al guardar el regalo' }
    }

    // Enviar email (best-effort — no rompe si falla)
    try {
      await sendRegaloPlanEmail({
        email: email.toLowerCase().trim(),
        planNombre: plan.nombre,
        ciclo,
        isFounder,
        nota: nota?.trim() || null,
      })
    } catch (emailErr) {
      console.error('[regalarPlan] email falló (no crítico):', emailErr)
    }

    revalidatePath('/dashboard/admin/regalar-plan')
    return { success: true, data: { giftId: gift.id } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al regalar plan'
    return { success: false, error: message }
  }
}

// ─── Listar regalos ────────────────────────────────────────

export async function listarRegalos(): Promise<ActionResult<GiftedPlanRow[]>> {
  try {
    const auth = await verificarSuperAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('gifted_plans')
      .select('id, email, plan_id, ciclo, is_founder, estado, nota, created_at, activated_at, consultora_id, plans(nombre)')
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const rows: GiftedPlanRow[] = (data ?? []).map((row: any) => ({
      id: row.id,
      email: row.email,
      plan_id: row.plan_id,
      plan_nombre: row.plans?.nombre ?? '—',
      ciclo: row.ciclo as 'monthly' | 'annual',
      is_founder: row.is_founder,
      estado: row.estado as 'pendiente' | 'activado' | 'cancelado',
      nota: row.nota,
      created_at: row.created_at,
      activated_at: row.activated_at,
      consultora_id: row.consultora_id,
    }))

    return { success: true, data: rows }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al listar regalos'
    return { success: false, error: message }
  }
}

// ─── Cancelar regalo ───────────────────────────────────────

export async function cancelarRegalo(giftId: string): Promise<ActionResult<void>> {
  try {
    const auth = await verificarSuperAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    if (!giftId) return { success: false, error: 'giftId requerido' }

    const admin = createAdminClient()

    // Solo cancelar si estaba pendiente
    const { data: gift } = await admin
      .from('gifted_plans')
      .select('id, estado')
      .eq('id', giftId)
      .single()

    if (!gift) return { success: false, error: 'Regalo no encontrado' }
    if (gift.estado !== 'pendiente') {
      return { success: false, error: `No se puede cancelar un regalo con estado "${gift.estado}"` }
    }

    const { error } = await admin
      .from('gifted_plans')
      .update({ estado: 'cancelado' })
      .eq('id', giftId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/admin/regalar-plan')
    return { success: true, data: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cancelar regalo'
    return { success: false, error: message }
  }
}

// ─── Listar planes regalables (server-side) ────────────────

export interface PlanRegalable {
  id: string
  nombre: string
  tipo: string
  precio_mensual_neto: number | null
  precio_anual_neto: number | null
}

export async function listarPlanesRegalables(): Promise<ActionResult<PlanRegalable[]>> {
  try {
    const auth = await verificarSuperAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('plans')
      .select('id, nombre, tipo, precio_mensual_neto, precio_anual_neto')
      .eq('is_active', true)
      .not('tipo', 'in', '(trial,empresa)')
      .order('sort_order', { ascending: true })

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: (data ?? []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        precio_mensual_neto: p.precio_mensual_neto !== null ? Number(p.precio_mensual_neto) : null,
        precio_anual_neto: p.precio_anual_neto !== null ? Number(p.precio_anual_neto) : null,
      })),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al listar planes'
    return { success: false, error: message }
  }
}

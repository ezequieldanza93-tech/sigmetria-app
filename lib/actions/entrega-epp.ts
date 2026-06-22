'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole, SystemRole, ActionResult } from '@/lib/types'
import { canWrite } from '@/lib/types'

export interface EntregaEppItemInput {
  producto_id?: string | null
  producto_nombre: string
  talle?: string | null
  cantidad?: number
}

export interface RegistrarEntregaEppInput {
  personaId: string
  establecimientoId?: string | null
  fechaEntrega?: string | null // YYYY-MM-DD
  observaciones?: string | null
  items: EntregaEppItemInput[]
}

/**
 * Registra una entrega de EPP a un trabajador (encabezado + ítems).
 *
 * Se ejecuta con la SESIÓN del profesional (no service role) a propósito: así el
 * trigger de auditoría atribuye la entrega a su auth.uid() y la RLS valida que
 * sea un rol de escritura de la consultora. El trabajador después confirma u
 * observa cada ítem desde su cuenta.
 */
export async function registrarEntregaEpp(
  input: RegistrarEntregaEppInput,
): Promise<ActionResult<{ entregaId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole | undefined) ?? null
  const consultoraId = membership?.consultora_id
  if (!consultoraId) return { success: false, error: 'No estás asociado a una consultora activa' }
  if (!canWrite(myRole, systemRole)) {
    return { success: false, error: 'No tenés permiso para registrar entregas de EPP' }
  }

  const items = (input.items ?? []).filter(i => i.producto_nombre?.trim())
  if (items.length === 0) {
    return { success: false, error: 'Agregá al menos un elemento entregado' }
  }

  // 1) Encabezado
  const { data: entrega, error: entregaErr } = await supabase
    .from('entregas_epp')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: input.establecimientoId ?? null,
      persona_id: input.personaId,
      entregado_por_id: user.id,
      entregado_por_nombre: profile?.full_name ?? null,
      fecha_entrega: input.fechaEntrega || new Date().toISOString().slice(0, 10),
      observaciones: input.observaciones?.trim() || null,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (entregaErr || !entrega) {
    return { success: false, error: entregaErr?.message ?? 'No se pudo crear la entrega' }
  }

  // 2) Ítems (consultora_id lo completa el trigger, pero lo seteamos explícito)
  const rows = items.map(i => ({
    entrega_id: entrega.id,
    consultora_id: consultoraId,
    producto_id: i.producto_id ?? null,
    producto_nombre: i.producto_nombre.trim(),
    talle: i.talle?.trim() || null,
    cantidad: i.cantidad && i.cantidad > 0 ? i.cantidad : 1,
  }))

  const { error: itemsErr } = await supabase.from('entregas_epp_items').insert(rows)
  if (itemsErr) {
    // rollback manual del encabezado para no dejar una entrega vacía
    await supabase.from('entregas_epp').delete().eq('id', entrega.id)
    return { success: false, error: `No se pudieron guardar los elementos: ${itemsErr.message}` }
  }

  revalidatePath('/dashboard/personas')
  return { success: true, data: { entregaId: entrega.id } }
}

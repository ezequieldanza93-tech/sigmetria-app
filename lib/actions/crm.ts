'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import type { ActionResult } from '@/lib/types'
import type { EstadoCrm } from '@/lib/crm/types'

const ESTADOS: EstadoCrm[] = ['nuevo', 'contactado', 'en_conversacion', 'cliente', 'descartado']
const ETAPAS = ['tofu', 'mofu', 'bofu']

interface LeadPatch {
  estado_crm?: EstadoCrm
  etapa_funnel?: string
  notas_crm?: string
}

/**
 * Actualiza un lead desde el panel CRM (estado del pipeline, etapa de funnel y/o notas).
 * Doble protección: gate por email en la action + RLS (crm_admin_update_leads) en la base.
 */
export async function updateLead(leadId: string, patch: LeadPatch): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!isCrmAdmin(user.email)) return { success: false, error: 'Sin acceso al CRM' }

  const update: Record<string, unknown> = {}

  if (patch.estado_crm !== undefined) {
    if (!ESTADOS.includes(patch.estado_crm)) return { success: false, error: 'Estado inválido' }
    update.estado_crm = patch.estado_crm
  }
  if (patch.etapa_funnel !== undefined) {
    if (patch.etapa_funnel && !ETAPAS.includes(patch.etapa_funnel)) return { success: false, error: 'Etapa inválida' }
    update.etapa_funnel = patch.etapa_funnel || null
  }
  if (patch.notas_crm !== undefined) {
    update.notas_crm = patch.notas_crm.trim() || null
  }

  // Nada para actualizar → no tocar la fila (evita bumpear ultima_actividad_at sin cambios).
  if (Object.keys(update).length === 0) return { success: true, data: null }
  update.ultima_actividad_at = new Date().toISOString()

  const { error } = await supabase.from('leads').update(update).eq('id', leadId)
  if (error) {
    console.error('[crm:updateLead]', error.message)
    return { success: false, error: 'No se pudo actualizar el lead.' }
  }

  revalidatePath('/dashboard/crm')
  return { success: true, data: null }
}

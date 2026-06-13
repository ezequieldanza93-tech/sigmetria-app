'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createPuesto(
  sectorId: string,
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = formData.get('nombre') as string
  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const tipo = formData.get('tipo') as 'operativo' | 'administrativo' | null

  const { error } = await supabase
    .from('puestos_de_trabajo')
    .insert({ sector_id: sectorId, nombre: nombre.trim(), tipo: tipo || null })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function deletePuesto(
  puestoId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Soft-delete (is_active=false), no DELETE físico: la papelera (Disp. 15/2026)
  // restringe el borrado físico a developer. El puesto desaparece de los listados
  // (filtran is_active=true) sin destruir el dato.
  const { error } = await supabase
    .from('puestos_de_trabajo')
    .update({ is_active: false })
    .eq('id', puestoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

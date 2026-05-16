'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function addEppToPuesto(
  puestoId: string,
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const productoId = formData.get('producto_id') as string
  if (!productoId) return { success: false, error: 'Seleccioná un producto' }

  const horasStr = formData.get('horas_vida_util') as string
  const horas = horasStr ? parseFloat(horasStr) : null

  const { error } = await supabase.from('epp_por_puesto').insert({
    puesto_id: puestoId,
    producto_id: productoId,
    horas_vida_util: horas && !isNaN(horas) ? horas : null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function removeEppFromPuesto(
  eppId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('epp_por_puesto').delete().eq('id', eppId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

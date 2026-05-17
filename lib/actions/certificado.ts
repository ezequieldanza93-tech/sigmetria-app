'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createCertificadoCalibracion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const instrumentoId = formData.get('instrumento_id') as string
  const fechaEmision = formData.get('fecha_emision') as string
  const fechaVencimiento = formData.get('fecha_vencimiento') as string

  if (!instrumentoId) return { success: false, error: 'Instrumento requerido' }
  if (!fechaEmision) return { success: false, error: 'Fecha de emisión requerida' }
  if (!fechaVencimiento) return { success: false, error: 'Fecha de vencimiento requerida' }

  await supabase
    .from('certificados_calibracion')
    .update({ activo: false })
    .eq('instrumento_id', instrumentoId)
    .eq('activo', true)

  const { error } = await supabase.from('certificados_calibracion').insert({
    instrumento_id: instrumentoId,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    organismo_emisor_id: (formData.get('organismo_emisor_id') as string) || null,
    activo: true,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}

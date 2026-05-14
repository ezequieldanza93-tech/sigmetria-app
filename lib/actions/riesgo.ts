'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, RiesgoNivel } from '@/lib/types'

export async function createRiesgo(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const descripcion = formData.get('descripcion') as string
  const nivel = formData.get('nivel') as RiesgoNivel
  const fechaIdentificacion = formData.get('fecha_identificacion') as string

  if (!descripcion?.trim()) return { success: false, error: 'La descripción es obligatoria' }
  if (!nivel) return { success: false, error: 'El nivel es obligatorio' }
  if (!fechaIdentificacion) return { success: false, error: 'La fecha de identificación es obligatoria' }

  const { error } = await supabase
    .from('riesgos')
    .insert({
      establecimiento_id: establecimientoId,
      descripcion: descripcion.trim(),
      nivel,
      medida_correctiva: (formData.get('medida_correctiva') as string) || null,
      responsable_id: (formData.get('responsable_id') as string) || null,
      fecha_identificacion: fechaIdentificacion,
      resuelto: false,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateRiesgo(
  riesgoId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('riesgos')
    .update({
      descripcion: (formData.get('descripcion') as string)?.trim(),
      nivel: formData.get('nivel') as RiesgoNivel,
      medida_correctiva: (formData.get('medida_correctiva') as string) || null,
      responsable_id: (formData.get('responsable_id') as string) || null,
    })
    .eq('id', riesgoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function resolverRiesgo(
  riesgoId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('riesgos')
    .update({
      resuelto: true,
      fecha_resolucion: new Date().toISOString().split('T')[0],
    })
    .eq('id', riesgoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

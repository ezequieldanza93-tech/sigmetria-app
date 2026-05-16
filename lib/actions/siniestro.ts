'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, SiniestroTipo, SiniestroEstado } from '@/lib/types'

export async function createSiniestro(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipo = formData.get('tipo') as SiniestroTipo
  const fechaOcurrencia = formData.get('fecha_ocurrencia') as string

  if (!tipo) return { success: false, error: 'El tipo es obligatorio' }
  if (!fechaOcurrencia) return { success: false, error: 'La fecha es obligatoria' }

  const diasPerdidosStr = formData.get('dias_perdidos') as string
  const diasPerdidos = diasPerdidosStr ? parseInt(diasPerdidosStr, 10) : null

  const { error } = await supabase
    .from('siniestros')
    .insert({
      establecimiento_id: establecimientoId,
      persona_id: (formData.get('persona_id') as string) || null,
      tipo,
      estado: 'pendiente' as SiniestroEstado,
      fecha_ocurrencia: fechaOcurrencia,
      descripcion: (formData.get('descripcion') as string) || null,
      dias_perdidos: isNaN(diasPerdidos as number) ? null : diasPerdidos,
      requiere_derivacion: formData.get('requiere_derivacion') === 'true',
      acciones_correctivas: (formData.get('acciones_correctivas') as string) || null,
      reportado_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateSiniestro(
  siniestroId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const diasPerdidosStr = formData.get('dias_perdidos') as string
  const diasPerdidos = diasPerdidosStr ? parseInt(diasPerdidosStr, 10) : null

  const { error } = await supabase
    .from('siniestros')
    .update({
      tipo: formData.get('tipo') as SiniestroTipo,
      estado: formData.get('estado') as SiniestroEstado,
      fecha_ocurrencia: formData.get('fecha_ocurrencia') as string,
      descripcion: (formData.get('descripcion') as string) || null,
      dias_perdidos: isNaN(diasPerdidos as number) ? null : diasPerdidos,
      requiere_derivacion: formData.get('requiere_derivacion') === 'true',
      acciones_correctivas: (formData.get('acciones_correctivas') as string) || null,
    })
    .eq('id', siniestroId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

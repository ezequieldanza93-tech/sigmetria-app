'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createMatricula(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const personaId = formData.get('persona_id') as string
  const numero = (formData.get('numero') as string)?.trim()
  const fechaEmision = formData.get('fecha_emision') as string
  const fechaVencimiento = formData.get('fecha_vencimiento') as string

  if (!personaId) return { success: false, error: 'Persona requerida' }
  if (!numero) return { success: false, error: 'Número de matrícula requerido' }
  if (!fechaEmision) return { success: false, error: 'Fecha de emisión requerida' }
  if (!fechaVencimiento) return { success: false, error: 'Fecha de vencimiento requerida' }

  await supabase
    .from('matriculas')
    .update({ activa: false })
    .eq('persona_id', personaId)
    .eq('activa', true)

  const { error } = await supabase.from('matriculas').insert({
    persona_id: personaId,
    numero,
    organismo_emisor_id: (formData.get('organismo_emisor_id') as string) || null,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    activa: true,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/equipo')
  return { success: true, data: null }
}

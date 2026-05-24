'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, SiniestroEstado } from '@/lib/types'

const createSiniestroSchema = z.object({
  tipo: z.enum(['accidente', 'incidente', 'casi_accidente', 'enfermedad_profesional']),
  tipo_persona: z.enum(['trabajador_interno', 'trabajador_externo']).optional(),
  persona_id: z.string().nullable().optional(),
  fecha_ocurrencia: z.string().min(1, { message: 'La fecha es obligatoria' }),
  hora_ocurrencia: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  fecha_baja_medica: z.string().nullable().optional(),
  fecha_alta_medica: z.string().nullable().optional(),
  tiene_denuncia_adjunta: z.coerce.boolean().optional(),
  tiene_evolucion_medica: z.coerce.boolean().optional(),
  ente_investigador: z.string().nullable().optional(),
  causa_inmediata: z.string().nullable().optional(),
  causa_basica: z.string().nullable().optional(),
  dias_perdidos: z.coerce.number().int().nullable().optional(),
  requiere_derivacion: z.literal('true').optional(),
  acciones_correctivas: z.string().nullable().optional(),
})

export async function createSiniestro(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { raw[k] = v })

  const parsed = createSiniestroSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message ?? 'Datos inválidos' }
  }

  const {
    tipo, tipo_persona, persona_id, fecha_ocurrencia, hora_ocurrencia,
    descripcion, fecha_baja_medica, fecha_alta_medica,
    tiene_denuncia_adjunta, tiene_evolucion_medica,
    ente_investigador, causa_inmediata, causa_basica,
    dias_perdidos, requiere_derivacion, acciones_correctivas,
  } = parsed.data

  const insertData: Record<string, unknown> = {
    establecimiento_id: establecimientoId,
    persona_id: persona_id ?? null,
    tipo,
    tipo_persona: tipo_persona ?? null,
    estado: 'pendiente' as SiniestroEstado,
    fecha_ocurrencia,
    hora_ocurrencia: hora_ocurrencia ?? null,
    descripcion: descripcion ?? null,
    dias_perdidos: dias_perdidos ?? null,
    fecha_baja_medica: fecha_baja_medica ?? null,
    fecha_alta_medica: fecha_alta_medica ?? null,
    tiene_denuncia_adjunta: tiene_denuncia_adjunta ?? false,
    tiene_evolucion_medica: tiene_evolucion_medica ?? false,
    ente_investigador: ente_investigador ?? null,
    causa_inmediata: causa_inmediata ?? null,
    causa_basica: causa_basica ?? null,
    requiere_derivacion: requiere_derivacion === 'true',
    acciones_correctivas: acciones_correctivas ?? null,
    reportado_por: user.id,
  }

  const { error } = await supabase
    .from('siniestros')
    .insert(insertData)

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

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { raw[k] = v })

  const parsed = createSiniestroSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const {
    tipo, tipo_persona, persona_id, fecha_ocurrencia, hora_ocurrencia,
    descripcion, fecha_baja_medica, fecha_alta_medica,
    tiene_denuncia_adjunta, tiene_evolucion_medica,
    ente_investigador, causa_inmediata, causa_basica,
    dias_perdidos, requiere_derivacion, acciones_correctivas,
  } = parsed.data

  const updateData: Record<string, unknown> = {
    tipo,
    tipo_persona: tipo_persona ?? null,
    persona_id: persona_id ?? null,
    estado: (formData.get('estado') as SiniestroEstado) ?? 'pendiente',
    fecha_ocurrencia,
    hora_ocurrencia: hora_ocurrencia ?? null,
    descripcion: descripcion ?? null,
    dias_perdidos: dias_perdidos ?? null,
    fecha_baja_medica: fecha_baja_medica ?? null,
    fecha_alta_medica: fecha_alta_medica ?? null,
    tiene_denuncia_adjunta: tiene_denuncia_adjunta ?? false,
    tiene_evolucion_medica: tiene_evolucion_medica ?? false,
    ente_investigador: ente_investigador ?? null,
    causa_inmediata: causa_inmediata ?? null,
    causa_basica: causa_basica ?? null,
    requiere_derivacion: requiere_derivacion === 'true',
    acciones_correctivas: acciones_correctivas ?? null,
  }

  const { error } = await supabase
    .from('siniestros')
    .update(updateData)
    .eq('id', siniestroId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

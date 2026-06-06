'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult, IncidenteEstado } from '@/lib/types'

const MAX_ARCHIVOS = 5

/**
 * Sube los archivos al bucket `documentos` (PRIVADO) bajo
 * `{consultoraId}/incidentes/{establecimientoId}/{timestamp}-{filename}` y
 * devuelve los PATHS relativos (no URLs). El prefijo consultora_id es
 * OBLIGATORIO: la RLS de lectura por tenant extrae el consultora_id del primer
 * segmento del path. La URL se deriva on-read con resolveAssetUrl('documentos').
 * Patrón espejo de establecimiento-info.ts / trabajador-documento.ts.
 */
async function uploadIncidenteFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultoraId: string,
  establecimientoId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = []
  for (const file of files) {
    if (paths.length >= MAX_ARCHIVOS) break
    const path = tenantStoragePath(consultoraId, 'incidentes', establecimientoId, `${Date.now()}-${file.name}`)
    const { data: upload, error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })
    if (error) continue
    paths.push(upload.path)
  }
  return paths
}

function collectIncidenteFiles(formData: FormData, name: string): File[] {
  const all = formData.getAll(name) as File[]
  return all.filter(f => f instanceof File && f.size > 0).slice(0, MAX_ARCHIVOS)
}

const createIncidenteSchema = z.object({
  tipo: z.enum(['incidente', 'accidente_leve', 'accidente_moderado', 'accidente_grave', 'enfermedad_profesional']),
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

export async function createIncidente(
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

  const parsed = createIncidenteSchema.safeParse(raw)
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

  const denunciaFiles = collectIncidenteFiles(formData, 'denuncia_adjuntos')
  const investigacionFiles = collectIncidenteFiles(formData, 'investigacion_adjuntos')
  let denunciaUrls: string[] = []
  let investigacionUrls: string[] = []
  if (denunciaFiles.length > 0 || investigacionFiles.length > 0) {
    const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }
    denunciaUrls = denunciaFiles.length > 0
      ? await uploadIncidenteFiles(supabase, consultoraId, establecimientoId, denunciaFiles)
      : []
    investigacionUrls = investigacionFiles.length > 0
      ? await uploadIncidenteFiles(supabase, consultoraId, establecimientoId, investigacionFiles)
      : []
  }

  const insertData: Record<string, unknown> = {
    establecimiento_id: establecimientoId,
    persona_id: persona_id ?? null,
    tipo,
    tipo_persona: tipo_persona ?? null,
    estado: 'pendiente' as IncidenteEstado,
    fecha_ocurrencia,
    hora_ocurrencia: hora_ocurrencia ?? null,
    descripcion: descripcion ?? null,
    dias_perdidos: dias_perdidos ?? null,
    fecha_baja_medica: fecha_baja_medica ?? null,
    fecha_alta_medica: fecha_alta_medica ?? null,
    tiene_denuncia_adjunta: tiene_denuncia_adjunta ?? false,
    tiene_evolucion_medica: tiene_evolucion_medica ?? false,
    denuncia_adjuntos_urls: denunciaUrls,
    investigacion_adjuntos_urls: investigacionUrls,
    ente_investigador: ente_investigador ?? null,
    causa_inmediata: causa_inmediata ?? null,
    causa_basica: causa_basica ?? null,
    requiere_derivacion: requiere_derivacion === 'true',
    acciones_correctivas: acciones_correctivas ?? null,
    reportado_por: user.id,
  }

  const { error } = await supabase
    .from('incidentes')
    .insert(insertData)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateIncidente(
  incidenteId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { raw[k] = v })

  const parsed = createIncidenteSchema.safeParse(raw)
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

  const denunciaFiles = collectIncidenteFiles(formData, 'denuncia_adjuntos')
  const investigacionFiles = collectIncidenteFiles(formData, 'investigacion_adjuntos')
  let denunciaUrls: string[] = []
  let investigacionUrls: string[] = []
  if (denunciaFiles.length > 0 || investigacionFiles.length > 0) {
    const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }
    denunciaUrls = denunciaFiles.length > 0
      ? await uploadIncidenteFiles(supabase, consultoraId, establecimientoId, denunciaFiles)
      : []
    investigacionUrls = investigacionFiles.length > 0
      ? await uploadIncidenteFiles(supabase, consultoraId, establecimientoId, investigacionFiles)
      : []
  }

  const updateData: Record<string, unknown> = {
    tipo,
    tipo_persona: tipo_persona ?? null,
    persona_id: persona_id ?? null,
    estado: (formData.get('estado') as IncidenteEstado) ?? 'pendiente',
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

  // Solo pisamos las columnas de adjuntos si se subieron archivos nuevos,
  // para no borrar los existentes en una edición sin re-adjuntar.
  if (denunciaUrls.length > 0) updateData.denuncia_adjuntos_urls = denunciaUrls
  if (investigacionUrls.length > 0) updateData.investigacion_adjuntos_urls = investigacionUrls

  const { error } = await supabase
    .from('incidentes')
    .update(updateData)
    .eq('id', incidenteId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

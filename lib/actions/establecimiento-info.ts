'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

const MAX_ARCHIVOS = 5

const createDenunciaSchema = z.object({
  fecha: z.string().min(1, { message: 'Fecha requerida' }),
  descripcion: z.string().min(1, { message: 'Descripción requerida' }).transform(s => s.trim()),
  persona_id: z.string().uuid().nullable().optional(),
})

const createFeedbackClienteSchema = z.object({
  fecha: z.string().min(1, { message: 'Fecha requerida' }),
  cliente: z.string().min(1, { message: 'Cliente requerido' }).transform(s => s.trim()),
  tipo: z.enum(['positivo', 'negativo', 'sugerencia'], { message: 'Tipo requerido' }),
  descripcion: z.string().min(1, { message: 'Descripción requerida' }).transform(s => s.trim()),
  persona_id: z.string().uuid().nullable().optional(),
})

async function getConsultoraId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.consultora_id ?? null
}

function collectFiles(formData: FormData): File[] {
  const all = formData.getAll('archivo') as File[]
  const files = all.filter(f => f.size > 0)
  if (files.length > 0) return files.slice(0, MAX_ARCHIVOS)
  for (let i = 0; i < MAX_ARCHIVOS; i++) {
    const file = formData.get(`archivo_${i}`) as File | null
    if (file && file.size > 0) return [file]
  }
  const single = formData.get('archivo') as File | null
  if (single && single.size > 0) return [single]
  return []
}

// Sube al bucket `documentos` con path por consultora y devuelve los PATHS
// relativos (no URLs). La URL se deriva on-read con publicAssetUrl('documentos', path).
async function uploadFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultoraId: string,
  entity: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = []
  for (const file of files) {
    if (paths.length >= MAX_ARCHIVOS) break
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${consultoraId}/${entity}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data: upload, error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })
    if (error) continue
    paths.push(upload.path)
  }
  return paths
}

export async function createDenuncia(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { if (typeof v === 'string') raw[k] = v })

  const parsed = createDenunciaSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { fecha, descripcion, persona_id } = parsed.data

  const consultoraId = await getConsultoraId(supabase, user.id)
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const { data: est } = await supabase
    .from('establecimientos')
    .select('empresa_id')
    .eq('id', establecimientoId)
    .maybeSingle()
  if (!est) return { success: false, error: 'Establecimiento no encontrado' }

  const files = collectFiles(formData)
  const adjuntosUrls = files.length > 0
    ? await uploadFiles(supabase, consultoraId, 'denuncias', files)
    : []

  const { data: denuncia, error } = await supabase
    .from('denuncias')
    .insert({
      consultora_id: consultoraId,
      empresa_id: est.empresa_id,
      establecimiento_id: establecimientoId,
      descripcion,
      persona_id: persona_id ?? null,
      fecha_denuncia: fecha,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  if (adjuntosUrls.length > 0) {
    await supabase.from('denuncias_fotos').insert(
      adjuntosUrls.map(url => ({ denuncia_id: denuncia.id, url }))
    )
  }

  return { success: true, data: null }
}

export async function createFeedbackCliente(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { if (typeof v === 'string') raw[k] = v })

  const parsed = createFeedbackClienteSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { fecha, cliente, tipo, descripcion, persona_id } = parsed.data

  const consultoraId = await getConsultoraId(supabase, user.id)
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const files = collectFiles(formData)
  const adjuntosUrls = files.length > 0
    ? await uploadFiles(supabase, consultoraId, 'feedback', files)
    : []

  const { error } = await supabase.from('establecimientos_feedback_clientes').insert({
    establecimiento_id: establecimientoId,
    fecha,
    cliente,
    tipo,
    descripcion,
    persona_id: persona_id ?? null,
    adjuntos_urls: adjuntosUrls.length > 0 ? adjuntosUrls : null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

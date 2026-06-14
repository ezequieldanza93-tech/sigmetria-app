'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Feedback } from '@/lib/types'

// ---- Schemas ----

const errorJsSchema = z.object({
  message: z.string(),
  source: z.string().optional(),
  line: z.number().optional(),
  stack: z.string().optional(),
  timestamp: z.string(),
})

const contextoSchema = z.object({
  url: z.string(),
  ruta: z.string(),
  userAgent: z.string(),
  viewport: z.object({ w: z.number(), h: z.number() }),
  consultoraId: z.string().uuid().nullable().optional(),
  consultoraNombre: z.string().nullable().optional(),
  erroresJs: z.array(errorJsSchema).optional(),
})

const reporteProblemaSchema = z.object({
  tipo: z.enum(['error', 'idea']),
  resumen: z.string().min(1, 'El resumen es obligatorio').max(120),
  descripcion: z.string().min(1, 'La descripción es obligatoria').max(4000),
  screenshotDataUrl: z.string().nullable().optional(),
  contexto: contextoSchema,
})

// ---- Helpers ----

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

/**
 * Sube un data URL de screenshot al bucket `feedback-adjuntos`.
 * Retorna el path dentro del bucket, o null si falla (no aborta el flujo).
 */
async function subirScreenshot(
  dataUrl: string,
  feedbackId: string,
): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Extraer la parte base64 del data URL (data:image/png;base64,<data>)
    const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!matches || matches.length < 3) return null

    const mimeType = matches[1]
    const base64Data = matches[2]
    const ext = mimeType.split('/')[1] ?? 'png'
    const path = `reportes/${feedbackId}/screenshot.${ext}`

    // Convertir base64 a Buffer
    const buffer = Buffer.from(base64Data, 'base64')

    const { error } = await supabase.storage
      .from('feedback-adjuntos')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      })

    if (error) return null
    return path
  } catch {
    return null
  }
}

// ---- Actions ----

export async function enviarReporteProblema(input: {
  tipo: 'error' | 'idea'
  resumen: string
  descripcion: string
  screenshotDataUrl?: string | null
  contexto: {
    url: string
    ruta: string
    userAgent: string
    viewport: { w: number; h: number }
    consultoraId?: string | null
    consultoraNombre?: string | null
    erroresJs?: Array<{ message: string; source?: string; line?: number; stack?: string; timestamp: string }>
  }
}): Promise<{ success: true; data: { id: string } } | { error: string }> {
  // 1. Validar input con Zod
  const parsed = reporteProblemaSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message ?? 'Datos inválidos' }
  }

  const { tipo, resumen, descripcion, screenshotDataUrl, contexto } = parsed.data

  // 2. Obtener usuario autenticado
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }

  const supabase = await createClient()

  // 3. Mapear tipo al valor de columna de feedback
  const tipoMapeado = tipo === 'error' ? 'bug' : 'sugerencia'

  // 4. Pre-generar un ID para el feedback (para usar en el path del screenshot)
  const tempId = crypto.randomUUID()

  // 5. Subir screenshot si viene (fallo no aborta)
  let screenshotPath: string | null = null
  if (screenshotDataUrl) {
    screenshotPath = await subirScreenshot(screenshotDataUrl, tempId)
  }

  // 6. Armar metadata
  const metadata: Record<string, unknown> = {
    canal: 'founder-tester',
    url: contexto.url,
    ruta: contexto.ruta,
    userAgent: contexto.userAgent,
    viewport: contexto.viewport,
    consultora_nombre: contexto.consultoraNombre ?? null,
    screenshot_path: screenshotPath,
    errores_js: tipo === 'error' ? (contexto.erroresJs ?? []) : [],
  }

  // 7. Insertar en tabla feedback usando el ID pre-generado
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      id: tempId,
      user_id: user.id,
      consultora_id: contexto.consultoraId ?? null,
      tipo: tipoMapeado,
      titulo: resumen,
      comentario: descripcion,
      status: 'nuevo',
      metadata,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  return { success: true, data: { id: data.id } }
}

export async function listarReportesFounder(): Promise<ActionResult<Feedback[]>> {
  const user = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const supabase = await createClient()

  // Solo super_admin puede leer la cola del founder-tester
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) return { success: false, error: 'Acceso denegado' }

  const { data, error } = await supabase
    .from('feedback')
    .select(`
      *,
      profiles:user_id (id, full_name, email),
      consultoras:consultora_id (id, nombre)
    `)
    .filter('metadata->>canal', 'eq', 'founder-tester')
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }

  const mapped = (data ?? []).map((item: Record<string, unknown>) => {
    const profiles = item.profiles as { full_name: string; email: string } | null
    const consultoras = item.consultoras as { nombre: string } | null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { profiles: _p, consultoras: _c, ...rest } = item
    return {
      ...rest,
      user_email: profiles?.email,
      user_nombre: profiles?.full_name,
      consultora_nombre: consultoras?.nombre,
    } as unknown as Feedback
  })

  return { success: true, data: mapped }
}

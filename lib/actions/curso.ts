'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { uploadAsset } from '@/lib/storage/upload'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

// ============================================================
// HELPERS
// ============================================================

async function getUserAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function getConsultoraMembership(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

function canAuthor(role: string | undefined): boolean {
  return role === 'full_access_main' || role === 'full_access_branch'
}

// ============================================================
// AUTHORING: CURSOS
// ============================================================

const cursoSchema = z.object({
  titulo: z.string().min(1, 'El título es obligatorio'),
  descripcion_corta: z.string().optional().default(''),
  descripcion_larga: z.string().optional().default(''),
  categoria: z.string().optional().default(''),
  nivel: z.enum(['basico', 'intermedio', 'avanzado']).optional().default('basico'),
  idioma: z.string().optional().default('es'),
  duracion_estimada_minutos: z.coerce.number().optional().default(0),
  vencimiento_meses: z.coerce.number().nullable().optional().default(null),
})

export async function crearCurso(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  // Check if user wants a public course (super_admin only) or consultora course
  const isPublic = formData.get('es_publico') === 'true'
  let consultoraId: string | null = null
  let isSuperAdmin = false

  if (!isPublic) {
    const member = await getConsultoraMembership(user.id)
    if (!member) return { success: false, error: 'Sin membresía activa' }
    if (!canAuthor(member.role)) return { success: false, error: 'Sin permisos para crear cursos' }
    consultoraId = member.consultora_id
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    isSuperAdmin = profile?.is_super_admin ?? false
    if (!isSuperAdmin) return { success: false, error: 'Solo super_admin puede crear cursos públicos' }
  }

  const parsed = validateFormData(cursoSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  // Handle portada upload
  let portadaUrl: string | null = null
  const portadaFile = formData.get('portada') as File | null
  if (portadaFile && portadaFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'cursos-portadas',
      consultoraId: consultoraId ?? 'public',
      entityType: 'curso',
      entityId: 'pending',
      kind: 'portada',
      file: portadaFile,
    })
    if (!up.ok) return { success: false, error: up.error }
    portadaUrl = up.path
  }

  const { data, error } = await supabase
    .from('cursos')
    .insert({
      consultora_id: consultoraId,
      autor_id: user.id,
      titulo: parsed.data.titulo,
      descripcion_corta: parsed.data.descripcion_corta || null,
      descripcion_larga: parsed.data.descripcion_larga || null,
      categoria: parsed.data.categoria || null,
      nivel: parsed.data.nivel,
      idioma: parsed.data.idioma,
      duracion_estimada_minutos: parsed.data.duracion_estimada_minutos || null,
      vencimiento_meses: parsed.data.vencimiento_meses,
      portada_url: portadaUrl,
      estado: 'borrador',
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin')
  return { success: true, data: { id: data.id } }
}

export async function actualizarCurso(
  cursoId: string,
  _prev: ActionResult<void> | null,
  formData: FormData
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: curso } = await supabase.from('cursos').select('consultora_id, estado, version').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  // Permission check
  if (curso.consultora_id) {
    const member = await getConsultoraMembership(user.id)
    if (!member || member.consultora_id !== curso.consultora_id || !canAuthor(member.role))
      return { success: false, error: 'Sin permisos' }
  } else {
    const { data: p } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!p?.is_super_admin) return { success: false, error: 'Sin permisos' }
  }

  const parsed = validateFormData(cursoSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  // Handle portada
  let portadaUrl = formData.get('portada_url') as string | null
  const portadaFile = formData.get('portada') as File | null
  if (portadaFile && portadaFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'cursos-portadas',
      consultoraId: curso.consultora_id ?? 'public',
      entityType: 'curso',
      entityId: cursoId,
      kind: 'portada',
      file: portadaFile,
    })
    if (!up.ok) return { success: false, error: up.error }
    portadaUrl = up.path
  }

  const newVersion = curso.estado === 'publicado' ? curso.version + 1 : curso.version

  const { error } = await supabase
    .from('cursos')
    .update({
      titulo: parsed.data.titulo,
      descripcion_corta: parsed.data.descripcion_corta || null,
      descripcion_larga: parsed.data.descripcion_larga || null,
      categoria: parsed.data.categoria || null,
      nivel: parsed.data.nivel,
      idioma: parsed.data.idioma,
      duracion_estimada_minutos: parsed.data.duracion_estimada_minutos || null,
      vencimiento_meses: parsed.data.vencimiento_meses,
      portada_url: portadaUrl,
      version: newVersion,
    })
    .eq('id', cursoId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${cursoId}/editar`)
  return { success: true, data: undefined }
}

export async function publicarCurso(cursoId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  // Verify permissions
  const { data: curso } = await supabase.from('cursos').select('consultora_id').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  if (curso.consultora_id) {
    const member = await getConsultoraMembership(user.id)
    if (!member || member.consultora_id !== curso.consultora_id || !canAuthor(member.role))
      return { success: false, error: 'Sin permisos' }
  } else {
    const { data: p } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!p?.is_super_admin) return { success: false, error: 'Sin permisos' }
  }

  // Check has at least 1 module with 1 lesson
  const { count: modCount } = await supabase
    .from('curso_modulos')
    .select('id', { count: 'exact', head: true })
    .eq('curso_id', cursoId)
  if (!modCount || modCount === 0) return { success: false, error: 'El curso debe tener al menos 1 módulo' }

  const { count: lecCount } = await supabase
    .from('curso_lecciones')
    .select('id', { count: 'exact', head: true })
    .in('modulo_id', (await supabase.from('curso_modulos').select('id').eq('curso_id', cursoId)).data?.map(m => m.id) ?? [])
  if (!lecCount || lecCount === 0) return { success: false, error: 'El curso debe tener al menos 1 lección' }

  const { error } = await supabase
    .from('cursos')
    .update({ estado: 'publicado' })
    .eq('id', cursoId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${cursoId}/editar`)
  revalidatePath('/dashboard/cursos/admin')
  return { success: true, data: undefined }
}

export async function archivarCurso(cursoId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: curso } = await supabase.from('cursos').select('consultora_id').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  if (curso.consultora_id) {
    const member = await getConsultoraMembership(user.id)
    if (!member || member.consultora_id !== curso.consultora_id || !canAuthor(member.role))
      return { success: false, error: 'Sin permisos' }
  } else {
    const { data: p } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!p?.is_super_admin) return { success: false, error: 'Sin permisos' }
  }

  const { error } = await supabase.from('cursos').update({ estado: 'archivado' }).eq('id', cursoId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin')
  return { success: true, data: undefined }
}

// ============================================================
// ESTRUCTURA: MÓDULOS
// ============================================================

const moduloSchema = z.object({
  curso_id: z.string().uuid(),
  titulo: z.string().min(1, 'El título es obligatorio'),
  descripcion: z.string().optional().default(''),
})

export async function crearModulo(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(moduloSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  // Get next orden
  const { data: max } = await supabase
    .from('curso_modulos')
    .select('orden')
    .eq('curso_id', parsed.data.curso_id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orden = (max?.orden ?? 0) + 1

  const { data, error } = await supabase
    .from('curso_modulos')
    .insert({
      curso_id: parsed.data.curso_id,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion || null,
      orden,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${parsed.data.curso_id}/editar`)
  return { success: true, data: { id: data.id } }
}

export async function actualizarModulo(
  moduloId: string,
  _prev: ActionResult<void> | null,
  formData: FormData
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const titulo = formData.get('titulo') as string
  const descripcion = formData.get('descripcion') as string
  if (!titulo?.trim()) return { success: false, error: 'El título es obligatorio' }

  const { error } = await supabase
    .from('curso_modulos')
    .update({ titulo: titulo.trim(), descripcion: descripcion || null })
    .eq('id', moduloId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/*/editar`)
  return { success: true, data: undefined }
}

export async function eliminarModulo(moduloId: string): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  const { error } = await supabase.from('curso_modulos').delete().eq('id', moduloId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

export async function reordenarModulos(cursoId: string, idsEnOrden: string[]): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  // Update each modulo's orden one by one
  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase.from('curso_modulos').update({ orden: i + 1 }).eq('id', idsEnOrden[i])
    if (error) return { success: false, error: error.message }
  }
  revalidatePath(`/dashboard/cursos/admin/${cursoId}/editar`)
  return { success: true, data: undefined }
}

// ============================================================
// ESTRUCTURA: LECCIONES
// ============================================================

const leccionSchema = z.object({
  modulo_id: z.string().uuid(),
  titulo: z.string().min(1, 'El título es obligatorio'),
  tipo: z.enum(['video', 'pdf', 'texto', 'embed']),
  contenido_url: z.string().optional().default(''),
  contenido_texto: z.string().optional().default(''),
  duracion_minutos: z.coerce.number().optional().default(0),
  descargable: z.coerce.boolean().optional().default(false),
  anti_skip: z.coerce.boolean().optional().default(false),
})

export async function crearLeccion(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(leccionSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  // Get next orden
  const { data: max } = await supabase
    .from('curso_lecciones')
    .select('orden')
    .eq('modulo_id', parsed.data.modulo_id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orden = (max?.orden ?? 0) + 1

  const { data, error } = await supabase
    .from('curso_lecciones')
    .insert({
      modulo_id: parsed.data.modulo_id,
      titulo: parsed.data.titulo,
      tipo: parsed.data.tipo,
      contenido_url: parsed.data.contenido_url || null,
      contenido_texto: parsed.data.contenido_texto || null,
      duracion_minutos: parsed.data.duracion_minutos || null,
      descargable: parsed.data.descargable,
      anti_skip: parsed.data.anti_skip,
      orden,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/*/editar`)
  return { success: true, data: { id: data.id } }
}

export async function actualizarLeccion(
  leccionId: string,
  _prev: ActionResult<void> | null,
  formData: FormData
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(leccionSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const { error } = await supabase
    .from('curso_lecciones')
    .update({
      titulo: parsed.data.titulo,
      tipo: parsed.data.tipo,
      contenido_url: parsed.data.contenido_url || null,
      contenido_texto: parsed.data.contenido_texto || null,
      duracion_minutos: parsed.data.duracion_minutos || null,
      descargable: parsed.data.descargable,
      anti_skip: parsed.data.anti_skip,
    })
    .eq('id', leccionId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

export async function eliminarLeccion(leccionId: string): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  const { error } = await supabase.from('curso_lecciones').delete().eq('id', leccionId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

export async function reordenarLecciones(moduloId: string, idsEnOrden: string[]): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase.from('curso_lecciones').update({ orden: i + 1 }).eq('id', idsEnOrden[i])
    if (error) return { success: false, error: error.message }
  }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

export async function subirMaterialLeccion(
  leccionId: string,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Archivo requerido' }

  // Get leccion info to find curso
  const { data: leccion } = await supabase
    .from('curso_lecciones')
    .select('modulo_id')
    .eq('id', leccionId)
    .single()
  if (!leccion) return { success: false, error: 'Lección no encontrada' }

  const { data: modulo } = await supabase
    .from('curso_modulos')
    .select('curso_id')
    .eq('id', leccion.modulo_id)
    .single()
  if (!modulo) return { success: false, error: 'Módulo no encontrado' }

  const { data: curso } = await supabase.from('cursos').select('consultora_id').eq('id', modulo.curso_id).single()

  const up = await uploadAsset({
    bucket: 'cursos-material',
    consultoraId: curso?.consultora_id ?? 'public',
    entityType: 'curso',
    entityId: modulo.curso_id,
    kind: `leccion_${leccionId}`,
    file,
  })

  if (!up.ok) return { success: false, error: up.error }

  const { error } = await supabase
    .from('curso_lecciones')
    .update({ contenido_url: up.path })
    .eq('id', leccionId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: { url: up.path } }
}

// ============================================================
// QUIZZES
// ============================================================

const quizSchema = z.object({
  curso_id: z.string().uuid(),
  modulo_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1, 'El título es obligatorio'),
  porcentaje_aprobacion: z.coerce.number().min(0).max(100).default(70),
  max_intentos: z.coerce.number().nullable().optional().default(3),
  tiempo_limite_minutos: z.coerce.number().nullable().optional().default(null),
  randomizar_preguntas: z.coerce.boolean().default(true),
  mostrar_correctas: z.coerce.boolean().default(true),
})

export async function crearQuiz(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(quizSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const { data, error } = await supabase
    .from('curso_quizzes')
    .insert({
      curso_id: parsed.data.curso_id,
      modulo_id: parsed.data.modulo_id || null,
      titulo: parsed.data.titulo,
      porcentaje_aprobacion: parsed.data.porcentaje_aprobacion,
      max_intentos: parsed.data.max_intentos,
      tiempo_limite_minutos: parsed.data.tiempo_limite_minutos,
      randomizar_preguntas: parsed.data.randomizar_preguntas,
      mostrar_correctas: parsed.data.mostrar_correctas,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${parsed.data.curso_id}/editar`)
  return { success: true, data: { id: data.id } }
}

export async function actualizarQuiz(
  quizId: string,
  _prev: ActionResult<void> | null,
  formData: FormData
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(quizSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const { error } = await supabase
    .from('curso_quizzes')
    .update({
      titulo: parsed.data.titulo,
      porcentaje_aprobacion: parsed.data.porcentaje_aprobacion,
      max_intentos: parsed.data.max_intentos,
      tiempo_limite_minutos: parsed.data.tiempo_limite_minutos,
      randomizar_preguntas: parsed.data.randomizar_preguntas,
      mostrar_correctas: parsed.data.mostrar_correctas,
    })
    .eq('id', quizId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/*/editar`)
  return { success: true, data: undefined }
}

export async function eliminarQuiz(quizId: string): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  const { error } = await supabase.from('curso_quizzes').delete().eq('id', quizId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

const preguntaInputSchema = z.object({
  enunciado: z.string().min(1),
  tipo: z.enum(['multiple_choice', 'multiple_select', 'true_false', 'short_text']),
  puntaje: z.number().default(1),
  explicacion: z.string().optional().default(''),
  short_text_respuesta: z.string().optional().default(''),
  opciones: z.array(z.object({
    texto: z.string().min(1),
    es_correcta: z.boolean(),
  })).optional().default([]),
})

export async function guardarPreguntasQuiz(
  quizId: string,
  preguntas: z.infer<typeof preguntaInputSchema>[]
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  // Validate all preguntas
  for (const p of preguntas) {
    const r = preguntaInputSchema.safeParse(p)
    if (!r.success) return { success: false, error: `Pregunta inválida: ${formatZodErrors(r.error)}` }
  }

  // Delete existing preguntas + opciones (CASCADE)
  const { error: delError } = await supabase.from('curso_preguntas').delete().eq('quiz_id', quizId)
  if (delError) return { success: false, error: delError.message }

  // Insert new preguntas
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i]
    const { data: pregunta, error: pErr } = await supabase
      .from('curso_preguntas')
      .insert({
        quiz_id: quizId,
        orden: i + 1,
        enunciado: p.enunciado,
        tipo: p.tipo,
        puntaje: p.puntaje,
        explicacion: p.explicacion || null,
        short_text_respuesta: p.short_text_respuesta || null,
      })
      .select('id')
      .single()

    if (pErr) return { success: false, error: pErr.message }

    if (p.opciones && p.opciones.length > 0) {
      const { error: oErr } = await supabase.from('curso_opciones').insert(
        p.opciones.map((o, oi) => ({
          pregunta_id: pregunta.id,
          orden: oi + 1,
          texto: o.texto,
          es_correcta: o.es_correcta,
        }))
      )
      if (oErr) return { success: false, error: oErr.message }
    }
  }

  revalidatePath(`/dashboard/cursos/admin/*/editar`)
  return { success: true, data: undefined }
}

// ============================================================
// ASIGNACIONES
// ============================================================

export async function asignarCurso(
  _prev: ActionResult<{ ids: string[] }> | null,
  formData: FormData
): Promise<ActionResult<{ ids: string[] }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const cursoId = formData.get('curso_id') as string
  const personaIdsRaw = formData.getAll('persona_id') as string[]
  const fechaLimite = formData.get('fecha_limite') as string | null
  const obligatorio = formData.get('obligatorio') === 'true'

  if (!cursoId || personaIdsRaw.length === 0) return { success: false, error: 'Curso y al menos 1 persona requeridos' }

  // Get curso version
  const { data: curso } = await supabase.from('cursos').select('version').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  // Get persona consultora_ids for permission check
  const { data: personas } = await supabase
    .from('personas_directorio')
    .select('id')
    .in('id', personaIdsRaw)

  if (!personas || personas.length === 0) return { success: false, error: 'Personas no encontradas' }

  const insertData = personas.map(p => ({
    curso_id: cursoId,
    persona_id: p.id,
    fecha_limite: fechaLimite || null,
    obligatorio,
    curso_version: curso.version,
    asignado_por_id: user.id,
  }))

  const { data: inserts, error } = await supabase
    .from('curso_asignaciones')
    .insert(insertData)
    .select('id')

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/cursos/admin/${cursoId}/asignaciones`)
  return { success: true, data: { ids: inserts?.map(i => i.id) ?? [] } }
}

interface AsignacionCriterios {
  empresa_id?: string
  establecimiento_id?: string
  sector_id?: string
  puesto_id?: string
  fecha_limite?: string
  obligatorio?: boolean
}

export async function asignarMasivo(
  cursoId: string,
  criterios: AsignacionCriterios
): Promise<ActionResult<{ creadas: number }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: curso } = await supabase.from('cursos').select('version').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  // Build query to get personas matching criteria
  let query = supabase.from('personas_directorio').select('id')

  if (criterios.puesto_id) {
    // Get personas by puesto via trabajador_puestos
    const { data: tp } = await supabase
      .from('trabajador_puestos')
      .select('persona_id')
      .eq('puesto_id', criterios.puesto_id)
      .is('fecha_baja', null)
    const ids = tp?.map(t => t.persona_id) ?? []
    if (ids.length === 0) return { success: true, data: { creadas: 0 } }
    query = query.in('id', ids)
  }

  if (criterios.sector_id) {
    const { data: puestos } = await supabase
      .from('puestos_de_trabajo')
      .select('id')
      .eq('sector_id', criterios.sector_id)
    const puestoIds = puestos?.map(p => p.id) ?? []
    const { data: tp } = await supabase
      .from('trabajador_puestos')
      .select('persona_id')
      .in('puesto_id', puestoIds)
      .is('fecha_baja', null)
    const ids = tp?.map(t => t.persona_id) ?? []
    query = query.in('id', ids)
  }

  if (criterios.establecimiento_id) {
    // Filter by establecimiento - direct field on personas_directorio? 
    // Actually, let's check the schema... using organizacion_id for now
    const { data: est } = await supabase
      .from('establecimientos')
      .select('empresa_id')
      .eq('id', criterios.establecimiento_id)
      .single()
    if (est) {
      criterios.empresa_id = est.empresa_id
    }
  }

  if (criterios.empresa_id) {
    // Filter by empresa - we need to find personas linked to this empresa's establecimientos
    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, empresa_id')
      .eq('empresa_id', criterios.empresa_id)

    const estIds = establecimientos?.map(e => e.id) ?? []

    if (estIds.length > 0) {
      const { data: puestos } = await supabase
        .from('puestos_de_trabajo')
        .select('id')
        .in('sector_id', (
          await supabase.from('sectores_establecimiento').select('id').in('establecimiento_id', estIds)
        ).data?.map(s => s.id) ?? [])
      const puestoIds = puestos?.map(p => p.id) ?? []
      const { data: tp } = await supabase
        .from('trabajador_puestos')
        .select('persona_id')
        .in('puesto_id', puestoIds)
        .is('fecha_baja', null)
      const ids = tp?.map(t => t.persona_id) ?? []
      query = query.in('id', ids)
    }
  }

  const { data: personas } = await query
  if (!personas || personas.length === 0) return { success: true, data: { creadas: 0 } }

  // Filter out already assigned
  const { data: existing } = await supabase
    .from('curso_asignaciones')
    .select('persona_id')
    .eq('curso_id', cursoId)
    .in('persona_id', personas.map(p => p.id))

  const existingIds = new Set(existing?.map(e => e.persona_id) ?? [])
  const newPersonas = personas.filter(p => !existingIds.has(p.id))

  if (newPersonas.length === 0) return { success: true, data: { creadas: 0 } }

  const { error } = await supabase.from('curso_asignaciones').insert(
    newPersonas.map(p => ({
      curso_id: cursoId,
      persona_id: p.id,
      fecha_limite: criterios.fecha_limite || null,
      obligatorio: criterios.obligatorio ?? false,
      curso_version: curso.version,
      asignado_por_id: user.id,
    }))
  )

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${cursoId}/asignaciones`)
  return { success: true, data: { creadas: newPersonas.length } }
}

export async function importarAsignacionesCSV(
  cursoId: string,
  formData: FormData
): Promise<ActionResult<{ creadas: number; fallidas: number }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Archivo CSV requerido' }

  const { data: curso } = await supabase.from('cursos').select('version').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { success: false, error: 'CSV vacío o sin datos' }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const dniIdx = header.indexOf('dni')
  const emailIdx = header.indexOf('email')

  let creadas = 0
  let fallidas = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const dni = dniIdx >= 0 ? cols[dniIdx] : null
    const email = emailIdx >= 0 ? cols[emailIdx] : null

    let query = supabase.from('personas_directorio').select('id').limit(1)
    if (dni) query = query.eq('dni', dni)
    else if (email) query = query.eq('email', email)
    else { fallidas++; continue }

    const { data: personas } = await query
    if (!personas || personas.length === 0) { fallidas++; continue }

    const { error } = await supabase.from('curso_asignaciones').insert({
      curso_id: cursoId,
      persona_id: personas[0].id,
      curso_version: curso.version,
      asignado_por_id: user.id,
    })

    if (error) { fallidas++ } else { creadas++ }
  }

  revalidatePath(`/dashboard/cursos/admin/${cursoId}/asignaciones`)
  return { success: true, data: { creadas, fallidas } }
}

export async function desasignarCurso(asignacionId: string): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  const { error } = await supabase.from('curso_asignaciones').update({ estado: 'desasignado' }).eq('id', asignacionId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/asignaciones')
  return { success: true, data: undefined }
}

// ============================================================
// PLAYER / PROGRESO
// ============================================================

export async function iniciarCurso(asignacionId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('curso_asignaciones')
    .update({ estado: 'en_curso', fecha_inicio: new Date().toISOString(), ultimo_acceso: new Date().toISOString() })
    .eq('id', asignacionId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function marcarLeccionCompletada(
  asignacionId: string,
  leccionId: string,
  minutosVistos: number = 0
): Promise<ActionResult<void>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  // Upsert progreso
  const { error } = await supabase
    .from('curso_progreso_lecciones')
    .upsert({
      asignacion_id: asignacionId,
      leccion_id: leccionId,
      completada: true,
      minutos_vistos: minutosVistos,
      ultima_vez: new Date().toISOString(),
    }, { onConflict: 'asignacion_id, leccion_id' })

  if (error) return { success: false, error: error.message }

  // Recalcular progreso %
  await recalcularProgreso(asignacionId)

  // Update ultimo_acceso
  await supabase.from('curso_asignaciones').update({ ultimo_acceso: new Date().toISOString() }).eq('id', asignacionId)

  revalidatePath(`/dashboard/cursos/[id]`)
  return { success: true, data: undefined }
}

async function recalcularProgreso(asignacionId: string) {
  const supabase = await createClient()

  // Get asignacion
  const { data: asig } = await supabase.from('curso_asignaciones').select('curso_id').eq('id', asignacionId).single()
  if (!asig) return

  // Count total lecciones
  const { count: total } = await supabase
    .from('curso_lecciones')
    .select('id', { count: 'exact', head: true })
    .in('modulo_id', (
      await supabase.from('curso_modulos').select('id').eq('curso_id', asig.curso_id)
    ).data?.map(m => m.id) ?? [])

  if (!total || total === 0) return

  // Count completed
  const { count: completadas } = await supabase
    .from('curso_progreso_lecciones')
    .select('id', { count: 'exact', head: true })
    .eq('asignacion_id', asignacionId)
    .eq('completada', true)

  const pct = Math.round(((completadas ?? 0) / total) * 100)

  await supabase
    .from('curso_asignaciones')
    .update({ progreso_porcentaje: pct, updated_at: new Date().toISOString() })
    .eq('id', asignacionId)
}

// ============================================================
// QUIZ PLAYER
// ============================================================

export async function iniciarIntentoQuiz(
  asignacionId: string,
  quizId: string
): Promise<ActionResult<{ intentoId: string; numeroIntento: number }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  // Get quiz config
  const { data: quiz } = await supabase.from('curso_quizzes').select('max_intentos').eq('id', quizId).single()
  if (!quiz) return { success: false, error: 'Quiz no encontrado' }

  // Count existing attempts
  const { count: intentosRealizados } = await supabase
    .from('curso_intentos_quiz')
    .select('id', { count: 'exact', head: true })
    .eq('asignacion_id', asignacionId)
    .eq('quiz_id', quizId)

  const maxIntentos = quiz.max_intentos ?? 999
  if (intentosRealizados && intentosRealizados >= maxIntentos) {
    return { success: false, error: 'Alcanzaste el máximo de intentos para este quiz' }
  }

  const numeroIntento = (intentosRealizados ?? 0) + 1

  const { data, error } = await supabase
    .from('curso_intentos_quiz')
    .insert({
      asignacion_id: asignacionId,
      quiz_id: quizId,
      numero_intento: numeroIntento,
      fecha_inicio: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { intentoId: data.id, numeroIntento } }
}

export async function enviarIntentoQuiz(
  _prev: ActionResult<{ aprobado: boolean; puntaje: number; certificadoId?: string }> | null,
  formData: FormData
): Promise<ActionResult<{ aprobado: boolean; puntaje: number; certificadoId?: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const intentoId = formData.get('intento_id') as string
  if (!intentoId) return { success: false, error: 'ID de intento requerido' }

  const respuestasRaw = formData.get('respuestas') as string
  let respuestas: { pregunta_id: string; opciones_seleccionadas?: string[]; texto?: string }[]
  try {
    respuestas = JSON.parse(respuestasRaw)
  } catch {
    return { success: false, error: 'Respuestas inválidas' }
  }

  // Get intento
  const { data: intento } = await supabase
    .from('curso_intentos_quiz')
    .select('asignacion_id, quiz_id')
    .eq('id', intentoId)
    .single()
  if (!intento) return { success: false, error: 'Intento no encontrado' }

  // Get quiz with preguntas
  const { data: quiz } = await supabase
    .from('curso_quizzes')
    .select('*, curso_preguntas(*, curso_opciones(*))')
    .eq('id', intento.quiz_id)
    .single()

  if (!quiz) return { success: false, error: 'Quiz no encontrado' }

  const preguntas = (quiz as any).curso_preguntas ?? []
  let puntajeObtenido = 0
  let puntajeTotal = 0

  const respuestasConResultado = preguntas.map((p: any) => {
    puntajeTotal += Number(p.puntaje)
    const userResp = respuestas.find(r => r.pregunta_id === p.id)
    let esCorrecta = false

    if (p.tipo === 'short_text') {
      const correcta = (p.short_text_respuesta ?? '').toLowerCase().trim()
      const userText = (userResp?.texto ?? '').toLowerCase().trim()
      esCorrecta = userText === correcta
    } else if (p.tipo === 'true_false') {
      const correcta = p.curso_opciones?.find((o: any) => o.es_correcta)
      const selected = userResp?.opciones_seleccionadas ?? []
      esCorrecta = correcta && selected.includes(correcta.id)
    } else {
      const correctas = p.curso_opciones?.filter((o: any) => o.es_correcta).map((o: any) => o.id) ?? []
      const selected = userResp?.opciones_seleccionadas ?? []
      if (p.tipo === 'multiple_choice') {
        esCorrecta = selected.length === 1 && correctas.length === 1 && selected[0] === correctas[0]
      } else if (p.tipo === 'multiple_select') {
        const a = new Set(selected)
        const b = new Set(correctas)
        esCorrecta = a.size === b.size && [...a].every(v => b.has(v))
      }
    }

    if (esCorrecta) puntajeObtenido += Number(p.puntaje)
    return {
      pregunta_id: p.id,
      opciones_seleccionadas: userResp?.opciones_seleccionadas ?? [],
      texto: userResp?.texto ?? null,
      es_correcta: esCorrecta,
    }
  })

  const porcentaje = puntajeTotal > 0 ? (puntajeObtenido / puntajeTotal) * 100 : 0
  const aprobado = porcentaje >= quiz.porcentaje_aprobacion

  // Update intento
  await supabase
    .from('curso_intentos_quiz')
    .update({
      fecha_fin: new Date().toISOString(),
      puntaje_obtenido: puntajeObtenido,
      puntaje_total: puntajeTotal,
      porcentaje,
      aprobado,
      respuestas: respuestasConResultado,
    })
    .eq('id', intentoId)

  let certificadoId: string | undefined

  if (aprobado) {
    // Check if this is the final quiz (modulo_id IS NULL)
    if (!quiz.modulo_id) {
      // Final quiz — mark course as approved and emit certificate
      await supabase
        .from('curso_asignaciones')
        .update({
          estado: 'aprobado',
          fecha_aprobacion: new Date().toISOString(),
          progreso_porcentaje: 100,
        })
        .eq('id', intento.asignacion_id)

      const certResult = await emitirCertificado(intento.asignacion_id)
      if (certResult.success && certResult.data) {
        certificadoId = certResult.data.certificadoId
      }
    } else {
      // Module quiz — mark module as complete (check all lessons + quiz done)
      // For now, just update progress
      await recalcularProgreso(intento.asignacion_id)
    }
  }

  revalidatePath('/dashboard/cursos/[id]/quiz/[quizId]')
  return {
    success: true,
    data: { aprobado, puntaje: porcentaje, certificadoId },
  }
}

// ============================================================
// CERTIFICADOS
// ============================================================

export async function emitirCertificado(asignacionId: string): Promise<ActionResult<{ certificadoId: string; pdfUrl: string }>> {
  const supabase = await createClient()

  const { data: asig } = await supabase
    .from('curso_asignaciones')
    .select('*, cursos(*), personas_directorio!persona_id(*)')
    .eq('id', asignacionId)
    .single()

  if (!asig) return { success: false, error: 'Asignación no encontrada' }

  const curso = (asig as any).cursos
  const persona = (asig as any).personas_directorio

  // Generate validation code
  const codigo = `CERT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const fechaEmision = new Date().toISOString()
  let fechaVencimiento: string | null = null

  if (curso.vencimiento_meses) {
    const d = new Date()
    d.setMonth(d.getMonth() + curso.vencimiento_meses)
    fechaVencimiento = d.toISOString().split('T')[0]
  }

  // Insert certificado
  const { data: cert, error: certErr } = await supabase
    .from('cursos_certificados')
    .insert({
      asignacion_id: asignacionId,
      codigo_validacion: codigo,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
    })
    .select('id')
    .single()

  if (certErr) return { success: false, error: certErr.message }

  // Create firma record
  const { data: autor } = await supabase.from('cursos').select('autor_id').eq('id', curso.id).single()
  const autorName = autor?.autor_id
    ? (await supabase.from('profiles').select('full_name').eq('id', autor.autor_id).single()).data?.full_name ?? 'Autor'
    : 'Sigmetría HyS'

  await supabase.from('firmas').insert({
    consultora_id: curso.consultora_id ?? '00000000-0000-0000-0000-000000000000',
    entidad_tipo: 'curso_certificado',
    entidad_id: cert.id,
    firmante_tipo: 'usuario_interno',
    firmante_usuario_id: curso.autor_id,
    nombre_completo: autorName,
    dni: curso.consultora_id ?? 'PUBLIC',
  })

  // Generate PDF URL (we'll use a simple approach — generate HTML and convert later)
  // For now, store without PDF — the PDF generation will be improved later
  const pdfPath = `${curso.consultora_id ?? 'public'}/cert_${codigo}.pdf`
  const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/cursos/certificado-pdf/${codigo}`

  await supabase.from('cursos_certificados').update({ pdf_path: pdfPath, pdf_url: pdfUrl }).eq('id', cert.id)

  // Create notification
  try {
    await supabase.from('notificaciones').insert({
      consultora_id: curso.consultora_id ?? '00000000-0000-0000-0000-000000000000',
      tipo: 'curso_aprobado',
      entidad_tipo: 'certificado',
      entidad_id: cert.id,
      titulo: `¡Curso completado!`,
      mensaje: `Felicitaciones, completaste el curso "${curso.titulo}". Tu certificado ya está disponible.`,
      entidad_nombre: curso.titulo,
      contexto_nombre: `${persona.nombre} ${persona.apellido}`,
      fecha_vencimiento: fechaVencimiento ?? '2099-12-31',
      dias_restantes: curso.vencimiento_meses ? (curso.vencimiento_meses * 30) : 9999,
    })
  } catch {
    // Non-critical
  }

  return { success: true, data: { certificadoId: cert.id, pdfUrl } }
}

export async function validarCertificadoPublico(
  codigo: string
): Promise<{ valido: boolean; datos?: { codigo: string; curso_titulo: string; persona_nombre: string; fecha_emision: string; fecha_vencimiento: string | null; valido: boolean; autor_nombre: string | null; consultora_nombre: string | null } }> {
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from('cursos_certificados')
    .select('*, curso_asignaciones!asignacion_id(cursos!curso_id(titulo, consultora_id), personas_directorio!persona_id(nombre, apellido))')
    .eq('codigo_validacion', codigo)
    .maybeSingle()

  if (!cert) return { valido: false }

  if (cert.invalidado) return { valido: false }

  const asig = (cert as any).curso_asignaciones
  if (!asig) return { valido: false }

  const cursoData = asig.cursos
  const personaData = asig.personas_directorio

  const estaVencido = cert.fecha_vencimiento && new Date(cert.fecha_vencimiento) < new Date()

  return {
    valido: !estaVencido,
    datos: {
      codigo: cert.codigo_validacion,
      curso_titulo: cursoData.titulo,
      persona_nombre: `${personaData.nombre} ${personaData.apellido}`,
      fecha_emision: cert.fecha_emision,
      fecha_vencimiento: cert.fecha_vencimiento,
      valido: !estaVencido,
      autor_nombre: null,
      consultora_nombre: null,
    },
  }
}

// ============================================================
// COMPLIANCE
// ============================================================

export async function obtenerCumplimientoConsultora(): Promise<ActionResult<{
  porcentaje_global: number
  total_asignaciones: number
  aprobadas: number
  pendientes: number
  vencidas: number
  proximas_a_vencer: number
}>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const member = await getConsultoraMembership(user.id)
  if (!member) return { success: false, error: 'Sin membresía activa' }

  // Get all personas of this consultora
  const { data: personas } = await supabase
    .from('personas_directorio')
    .select('id')
    .eq('created_in_consultora_id', member.consultora_id)

  if (!personas || personas.length === 0) return {
    success: true,
    data: { porcentaje_global: 100, total_asignaciones: 0, aprobadas: 0, pendientes: 0, vencidas: 0, proximas_a_vencer: 0 },
  }

  const { data: asignaciones } = await supabase
    .from('curso_asignaciones')
    .select('estado, fecha_limite')
    .in('persona_id', personas.map(p => p.id))
    .neq('estado', 'desasignado')

  const total = asignaciones?.length ?? 0
  if (total === 0) return {
    success: true,
    data: { porcentaje_global: 100, total_asignaciones: 0, aprobadas: 0, pendientes: 0, vencidas: 0, proximas_a_vencer: 0 },
  }

  const aprobadas = asignaciones?.filter(a => a.estado === 'aprobado').length ?? 0
  const pendientes = asignaciones?.filter(a => a.estado === 'pendiente' || a.estado === 'en_curso').length ?? 0
  const vencidas = asignaciones?.filter(a => a.estado === 'vencido').length ?? 0

  const today = new Date()
  const proximasAVencer = asignaciones?.filter(a => {
    if (!a.fecha_limite || a.estado === 'aprobado' || a.estado === 'vencido') return false
    const diff = (new Date(a.fecha_limite).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  }).length ?? 0

  return {
    success: true,
    data: {
      porcentaje_global: Math.round((aprobadas / total) * 100),
      total_asignaciones: total,
      aprobadas,
      pendientes,
      vencidas,
      proximas_a_vencer: proximasAVencer,
    },
  }
}

export async function obtenerCumplimientoEmpresa(empresaId: string): Promise<ActionResult<{
  empresa_id: string
  empresa_nombre: string
  porcentaje: number
  total: number
  aprobadas: number
  vencidas: number
  detalle_por_establecimiento: { establecimiento_id: string; establecimiento_nombre: string; porcentaje: number; total: number; aprobadas: number }[]
}>> {
  const { supabase } = await getUserAuth()

  const { data: empresa } = await supabase.from('empresas').select('razon_social').eq('id', empresaId).single()
  if (!empresa) return { success: false, error: 'Empresa no encontrada' }

  const { data: establecimientos } = await supabase.from('establecimientos').select('id, nombre').eq('empresa_id', empresaId)
  // Get personas for each establecimiento
  let allAsignaciones: any[] = []
  const detalleEstablecimiento: any[] = []

  for (const est of establecimientos ?? []) {
    const { data: puestos } = await supabase.from('puestos_de_trabajo').select('id').in('sector_id', (
      await supabase.from('sectores_establecimiento').select('id').eq('establecimiento_id', est.id)
    ).data?.map(s => s.id) ?? [])

    const puestoIds = puestos?.map(p => p.id) ?? []
    const { data: tp } = await supabase.from('trabajador_puestos').select('persona_id').in('puesto_id', puestoIds)
    const personaIds = [...new Set(tp?.map(t => t.persona_id) ?? [])]

    if (personaIds.length > 0) {
      const { data: asigs } = await supabase
        .from('curso_asignaciones')
        .select('estado, empresa_id')
        .in('persona_id', personaIds)
        .neq('estado', 'desasignado')

      const total = asigs?.length ?? 0
      const aprobadas = asigs?.filter(a => a.estado === 'aprobado').length ?? 0

      detalleEstablecimiento.push({
        establecimiento_id: est.id,
        establecimiento_nombre: est.nombre,
        porcentaje: total > 0 ? Math.round((aprobadas / total) * 100) : 100,
        total,
        aprobadas,
      })

      if (asigs) allAsignaciones = [...allAsignaciones, ...asigs]
    }
  }

  const total = allAsignaciones.length
  const aprobadas = allAsignaciones.filter(a => a.estado === 'aprobado').length
  const vencidas = allAsignaciones.filter(a => a.estado === 'vencido').length

  return {
    success: true,
    data: {
      empresa_id: empresaId,
      empresa_nombre: empresa.razon_social,
      porcentaje: total > 0 ? Math.round((aprobadas / total) * 100) : 100,
      total,
      aprobadas,
      vencidas,
      detalle_por_establecimiento: detalleEstablecimiento,
    },
  }
}

export async function obtenerTrendCumplimiento(): Promise<ActionResult<{ mes: string; porcentaje: number; total: number }[]>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const member = await getConsultoraMembership(user.id)
  if (!member) return { success: false, error: 'Sin membresía activa' }

  // Simplified: return last 12 months based on current data
  const { data: personas } = await supabase
    .from('personas_directorio')
    .select('id')
    .eq('created_in_consultora_id', member.consultora_id)

  if (!personas || personas.length === 0) return { success: true, data: [] }

  const { data: asignaciones } = await supabase
    .from('curso_asignaciones')
    .select('estado, fecha_aprobacion, created_at')
    .in('persona_id', personas.map(p => p.id))
    .neq('estado', 'desasignado')

  const trend: { mes: string; porcentaje: number; total: number }[] = []
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const total = asignaciones?.filter(a => new Date(a.created_at) <= new Date(d.getFullYear(), d.getMonth() + 1, 0)).length ?? 0
    const aprobadas = asignaciones?.filter(a => {
      if (a.estado !== 'aprobado' || !a.fecha_aprobacion) return false
      return new Date(a.fecha_aprobacion) <= new Date(d.getFullYear(), d.getMonth() + 1, 0)
    }).length ?? 0

    trend.push({
      mes: mesKey,
      porcentaje: total > 0 ? Math.round((aprobadas / total) * 100) : 0,
      total,
    })
  }

  return { success: true, data: trend }
}

// ============================================================
// OBLIGATORIEDAD
// ============================================================

const obligatorioSchema = z.object({
  curso_id: z.string().uuid(),
  scope_tipo: z.enum(['empresa', 'establecimiento', 'sector', 'puesto']),
  scope_id: z.string().uuid(),
  vigente_desde: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  vigente_hasta: z.string().nullable().optional().default(null),
  fecha_limite_dias: z.coerce.number().nullable().optional().default(null),
})

export async function definirObligatoriedad(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(obligatorioSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const { data, error } = await supabase
    .from('cursos_obligatorios')
    .insert({
      curso_id: parsed.data.curso_id,
      scope_tipo: parsed.data.scope_tipo,
      scope_id: parsed.data.scope_id,
      vigente_desde: parsed.data.vigente_desde,
      vigente_hasta: parsed.data.vigente_hasta,
      fecha_limite_dias: parsed.data.fecha_limite_dias,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/cursos/admin/${parsed.data.curso_id}/editar`)
  return { success: true, data: { id: data.id } }
}

export async function eliminarObligatoriedad(obligatorioId: string): Promise<ActionResult<void>> {
  const { supabase } = await getUserAuth()
  const { error } = await supabase.from('cursos_obligatorios').delete().eq('id', obligatorioId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/cursos/admin/*/editar')
  return { success: true, data: undefined }
}

export async function reconciliarObligatoriedades(cursoId: string): Promise<ActionResult<{ asignacionesNuevas: number }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: curso } = await supabase.from('cursos').select('version, consultora_id').eq('id', cursoId).single()
  if (!curso) return { success: false, error: 'Curso no encontrado' }

  const { data: reglas } = await supabase.from('cursos_obligatorios').select('*').eq('curso_id', cursoId)
  if (!reglas || reglas.length === 0) return { success: true, data: { asignacionesNuevas: 0 } }

  const personaIds: Set<string> = new Set()

  for (const regla of reglas) {
    if (regla.scope_tipo === 'puesto') {
      const { data: tp } = await supabase.from('trabajador_puestos').select('persona_id').eq('puesto_id', regla.scope_id)
      tp?.forEach(t => personaIds.add(t.persona_id))
    } else if (regla.scope_tipo === 'sector') {
      const { data: puestos } = await supabase.from('puestos_de_trabajo').select('id').eq('sector_id', regla.scope_id)
      const { data: tp } = await supabase.from('trabajador_puestos').select('persona_id').in('puesto_id', puestos?.map(p => p.id) ?? [])
      tp?.forEach(t => personaIds.add(t.persona_id))
    } else if (regla.scope_tipo === 'establecimiento') {
      const { data: puestos } = await supabase.from('puestos_de_trabajo').select('id').in('sector_id', (
        await supabase.from('sectores_establecimiento').select('id').eq('establecimiento_id', regla.scope_id)
      ).data?.map(s => s.id) ?? [])
      const { data: tp } = await supabase.from('trabajador_puestos').select('persona_id').in('puesto_id', puestos?.map(p => p.id) ?? [])
      tp?.forEach(t => personaIds.add(t.persona_id))
    } else if (regla.scope_tipo === 'empresa') {
      const { data: establecimientos } = await supabase.from('establecimientos').select('id').eq('empresa_id', regla.scope_id)
      for (const est of establecimientos ?? []) {
        const { data: puestos } = await supabase.from('puestos_de_trabajo').select('id').in('sector_id', (
          await supabase.from('sectores_establecimiento').select('id').eq('establecimiento_id', est.id)
        ).data?.map(s => s.id) ?? [])
        const { data: tp } = await supabase.from('trabajador_puestos').select('persona_id').in('puesto_id', puestos?.map(p => p.id) ?? [])
        tp?.forEach(t => personaIds.add(t.persona_id))
      }
    }
  }

  // Remove already assigned
  const { data: existing } = await supabase
    .from('curso_asignaciones')
    .select('persona_id')
    .eq('curso_id', cursoId)

  const existingIds = new Set(existing?.map(e => e.persona_id) ?? [])
  const newPersonaIds = [...personaIds].filter(id => !existingIds.has(id))

  if (newPersonaIds.length === 0) return { success: true, data: { asignacionesNuevas: 0 } }

  const { error } = await supabase.from('curso_asignaciones').insert(
    newPersonaIds.map(pid => ({
      curso_id: cursoId,
      persona_id: pid,
      obligatorio: true,
      curso_version: curso.version,
      asignado_por_id: user.id,
    }))
  )

  if (error) return { success: false, error: error.message }
  return { success: true, data: { asignacionesNuevas: newPersonaIds.length } }
}

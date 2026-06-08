'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { emitirCertificado } from '@/lib/actions/curso'
import { Resend } from 'resend'

// ============================================================
// TIPOS COMPARTIDOS (consumidos por las hojas/UI)
// ============================================================

export type CapacitacionModalidad = 'elearning' | 'presencial'
export type CapacitacionSesionEstado = 'borrador' | 'abierta' | 'cerrada'
export type ParticipanteEstado = 'pendiente' | 'en_progreso' | 'aprobado' | 'reprobado'

export interface PersonaEstablecimiento {
  persona_id: string
  nombre: string
  apellido: string
  email: string | null
  legajo: string | null
}

export interface ParticipanteInput {
  personaId?: string
  nombre?: string
  email?: string
}

export interface ParticipanteToken {
  id: string
  personaId: string | null
  nombre: string | null
  email: string | null
  token: string
  url: string
}

export interface EnvioLinkResultado {
  participanteId: string
  email: string | null
  enviado: boolean
  error?: string
}

// Pregunta/Opción tal como se mandan al cliente público: SIN es_correcta
export interface PreguntaPublica {
  id: string
  orden: number
  enunciado: string
  tipo: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_text'
  puntaje: number
  opciones: { id: string; orden: number; texto: string }[]
}

export interface LeccionPublica {
  id: string
  modulo_id: string
  orden: number
  titulo: string
  tipo: 'video' | 'pdf' | 'texto' | 'embed'
  contenido_url: string | null
  contenido_texto: string | null
  duracion_minutos: number | null
  descargable: boolean
  anti_skip: boolean
}

export interface CapacitacionPublica {
  sesion: {
    id: string
    titulo: string | null
    modalidad: CapacitacionModalidad
    estado: CapacitacionSesionEstado
    fecha: string | null
    nota_aprobacion: number | null
  }
  curso: {
    id: string
    titulo: string
    descripcion_corta: string | null
    portada_url: string | null
  }
  lecciones: LeccionPublica[]
  quiz: {
    id: string | null
    porcentaje_aprobacion: number
    preguntas: PreguntaPublica[]
  } | null
  participante: {
    id: string
    nombre: string | null
    estado: ParticipanteEstado
    intentos: number
    aprobado: boolean
    puntaje: number | null
  }
}

export interface RespuestaParticipante {
  pregunta_id: string
  opciones_seleccionadas?: string[]
  texto?: string | null
}

export interface ResultadoEvaluacion {
  aprobado: boolean
  puntaje: number
  certificadoCodigo?: string
}

export interface RegistroParticipante {
  id: string
  persona_id: string | null
  nombre: string | null
  email: string | null
  estado: ParticipanteEstado
  puntaje: number | null
  aprobado: boolean
  intentos: number
  iniciado_at: string | null
  completado_at: string | null
  certificado_codigo: string | null
  certificado_pdf_url: string | null
}

export interface RegistroGeneral {
  sesion: {
    id: string
    titulo: string | null
    modalidad: CapacitacionModalidad
    estado: CapacitacionSesionEstado
    fecha: string | null
    nota_aprobacion: number | null
    comentario: string | null
  }
  curso: { id: string; titulo: string }
  instructor: { nombre: string | null; externo: string | null }
  participantes: RegistroParticipante[]
}

interface CrearSesionInput {
  cursoId: string
  establecimientoId: string
  empresaId?: string
  gestionEstablecimientoId?: string
  registroGestionId?: string
  rgFechaPlanificada?: string
  instructorPersonaId?: string
  instructorExterno?: string
  fecha?: string
  titulo?: string
  modalidad?: CapacitacionModalidad
  notaAprobacion?: number
}

// ============================================================
// HELPERS
// ============================================================

const DEFAULT_NOTA_APROBACION = 70

async function getUserAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://hys-app-sig.vercel.app'
}

/**
 * Valida un token contra capacitacion_participantes usando service-role.
 * Devuelve la fila del participante + la sesión asociada, o null si no
 * existe / expiró. NUNCA expone datos sin validar el token primero.
 */
async function resolveParticipantePorToken(token: string) {
  const admin = createAdminClient()
  const { data: participante, error } = await admin
    .from('capacitacion_participantes')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !participante) return null

  // Expiración (opcional). Si token_expira está seteado y ya pasó, rechazar.
  if (participante.token_expira && new Date(participante.token_expira) < new Date()) {
    return null
  }

  return participante
}

// ============================================================
// 1) CREAR SESIÓN DESDE UNA GESTIÓN (authed, RLS)
// ============================================================

export async function crearSesionDesdeGestion(
  input: CrearSesionInput
): Promise<ActionResult<{ sesionId: string }>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }

  if (!input.cursoId) return { success: false, error: 'cursoId es obligatorio' }
  if (!input.establecimientoId) return { success: false, error: 'establecimientoId es obligatorio' }

  const { data, error } = await supabase
    .from('capacitacion_sesiones')
    .insert({
      curso_id: input.cursoId,
      establecimiento_id: input.establecimientoId,
      empresa_id: input.empresaId ?? null,
      gestion_establecimiento_id: input.gestionEstablecimientoId ?? null,
      registro_gestion_id: input.registroGestionId ?? null,
      rg_fecha_planificada: input.rgFechaPlanificada ?? null,
      instructor_persona_id: input.instructorPersonaId ?? null,
      instructor_externo: input.instructorExterno ?? null,
      fecha: input.fecha ?? null,
      titulo: input.titulo ?? null,
      modalidad: input.modalidad ?? 'elearning',
      nota_aprobacion: input.notaAprobacion ?? null,
      estado: 'borrador',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: { sesionId: data.id } }
}

// ============================================================
// 2) PERSONAS DEL ESTABLECIMIENTO (authed, RLS) — preselección
// ============================================================

export async function getPersonasDeEstablecimiento(
  establecimientoId: string
): Promise<ActionResult<PersonaEstablecimiento[]>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!establecimientoId) return { success: false, error: 'establecimientoId es obligatorio' }

  const { data, error } = await supabase
    .from('personas_establecimientos')
    .select('persona_id, personas_directorio!persona_id(id, nombre, apellido, email, legajo, is_active)')
    .eq('establecimiento_id', establecimientoId)

  if (error) return { success: false, error: error.message }

  const personas: PersonaEstablecimiento[] = (data ?? [])
    .map((row) => {
      const p = (row as { personas_directorio: unknown }).personas_directorio as
        | { id: string; nombre: string; apellido: string; email: string | null; legajo: string | null; is_active: boolean }
        | null
      if (!p || p.is_active === false) return null
      return {
        persona_id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        email: p.email,
        legajo: p.legajo,
      }
    })
    .filter((p): p is PersonaEstablecimiento => p !== null)

  return { success: true, data: personas }
}

// ============================================================
// 3) AGREGAR PARTICIPANTES (authed, RLS) — genera tokens + asignaciones
// ============================================================

export async function agregarParticipantes(
  sesionId: string,
  items: ParticipanteInput[]
): Promise<ActionResult<ParticipanteToken[]>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!sesionId) return { success: false, error: 'sesionId es obligatorio' }
  if (!items.length) return { success: false, error: 'No hay participantes para agregar' }

  // Cargar la sesión (curso para crear/asegurar asignaciones)
  const { data: sesion, error: sesErr } = await supabase
    .from('capacitacion_sesiones')
    .select('id, curso_id, establecimiento_id, empresa_id')
    .eq('id', sesionId)
    .single()

  if (sesErr || !sesion) return { success: false, error: 'Sesión no encontrada o sin acceso' }

  // Versión del curso (para curso_asignaciones.curso_version NOT NULL)
  const { data: curso } = await supabase.from('cursos').select('version').eq('id', sesion.curso_id).single()
  const cursoVersion = curso?.version ?? 1

  const creados: ParticipanteToken[] = []

  for (const item of items) {
    if (!item.personaId && !item.nombre && !item.email) continue

    let asignacionId: string | null = null

    // Si tiene persona, aseguramos curso_asignaciones (persona_id NOT NULL)
    if (item.personaId) {
      const { data: existente } = await supabase
        .from('curso_asignaciones')
        .select('id')
        .eq('curso_id', sesion.curso_id)
        .eq('persona_id', item.personaId)
        .maybeSingle()

      if (existente) {
        asignacionId = existente.id
      } else {
        const { data: nuevaAsig, error: asigErr } = await supabase
          .from('curso_asignaciones')
          .insert({
            curso_id: sesion.curso_id,
            persona_id: item.personaId,
            empresa_id: sesion.empresa_id ?? null,
            establecimiento_id: sesion.establecimiento_id,
            asignado_por_id: user.id,
            curso_version: cursoVersion,
            estado: 'pendiente',
          })
          .select('id')
          .single()
        if (!asigErr && nuevaAsig) asignacionId = nuevaAsig.id
      }
    }

    const token = randomUUID()

    const { data: participante, error: partErr } = await supabase
      .from('capacitacion_participantes')
      .insert({
        sesion_id: sesionId,
        persona_id: item.personaId ?? null,
        nombre: item.nombre ?? null,
        email: item.email ?? null,
        token,
        asignacion_id: asignacionId,
        estado: 'pendiente',
        aprobado: false,
        intentos: 0,
      })
      .select('id, persona_id, nombre, email, token')
      .single()

    if (partErr || !participante) continue

    creados.push({
      id: participante.id,
      personaId: participante.persona_id,
      nombre: participante.nombre,
      email: participante.email,
      token: participante.token,
      url: `${appUrl()}/capacitacion/${participante.token}`,
    })
  }

  if (!creados.length) {
    return { success: false, error: 'No se pudo crear ningún participante' }
  }

  revalidatePath('/dashboard')
  return { success: true, data: creados }
}

// ============================================================
// 4) ENVIAR LINKS POR EMAIL (authed) — best-effort
// ============================================================

export async function enviarLinksParticipantes(
  sesionId: string
): Promise<ActionResult<EnvioLinkResultado[]>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!sesionId) return { success: false, error: 'sesionId es obligatorio' }

  const { data: sesion } = await supabase
    .from('capacitacion_sesiones')
    .select('id, titulo, cursos!curso_id(titulo)')
    .eq('id', sesionId)
    .single()

  if (!sesion) return { success: false, error: 'Sesión no encontrada o sin acceso' }

  const cursoTitulo =
    (sesion as unknown as { cursos: { titulo: string } | null }).cursos?.titulo ?? sesion.titulo ?? 'Capacitación'

  const { data: participantes, error } = await supabase
    .from('capacitacion_participantes')
    .select('id, nombre, email, token')
    .eq('sesion_id', sesionId)

  if (error) return { success: false, error: error.message }

  const resultados: EnvioLinkResultado[] = []
  const resendKey = process.env.RESEND_API_KEY
  const resend = resendKey ? new Resend(resendKey) : null
  const FROM = 'Sigmetría Capacitaciones <alertas@sigmetria.com.ar>'

  for (const p of participantes ?? []) {
    if (!p.email) {
      resultados.push({ participanteId: p.id, email: null, enviado: false, error: 'Sin email' })
      continue
    }
    if (!resend) {
      resultados.push({ participanteId: p.id, email: p.email, enviado: false, error: 'RESEND_API_KEY no configurado' })
      continue
    }

    const url = `${appUrl()}/capacitacion/${p.token}`
    const nombre = p.nombre ?? 'participante'
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="text-align:center;margin-bottom:24px">
          <p style="text-transform:uppercase;letter-spacing:2px;color:#9ca3af;font-size:12px;font-weight:600;margin:0">Sigmetría HyS</p>
          <h2 style="color:#111827;margin:8px 0 0">Capacitación asignada</h2>
        </div>
        <p style="color:#374151">Hola ${nombre}, tenés una capacitación pendiente:</p>
        <p style="color:#111827;font-size:18px;font-weight:600;margin:8px 0 20px">${cursoTitulo}</p>
        <p style="color:#374151">Ingresá con el siguiente botón. No necesitás usuario ni contraseña.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            Hacer la capacitación →
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px">Si el botón no funciona, copiá este enlace:<br>${url}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
        <p style="color:#9ca3af;font-size:12px;margin:0">Generado automáticamente por Sigmetría. Este enlace es personal e intransferible.</p>
      </div>
    `

    try {
      const { error: sendErr } = await resend.emails.send({
        from: FROM,
        to: p.email,
        subject: `Capacitación asignada: ${cursoTitulo}`,
        html,
      })
      if (sendErr) {
        resultados.push({ participanteId: p.id, email: p.email, enviado: false, error: sendErr.message })
      } else {
        resultados.push({ participanteId: p.id, email: p.email, enviado: true })
      }
    } catch (e) {
      resultados.push({
        participanteId: p.id,
        email: p.email,
        enviado: false,
        error: e instanceof Error ? e.message : 'Error desconocido al enviar',
      })
    }
  }

  return { success: true, data: resultados }
}

// ============================================================
// 5) GET CAPACITACIÓN POR TOKEN (PÚBLICO, service-role) — sin es_correcta
// ============================================================

export async function getCapacitacionPorToken(
  token: string
): Promise<ActionResult<CapacitacionPublica>> {
  if (!token) return { success: false, error: 'Token requerido' }

  const participante = await resolveParticipantePorToken(token)
  if (!participante) return { success: false, error: 'El enlace no es válido o expiró' }

  const admin = createAdminClient()

  // Sesión + curso
  const { data: sesion } = await admin
    .from('capacitacion_sesiones')
    .select(
      'id, titulo, modalidad, estado, fecha, nota_aprobacion, curso_id, cursos!curso_id(id, titulo, descripcion_corta, portada_url, configuracion_quiz)'
    )
    .eq('id', participante.sesion_id)
    .single()

  if (!sesion) return { success: false, error: 'Sesión no encontrada' }

  const curso = (sesion as unknown as {
    cursos: { id: string; titulo: string; descripcion_corta: string | null; portada_url: string | null; configuracion_quiz: Record<string, unknown> | null } | null
  }).cursos

  if (!curso) return { success: false, error: 'Curso no encontrado' }

  // Lecciones (ordenadas por módulo y orden) para el slideshow
  const { data: modulos } = await admin
    .from('curso_modulos')
    .select('id, orden, curso_lecciones(id, modulo_id, orden, titulo, tipo, contenido_url, contenido_texto, duracion_minutos, descargable, anti_skip)')
    .eq('curso_id', curso.id)
    .order('orden', { ascending: true })

  const lecciones: LeccionPublica[] = []
  for (const m of (modulos ?? []) as {
    id: string
    orden: number
    curso_lecciones: LeccionPublica[]
  }[]) {
    const ls = [...(m.curso_lecciones ?? [])].sort((a, b) => a.orden - b.orden)
    for (const l of ls) lecciones.push(l)
  }

  // Quiz final del curso (modulo_id IS NULL). Preguntas + opciones SIN es_correcta.
  const { data: quizRow } = await admin
    .from('curso_quizzes')
    .select('id, porcentaje_aprobacion, curso_preguntas(id, orden, enunciado, tipo, puntaje, curso_opciones(id, orden, texto))')
    .eq('curso_id', curso.id)
    .is('modulo_id', null)
    .maybeSingle()

  let quiz: CapacitacionPublica['quiz'] = null
  if (quizRow) {
    const preguntas: PreguntaPublica[] = (
      (quizRow as { curso_preguntas: {
        id: string
        orden: number
        enunciado: string
        tipo: PreguntaPublica['tipo']
        puntaje: number
        curso_opciones: { id: string; orden: number; texto: string }[]
      }[] }).curso_preguntas ?? []
    )
      .map((p) => ({
        id: p.id,
        orden: p.orden,
        enunciado: p.enunciado,
        tipo: p.tipo,
        puntaje: Number(p.puntaje),
        // IMPORTANTE: nunca incluir es_correcta
        opciones: [...(p.curso_opciones ?? [])]
          .sort((a, b) => a.orden - b.orden)
          .map((o) => ({ id: o.id, orden: o.orden, texto: o.texto })),
      }))
      .sort((a, b) => a.orden - b.orden)

    quiz = {
      id: quizRow.id,
      porcentaje_aprobacion: quizRow.porcentaje_aprobacion ?? DEFAULT_NOTA_APROBACION,
      preguntas,
    }
  }

  // Marcar primer acceso: estado en_progreso + iniciado_at
  if (participante.estado === 'pendiente' || !participante.iniciado_at) {
    await admin
      .from('capacitacion_participantes')
      .update({
        estado: participante.estado === 'pendiente' ? 'en_progreso' : participante.estado,
        iniciado_at: participante.iniciado_at ?? new Date().toISOString(),
      })
      .eq('id', participante.id)
  }

  return {
    success: true,
    data: {
      sesion: {
        id: sesion.id,
        titulo: sesion.titulo,
        modalidad: sesion.modalidad as CapacitacionModalidad,
        estado: sesion.estado as CapacitacionSesionEstado,
        fecha: sesion.fecha,
        nota_aprobacion: sesion.nota_aprobacion,
      },
      curso: {
        id: curso.id,
        titulo: curso.titulo,
        descripcion_corta: curso.descripcion_corta,
        portada_url: curso.portada_url,
      },
      lecciones,
      quiz,
      participante: {
        id: participante.id,
        nombre: participante.nombre,
        estado: (participante.estado === 'pendiente' ? 'en_progreso' : participante.estado) as ParticipanteEstado,
        intentos: participante.intentos ?? 0,
        aprobado: participante.aprobado ?? false,
        puntaje: participante.puntaje ?? null,
      },
    },
  }
}

// ============================================================
// 6) SUBMIT EVALUACIÓN POR TOKEN (PÚBLICO, service-role) — corrige server-side
// ============================================================

export async function submitEvaluacionPorToken(
  token: string,
  respuestas: RespuestaParticipante[]
): Promise<ActionResult<ResultadoEvaluacion>> {
  if (!token) return { success: false, error: 'Token requerido' }

  const participante = await resolveParticipantePorToken(token)
  if (!participante) return { success: false, error: 'El enlace no es válido o expiró' }

  const admin = createAdminClient()

  // Sesión + curso (para nota de aprobación y vencimiento)
  const { data: sesion } = await admin
    .from('capacitacion_sesiones')
    .select('id, nota_aprobacion, curso_id, cursos!curso_id(id, configuracion_quiz)')
    .eq('id', participante.sesion_id)
    .single()

  if (!sesion) return { success: false, error: 'Sesión no encontrada' }

  const cursoCfg = (sesion as unknown as {
    cursos: { id: string; configuracion_quiz: Record<string, unknown> | null } | null
  }).cursos

  // Quiz final con respuestas correctas (server-side ONLY)
  const { data: quizRow } = await admin
    .from('curso_quizzes')
    .select('id, porcentaje_aprobacion, curso_preguntas(id, tipo, puntaje, short_text_respuesta, curso_opciones(id, es_correcta))')
    .eq('curso_id', sesion.curso_id)
    .is('modulo_id', null)
    .maybeSingle()

  if (!quizRow) return { success: false, error: 'Esta capacitación no tiene evaluación' }

  const preguntas = (quizRow as {
    curso_preguntas: {
      id: string
      tipo: PreguntaPublica['tipo']
      puntaje: number
      short_text_respuesta: string | null
      curso_opciones: { id: string; es_correcta: boolean }[]
    }[]
  }).curso_preguntas ?? []

  let puntajeObtenido = 0
  let puntajeTotal = 0

  const respuestasConResultado = preguntas.map((p) => {
    puntajeTotal += Number(p.puntaje)
    const userResp = respuestas.find((r) => r.pregunta_id === p.id)
    let esCorrecta = false

    if (p.tipo === 'short_text') {
      const correcta = (p.short_text_respuesta ?? '').toLowerCase().trim()
      const userText = (userResp?.texto ?? '').toLowerCase().trim()
      esCorrecta = correcta.length > 0 && userText === correcta
    } else if (p.tipo === 'true_false') {
      const correcta = (p.curso_opciones ?? []).find((o) => o.es_correcta)
      const selected = userResp?.opciones_seleccionadas ?? []
      esCorrecta = !!correcta && selected.includes(correcta.id)
    } else {
      const correctas = (p.curso_opciones ?? []).filter((o) => o.es_correcta).map((o) => o.id)
      const selected = userResp?.opciones_seleccionadas ?? []
      if (p.tipo === 'multiple_choice') {
        esCorrecta = selected.length === 1 && correctas.length === 1 && selected[0] === correctas[0]
      } else if (p.tipo === 'multiple_select') {
        const a = new Set(selected)
        const b = new Set(correctas)
        esCorrecta = a.size === b.size && [...a].every((v) => b.has(v))
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

  const porcentaje = puntajeTotal > 0 ? Math.round((puntajeObtenido / puntajeTotal) * 100) : 0

  // Nota de aprobación: prioridad → sesión, luego configuracion_quiz del curso,
  // luego porcentaje_aprobacion del quiz, default 70.
  const cfgNota =
    cursoCfg?.configuracion_quiz && typeof (cursoCfg.configuracion_quiz as Record<string, unknown>).porcentaje_aprobacion === 'number'
      ? ((cursoCfg.configuracion_quiz as Record<string, unknown>).porcentaje_aprobacion as number)
      : undefined
  const notaAprobacion =
    sesion.nota_aprobacion ?? cfgNota ?? quizRow.porcentaje_aprobacion ?? DEFAULT_NOTA_APROBACION

  const aprobado = porcentaje >= notaAprobacion
  const nuevosIntentos = (participante.intentos ?? 0) + 1
  const nowIso = new Date().toISOString()

  // Actualizar participante
  await admin
    .from('capacitacion_participantes')
    .update({
      puntaje: porcentaje,
      aprobado,
      estado: aprobado ? 'aprobado' : 'reprobado',
      intentos: nuevosIntentos,
      respuestas: respuestasConResultado,
      completado_at: nowIso,
    })
    .eq('id', participante.id)

  let certificadoCodigo: string | undefined

  // Si tiene asignación (participante con persona) → actualizar asignación + emitir cert
  if (participante.asignacion_id) {
    if (aprobado) {
      await admin
        .from('curso_asignaciones')
        .update({
          estado: 'aprobado',
          fecha_aprobacion: nowIso,
          progreso_porcentaje: 100,
        })
        .eq('id', participante.asignacion_id)

      // Reutiliza la lógica de emisión de certificados del módulo cursos.
      const certResult = await emitirCertificado(participante.asignacion_id)
      if (certResult.success) {
        // Recuperar el código para devolverlo y linkear certificado_id.
        const { data: cert } = await admin
          .from('cursos_certificados')
          .select('id, codigo_validacion')
          .eq('id', certResult.data.certificadoId)
          .single()
        if (cert) {
          certificadoCodigo = cert.codigo_validacion
          await admin
            .from('capacitacion_participantes')
            .update({ certificado_id: cert.id })
            .eq('id', participante.id)
        }
      }
    } else {
      await admin
        .from('curso_asignaciones')
        .update({ estado: 'en_curso' })
        .eq('id', participante.asignacion_id)
    }
  }

  return {
    success: true,
    data: { aprobado, puntaje: porcentaje, certificadoCodigo },
  }
}

// ============================================================
// 7) REGISTRO GENERAL / ACTA (authed, RLS)
// ============================================================

export async function getRegistroGeneral(
  sesionId: string
): Promise<ActionResult<RegistroGeneral>> {
  const { supabase, user } = await getUserAuth()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!sesionId) return { success: false, error: 'sesionId es obligatorio' }

  const { data: sesion, error: sesErr } = await supabase
    .from('capacitacion_sesiones')
    .select(
      'id, titulo, modalidad, estado, fecha, nota_aprobacion, comentario, instructor_externo, ' +
        'cursos!curso_id(id, titulo), ' +
        'personas_directorio!instructor_persona_id(nombre, apellido)'
    )
    .eq('id', sesionId)
    .single()

  if (sesErr || !sesion) return { success: false, error: 'Sesión no encontrada o sin acceso' }

  const sesionRow = sesion as unknown as {
    id: string
    titulo: string | null
    modalidad: string
    estado: string
    fecha: string | null
    nota_aprobacion: number | null
    comentario: string | null
    instructor_externo: string | null
    cursos: { id: string; titulo: string } | null
    personas_directorio: { nombre: string; apellido: string } | null
  }
  const curso = sesionRow.cursos
  const instructorPersona = sesionRow.personas_directorio

  const { data: parts, error: partErr } = await supabase
    .from('capacitacion_participantes')
    .select(
      'id, persona_id, nombre, email, estado, puntaje, aprobado, intentos, iniciado_at, completado_at, ' +
        'cursos_certificados!certificado_id(codigo_validacion, pdf_url)'
    )
    .eq('sesion_id', sesionId)
    .order('created_at', { ascending: true })

  if (partErr) return { success: false, error: partErr.message }

  const partsRows = (parts ?? []) as unknown as {
    id: string
    persona_id: string | null
    nombre: string | null
    email: string | null
    estado: string
    puntaje: number | null
    aprobado: boolean
    intentos: number
    iniciado_at: string | null
    completado_at: string | null
    cursos_certificados: { codigo_validacion: string; pdf_url: string | null } | null
  }[]

  const participantes: RegistroParticipante[] = partsRows.map((p) => {
    const cert = p.cursos_certificados
    return {
      id: p.id,
      persona_id: p.persona_id,
      nombre: p.nombre,
      email: p.email,
      estado: p.estado as ParticipanteEstado,
      puntaje: p.puntaje,
      aprobado: p.aprobado,
      intentos: p.intentos,
      iniciado_at: p.iniciado_at,
      completado_at: p.completado_at,
      certificado_codigo: cert?.codigo_validacion ?? null,
      certificado_pdf_url: cert?.pdf_url ?? null,
    }
  })

  return {
    success: true,
    data: {
      sesion: {
        id: sesionRow.id,
        titulo: sesionRow.titulo,
        modalidad: sesionRow.modalidad as CapacitacionModalidad,
        estado: sesionRow.estado as CapacitacionSesionEstado,
        fecha: sesionRow.fecha,
        nota_aprobacion: sesionRow.nota_aprobacion,
        comentario: sesionRow.comentario,
      },
      curso: { id: curso?.id ?? '', titulo: curso?.titulo ?? '' },
      instructor: {
        nombre: instructorPersona ? `${instructorPersona.nombre} ${instructorPersona.apellido}` : null,
        externo: sesionRow.instructor_externo,
      },
      participantes,
    },
  }
}

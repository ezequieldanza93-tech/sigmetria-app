'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, UserRole, SystemRole } from '@/lib/types'

/**
 * Auditoría y cadena de custodia — SRT Disp. 15/2026, Estándar 8.
 *
 * El Responsable de Estándares (y los admins) verifican desde acá la
 * integridad de la cadena de custodia del audit_log y consultan el historial
 * inmutable de cualquier registro o flujo completo (trace_id).
 *
 * Todas las lecturas corren con el cliente AUTENTICADO → la RLS de
 * audit_log/audit_trail ya scopea por consultora y rol. Acá sumamos un gate de
 * rol explícito en la app para que la UI no exponga la pantalla a quien no debe.
 */

// Roles con acceso a la auditoría (espejo del gate de la página y el nav).
const AUDIT_ROLES: UserRole[] = [
  'full_access_main',
  'full_access_branch',
  'responsable_estandares',
  'auditor_externo',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface VerificacionCadena {
  estado: 'INTEGRA' | 'ALTERADA'
  primer_fallo_id: string | null
  primer_fallo_seq: number | null
  detalle: string | null
}

export interface AuditTrailRow {
  id: string
  created_at: string
  seq: number
  trace_id: string | null
  origen: string | null
  accion: string
  tabla_nombre: string
  registro_id: string | null
  user_id: string | null
  actor_email: string | null
  consultora_id: string | null
  datos_antes: Record<string, unknown> | null
  datos_nuevo: Record<string, unknown> | null
  hash: string | null
  hash_prev: string | null
}

/** Opción de selector con nombre legible (jamás un UUID a la vista del auditor). */
export interface AuditOpcion {
  id: string
  nombre: string
}

/** Opción de selector con etiqueta compuesta (nombre de gestión + fecha, etc.). */
export interface AuditOpcionLabel {
  id: string
  label: string
}

// ── Gate de acceso ─────────────────────────────────────────────────────────

interface AuditContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  consultoraId: string | null
  authorized: boolean
}

/**
 * Resuelve usuario + consultora + rol y decide si puede usar la auditoría.
 * Mismo criterio que la página y el nav: admins, branch y responsable de
 * estándares; developer/super-admin siempre.
 */
async function getAuditContext(): Promise<AuditContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, consultoraId: null, authorized: false }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role, is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const isSuperAdmin = profile?.is_super_admin === true
  const userRole = (membership?.role as UserRole | undefined) ?? null
  const consultoraId = (membership?.consultora_id as string | undefined) ?? null

  const authorized =
    isSuperAdmin ||
    systemRole === 'developer' ||
    (userRole != null && AUDIT_ROLES.includes(userRole))

  return { supabase, consultoraId, authorized }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

/**
 * Verifica la integridad de la cadena de custodia (hash encadenado) del
 * audit_log de la consultora del usuario. Devuelve INTEGRA o ALTERADA + el
 * primer eslabón roto.
 */
export async function verificarCadena(): Promise<ActionResult<VerificacionCadena>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const { data, error } = await supabase.rpc('fn_verify_audit_chain', {
    p_consultora_id: consultoraId,
  })
  if (error) return { success: false, error: error.message }

  const row = (Array.isArray(data) ? data[0] : data) as VerificacionCadena | undefined
  if (!row) {
    // Sin filas en el log = cadena vacía, por definición íntegra.
    return {
      success: true,
      data: { estado: 'INTEGRA', primer_fallo_id: null, primer_fallo_seq: null, detalle: null },
    }
  }
  return { success: true, data: row }
}

/**
 * Historial inmutable de una entidad puntual (tabla + registro_id).
 * Cronológico, con el detalle antes/después de cada evento.
 */
export async function getHistorialEntidad(
  tabla: string,
  registroId: string,
): Promise<ActionResult<AuditTrailRow[]>> {
  const { supabase, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!tabla?.trim()) return { success: false, error: 'Seleccioná una tabla' }
  if (!UUID_RE.test(registroId)) return { success: false, error: 'El ID del registro no es un UUID válido' }

  const { data, error } = await supabase.rpc('fn_audit_historial', {
    p_tabla: tabla,
    p_registro_id: registroId,
  })
  if (error) return { success: false, error: error.message }

  return { success: true, data: (data ?? []) as AuditTrailRow[] }
}

/**
 * Reconstruye el flujo completo asociado a un trace_id (puede atravesar varias
 * tablas), en orden cronológico.
 */
export async function getFlujoPorTrace(
  traceId: string,
): Promise<ActionResult<AuditTrailRow[]>> {
  const { supabase, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!UUID_RE.test(traceId)) return { success: false, error: 'El trace_id no es un UUID válido' }

  const { data, error } = await supabase.rpc('fn_audit_por_trace', {
    p_trace_id: traceId,
  })
  if (error) return { success: false, error: error.message }

  return { success: true, data: (data ?? []) as AuditTrailRow[] }
}

// ── Selectores por nombre (cascada del auditor) ──────────────────────────────
//
// El auditor del organismo de control NO conoce UUIDs. Estas acciones pueblan
// los selectores de la cascada Empresa → Establecimiento → (Recorrida |
// Observación), devolviendo SIEMPRE nombres/fechas legibles. El id resuelto
// queda interno y se le pasa a getHistorialEntidad sin que el auditor lo vea ni
// lo tipee. Todas gatean con getAuditContext y scopean a la consultora del
// usuario (la RLS lo refuerza igual).

/** DD/MM/AAAA para etiquetas de recorridas/observaciones (date o timestamptz). */
function formatFechaLabel(iso: string | null): string {
  if (!iso) return 'sin fecha'
  // Las fechas tipo `date` (YYYY-MM-DD) las parseamos como locales para no
  // correr un día por timezone; las timestamptz las dejamos a Intl.
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const d = soloFecha ? new Date(`${iso}T00:00:00`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return 'sin fecha'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)
}

/** Empresas activas de la consultora del usuario, por nombre (razón social). */
export async function listAuditEmpresas(): Promise<ActionResult<AuditOpcion[]>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const { data, error } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('consultora_id', consultoraId)
    .eq('is_active', true)
    .order('razon_social', { ascending: true })
  if (error) return { success: false, error: error.message }

  const opciones = (data ?? []).map(e => ({
    id: e.id as string,
    nombre: (e.razon_social as string | null) ?? '(sin nombre)',
  }))
  return { success: true, data: opciones }
}

/** Establecimientos activos de una empresa de la consultora del usuario. */
export async function listAuditEstablecimientos(
  empresaId: string,
): Promise<ActionResult<AuditOpcion[]>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }
  if (!UUID_RE.test(empresaId)) return { success: false, error: 'Empresa inválida' }

  // Validamos que la empresa sea de la consultora del usuario antes de listar
  // sus establecimientos (no exponer datos de otra consultora).
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', empresaId)
    .eq('consultora_id', consultoraId)
    .maybeSingle()
  if (!empresa) return { success: false, error: 'Empresa no encontrada o sin acceso' }

  // OJO: la tabla `establecimientos` NO tiene columna `is_active` (a diferencia de
  // `empresas`). Filtrar por ella rompía la query → "no hay establecimientos".
  // El auditor ve TODOS los establecimientos de la empresa.
  const { data, error } = await supabase
    .from('establecimientos')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .order('nombre', { ascending: true })
  if (error) return { success: false, error: error.message }

  const opciones = (data ?? []).map(e => ({
    id: e.id as string,
    nombre: (e.nombre as string | null) ?? '(sin nombre)',
  }))
  return { success: true, data: opciones }
}

/**
 * Valida que el establecimiento pertenezca a la consultora del usuario.
 * Devuelve true si es accesible; las listas de recorridas/observaciones lo
 * usan como gate previo (la RLS refuerza, pero no exponemos cross-tenant).
 */
async function establecimientoDeConsultora(
  supabase: AuditContext['supabase'],
  establecimientoId: string,
  consultoraId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('establecimientos')
    .select('id, empresas!inner(consultora_id)')
    .eq('id', establecimientoId)
    .eq('empresas.consultora_id', consultoraId)
    .maybeSingle()
  return !!data
}

/**
 * Recorridas (registros de gestión) de un establecimiento. El label es legible:
 * nombre de la gestión + fecha. La gestión se resuelve por el join
 * gestiones_registros → gestiones_establecimientos → gestiones.
 */
export async function listAuditRecorridas(
  establecimientoId: string,
): Promise<ActionResult<AuditOpcionLabel[]>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }
  if (!UUID_RE.test(establecimientoId)) return { success: false, error: 'Establecimiento inválido' }

  if (!(await establecimientoDeConsultora(supabase, establecimientoId, consultoraId))) {
    return { success: false, error: 'Establecimiento no encontrado o sin acceso' }
  }

  const { data, error } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      fecha_ejecutada,
      fecha_planificada,
      gestiones_establecimientos!inner(
        establecimiento_id,
        gestiones!inner(nombre)
      )
    `)
    .eq('gestiones_establecimientos.establecimiento_id', establecimientoId)
    .order('fecha_planificada', { ascending: false })
    .limit(50)
  if (error) return { success: false, error: error.message }

  const filas = (data ?? []) as unknown as Array<{
    id: string
    fecha_ejecutada: string | null
    fecha_planificada: string | null
    gestiones_establecimientos: { gestiones: { nombre: string | null } | null } | null
  }>

  const opciones = filas.map(r => {
    const nombreGestion = r.gestiones_establecimientos?.gestiones?.nombre ?? 'Recorrida'
    // Mostramos la fecha más representativa: la ejecutada si existe, si no la planificada.
    const fecha = formatFechaLabel(r.fecha_ejecutada ?? r.fecha_planificada)
    return { id: r.id, label: `${nombreGestion} — ${fecha}` }
  })
  return { success: true, data: opciones }
}

/**
 * Observaciones de un establecimiento. El label es legible: descripción
 * truncada + fecha. Las observaciones cuelgan de un registro de gestión
 * (registro_gestion_id), que a su vez cuelga del establecimiento.
 */
export async function listAuditObservaciones(
  establecimientoId: string,
): Promise<ActionResult<AuditOpcionLabel[]>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }
  if (!UUID_RE.test(establecimientoId)) return { success: false, error: 'Establecimiento inválido' }

  if (!(await establecimientoDeConsultora(supabase, establecimientoId, consultoraId))) {
    return { success: false, error: 'Establecimiento no encontrado o sin acceso' }
  }

  // Las observaciones no apuntan al establecimiento directo: cuelgan de un
  // registro de gestión. Tras particionar gestiones_registros, su FK desde
  // observaciones es COMPUESTA (registro_gestion_id + rg_fecha_planificada), lo
  // que hace frágil el embedding implícito de PostgREST. Usamos el patrón
  // canónico del repo (lib/queries/aggregate.ts): dos pasos —ids de registros
  // del establecimiento y luego observaciones por registro_gestion_id IN (...).
  const { data: regs, error: regsError } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      gestiones_establecimientos!inner(establecimiento_id)
    `)
    .eq('gestiones_establecimientos.establecimiento_id', establecimientoId)
    .limit(2000)
  if (regsError) return { success: false, error: regsError.message }

  const regIds = (regs ?? []).map(r => (r as { id: string }).id)
  if (regIds.length === 0) return { success: true, data: [] }

  const { data, error } = await supabase
    .from('gestiones_observaciones')
    .select('id, descripcion, fecha_planificada, created_at')
    .in('registro_gestion_id', regIds)
    .order('fecha_planificada', { ascending: false })
    .limit(50)
  if (error) return { success: false, error: error.message }

  const filas = (data ?? []) as unknown as Array<{
    id: string
    descripcion: string | null
    fecha_planificada: string | null
    created_at: string | null
  }>

  const opciones = filas.map(o => {
    const desc = (o.descripcion ?? '').trim() || 'Observación'
    const descCorta = desc.length > 60 ? `${desc.slice(0, 60)}…` : desc
    const fecha = formatFechaLabel(o.fecha_planificada ?? o.created_at)
    return { id: o.id, label: `${descCorta} — ${fecha}` }
  })
  return { success: true, data: opciones }
}

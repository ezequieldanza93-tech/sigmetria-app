'use server'

/**
 * Papelera multinivel (Fase 1) — soft-delete de empresa / establecimiento /
 * sector / puesto. Solo el admin principal (full_access_main) de la consultora
 * dueña, o un super admin, puede mover a papelera, restaurar y cambiar estado.
 *
 * SEGURIDAD: estas acciones usan el ADMIN client (service role, bypassa RLS)
 * porque la papelera necesita ver/escribir filas que la RLS oculta. Por eso el
 * gating es MANUAL y estricto: (1) requireAdminPrincipal valida el rol; (2) se
 * resuelve la consultora dueña del registro y se compara con la del usuario
 * (salvo super admin). NUNCA se opera fuera de la consultora del usuario.
 *
 * El borrado es SOFT (deleted_at): no hay DELETE físico, la auditoría (audit_log)
 * y los datos quedan intactos (Disp. 15/2026). El borrado de un nodo CASCADEA el
 * marcado a sus descendientes estructurales con el MISMO timestamp; restaurar
 * revierte exactamente los que comparten ese timestamp (la misma operación).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveRole, type EffectiveRole } from '@/lib/auth/effective-role'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export type EntidadPapelera = 'empresas' | 'establecimientos' | 'establecimientos_sectores' | 'puestos_de_trabajo'

const ENTIDADES: EntidadPapelera[] = ['empresas', 'establecimientos', 'establecimientos_sectores', 'puestos_de_trabajo']

const LABEL_ENTIDAD: Record<EntidadPapelera, string> = {
  empresas: 'Empresa',
  establecimientos: 'Establecimiento',
  establecimientos_sectores: 'Sector',
  puestos_de_trabajo: 'Puesto',
}

/** Días que un registro permanece en la papelera antes de no ser restaurable. */
const PAPELERA_RETENCION_DIAS = 90

export interface PapeleraItem {
  tabla: EntidadPapelera
  tablaLabel: string
  id: string
  nombre: string
  contexto: string | null
  deletedAt: string
  deletedReason: string | null
  deletedPor: string | null
  diasRestantes: number
}

export interface ConteoDependencias {
  establecimientos: number
  gestiones: number
  registros: number
  sectores: number
  puestos: number
}

type Admin = ReturnType<typeof createAdminClient>

function esEntidadValida(t: string): t is EntidadPapelera {
  return (ENTIDADES as string[]).includes(t)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function esUuid(s: string): boolean {
  return typeof s === 'string' && UUID_RE.test(s)
}

/** Valida que el usuario sea admin principal (o super admin). */
async function requireAdminPrincipal(): Promise<
  { ok: true; eff: EffectiveRole } | { ok: false; error: string }
> {
  const eff = await getEffectiveRole()
  if (!eff) return { ok: false, error: 'No autenticado' }
  if (eff.effectiveUserRole !== 'full_access_main' && !eff.isSuperAdmin) {
    return { ok: false, error: 'Solo el administrador principal puede hacer esto' }
  }
  return { ok: true, eff }
}

/** Resuelve la consultora dueña de un registro según su tabla (con admin client). */
async function resolverConsultoraId(admin: Admin, tabla: EntidadPapelera, id: string): Promise<string | null> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pick = (row: any): string | null => {
    // Desenrolla embeds objeto-o-array hasta encontrar consultora_id.
    let cur = row
    while (cur && typeof cur === 'object' && !('consultora_id' in cur)) {
      const next = cur.establecimientos_sectores ?? cur.establecimientos ?? cur.empresas
      cur = Array.isArray(next) ? next[0] : next
    }
    return cur?.consultora_id ?? null
  }
  if (tabla === 'empresas') {
    const { data } = await admin.from('empresas').select('consultora_id').eq('id', id).maybeSingle()
    return (data as any)?.consultora_id ?? null
  }
  if (tabla === 'establecimientos') {
    const { data } = await admin.from('establecimientos').select('empresas(consultora_id)').eq('id', id).maybeSingle()
    return pick(data)
  }
  if (tabla === 'establecimientos_sectores') {
    const { data } = await admin.from('establecimientos_sectores').select('establecimientos(empresas(consultora_id))').eq('id', id).maybeSingle()
    return pick(data)
  }
  // puestos_de_trabajo
  const { data } = await admin.from('puestos_de_trabajo').select('establecimientos_sectores(establecimientos(empresas(consultora_id)))').eq('id', id).maybeSingle()
  return pick(data)
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Verifica rol + que el registro pertenezca a la consultora del usuario (salvo super admin). */
async function autorizarSobreRegistro(
  admin: Admin,
  tabla: EntidadPapelera,
  id: string,
): Promise<{ ok: true; eff: EffectiveRole } | { ok: false; error: string }> {
  const auth = await requireAdminPrincipal()
  if (!auth.ok) return auth
  if (auth.eff.isSuperAdmin) return { ok: true, eff: auth.eff }
  const consultoraReg = await resolverConsultoraId(admin, tabla, id)
  if (!consultoraReg) return { ok: false, error: 'No se pudo resolver la consultora del registro' }
  if (consultoraReg !== auth.eff.consultoraId) {
    return { ok: false, error: 'El registro no pertenece a tu consultora' }
  }
  return { ok: true, eff: auth.eff }
}

// ─── IDs de la cascada estructural descendente ──────────────────────────────
async function idsDescendientes(admin: Admin, tabla: EntidadPapelera, id: string): Promise<{
  establecimientos: string[]
  sectores: string[]
  puestos: string[]
}> {
  let establecimientos: string[] = []
  let sectores: string[] = []

  if (tabla === 'empresas') {
    const { data } = await admin.from('establecimientos').select('id').eq('empresa_id', id)
    establecimientos = ((data ?? []) as { id: string }[]).map(e => e.id)
  } else if (tabla === 'establecimientos') {
    establecimientos = [id]
  }

  if (tabla === 'establecimientos_sectores') {
    sectores = [id]
  } else if (establecimientos.length > 0) {
    const { data } = await admin.from('establecimientos_sectores').select('id').in('establecimiento_id', establecimientos)
    sectores = ((data ?? []) as { id: string }[]).map(s => s.id)
  }

  let puestos: string[] = []
  if (tabla === 'puestos_de_trabajo') {
    puestos = [id]
  } else if (sectores.length > 0) {
    const { data } = await admin.from('puestos_de_trabajo').select('id').in('sector_id', sectores)
    puestos = ((data ?? []) as { id: string }[]).map(p => p.id)
  }

  // El propio establecimiento/sector se excluye de "descendientes" cuando ES el nodo borrado.
  return {
    establecimientos: tabla === 'empresas' ? establecimientos : [],
    sectores: tabla === 'empresas' || tabla === 'establecimientos' ? sectores : [],
    puestos: tabla === 'empresas' || tabla === 'establecimientos' || tabla === 'establecimientos_sectores' ? puestos : [],
  }
}

/**
 * Devuelve el label del ANCESTRO estructural más cercano que está en papelera,
 * o null si toda la cadena ascendente está vigente. Impide restaurar un
 * descendiente dejándolo colgado de un ancestro oculto (fila huérfana).
 */
async function ancestroEnPapelera(admin: Admin, tabla: EntidadPapelera, id: string): Promise<string | null> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)
  if (tabla === 'empresas') return null
  if (tabla === 'establecimientos') {
    const { data } = await admin.from('establecimientos').select('empresas(deleted_at)').eq('id', id).maybeSingle()
    return one((data as any)?.empresas)?.deleted_at ? 'la empresa' : null
  }
  if (tabla === 'establecimientos_sectores') {
    const { data } = await admin.from('establecimientos_sectores')
      .select('establecimientos(deleted_at, empresas(deleted_at))').eq('id', id).maybeSingle()
    const est = one((data as any)?.establecimientos)
    if (est?.deleted_at) return 'el establecimiento'
    if (one(est?.empresas)?.deleted_at) return 'la empresa'
    return null
  }
  // puestos_de_trabajo
  const { data } = await admin.from('puestos_de_trabajo')
    .select('establecimientos_sectores(deleted_at, establecimientos(deleted_at, empresas(deleted_at)))').eq('id', id).maybeSingle()
  const sec = one((data as any)?.establecimientos_sectores)
  if (sec?.deleted_at) return 'el sector'
  const est = one(sec?.establecimientos)
  if (est?.deleted_at) return 'el establecimiento'
  if (one(est?.empresas)?.deleted_at) return 'la empresa'
  return null
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Mueve un registro (y su jerarquía estructural descendente) a la papelera.
 * Todos quedan con el MISMO deleted_at para poder restaurar la operación exacta.
 */
export async function moverAPapelera(
  tabla: string,
  id: string,
  motivo: string,
): Promise<ActionResult<null>> {
  if (!esEntidadValida(tabla)) return { success: false, error: 'Entidad inválida' }
  if (!esUuid(id)) return { success: false, error: 'Registro inválido' }
  if (!motivo || !motivo.trim()) return { success: false, error: 'Indicá el motivo del borrado' }

  const admin = createAdminClient()
  const auth = await autorizarSobreRegistro(admin, tabla, id)
  if (!auth.ok) return { success: false, error: auth.error }

  // No re-borrar un nodo ya en papelera: fragmentaría el timestamp de la operación
  // (el restore agrupa por ese ts) y daría un falso success.
  const { data: actual, error: eGet } = await admin.from(tabla).select('deleted_at').eq('id', id).maybeSingle()
  if (eGet) return { success: false, error: eGet.message }
  if (!actual) return { success: false, error: 'No se encontró el registro' }
  if ((actual as { deleted_at: string | null }).deleted_at) {
    return { success: false, error: 'El registro ya está en la papelera' }
  }

  const ts = new Date().toISOString()
  const patch = { deleted_at: ts, deleted_by: auth.eff.userId, deleted_reason: motivo.trim() }

  // El nodo elegido.
  const { error: e0 } = await admin.from(tabla).update(patch).eq('id', id).is('deleted_at', null)
  if (e0) return { success: false, error: e0.message }

  // Cascada descendente (solo lo vigente, mismo ts). Propagamos errores: una
  // cascada parcial dejaría la jerarquía inconsistente.
  const desc = await idsDescendientes(admin, tabla, id)
  if (desc.establecimientos.length > 0) {
    const { error } = await admin.from('establecimientos').update(patch).in('id', desc.establecimientos).is('deleted_at', null)
    if (error) return { success: false, error: error.message }
  }
  if (desc.sectores.length > 0) {
    const { error } = await admin.from('establecimientos_sectores').update(patch).in('id', desc.sectores).is('deleted_at', null)
    if (error) return { success: false, error: error.message }
  }
  if (desc.puestos.length > 0) {
    const { error } = await admin.from('puestos_de_trabajo').update(patch).in('id', desc.puestos).is('deleted_at', null)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, data: null }
}

/**
 * Restaura un registro de la papelera junto con los descendientes que se
 * borraron en la MISMA operación (mismo deleted_at).
 */
export async function restaurarDePapelera(tabla: string, id: string): Promise<ActionResult<null>> {
  if (!esEntidadValida(tabla)) return { success: false, error: 'Entidad inválida' }
  if (!esUuid(id)) return { success: false, error: 'Registro inválido' }

  const admin = createAdminClient()
  const auth = await autorizarSobreRegistro(admin, tabla, id)
  if (!auth.ok) return { success: false, error: auth.error }

  // No restaurar dejando un ancestro en papelera: quedaría una fila visible
  // colgando de un padre oculto (jerarquía inconsistente).
  const ancestro = await ancestroEnPapelera(admin, tabla, id)
  if (ancestro) return { success: false, error: `Primero restaurá ${ancestro} que lo contiene` }

  // Timestamp con el que se borró este nodo: identifica la operación a revertir.
  const { data: row, error: eRow } = await admin.from(tabla).select('deleted_at').eq('id', id).maybeSingle()
  if (eRow) return { success: false, error: eRow.message }
  const ts = (row as { deleted_at: string | null } | null)?.deleted_at
  if (!ts) return { success: false, error: 'El registro no está en la papelera' }

  const restore = { deleted_at: null, deleted_by: null, deleted_reason: null }

  const { error: e0 } = await admin.from(tabla).update(restore).eq('id', id)
  if (e0) return { success: false, error: e0.message }

  // Revertimos los descendientes borrados en la misma operación (deleted_at == ts).
  const desc = await idsDescendientes(admin, tabla, id)
  if (desc.establecimientos.length > 0) {
    const { error } = await admin.from('establecimientos').update(restore).in('id', desc.establecimientos).eq('deleted_at', ts)
    if (error) return { success: false, error: error.message }
  }
  if (desc.sectores.length > 0) {
    const { error } = await admin.from('establecimientos_sectores').update(restore).in('id', desc.sectores).eq('deleted_at', ts)
    if (error) return { success: false, error: error.message }
  }
  if (desc.puestos.length > 0) {
    const { error } = await admin.from('puestos_de_trabajo').update(restore).in('id', desc.puestos).eq('deleted_at', ts)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, data: null }
}

/** Cambia activo/inactivo (NO es borrado: el registro sigue visible). */
export async function cambiarEstadoActivo(
  tabla: string,
  id: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  if (!esEntidadValida(tabla)) return { success: false, error: 'Entidad inválida' }
  if (!esUuid(id)) return { success: false, error: 'Registro inválido' }

  const admin = createAdminClient()
  const auth = await autorizarSobreRegistro(admin, tabla, id)
  if (!auth.ok) return { success: false, error: auth.error }

  // establecimientos usa enum `status`; el resto usa is_active boolean.
  const patch = tabla === 'establecimientos'
    ? { status: activo ? 'active' : 'on_hold' }
    : { is_active: activo }

  // Solo sobre registros vigentes: no se togglea algo que está en la papelera.
  const { error } = await admin.from(tabla).update(patch).eq('id', id).is('deleted_at', null)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard', 'layout')
  return { success: true, data: null }
}

/** Cuenta las dependencias de un registro para mostrar en el modal de confirmación. */
export async function contarDependencias(tabla: string, id: string): Promise<ActionResult<ConteoDependencias>> {
  if (!esEntidadValida(tabla)) return { success: false, error: 'Entidad inválida' }
  if (!esUuid(id)) return { success: false, error: 'Registro inválido' }
  const admin = createAdminClient()
  const auth = await autorizarSobreRegistro(admin, tabla, id)
  if (!auth.ok) return { success: false, error: auth.error }

  const desc = await idsDescendientes(admin, tabla, id)
  const estIds = tabla === 'establecimientos' ? [id] : desc.establecimientos
  const sectorIds = tabla === 'establecimientos_sectores' ? [id] : desc.sectores
  const puestoIds = tabla === 'puestos_de_trabajo' ? [id] : desc.puestos

  let gestiones = 0
  let registros = 0
  if (estIds.length > 0) {
    const { data: geData } = await admin.from('gestiones_establecimientos').select('id').in('establecimiento_id', estIds)
    const geIds = ((geData ?? []) as { id: string }[]).map(g => g.id)
    gestiones = geIds.length
    if (geIds.length > 0) {
      const { count } = await admin
        .from('gestiones_registros')
        .select('id', { count: 'exact', head: true })
        .in('gestion_establecimiento_id', geIds)
      registros = count ?? 0
    }
  }

  return {
    success: true,
    data: {
      establecimientos: estIds.length,
      sectores: sectorIds.length,
      puestos: puestoIds.length,
      gestiones,
      registros,
    },
  }
}

/** Lista los registros en papelera de la consultora del usuario (todas las entidades). */
export async function listarPapelera(): Promise<ActionResult<PapeleraItem[]>> {
  const auth = await requireAdminPrincipal()
  if (!auth.ok) return { success: false, error: auth.error }
  const admin = createAdminClient()
  const consultoraId = auth.eff.consultoraId
  const esSuper = auth.eff.isSuperAdmin
  if (!esSuper && !consultoraId) return { success: false, error: 'Sin consultora asociada' }

  const items: PapeleraItem[] = []
  const hoy = Date.now()
  const diasRestantes = (deletedAt: string): number => {
    const fin = new Date(deletedAt).getTime() + PAPELERA_RETENCION_DIAS * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((fin - hoy) / (24 * 60 * 60 * 1000)))
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Empresas
  {
    let q = admin.from('empresas')
      .select('id, razon_social, deleted_at, deleted_reason, consultora_id, profiles:deleted_by(full_name)')
      .not('deleted_at', 'is', null)
    if (!esSuper) q = q.eq('consultora_id', consultoraId!)
    const { data } = await q
    for (const r of (data ?? []) as any[]) {
      items.push({
        tabla: 'empresas', tablaLabel: LABEL_ENTIDAD.empresas, id: r.id,
        nombre: r.razon_social ?? '—', contexto: null,
        deletedAt: r.deleted_at, deletedReason: r.deleted_reason,
        deletedPor: r.profiles?.full_name ?? null, diasRestantes: diasRestantes(r.deleted_at),
      })
    }
  }
  // Establecimientos
  {
    let q = admin.from('establecimientos')
      .select('id, nombre, deleted_at, deleted_reason, empresas!inner(razon_social, consultora_id), profiles:deleted_by(full_name)')
      .not('deleted_at', 'is', null)
    if (!esSuper) q = q.eq('empresas.consultora_id', consultoraId!)
    const { data } = await q
    for (const r of (data ?? []) as any[]) {
      const emp = Array.isArray(r.empresas) ? r.empresas[0] : r.empresas
      items.push({
        tabla: 'establecimientos', tablaLabel: LABEL_ENTIDAD.establecimientos, id: r.id,
        nombre: r.nombre ?? '—', contexto: emp?.razon_social ?? null,
        deletedAt: r.deleted_at, deletedReason: r.deleted_reason,
        deletedPor: r.profiles?.full_name ?? null, diasRestantes: diasRestantes(r.deleted_at),
      })
    }
  }
  // Sectores
  {
    let q = admin.from('establecimientos_sectores')
      .select('id, nombre, deleted_at, deleted_reason, establecimientos!inner(nombre, empresas!inner(razon_social, consultora_id)), profiles:deleted_by(full_name)')
      .not('deleted_at', 'is', null)
    if (!esSuper) q = q.eq('establecimientos.empresas.consultora_id', consultoraId!)
    const { data } = await q
    for (const r of (data ?? []) as any[]) {
      const est = Array.isArray(r.establecimientos) ? r.establecimientos[0] : r.establecimientos
      items.push({
        tabla: 'establecimientos_sectores', tablaLabel: LABEL_ENTIDAD.establecimientos_sectores, id: r.id,
        nombre: r.nombre ?? '—', contexto: est?.nombre ?? null,
        deletedAt: r.deleted_at, deletedReason: r.deleted_reason,
        deletedPor: r.profiles?.full_name ?? null, diasRestantes: diasRestantes(r.deleted_at),
      })
    }
  }
  // Puestos
  {
    let q = admin.from('puestos_de_trabajo')
      .select('id, nombre, deleted_at, deleted_reason, establecimientos_sectores!inner(nombre, establecimientos!inner(empresas!inner(consultora_id))), profiles:deleted_by(full_name)')
      .not('deleted_at', 'is', null)
    if (!esSuper) q = q.eq('establecimientos_sectores.establecimientos.empresas.consultora_id', consultoraId!)
    const { data } = await q
    for (const r of (data ?? []) as any[]) {
      const sec = Array.isArray(r.establecimientos_sectores) ? r.establecimientos_sectores[0] : r.establecimientos_sectores
      items.push({
        tabla: 'puestos_de_trabajo', tablaLabel: LABEL_ENTIDAD.puestos_de_trabajo, id: r.id,
        nombre: r.nombre ?? '—', contexto: sec?.nombre ?? null,
        deletedAt: r.deleted_at, deletedReason: r.deleted_reason,
        deletedPor: r.profiles?.full_name ?? null, diasRestantes: diasRestantes(r.deleted_at),
      })
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  return { success: true, data: items }
}

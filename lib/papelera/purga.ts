import 'server-only'

/**
 * Papelera Fase 2 — aviso de purga inminente (72hs antes de los 90 días).
 *
 * NO borra nada físicamente. La purga a 90d es lógica (listarPapelera/restaurar
 * en lib/actions/papelera.ts excluyen lo que supera 90 días). Acá solo: buscar lo
 * que cumple ~87 días en papelera y aún no fue avisado, agrupar por consultora,
 * mandar email a los admins, y marcar purga_aviso_at para no re-avisar.
 *
 * Idempotente y robusto ante fallos del cron: el filtro purga_aviso_at IS NULL
 * recupera los avisos no enviados mientras sigan dentro de la ventana.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPapeleraPurgaEmail, type PurgaEmailItem } from '@/lib/email/papelera-purga'

const RETENCION_DIAS = 90
const AVISO_ANTES_DIAS = 3

type Admin = ReturnType<typeof createAdminClient>
type Tabla = 'empresas' | 'establecimientos' | 'establecimientos_sectores' | 'puestos_de_trabajo'

const LABEL: Record<Tabla, string> = {
  empresas: 'Empresa',
  establecimientos: 'Establecimiento',
  establecimientos_sectores: 'Sector',
  puestos_de_trabajo: 'Puesto',
}

interface ItemPorPurgar {
  tabla: Tabla
  id: string
  nombre: string
  contexto: string | null
  consultoraId: string
  consultoraNombre: string
  deletedAt: string
}

export interface AvisoPurgaResult {
  consultoras: number
  avisados: number
  emailsEnviados: number
  errores: string[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (x: any) => (Array.isArray(x) ? x[0] : x)

function diasRestantes(deletedAt: string): number {
  const fin = new Date(deletedAt).getTime() + RETENCION_DIAS * 86400000
  return Math.max(0, Math.ceil((fin - Date.now()) / 86400000))
}

async function getAdminEmails(admin: Admin, consultoraId: string): Promise<string[]> {
  const { data: members } = await admin
    .from('consultoras_members')
    .select('user_id, role')
    .eq('consultora_id', consultoraId)
    .eq('is_active', true)
    .in('role', ['full_access_main', 'full_access_branch'])
  if (!members?.length) return []
  const emails: string[] = []
  for (const m of members as { user_id: string }[]) {
    const { data } = await admin.auth.admin.getUserById(m.user_id)
    if (data?.user?.email) emails.push(data.user.email)
  }
  return [...new Set(emails)]
}

export async function emitirAvisosPurgaPapelera(): Promise<AvisoPurgaResult> {
  const admin = createAdminClient()
  const result: AvisoPurgaResult = { consultoras: 0, avisados: 0, emailsEnviados: 0, errores: [] }

  // Aviso a lo que cumplió ≥ (90-3)=87 días y aún no se avisó. SIN cota superior
  // por 90d: si el cron estuvo caído, un rezagado (>90d) igual recibe el aviso —
  // nunca se purga en silencio. El filtro purga_aviso_at IS NULL lo hace idempotente.
  const limite87 = new Date(Date.now() - (RETENCION_DIAS - AVISO_ANTES_DIAS) * 86400000).toISOString()

  const items: ItemPorPurgar[] = []

  const empSel = 'id, razon_social, deleted_at, consultora_id, consultoras(nombre)'
  const { data: emp } = await admin.from('empresas').select(empSel)
    .not('deleted_at', 'is', null).is('purga_aviso_at', null).lte('deleted_at', limite87)
  for (const r of (emp ?? []) as any[]) {
    items.push({ tabla: 'empresas', id: r.id, nombre: r.razon_social ?? '—', contexto: null, consultoraId: r.consultora_id, consultoraNombre: one(r.consultoras)?.nombre ?? '—', deletedAt: r.deleted_at })
  }

  const estSel = 'id, nombre, deleted_at, empresas!inner(razon_social, consultora_id, consultoras(nombre))'
  const { data: est } = await admin.from('establecimientos').select(estSel)
    .not('deleted_at', 'is', null).is('purga_aviso_at', null).lte('deleted_at', limite87)
  for (const r of (est ?? []) as any[]) {
    const e = one(r.empresas)
    items.push({ tabla: 'establecimientos', id: r.id, nombre: r.nombre ?? '—', contexto: e?.razon_social ?? null, consultoraId: e?.consultora_id, consultoraNombre: one(e?.consultoras)?.nombre ?? '—', deletedAt: r.deleted_at })
  }

  const secSel = 'id, nombre, deleted_at, establecimientos!inner(nombre, empresas!inner(consultora_id, consultoras(nombre)))'
  const { data: sec } = await admin.from('establecimientos_sectores').select(secSel)
    .not('deleted_at', 'is', null).is('purga_aviso_at', null).lte('deleted_at', limite87)
  for (const r of (sec ?? []) as any[]) {
    const e = one(r.establecimientos); const em = one(e?.empresas)
    items.push({ tabla: 'establecimientos_sectores', id: r.id, nombre: r.nombre ?? '—', contexto: e?.nombre ?? null, consultoraId: em?.consultora_id, consultoraNombre: one(em?.consultoras)?.nombre ?? '—', deletedAt: r.deleted_at })
  }

  const puSel = 'id, nombre, deleted_at, establecimientos_sectores!inner(nombre, establecimientos!inner(empresas!inner(consultora_id, consultoras(nombre))))'
  const { data: pu } = await admin.from('puestos_de_trabajo').select(puSel)
    .not('deleted_at', 'is', null).is('purga_aviso_at', null).lte('deleted_at', limite87)
  for (const r of (pu ?? []) as any[]) {
    const s = one(r.establecimientos_sectores); const e = one(s?.establecimientos); const em = one(e?.empresas)
    items.push({ tabla: 'puestos_de_trabajo', id: r.id, nombre: r.nombre ?? '—', contexto: s?.nombre ?? null, consultoraId: em?.consultora_id, consultoraNombre: one(em?.consultoras)?.nombre ?? '—', deletedAt: r.deleted_at })
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (items.length === 0) return result

  // Agrupar por consultora.
  const porConsultora = new Map<string, ItemPorPurgar[]>()
  for (const it of items) {
    if (!it.consultoraId) continue
    const arr = porConsultora.get(it.consultoraId) ?? []
    arr.push(it)
    porConsultora.set(it.consultoraId, arr)
  }

  for (const [consultoraId, lista] of porConsultora) {
    result.consultoras++
    const emails = await getAdminEmails(admin, consultoraId)
    if (emails.length === 0) {
      result.errores.push(`consultora ${consultoraId}: ${lista.length} por purgar pero sin admins con email`)
      continue
    }
    const emailItems: PurgaEmailItem[] = lista.map(it => ({
      tablaLabel: LABEL[it.tabla], nombre: it.nombre, contexto: it.contexto, diasRestantes: diasRestantes(it.deletedAt),
    }))
    try {
      await sendPapeleraPurgaEmail({ consultoraNombre: lista[0].consultoraNombre, emails, items: emailItems })
      result.emailsEnviados++
    } catch (e) {
      result.errores.push(`consultora ${consultoraId}: email → ${e instanceof Error ? e.message : 'error'}`)
      continue // sin marcar: se reintenta en la próxima corrida
    }
    // Marcar avisado (por tabla) solo si el email salió.
    const ahora = new Date().toISOString()
    const porTabla = new Map<Tabla, string[]>()
    for (const it of lista) {
      const arr = porTabla.get(it.tabla) ?? []
      arr.push(it.id)
      porTabla.set(it.tabla, arr)
    }
    for (const [tabla, ids] of porTabla) {
      const { error } = await admin.from(tabla).update({ purga_aviso_at: ahora }).in('id', ids)
      if (error) result.errores.push(`marcar ${tabla}: ${error.message}`)
      else result.avisados += ids.length
    }
  }

  return result
}

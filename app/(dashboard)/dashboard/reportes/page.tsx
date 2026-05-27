import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canViewReportes, UserRole } from '@/lib/types'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, AlertCircle, Clock, FileCheck, ExternalLink } from 'lucide-react'

type EstadoCumplimiento = 'verde' | 'amarillo' | 'rojo'

interface EmpresaMetrica {
  id: string
  razon_social: string
  cuit: string | null
  docsVigentes: number
  docsTotal: number
  inspecciones12m: number
  capacitaciones12m: number
  riesgosCriticos: number
  riesgosAltos: number
  siniestrosAbiertos: number
  maxDiasSiniestroAbierto: number
  estado: EstadoCumplimiento
}

interface AuditEntry {
  id: string
  tabla_nombre: string
  accion: string
  created_at: string
  user_id: string | null
  profiles: { full_name: string | null } | null
}

const TABLA_LABELS: Record<string, string> = {
  siniestros: 'Siniestro',
  inspecciones: 'Inspección',
  capacitaciones: 'Capacitación',
  capacitaciones_asistentes: 'Asistencia',
  riesgos: 'Riesgo',
  mediciones: 'Medición',
  empresas: 'Empresa',
  establecimientos: 'Establecimiento',
  establecimientos_documentos: 'Documento',
  empresas_documentos: 'Doc. Empresa',
}

function computeEstado(m: Omit<EmpresaMetrica, 'estado'>): EstadoCumplimiento {
  if (m.riesgosCriticos > 0 || m.maxDiasSiniestroAbierto > 30) return 'rojo'
  if (m.riesgosAltos > 0 || m.siniestrosAbiertos > 0) return 'amarillo'
  return 'verde'
}

const ESTADO_CONFIG = {
  verde: { label: 'Conforme', icon: CheckCircle, className: 'text-success bg-success-bg' },
  amarillo: { label: 'Atención', icon: AlertCircle, className: 'text-warning bg-warning-bg' },
  rojo: { label: 'Crítico', icon: AlertTriangle, className: 'text-danger bg-danger-bg' },
} as const

const ACCION_COLORS: Record<string, string> = {
  INSERT: 'bg-success-bg text-success',
  UPDATE: 'bg-[var(--brand-bg)] text-brand-primary',
  DELETE: 'bg-danger-bg text-danger',
}

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role, is_super_admin').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  const userRole = membership?.role as UserRole ?? null
  const systemRole = profile?.system_role ?? 'user'
  const isSuperAdmin = profile?.is_super_admin ?? false

  if (!canViewReportes(userRole, systemRole) && !isSuperAdmin) redirect('/dashboard')

  const consultoraId = membership?.consultora_id
  if (!consultoraId && !isSuperAdmin) redirect('/dashboard')

  // ── Empresas ─────────────────────────────────────────────────────────────
  const { data: empresasRaw } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit')
    .eq('consultora_id', consultoraId!)
    .order('razon_social')

  const empresas = empresasRaw ?? []
  const empresaIds = empresas.map(e => e.id)

  if (empresaIds.length === 0) {
    return <EmptyState />
  }

  // ── Establecimientos (para mapear a empresa) ──────────────────────────────
  const { data: estsRaw } = await supabase
    .from('establecimientos')
    .select('id, empresa_id')
    .in('empresa_id', empresaIds)

  const ests = estsRaw ?? []
  const estToEmpresa = new Map(ests.map(e => [e.id, e.empresa_id]))
  const estIds = [...estToEmpresa.keys()]

  const ahora = new Date()
  const hace12m = new Date(ahora)
  hace12m.setFullYear(hace12m.getFullYear() - 1)
  const hace12mStr = hace12m.toISOString().split('T')[0]

  // ── Datos en paralelo ────────────────────────────────────────────────────
  const [
    { data: riesgosRaw },
    { data: siniestrosRaw },
    { data: inspeccionesRaw },
    { data: capacitacionesRaw },
    { data: estDocsRaw },
    { data: empDocsRaw },
    { data: auditRaw },
  ] = await Promise.all([
    estIds.length > 0
      ? supabase.from('riesgos').select('establecimiento_id, nivel, resuelto').in('establecimiento_id', estIds).eq('resuelto', false)
      : Promise.resolve({ data: [] }),
    estIds.length > 0
      ? supabase.from('siniestros').select('establecimiento_id, estado, fecha_ocurrencia').in('establecimiento_id', estIds).in('estado', ['pendiente', 'en_investigacion'])
      : Promise.resolve({ data: [] }),
    estIds.length > 0
      ? supabase.from('inspecciones').select('establecimiento_id, estado').in('establecimiento_id', estIds).in('estado', ['realizada', 'con_observaciones']).gte('fecha_realizada', hace12mStr)
      : Promise.resolve({ data: [] }),
    supabase.from('capacitaciones').select('empresa_id, estado').in('empresa_id', empresaIds).eq('estado', 'realizada').gte('fecha_realizada', hace12mStr),
    estIds.length > 0
      ? supabase.from('establecimientos_documentos').select('establecimiento_id, fecha_vencimiento').in('establecimiento_id', estIds)
      : Promise.resolve({ data: [] }),
    supabase.from('empresas_documentos').select('empresa_id, fecha_vencimiento').in('empresa_id', empresaIds),
    supabase.from('audit_log').select('id, tabla_nombre, accion, created_at, user_id, profiles(full_name)').order('created_at', { ascending: false }).limit(100),
  ])

  // ── Agrupar por empresa ──────────────────────────────────────────────────
  const metricas = new Map<string, Omit<EmpresaMetrica, 'estado'>>(
    empresas.map(e => [e.id, {
      id: e.id,
      razon_social: e.razon_social,
      cuit: e.cuit ?? null,
      docsVigentes: 0,
      docsTotal: 0,
      inspecciones12m: 0,
      capacitaciones12m: 0,
      riesgosCriticos: 0,
      riesgosAltos: 0,
      siniestrosAbiertos: 0,
      maxDiasSiniestroAbierto: 0,
    }])
  )

  const hoyMs = ahora.getTime()

  // Documentos de establecimiento
  for (const d of estDocsRaw ?? []) {
    const empId = estToEmpresa.get(d.establecimiento_id)
    if (!empId) continue
    const m = metricas.get(empId)
    if (!m) continue
    m.docsTotal++
    const vence = d.fecha_vencimiento ? new Date(d.fecha_vencimiento).getTime() : Infinity
    if (vence > hoyMs) m.docsVigentes++
  }

  // Documentos de empresa
  for (const d of empDocsRaw ?? []) {
    const m = metricas.get(d.empresa_id)
    if (!m) continue
    m.docsTotal++
    const vence = d.fecha_vencimiento ? new Date(d.fecha_vencimiento).getTime() : Infinity
    if (vence > hoyMs) m.docsVigentes++
  }

  // Inspecciones
  for (const i of inspeccionesRaw ?? []) {
    const empId = estToEmpresa.get(i.establecimiento_id)
    const m = empId ? metricas.get(empId) : null
    if (m) m.inspecciones12m++
  }

  // Capacitaciones
  for (const c of capacitacionesRaw ?? []) {
    const m = metricas.get(c.empresa_id)
    if (m) m.capacitaciones12m++
  }

  // Riesgos
  for (const r of riesgosRaw ?? []) {
    const empId = estToEmpresa.get(r.establecimiento_id)
    const m = empId ? metricas.get(empId) : null
    if (!m) continue
    if (r.nivel === 'critico') m.riesgosCriticos++
    if (r.nivel === 'alto') m.riesgosAltos++
  }

  // Siniestros
  for (const s of siniestrosRaw ?? []) {
    const empId = estToEmpresa.get(s.establecimiento_id)
    const m = empId ? metricas.get(empId) : null
    if (!m) continue
    m.siniestrosAbiertos++
    const dias = s.fecha_ocurrencia
      ? Math.floor((hoyMs - new Date(s.fecha_ocurrencia).getTime()) / 86_400_000)
      : 0
    if (dias > m.maxDiasSiniestroAbierto) m.maxDiasSiniestroAbierto = dias
  }

  const empresasConEstado: EmpresaMetrica[] = [...metricas.values()].map(m => ({
    ...m,
    estado: computeEstado(m),
  }))

  const auditEntries = (auditRaw as unknown as AuditEntry[]) ?? []
  const auditDisponible = auditEntries.length > 0

  const criticas = empresasConEstado.filter(e => e.estado === 'rojo').length
  const atencion = empresasConEstado.filter(e => e.estado === 'amarillo').length
  const conformes = empresasConEstado.filter(e => e.estado === 'verde').length

  return (
    <div className="px-6 py-6 max-w-7xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Módulo de Reportes</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Art. 5 Res. SRT 48/2025 — Supervisión de cumplimiento técnico-normativo</p>
        </div>
        <span className="text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 shrink-0">
          Responsable de Estándares
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Empresas conformes" value={conformes} total={empresas.length} color="success" />
        <KpiCard label="Requieren atención" value={atencion} total={empresas.length} color="warning" />
        <KpiCard label="Estado crítico" value={criticas} total={empresas.length} color="danger" />
      </div>

      {/* ── Reporte 1: Estado de cumplimiento ──────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-3">Estado de cumplimiento por empresa</h2>
        <div className="border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated border-b border-border-subtle text-text-tertiary text-xs">
                <th className="text-left px-4 py-3 font-medium">Empresa</th>
                <th className="text-center px-3 py-3 font-medium">Docs vigentes</th>
                <th className="text-center px-3 py-3 font-medium">Inspecciones 12m</th>
                <th className="text-center px-3 py-3 font-medium">Capacitaciones 12m</th>
                <th className="text-center px-3 py-3 font-medium">Riesgos críticos</th>
                <th className="text-center px-3 py-3 font-medium">Siniestros abiertos</th>
                <th className="text-center px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {empresasConEstado.map(e => {
                const cfg = ESTADO_CONFIG[e.estado]
                const EstadoIcon = cfg.icon
                return (
                  <tr key={e.id} className="bg-surface-base hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{e.razon_social}</p>
                      {e.cuit && <p className="text-xs text-text-tertiary">CUIT {e.cuit}</p>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={e.docsTotal === 0 ? 'text-text-tertiary' : e.docsVigentes < e.docsTotal ? 'text-warning font-medium' : 'text-text-primary'}>
                        {e.docsVigentes}/{e.docsTotal}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-text-secondary">{e.inspecciones12m}</td>
                    <td className="px-3 py-3 text-center text-text-secondary">{e.capacitaciones12m}</td>
                    <td className="px-3 py-3 text-center">
                      {e.riesgosCriticos > 0
                        ? <span className="font-semibold text-danger">{e.riesgosCriticos}</span>
                        : <span className="text-text-tertiary">—</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-center">
                      {e.siniestrosAbiertos > 0
                        ? <span className={e.maxDiasSiniestroAbierto > 30 ? 'font-semibold text-danger' : 'text-warning'}>{e.siniestrosAbiertos}</span>
                        : <span className="text-text-tertiary">—</span>
                      }
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${cfg.className}`}>
                        <EstadoIcon size={12} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/dashboard/reportes/${e.id}/imprimir`}
                        className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                        title="Generar reporte imprimible"
                      >
                        <ExternalLink size={12} />
                        Reporte
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Reporte 2: Actividad reciente (audit log) ───────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary">Historial de actividad</h2>
          <span className="text-xs text-text-tertiary">Últimas 100 acciones</span>
        </div>

        {!auditDisponible ? (
          <div className="border border-border-subtle rounded-xl p-8 text-center">
            <Clock size={32} className="mx-auto mb-3 text-text-tertiary" strokeWidth={1.5} />
            <p className="text-sm text-text-secondary font-medium">El historial de actividad estará disponible próximamente</p>
            <p className="text-xs text-text-tertiary mt-1">Los registros de auditoría se generan automáticamente a partir de ahora</p>
          </div>
        ) : (
          <div className="border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated border-b border-border-subtle text-text-tertiary text-xs">
                  <th className="text-left px-4 py-3 font-medium">Fecha / hora</th>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Registro</th>
                  <th className="text-left px-4 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {auditEntries.map(entry => {
                  const fecha = new Date(entry.created_at)
                  const tablaLabel = TABLA_LABELS[entry.tabla_nombre] ?? entry.tabla_nombre
                  const accionColor = ACCION_COLORS[entry.accion] ?? 'bg-gray-100 text-gray-700'
                  return (
                    <tr key={entry.id} className="bg-surface-base hover:bg-surface-elevated transition-colors">
                      <td className="px-4 py-2.5 text-text-tertiary text-xs tabular-nums">
                        {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {' '}
                        {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {entry.profiles?.full_name ?? <span className="text-text-tertiary italic">Sistema</span>}
                      </td>
                      <td className="px-4 py-2.5 text-text-primary">{tablaLabel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium rounded px-2 py-0.5 ${accionColor}`}>
                          {entry.accion}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Reporte 3: Emisión de reporte de cumplimiento ───────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-3">Emitir reporte de cumplimiento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {empresasConEstado.map(e => {
            const cfg = ESTADO_CONFIG[e.estado]
            const EstadoIcon = cfg.icon
            return (
              <div key={e.id} className="border border-border-subtle rounded-xl p-4 bg-surface-base flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary text-sm truncate">{e.razon_social}</p>
                    {e.cuit && <p className="text-xs text-text-tertiary">CUIT {e.cuit}</p>}
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${cfg.className}`}>
                    <EstadoIcon size={10} />
                    {cfg.label}
                  </span>
                </div>
                <Link
                  href={`/dashboard/reportes/${e.id}/imprimir`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-brand-primary text-white hover:opacity-90 transition-opacity"
                >
                  <FileCheck size={13} />
                  Generar reporte
                </Link>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}

function KpiCard({ label, value, total, color }: { label: string; value: number; total: number; color: 'success' | 'warning' | 'danger' }) {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <div className="border border-border-subtle rounded-xl p-4 bg-surface-base">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-text-tertiary mt-0.5">de {total} empresa{total !== 1 ? 's' : ''}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-6 max-w-7xl">
      <h1 className="text-xl font-semibold text-text-primary mb-2">Módulo de Reportes</h1>
      <div className="border border-border-subtle rounded-xl p-12 text-center mt-6">
        <FileCheck size={40} className="mx-auto mb-4 text-text-tertiary" strokeWidth={1.5} />
        <p className="text-sm text-text-secondary font-medium">No hay empresas registradas en la consultora</p>
        <p className="text-xs text-text-tertiary mt-1">Agregá empresas para generar reportes de cumplimiento</p>
      </div>
    </div>
  )
}

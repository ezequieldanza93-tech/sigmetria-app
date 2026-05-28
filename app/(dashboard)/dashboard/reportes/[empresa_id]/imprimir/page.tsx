import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { canViewReportes, UserRole, type Riesgo, type Inspeccion } from '@/lib/types'
import { PrintButton } from '@/components/reportes/print-button'

interface Props {
  params: Promise<{ empresa_id: string }>
}

export default async function ImprimirReportePage({ params }: Props) {
  const { empresa_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('full_name, system_role, is_super_admin').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id, consultoras(nombre)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  const userRole = membership?.role as UserRole ?? null
  const systemRole = profile?.system_role ?? 'user'
  const isSuperAdmin = profile?.is_super_admin ?? false

  if (!canViewReportes(userRole, systemRole) && !isSuperAdmin) redirect('/dashboard')

  const consultoraId = membership?.consultora_id
  const consultoraNombre = (membership?.consultoras as unknown as { nombre: string } | null)?.nombre ?? 'Consultora'

  // ── Empresa ───────────────────────────────────────────────────────────────
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit, domicilio, localidades(nombre, provincia)')
    .eq('id', empresa_id)
    .eq('consultora_id', consultoraId!)
    .single()

  if (!empresa) notFound()

  // ── Establecimientos ──────────────────────────────────────────────────────
  const { data: estsRaw } = await supabase
    .from('establecimientos')
    .select('id, nombre, domicilio')
    .eq('empresa_id', empresa_id)

  const ests = estsRaw ?? []
  const estIds = ests.map(e => e.id)

  const ahora = new Date()
  const hace12m = new Date(ahora)
  hace12m.setFullYear(hace12m.getFullYear() - 1)
  const hace12mStr = hace12m.toISOString().split('T')[0]

  // ── Datos en paralelo ─────────────────────────────────────────────────────
  const [
    { data: riesgosRaw },
    { data: inspeccionesRaw },
    { data: capacitacionesRaw },
    { data: estDocsRaw },
    { data: empDocsRaw },
  ] = await Promise.all([
    estIds.length > 0
      ? supabase.from('riesgos').select('nivel, descripcion, establecimiento_id, resuelto, fecha_identificacion').in('establecimiento_id', estIds).eq('resuelto', false).order('fecha_identificacion', { ascending: false })
      : Promise.resolve({ data: [] }),
    estIds.length > 0
      ? supabase.from('inspecciones').select('estado, fecha_realizada, establecimiento_id, observaciones').in('establecimiento_id', estIds).in('estado', ['realizada', 'con_observaciones']).order('fecha_realizada', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    supabase.from('capacitaciones').select('titulo, fecha_realizada, estado').eq('empresa_id', empresa_id).eq('estado', 'realizada').gte('fecha_realizada', hace12mStr).order('fecha_realizada', { ascending: false }),
    estIds.length > 0
      ? supabase.from('establecimientos_documentos').select('id, fecha_vencimiento, establecimiento_id, documentos_tipos(nombre)').in('establecimiento_id', estIds).order('fecha_vencimiento', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    supabase.from('empresas_documentos').select('id, fecha_vencimiento, documentos_tipos(nombre)').eq('empresa_id', empresa_id).order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
  ])

  const hoyMs = ahora.getTime()
  const estNombres = new Map(ests.map(e => [e.id, e.nombre]))

  const riesgos = (riesgosRaw ?? []) as unknown as Riesgo[]
  const inspecciones = (inspeccionesRaw ?? []) as unknown as Inspeccion[]
  const capacitaciones = capacitacionesRaw ?? []

  const allDocs = [
    ...(estDocsRaw ?? []).map(d => ({
      ...d,
      tipo: (d.documentos_tipos as unknown as { nombre: string } | null)?.nombre ?? '—',
      scope: estNombres.get(d.establecimiento_id) ?? 'Establecimiento',
    })),
    ...(empDocsRaw ?? []).map(d => ({
      ...d,
      tipo: (d.documentos_tipos as unknown as { nombre: string } | null)?.nombre ?? '—',
      scope: 'Empresa',
      establecimiento_id: '',
    })),
  ]

  const docsVigentes = allDocs.filter(d => !d.fecha_vencimiento || new Date(d.fecha_vencimiento).getTime() > hoyMs).length
  const riesgosCriticos = riesgos.filter(r => r.nivel === 'critico').length
  const riesgosAltos = riesgos.filter(r => r.nivel === 'alto').length

  const localidadInfo = empresa.localidades as unknown as { nombre: string; provincia: string } | null
  const fechaEmision = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaEmision = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const NIVEL_COLORS: Record<string, string> = {
    critico: '#dc2626',
    alto: '#ea580c',
    medio: '#ca8a04',
    bajo: '#16a34a',
  }

  return (
    <>
      {/* Botón de impresión — se oculta en @media print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href="/dashboard/reportes"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border border-border-subtle bg-surface-base text-text-secondary hover:bg-surface-elevated transition-colors shadow-lg"
        >
          ← Volver
        </a>
      </div>

      <style>{`
        @media print {
          @page { margin: 20mm 15mm; size: A4; }
          body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
          .print-page { max-width: 100% !important; padding: 0 !important; }
        }
      `}</style>

      <div className="print-page max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Encabezado */}
        <div className="border-b-2 border-gray-800 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{empresa.razon_social}</h1>
              {empresa.cuit && <p className="text-sm text-text-secondary mt-0.5">CUIT: {empresa.cuit}</p>}
              {localidadInfo && (
                <p className="text-sm text-text-secondary">{localidadInfo.nombre}, {localidadInfo.provincia}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Reporte de Cumplimiento</p>
              <p className="text-xs text-text-tertiary mt-1">Art. 5 Res. SRT 48/2025</p>
              <p className="text-sm font-medium text-text-primary mt-2">{fechaEmision} — {horaEmision}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Emitido por {consultoraNombre}</p>
            </div>
          </div>
        </div>

        {/* Resumen ejecutivo */}
        <section>
          <h2 className="text-base font-bold text-text-primary mb-3 uppercase tracking-wide text-xs">Resumen ejecutivo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Documentos vigentes" value={`${docsVigentes}/${allDocs.length}`} />
            <Kpi label="Inspecciones 12m" value={String(inspecciones.length)} />
            <Kpi label="Capacitaciones 12m" value={String(capacitaciones.length)} />
            <Kpi label="Riesgos activos" value={String(riesgos.length)} highlight={riesgosCriticos > 0 ? 'red' : riesgosAltos > 0 ? 'orange' : undefined} />
          </div>
        </section>

        {/* Documentos */}
        <section>
          <h2 className="text-base font-bold text-text-primary mb-3 uppercase tracking-wide text-xs">Documentos</h2>
          {allDocs.length === 0
            ? <p className="text-sm text-text-tertiary">Sin documentos registrados.</p>
            : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Tipo</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Alcance</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Vencimiento</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {allDocs.map((d, i) => {
                    const vence = d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null
                    const vigente = !vence || vence.getTime() > hoyMs
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-200 px-3 py-1.5">{d.tipo}</td>
                        <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{d.scope}</td>
                        <td className="border border-gray-200 px-3 py-1.5">
                          {vence ? vence.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin vencimiento'}
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5 text-center">
                          <span style={{ color: vigente ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {vigente ? 'Vigente' : 'Vencido'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </section>

        {/* Riesgos activos */}
        <section>
          <h2 className="text-base font-bold text-text-primary mb-3 uppercase tracking-wide text-xs">Riesgos activos</h2>
          {riesgos.length === 0
            ? <p className="text-sm text-text-tertiary">Sin riesgos activos registrados.</p>
            : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Nivel</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Descripción</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Establecimiento</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Identificado</th>
                  </tr>
                </thead>
                <tbody>
                  {riesgos.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 px-3 py-1.5">
                        <span style={{ color: NIVEL_COLORS[r.nivel] ?? '#111', fontWeight: 700, textTransform: 'capitalize' }}>{r.nivel}</span>
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5">{r.descripcion ?? '—'}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{estNombres.get(r.establecimiento_id) ?? '—'}</td>
                      <td className="border border-gray-200 px-3 py-1.5">
                        {r.fecha_identificacion
                          ? new Date(r.fecha_identificacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>

        {/* Últimas 5 inspecciones */}
        <section>
          <h2 className="text-base font-bold text-text-primary mb-3 uppercase tracking-wide text-xs">Últimas inspecciones</h2>
          {inspecciones.length === 0
            ? <p className="text-sm text-text-tertiary">Sin inspecciones registradas en los últimos 12 meses.</p>
            : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Fecha</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Estado</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Establecimiento</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inspecciones.map((i, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 px-3 py-1.5">
                        {i.fecha_realizada ? new Date(i.fecha_realizada).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="border border-gray-200 px-3 py-1.5" style={{ textTransform: 'capitalize' }}>{i.estado.replace('_', ' ')}</td>
                      <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{estNombres.get(i.establecimiento_id) ?? '—'}</td>
                      <td className="border border-gray-200 px-3 py-1.5">{i.observaciones ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>

        {/* Firma digital */}
        <div className="border-t-2 border-gray-800 pt-5 mt-8">
          <p className="text-sm text-text-secondary italic">
            Emitido por{' '}
            <span className="font-semibold text-text-primary">{profile?.full_name ?? user.email}</span>{' '}
            en su carácter de Responsable de Estándares — {fechaEmision}
          </p>
          <p className="text-xs text-text-tertiary mt-1">{consultoraNombre} · Documento generado automáticamente por Sigmetría HyS</p>
          <p className="text-xs text-text-tertiary">Art. 5 Res. SRT 48/2025 · Validez legal sujeta a firma ológrafa del responsable</p>
        </div>

      </div>
    </>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'orange' }) {
  const color = highlight === 'red' ? '#dc2626' : highlight === 'orange' ? '#ea580c' : '#111827'
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

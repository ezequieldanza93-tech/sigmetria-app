import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { LegajoTecnico } from '@/components/establecimiento/legajo-tecnico'
import type { Inspeccion, Documento, Capacitacion, Riesgo, Medicion, Incidente } from '@/lib/types'

interface Props {
  params: Promise<{ token: string }>
}

async function getEstablecimientoByToken(token: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('verificacion_tokens')
    .select('establecimiento_id, token')
    .eq('token', token)
    .single()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const tokenData = await getEstablecimientoByToken(token)
  if (!tokenData) {
    return { title: 'QR inválido · Sigmetría HyS', robots: { index: false, follow: false } }
  }
  const supabase = createServiceClient()
  const { data: est } = await supabase
    .from('establecimientos')
    .select('nombre')
    .eq('id', tokenData.establecimiento_id)
    .single()
  const nombre = est?.nombre ?? 'Establecimiento'
  return {
    title: `Legajo Técnico — ${nombre}`,
    robots: { index: false, follow: false },
    openGraph: { title: `Legajo Técnico — ${nombre} · Sigmetría HyS` },
  }
}

function InvalidQR() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-semibold text-text-primary">QR inválido o vencido</h1>
        <p className="text-sm text-text-tertiary">
          Este código QR no corresponde a ningún establecimiento activo o fue regenerado.
        </p>
        <a href="https://sigmetria.com.ar" className="inline-block text-sm text-brand-primary hover:underline">
          sigmetria.com.ar
        </a>
      </div>
    </div>
  )
}

export default async function VerificarPage({ params }: Props) {
  const { token } = await params
  const supabase = createServiceClient()

  const tokenData = await getEstablecimientoByToken(token)
  if (!tokenData) return <InvalidQR />

  const estId = tokenData.establecimiento_id

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('id, nombre, domicilio, actividad_principal, cantidad_trabajadores, empresa_id, localidades!localidad_id(nombre, provincia)')
    .eq('id', estId)
    .single()

  if (!establecimiento) return <InvalidQR />

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('id', establecimiento.empresa_id)
    .single()

  if (!empresa) return <InvalidQR />

  const ahora = new Date()
  const doceeMesesAtras = new Date(ahora)
  doceeMesesAtras.setFullYear(doceeMesesAtras.getFullYear() - 1)
  const doceeMesesAtrasStr = doceeMesesAtras.toISOString().split('T')[0]

  const [
    { data: inspeccionesRaw },
    { data: documentosRaw },
    { data: capacitacionesRaw },
    { data: riesgosRaw },
    { data: medicionesRaw },
    { data: incidentesRaw },
  ] = await Promise.all([
    supabase
      .from('inspecciones')
      .select('*')
      .eq('establecimiento_id', estId)
      .in('estado', ['realizada', 'con_observaciones'])
      .order('fecha_realizada', { ascending: false }),
    supabase
      .from('establecimientos_documentos')
      .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)')
      .eq('establecimiento_id', estId)
      .eq('legajo_tecnico', true)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
    supabase
      .from('capacitaciones')
      .select('id, titulo, fecha_realizada, capacitaciones_asistentes(id)')
      .eq('empresa_id', empresa.id)
      .or(`establecimiento_id.eq.${estId},establecimiento_id.is.null`)
      .eq('estado', 'realizada')
      .gte('fecha_realizada', doceeMesesAtrasStr)
      .order('fecha_realizada', { ascending: false }),
    supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .eq('resuelto', false),
    supabase
      .from('mediciones')
      .select('*, unidades(nombre, simbolo)')
      .eq('establecimiento_id', estId)
      .order('fecha', { ascending: false }),
    supabase
      .from('incidentes')
      .select('*')
      .eq('establecimiento_id', estId)
      .in('estado', ['pendiente', 'en_investigacion'])
      .order('fecha_ocurrencia', { ascending: false }),
  ])

  // Agrupar mediciones: últimas 3 por tipo
  const medicionesPorTipo: Record<string, Medicion[]> = {}
  for (const m of (medicionesRaw ?? []) as Medicion[]) {
    if (!medicionesPorTipo[m.tipo]) medicionesPorTipo[m.tipo] = []
    if (medicionesPorTipo[m.tipo].length < 3) medicionesPorTipo[m.tipo].push(m)
  }

  // Contar asistentes desde la relación embebida
  const capacitaciones = ((capacitacionesRaw ?? []) as (Capacitacion & { capacitaciones_asistentes?: { id: string }[] })[])
    .map(c => ({ ...c, _asistentes: c.capacitaciones_asistentes?.length ?? 0 }))

  const inspecciones = (inspeccionesRaw ?? []) as Inspeccion[]
  const ultimaInspeccion = inspecciones[0] ?? null
  const totalInspecciones12m = inspecciones.filter(i =>
    i.fecha_realizada && i.fecha_realizada >= doceeMesesAtrasStr
  ).length

  // Registrar acceso (fire and forget — no bloquea el render)
  supabase.rpc('registrar_acceso_legajo', { p_token: token }).then(() => {})

  return (
    <main id="main-content" className="min-h-screen bg-surface-base">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-brand-primary uppercase tracking-wide">Legajo Técnico Público</p>
            <p className="text-xs text-text-tertiary mt-0.5">Resolución SRT 48/2025 · Art. 4.5</p>
          </div>
          <span className="text-xs text-text-tertiary">Sigmetría HyS</span>
        </div>

        <LegajoTecnico
          establecimiento={establecimiento as any}
          empresa={empresa}
          ultimaInspeccion={ultimaInspeccion}
          totalInspecciones12m={totalInspecciones12m}
          documentos={(documentosRaw ?? []) as Documento[]}
          capacitaciones={capacitaciones}
          riesgos={(riesgosRaw ?? []) as Riesgo[]}
          medicionesPorTipo={medicionesPorTipo}
          incidentes={(incidentesRaw ?? []) as Incidente[]}
          ahora={ahora}
        />
      </div>
    </main>
  )
}

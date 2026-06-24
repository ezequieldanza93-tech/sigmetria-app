import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { logAuditEvent } from '@/lib/audit/log-event'
import { LegajoTecnico, type LegajoEstablecimiento } from '@/components/establecimiento/legajo-tecnico'
import { isAbsoluteUrl } from '@/lib/storage/resolve-url'
import type { Inspeccion, Documento, Capacitacion, Riesgo, Medicion, Incidente } from '@/lib/types'

interface Props {
  params: Promise<{ token: string }>
}

/** TTL corto para las URLs firmadas que abre el inspector (PDFs del legajo). */
const PUBLIC_DOC_TTL_SECONDS = 60 * 30

/**
 * Resuelve el establecimiento+token SOLO si el QR es VÁLIDO (no revocado, no
 * caducado). Centralizado en la función `token_legajo_valido` (SECURITY DEFINER).
 */
async function getEstablecimientoByToken(token: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .rpc('token_legajo_valido', { p_token: token })
    .maybeSingle()
  return data as { establecimiento_id: string; token_id: string } | null
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
          Este código QR no corresponde a ningún establecimiento activo, fue regenerado,
          revocado o caducó.
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
    .select('id, razon_social, consultora_id')
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
    // 2C.1/2C.2: solo documentos del legajo técnico marcados VISIBLES para la
    // vista pública. El filtro de VENCIDOS lo hace LegajoTecnico (soloVigentes).
    supabase
      .from('establecimientos_documentos')
      .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)')
      .eq('establecimiento_id', estId)
      .eq('legajo_tecnico', true)
      .eq('legajo_publico_visible', true)
      .is('deleted_at', null)
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

  const documentos = (documentosRaw ?? []) as Documento[]

  // 2C.1: firmar URLs (service role) SOLO de los documentos VIGENTES y visibles,
  // para que el inspector pueda abrir/descargar el PDF. Bucket `documentos` es
  // privado → signed URLs de TTL corto. Los vencidos ni se firman (no se muestran).
  const isVigente = (fecha: string | null) => !fecha || new Date(fecha) >= ahora
  const docsParaFirmar = documentos.filter(d => isVigente(d.fecha_vencimiento) && d.archivo_url)
  const urlByDocId = new Map<string, string>()
  const pathsToSign = docsParaFirmar
    .map(d => d.archivo_url)
    .filter((p): p is string => typeof p === 'string' && p.length > 0 && !isAbsoluteUrl(p))
  if (pathsToSign.length > 0) {
    const { data: signed } = await supabase.storage
      .from('documentos')
      .createSignedUrls(pathsToSign, PUBLIC_DOC_TTL_SECONDS)
    const signedByPath = new Map<string, string>()
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
    }
    for (const d of docsParaFirmar) {
      if (!d.archivo_url) continue
      if (isAbsoluteUrl(d.archivo_url)) urlByDocId.set(d.id, d.archivo_url) // legacy
      else {
        const u = signedByPath.get(d.archivo_url)
        if (u) urlByDocId.set(d.id, u)
      }
    }
  } else {
    // Solo legacy (URLs absolutas) — no hay nada que firmar.
    for (const d of docsParaFirmar) {
      if (d.archivo_url && isAbsoluteUrl(d.archivo_url)) urlByDocId.set(d.id, d.archivo_url)
    }
  }

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

  // El join localidades!localidad_id puede venir como objeto o array según el
  // inferidor de tipos de Supabase: lo normalizamos a la forma del componente.
  const estRaw = establecimiento as typeof establecimiento & {
    localidades?: { nombre: string; provincia: string } | { nombre: string; provincia: string }[] | null
  }
  const loc = Array.isArray(estRaw.localidades) ? estRaw.localidades[0] ?? null : estRaw.localidades ?? null
  const establecimientoLT: LegajoEstablecimiento = {
    nombre: establecimiento.nombre,
    domicilio: establecimiento.domicilio,
    actividad_principal: establecimiento.actividad_principal,
    cantidad_trabajadores: establecimiento.cantidad_trabajadores,
    localidades: loc,
  }

  // 2C.4: registrar el escaneo en el log de accesos (cadena de custodia).
  // timestamp + IP + UA. El inspector NO se loguea: registro anónimo vía
  // SECURITY DEFINER. Fire-and-forget — no bloquea ni rompe el render.
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const userAgent = h.get('user-agent') ?? null
  supabase
    .rpc('registrar_acceso_legajo', { p_token: token, p_ip: ip, p_user_agent: userAgent })
    .then(() => {})

  // Auditoría del acceso por QR (Art. 4.5 — cadena de custodia del legajo público).
  // Best-effort (D3): nunca rompe la página pública si el log falla. NO registra
  // datos sensibles ni personales — solo el token_id y el contexto del legajo.
  // Origen 'sistema': es un acceso anónimo (no hay usuario autenticado en esta ruta).
  await logAuditEvent(supabase, {
    accion: 'QR_ACCESS',
    tabla: 'verificacion_tokens',
    registroId: estId,
    consultoraId: (empresa as { consultora_id?: string | null }).consultora_id ?? null,
    meta: {
      token_id: tokenData.token_id,
      empresa_id: empresa.id,
      establecimiento_id: estId,
    },
    origen: 'sistema',
  })

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
          establecimiento={establecimientoLT}
          empresa={empresa}
          ultimaInspeccion={ultimaInspeccion}
          totalInspecciones12m={totalInspecciones12m}
          documentos={documentos}
          capacitaciones={capacitaciones}
          riesgos={(riesgosRaw ?? []) as Riesgo[]}
          medicionesPorTipo={medicionesPorTipo}
          incidentes={(incidentesRaw ?? []) as Incidente[]}
          ahora={ahora}
          soloVigentes
          getDocUrl={doc => urlByDocId.get(doc.id) ?? null}
        />
      </div>
    </main>
  )
}

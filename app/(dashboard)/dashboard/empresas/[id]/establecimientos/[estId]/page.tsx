import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { canWrite, UserRole } from '@/lib/types'
import { GestionesAgenda } from '@/components/establecimiento-gestiones-agenda'
import { EstablecimientoTabs } from '@/components/establecimiento-tabs'
import { EstablecimientoLocation } from '@/components/establecimiento-location'
import { ActuarView } from '@/components/actuar-view'
import { getDocTiposAplicables } from '@/lib/actions/aplicabilidad'
import type {
  SectorEstablecimiento, Siniestro, Inspeccion, Riesgo, Documento, DocumentType,
  Denuncia, FeedbackCliente, EmpresaDocumento, EmpleadoDocumentoLegajo, LegajoGestion,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { ClipboardList, FileText, BarChart3, Crosshair } from 'lucide-react'

type Section = 'agenda' | 'ficha' | 'dashboard' | 'seguimiento'
const VALID_SECTIONS: Section[] = ['agenda', 'ficha', 'dashboard', 'seguimiento']

const SECTION_TABS = [
  { id: 'ficha' as Section, icon: FileText, label: 'Ficha' },
  { id: 'agenda' as Section, icon: ClipboardList, label: 'Agenda' },
  { id: 'seguimiento' as Section, icon: Crosshair, label: 'Seguimiento' },
  { id: 'dashboard' as Section, icon: BarChart3, label: 'Dashboard' },
]

interface Props {
  params: Promise<{ id: string; estId: string }>
  searchParams: Promise<{ section?: string }>
}

export default async function EstablecimientoDetailPage({ params, searchParams }: Props) {
  const { id: empresaId, estId } = await params
  const { section: rawSection } = await searchParams
  const section: Section = (VALID_SECTIONS as string[]).includes(rawSection ?? '')
    ? (rawSection as Section)
    : 'agenda'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: membership },
    { data: establecimiento },
    { data: empresa },
  ] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('establecimientos').select('id, nombre, latitude, longitude, photo_site, direccion, created_at, establecimientos_tipos(id, codigo, nombre), localidades!localidad_id(nombre, provincia)').eq('id', estId).single(),
    supabase.from('empresas').select('id, razon_social').eq('id', empresaId).single(),
  ])

  if (!establecimiento || !empresa) notFound()

  const userCanWrite = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  // Section-specific data fetching
  let sectores: SectorEstablecimiento[] = []
  let siniestros: Siniestro[] = []
  let inspecciones: Inspeccion[] = []
  let riesgos: Riesgo[] = []
  let documentos: Documento[] = []
  let documentTypes: DocumentType[] = []
  let denuncias: Denuncia[] = []
  let feedbackClientes: FeedbackCliente[] = []
  let empresaDocumentos: EmpresaDocumento[] = []
  let gestionesLegajo: LegajoGestion[] = []
  let trabajadorDocumentos: EmpleadoDocumentoLegajo[] = []

  if (section === 'ficha') {
    const [s1, s2, s3, s4, s5] = await Promise.all([
      supabase
        .from('establecimientos_sectores')
        .select('*')
        .eq('establecimiento_id', estId)
        .eq('is_active', true)
        .order('es_custom')
        .order('nombre'),
      supabase
        .from('siniestros')
        .select('*')
        .eq('establecimiento_id', estId)
        .order('fecha_ocurrencia', { ascending: false }),
      supabase
        .from('inspecciones')
        .select('*')
        .eq('establecimiento_id', estId)
        .order('fecha_programada', { ascending: false }),
      supabase
        .from('establecimientos_documentos')
        .select('*, documentos_tipos(nombre)')
        .eq('establecimiento_id', estId)
        .order('created_at', { ascending: false }),
      getDocTiposAplicables(estId),
    ])
    sectores = (s1.data ?? []) as unknown as SectorEstablecimiento[]
    siniestros = (s2.data ?? []) as unknown as Siniestro[]
    inspecciones = (s3.data ?? []) as unknown as Inspeccion[]
    documentos = (s4.data ?? []) as unknown as Documento[]
    documentTypes = s5

    const today = new Date().toISOString().split('T')[0]
    const [d1, d2, d3, d4] = await Promise.all([
      supabase.from('establecimientos_denuncias').select('*').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('establecimientos_feedback_clientes').select('*').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('empresas_documentos').select('*, documentos_tipos(nombre)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase
        .from('gestiones_registros')
        .select('id, fecha_planificada, notas, gestiones_establecimientos!inner(mostrar_lt, establecimiento_id, gestiones!inner(nombre, gestiones_categorias(nombre)))')
        .eq('gestiones_establecimientos.establecimiento_id', estId)
        .eq('gestiones_establecimientos.mostrar_lt', true)
        .is('fecha_ejecutada', null)
        .gte('fecha_planificada', today)
        .order('fecha_planificada'),
    ])
    denuncias = (d1.data ?? []) as unknown as Denuncia[]
    feedbackClientes = (d2.data ?? []) as unknown as FeedbackCliente[]
    empresaDocumentos = (d3.data ?? []) as unknown as EmpresaDocumento[]
    gestionesLegajo = (d4.data ?? []) as unknown as LegajoGestion[]

    const { data: peData } = await supabase
      .from('personas_establecimientos')
      .select('persona_id')
      .eq('establecimiento_id', estId)
    const personaIds = ((peData ?? []) as { persona_id: string }[]).map(p => p.persona_id)
    if (personaIds.length > 0) {
      const { data: empDocs } = await supabase
        .from('personas_documentos')
        .select('*, documentos_tipos(nombre), personas_directorio(nombre, apellido, legajo)')
        .in('persona_id', personaIds)
        .order('created_at', { ascending: false })
      trabajadorDocumentos = (empDocs ?? []) as unknown as EmpleadoDocumentoLegajo[]
    }
  }

  if (section === 'agenda') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  if (section === 'seguimiento') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  const _tipos = establecimiento.establecimientos_tipos as unknown as { nombre: string } | null | undefined
  const tipoLabel = _tipos?.nombre ?? null

  return (
    <div className="p-0">
      {/* Sub-nav */}
      <div>
        <nav className="flex gap-1 border-b border-border-subtle px-6">
          {SECTION_TABS.map(({ id: tabId, icon: Icon, label }) => (
            <Link
              key={tabId}
              href={`/dashboard/empresas/${empresaId}/establecimientos/${estId}${tabId === 'agenda' ? '' : `?section=${tabId}`}`}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                section === tabId
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border-default',
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      {section === 'agenda' && (
        <GestionesAgenda
          establecimientoId={estId}
          empresaId={empresaId}
          canWrite={userCanWrite}
          riesgos={riesgos}
        />
      )}

      {section === 'ficha' && (
        <>
          {establecimiento.latitude != null && establecimiento.longitude != null && (
            <EstablecimientoLocation
              lat={establecimiento.latitude}
              lng={establecimiento.longitude}
              nombre={establecimiento.nombre}
              fotoUrl={establecimiento.photo_site}
            />
          )}
          <EstablecimientoTabs
            establecimientoId={estId}
            empresaId={empresaId}
            canWrite={userCanWrite}
            canDelete={false}
            sectores={sectores}
            siniestros={siniestros}
            inspecciones={inspecciones}
            documentos={documentos}
            documentTypes={documentTypes}
            denuncias={denuncias}
            feedbackClientes={feedbackClientes}
            empresaDocumentos={empresaDocumentos}
            gestionesLegajo={gestionesLegajo}
            trabajadorDocumentos={trabajadorDocumentos}
          />
        </>
      )}

      {section === 'dashboard' && (
        <div className="bg-surface-elevated rounded-xl border border-border-subtle p-12 text-center">
          <BarChart3 size={32} strokeWidth={1.5} className="text-text-tertiary mx-auto mb-3" />
          <p className="font-semibold text-text-primary">Dashboard del Establecimiento</p>
          <p className="text-sm text-text-tertiary mt-1">Próximamente — cards de estado, charts y métricas operativas.</p>
        </div>
      )}

      {section === 'seguimiento' && (
        <ActuarView establecimientoId={estId} />
      )}
    </div>
  )
}

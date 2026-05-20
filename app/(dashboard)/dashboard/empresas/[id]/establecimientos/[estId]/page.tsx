import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Info, ClipboardList, Hammer, ShieldCheck, Zap, Pencil } from 'lucide-react'
import { canWrite, canDelete, UserRole } from '@/lib/types'
import { EstablecimientoTabs } from '@/components/establecimiento-tabs'
import { EstablecimientoLocation } from '@/components/establecimiento-location'
import { GestionesAgenda } from '@/components/establecimiento-gestiones-agenda'
import { PlanificarView } from '@/components/planificar-view'
import { ActuarView } from '@/components/actuar-view'
import { getDocTiposAplicables } from '@/lib/actions/aplicabilidad'
import type {
  SectorEstablecimiento,
  Siniestro,
  Inspeccion,
  Riesgo,
  Documento,
  DocumentType,
  Denuncia,
  FeedbackCliente,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
} from '@/lib/types'

type Section = 'informacion' | 'planificar' | 'hacer' | 'verificar' | 'actuar'
const VALID_SECTIONS: Section[] = ['informacion', 'planificar', 'hacer', 'verificar', 'actuar']

const SIDEBAR_ITEMS = [
  { id: 'informacion' as Section, icon: Info,          label: 'Información' },
  { id: 'planificar'  as Section, icon: ClipboardList, label: 'Planificar' },
  { id: 'hacer'       as Section, icon: Hammer,        label: 'Hacer' },
  { id: 'verificar'   as Section, icon: ShieldCheck,   label: 'Verificar' },
  { id: 'actuar'      as Section, icon: Zap,           label: 'Actuar' },
]

interface Props {
  params: Promise<{ id: string; estId: string }>
  searchParams: Promise<{ section?: string }>
}

export default async function EstablecimientoDetailPage({ params, searchParams }: Props) {
  const { id, estId } = await params
  const { section: rawSection } = await searchParams
  const section: Section = (VALID_SECTIONS as string[]).includes(rawSection ?? '')
    ? (rawSection as Section)
    : 'hacer'

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
    supabase.from('establecimientos').select('*, establecimientos_tipos(id, codigo, nombre)').eq('id', estId).single(),
    supabase.from('empresas').select('id, razon_social').eq('id', id).single(),
  ])

  if (!establecimiento || !empresa) notFound()

  const userCanWrite = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  const userCanDelete = canDelete(
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

  if (section === 'informacion') {
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
      supabase.from('empresas_documentos').select('*, documentos_tipos(nombre)').eq('empresa_id', id).order('created_at', { ascending: false }),
      supabase
        .from('gestiones_registros')
        .select('id, fecha_planificada, notas, gestiones_establecimientos!inner(establecimiento_id, gestiones!inner(nombre, gestiones_categorias(nombre)))')
        .eq('gestiones_establecimientos.establecimiento_id', estId)
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

  if (section === 'planificar' || section === 'hacer') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  const tipoLabel = establecimiento.establecimientos_tipos?.nombre ?? null

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* PHVA sidebar */}
      <aside className="w-52 shrink-0 border-r border-border-subtle bg-surface-sidebar flex flex-col pt-6 px-3 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
        {/* Establecimiento header */}
        <div className="px-2 mb-5">
          <Link
            href={`/dashboard/empresas/${id}`}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors font-medium truncate block mb-0.5"
          >
            {empresa.razon_social}
          </Link>
          <p className="text-sm font-bold text-text-primary truncate">{establecimiento.nombre}</p>
          {tipoLabel && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">{tipoLabel}</p>
          )}
        </div>

        <div className="h-px bg-border-subtle mx-2 mb-3" />

        {/* PHVA nav */}
        <nav className="flex flex-col gap-0.5">
          {SIDEBAR_ITEMS.map(({ id: itemId, icon: Icon, label }) => {
            const isActive = section === itemId
            const isDisabled = itemId === 'verificar'

            if (isDisabled) {
              return (
                <span
                  key={itemId}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-text-tertiary opacity-40 cursor-not-allowed select-none"
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  {label}
                </span>
              )
            }

            return (
              <Link
                key={itemId}
                href={`/dashboard/empresas/${id}/establecimientos/${estId}?section=${itemId}`}
                className={[
                  'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-muted text-brand-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-primary rounded-r-full" />
                )}
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={isActive ? 'text-brand-primary shrink-0' : 'text-text-tertiary shrink-0'}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Editar link */}
        {userCanWrite && section === 'informacion' && (
          <div className="mt-auto px-2 pb-5 pt-4">
            <Link
              href={`/dashboard/empresas/${id}/establecimientos/${estId}/editar`}
              className="flex items-center justify-center gap-1.5 w-full border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Editar
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-8">
        {section === 'informacion' && (
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
              empresaId={id}
              canWrite={userCanWrite}
              canDelete={userCanDelete}
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

        {section === 'planificar' && (
          <PlanificarView establecimientoId={estId} empresaId={id} />
        )}

        {section === 'hacer' && (
          <GestionesAgenda
            establecimientoId={estId}
            empresaId={id}
            canWrite={userCanWrite}
            riesgos={riesgos}
          />
        )}

        {section === 'verificar' && (
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-12 text-center">
            <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={22} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <p className="font-semibold text-text-primary">Verificar</p>
            <p className="text-sm text-text-tertiary mt-1">Próximamente disponible.</p>
          </div>
        )}

        {section === 'actuar' && (
          <ActuarView establecimientoId={estId} />
        )}
      </div>
    </div>
  )
}

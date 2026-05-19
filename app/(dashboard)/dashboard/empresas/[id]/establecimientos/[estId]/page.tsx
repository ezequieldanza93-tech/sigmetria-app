import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, canDelete, UserRole } from '@/lib/types'
import { EstablecimientoTabs } from '@/components/establecimiento-tabs'
import { EstablecimientoLocation } from '@/components/establecimiento-location'
import { GestionesAgenda } from '@/components/establecimiento-gestiones-agenda'
import { PlanificarView } from '@/components/planificar-view'
import { ActuarView } from '@/components/actuar-view'
import type {
  SectorEstablecimiento,
  Siniestro,
  Inspeccion,
  Riesgo,
  Documento,
  DocumentType,
  Denuncia,
  FeedbackCliente,
} from '@/lib/types'

type Section = 'informacion' | 'planificar' | 'hacer' | 'verificar' | 'actuar'
const VALID_SECTIONS: Section[] = ['informacion', 'planificar', 'hacer', 'verificar', 'actuar']

const SIDEBAR_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'informacion', icon: 'I', label: 'Información' },
  { id: 'planificar', icon: 'P', label: 'Planificar' },
  { id: 'hacer', icon: 'H', label: 'Hacer' },
  { id: 'verificar', icon: 'V', label: 'Verificar' },
  { id: 'actuar', icon: 'A', label: 'Actuar' },
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
    supabase.from('consultora_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('establecimientos').select('*, tipos_establecimiento(id, codigo, nombre)').eq('id', estId).single(),
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

  if (section === 'informacion') {
    const [s1, s2, s3, s4, s5] = await Promise.all([
      supabase
        .from('sectores_establecimiento')
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
        .from('establecimiento_documentos')
        .select('*, documento_tipos(nombre)')
        .eq('establecimiento_id', estId)
        .order('created_at', { ascending: false }),
      supabase
        .from('documento_tipos')
        .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
        .eq('is_active', true)
        .eq('aplica_establecimiento', true)
        .order('nombre'),
    ])
    sectores = (s1.data ?? []) as unknown as SectorEstablecimiento[]
    siniestros = (s2.data ?? []) as unknown as Siniestro[]
    inspecciones = (s3.data ?? []) as unknown as Inspeccion[]
    documentos = (s4.data ?? []) as unknown as Documento[]
    documentTypes = (s5.data ?? []) as unknown as DocumentType[]

    const [d1, d2] = await Promise.all([
      supabase.from('establecimiento_denuncias').select('*').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('establecimiento_feedback_clientes').select('*').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
    ])
    denuncias = (d1.data ?? []) as unknown as Denuncia[]
    feedbackClientes = (d2.data ?? []) as unknown as FeedbackCliente[]
  }

  if (section === 'planificar' || section === 'hacer') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  const tipoLabel = establecimiento.tipos_establecimiento?.nombre ?? null

  return (
    <div className="flex">
      {/* Left sidebar */}
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white flex flex-col pt-8 px-3 sticky top-0 h-screen overflow-y-auto">
        <div className="px-2 mb-6">
          <p className="text-xs text-gray-400 font-medium truncate mb-0.5">{empresa.razon_social}</p>
          <p className="text-sm font-bold text-gray-900 truncate">{establecimiento.nombre}</p>
          {tipoLabel && <p className="text-xs text-gray-400 mt-0.5 truncate">{tipoLabel}</p>}
        </div>

        <nav className="flex flex-col gap-1">
          {SIDEBAR_ITEMS.map(item => {
            const isActive = section === item.id
            const isDisabled = item.id === 'verificar'
            if (isDisabled) {
              return (
                <span
                  key={item.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed"
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
              )
            }
            return (
              <Link
                key={item.id}
                href={`/dashboard/empresas/${id}/establecimientos/${estId}?section=${item.id}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sig-50 text-sig-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? 'bg-sig-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {userCanWrite && section === 'informacion' && (
          <div className="mt-auto px-2 pb-6 pt-4">
            <Link
              href={`/dashboard/empresas/${id}/establecimientos/${estId}/editar`}
              className="flex items-center justify-center gap-1.5 w-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Editar
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-8">
        {/* ── Información ── */}
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
            />
          </>
        )}

        {/* ── Planificar ── */}
        {section === 'planificar' && (
          <PlanificarView
            establecimientoId={estId}
            empresaId={id}
          />
        )}

        {/* ── Hacer ── */}
        {section === 'hacer' && (
          <GestionesAgenda
            establecimientoId={estId}
            empresaId={id}
            canWrite={userCanWrite}
            riesgos={riesgos}
          />
        )}

        {/* ── Verificar (placeholder) ── */}
        {section === 'verificar' && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-400 mx-auto mb-4">
              V
            </div>
            <p className="font-semibold text-gray-700">Verificar</p>
            <p className="text-sm text-gray-400 mt-1">Próximamente disponible.</p>
          </div>
        )}

        {/* ── Actuar ── */}
        {section === 'actuar' && (
          <ActuarView establecimientoId={estId} />
        )}
      </div>
    </div>
  )
}

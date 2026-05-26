import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole, SubcontratistaDocumento, DocumentType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SubcontratistaInfoTab } from '@/components/subcontratista/subcontratista-info-tab'
import { SubcontratistaDocumentosTab } from '@/components/subcontratista/subcontratista-documentos-tab'
import { SubcontratistaEstablecimientosTab } from '@/components/subcontratista/subcontratista-establecimientos-tab'
import { FileText, MapPin, Info } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { id: 'info', label: 'Información', icon: Info },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'establecimientos', label: 'Establecimientos', icon: MapPin },
] as const

type Tab = (typeof TABS)[number]['id']

export default async function SubcontratistaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab: rawTab } = await searchParams
  const tab: Tab = (['info', 'documentos', 'establecimientos'] satisfies Tab[]).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : 'info'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }, { data: sub }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('subcontratistas')
      .select(`
        *,
        subcontratistas_rubros!rubro_id(nombre),
        establecimientos_tipos!tipo_establecimiento_id(nombre),
        organizaciones_externas!organizacion_id(
          id, nombre, cuit, domicilio, email, telefono,
          tipo_identidad_impositiva, codigo_postal, is_active,
          localidades!localidad_id(nombre, provincia)
        ),
        organizaciones_externas!art_id(nombre)
      `)
      .eq('id', id)
      .single(),
  ])

  if (!sub) notFound()

  const puedeEditar = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (sub.organizaciones_externas as any) ?? {}
  const rubro = sub.subcontratistas_rubros as { nombre: string } | null
  const tipoEst = sub.establecimientos_tipos as { nombre: string } | null

  // ── Fetch data for tabs ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentos: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentTypes: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let establecimientosVinculados: any[] = []

  const asyncFns: (() => Promise<void>)[] = []

  if (tab === 'documentos') {
    asyncFns.push(async () => {
      const { data: docs } = await supabase
        .from('subcontratistas_documentos')
        .select('*, documentos_tipos!tipo_id(nombre)')
        .eq('subcontratista_id', id)
        .order('created_at', { ascending: false })
      documentos = docs ?? []
    })
    asyncFns.push(async () => {
      const { data: dt } = await supabase
        .from('documentos_tipos')
        .select('id, nombre, aplica_subcontratista, is_active')
        .eq('is_active', true)
        .eq('aplica_subcontratista', true)
        .order('nombre')
      documentTypes = dt ?? []
    })
  }

  if (tab === 'establecimientos') {
    asyncFns.push(async () => {
      const { data: est } = await supabase
        .from('organizaciones_establecimientos')
        .select(`
          establecimiento_id,
          establecimientos!establecimiento_id(
            id, nombre, actividad_principal,
            empresas!empresa_id(razon_social),
            establecimientos_tipos!tipo_id(nombre)
          )
        `)
        .eq('organizacion_id', sub.organizacion_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      establecimientosVinculados = (est ?? []).map((d: any) => d.establecimientos).filter(Boolean)
    })
  }

  await Promise.all(asyncFns.map(fn => fn()))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/organizaciones-externas"
          className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
        >
          ← Organizaciones Externas
        </Link>

        <div className="flex items-start justify-between gap-4 mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary">{org.nombre ?? 'Subcontratista'}</h1>
            {rubro && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-sig-100 text-sig-700">
                {rubro.nombre}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              org.is_active ? 'bg-success-bg text-success' : 'bg-surface-elevated text-text-secondary'
            }`}>
              {org.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          {puedeEditar && (
            <Link
              href={`/dashboard/organizaciones-externas/${id}/editar`}
              className="shrink-0 inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Editar
            </Link>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-border-subtle mt-4">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <Link
              key={tabId}
              href={`/dashboard/organizaciones-externas/${id}${tabId === 'info' ? '' : `?tab=${tabId}`}`}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === tabId
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

      {/* Tab content */}
      {tab === 'info' && (
        <SubcontratistaInfoTab
          sub={sub}
          org={org}
          rubro={rubro}
          tipoEst={tipoEst}
          puedeEditar={puedeEditar}
        />
      )}

      {tab === 'documentos' && (
        <SubcontratistaDocumentosTab
          documentos={documentos as unknown as SubcontratistaDocumento[]}
          documentTypes={documentTypes as unknown as DocumentType[]}
          subcontratistaId={id}
          puedeEditar={puedeEditar}
        />
      )}

      {tab === 'establecimientos' && (
        <SubcontratistaEstablecimientosTab
          establecimientos={establecimientosVinculados}
          subcontratistaId={id}
          organizacionId={sub.organizacion_id}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  )
}

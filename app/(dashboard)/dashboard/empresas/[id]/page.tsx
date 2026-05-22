import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { formatCUIT } from '@/lib/utils'
import { Building2, FileText, BarChart3 } from 'lucide-react'
import { EmpresaDocumentosSection } from '@/components/empresa-documentos-section'
import { EmpresaRightPanel } from '@/components/empresa-right-panel'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import type { DocumentType, Documento } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { id: 'establecimientos', label: 'Establecimientos', icon: Building2 },
  { id: 'ficha', label: 'Ficha', icon: FileText },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
] as const

type Tab = (typeof TABS)[number]['id']

export default async function EmpresaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab: rawTab } = await searchParams
  const tab: Tab = (['establecimientos', 'ficha', 'dashboard'] satisfies Tab[]).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : 'establecimientos'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('*, empresas_rubros(nombre), localidades(nombre, provincia), organizaciones_externas!art_id(nombre)').eq('id', id).single(),
  ])

  if (!empresa) notFound()

  const puedeEditar = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user'
  )

  // Fetch data by tab
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let establecimientos: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentos: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentTypes: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let personasLinks: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orgsLinks: any[] = []

  if (tab === 'establecimientos' || tab === 'dashboard') {
    const { data } = await supabase
      .from('establecimientos')
      .select('id, nombre, establecimientos_tipos(nombre), localidades!localidad_id(nombre, provincia), cantidad_trabajadores')
      .eq('empresa_id', id)
      .neq('status', 'cancelled')
      .order('nombre')
    establecimientos = data ?? []
    if (tab === 'establecimientos') {
      const estIds = establecimientos.map(e => e.id)
      if (estIds.length > 0) {
        const [pe, oe] = await Promise.all([
          supabase
            .from('personas_establecimientos')
            .select('persona_id, establecimiento_id, personas_directorio!persona_id(id, nombre, apellido, dni, fecha_ingreso, personas_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
            .in('establecimiento_id', estIds),
          supabase
            .from('organizaciones_establecimientos')
            .select('organizacion_id, establecimiento_id, organizaciones!organizacion_id(id, nombre, email, telefono, organizaciones_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
            .in('establecimiento_id', estIds),
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personasLinks = (pe.data ?? []) as any[]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orgsLinks = (oe.data ?? []) as any[]
      }
    }
  }

  if (tab === 'ficha') {
    const [d1, d2] = await Promise.all([
      supabase
        .from('empresas_documentos')
        .select('*, documentos_tipos(nombre)')
        .eq('empresa_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('documentos_tipos')
        .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
        .eq('is_active', true)
        .eq('aplica_empresa', true)
        .order('nombre'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentos = (d1.data ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentTypes = (d2.data ?? []) as any[]
  }

  return (
    <div className="p-6">
      {/* Header + sub-nav */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary mb-3">{empresa.razon_social}</h1>
        <nav className="flex gap-1 border-b border-border-subtle">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <Link
              key={tabId}
              href={`/dashboard/empresas/${id}${tabId === 'establecimientos' ? '' : `?tab=${tabId}`}`}
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
      {tab === 'establecimientos' && (
        <EmpresaRightPanel
          empresaId={id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          establecimientos={(establecimientos ?? []) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personasLinks={(personasLinks ?? []) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgsLinks={(orgsLinks ?? []) as any}
          puedeEditar={puedeEditar}
        />
      )}

      {tab === 'ficha' && (
        <div className="max-w-3xl">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{empresa.razon_social}</h2>
                {empresa.cuit && (
                  <p className="text-sm text-text-tertiary font-mono">{formatCUIT(empresa.cuit)}</p>
                )}
                {(empresa.empresas_rubros as unknown as { nombre: string } | null)?.nombre && (
                  <p className="text-sm text-text-tertiary mt-0.5">{(empresa.empresas_rubros as unknown as { nombre: string }).nombre}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${empresa.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {empresa.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {empresa.domicilio && (
                <div>
                  <p className="text-text-tertiary text-xs font-medium mb-0.5">Domicilio</p>
                  <p className="text-text-primary">{empresa.domicilio}</p>
                </div>
              )}
              {empresa.localidades && (
                <div>
                  <p className="text-text-tertiary text-xs font-medium mb-0.5">Ubicación</p>
                  <p className="text-text-primary">{empresa.localidades.nombre}, {empresa.localidades.provincia}</p>
                </div>
              )}
              {empresa.codigo_postal && (
                <div>
                  <p className="text-text-tertiary text-xs font-medium mb-0.5">CP</p>
                  <p className="text-text-primary">{empresa.codigo_postal}</p>
                </div>
              )}
              {empresa.organizaciones_externas && (
                <div>
                  <p className="text-text-tertiary text-xs font-medium mb-0.5">ART</p>
                  <p className="text-text-primary">{empresa.organizaciones_externas.nombre}</p>
                </div>
              )}
            </div>

            {puedeEditar && (
              <Link
                href={`/dashboard/empresas/${id}/editar`}
                className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                Editar información
              </Link>
            )}

            <div className="border-t border-border-subtle pt-4">
              <EmpresaDocumentosSection
                empresaId={id}
                documentos={(documentos ?? []) as Documento[]}
                documentTypes={(documentTypes ?? []) as DocumentType[]}
                canWrite={puedeEditar}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <AnalyticsDashboard
          level="empresa"
          empresaId={id}
          establecimientos={establecimientos.map(e => ({ id: e.id, nombre: e.nombre }))}
        />
      )}
    </div>
  )
}

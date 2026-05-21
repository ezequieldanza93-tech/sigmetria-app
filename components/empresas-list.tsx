import { createClient } from '@/lib/supabase/server'
import { canWrite, UserRole } from '@/lib/types'
import { EmpresasListView } from './empresas-list-view'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
  is_active: boolean
}

export async function EmpresasList() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: membership },
    { data: empresasRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase
      .from('empresas')
      .select(`id, razon_social, cuit, is_active, empresas_rubros(nombre), localidades(nombre, provincia), establecimientos(count)`)
      .range(0, 99)
      .order('razon_social'),
  ])

  const empresaIds = (empresasRaw ?? []).map(e => e.id as string)

  let establecimientosByEmpresa: Record<string, Establecimiento[]> = {}
  if (empresaIds.length > 0) {
    const { data: ests } = await supabase
      .from('establecimientos')
      .select('id, nombre, domicilio, is_active, empresa_id')
      .in('empresa_id', empresaIds)
      .order('nombre')

    establecimientosByEmpresa = (ests ?? []).reduce<Record<string, Establecimiento[]>>((acc, est) => {
      const eid = (est as { empresa_id: string }).empresa_id
      if (!acc[eid]) acc[eid] = []
      acc[eid].push({
        id: est.id as string,
        nombre: est.nombre as string,
        domicilio: (est.domicilio ?? null) as string | null,
        is_active: Boolean(est.is_active),
      })
      return acc
    }, {})
  }

  const empresas = (empresasRaw ?? []).map(e => ({
    id: e.id as string,
    razon_social: e.razon_social as string,
    cuit: (e.cuit ?? null) as string | null,
    is_active: Boolean(e.is_active),
    empresas_rubros: (e.empresas_rubros ?? null) as unknown as { nombre: string } | null,
    localidades: (e.localidades ?? null) as unknown as { nombre: string; provincia: string } | null,
    establecimientos: establecimientosByEmpresa[e.id as string] ?? [],
  }))

  const puedeCrear = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user',
  )

  return <EmpresasListView empresas={empresas} puedeCrear={puedeCrear} />
}

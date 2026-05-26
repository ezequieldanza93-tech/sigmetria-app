import { createClient } from '@/lib/supabase/server'
import { canWrite, UserRole } from '@/lib/types'
import { EmpresasListView } from './empresas-list-view'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
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
      .select(`id, razon_social, cuit, is_active, empresas_rubros(nombre), localidades(nombre, provincia), establecimientos(id, nombre, domicilio)`)
      .range(0, 99)
      .order('razon_social'),
  ])

  const empresas = (empresasRaw ?? []).map(e => {
    const ests = ((e.establecimientos as unknown as Establecimiento[]) ?? [])
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    return {
      id: e.id as string,
      razon_social: e.razon_social as string,
      cuit: (e.cuit ?? null) as string | null,
      is_active: Boolean(e.is_active),
      empresas_rubros: (e.empresas_rubros ?? null) as unknown as { nombre: string } | null,
      localidades: (e.localidades ?? null) as unknown as { nombre: string; provincia: string } | null,
      establecimientoCount: ests.length,
      establecimientos: ests,
    }
  })

  const puedeCrear = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user',
  )

  return <EmpresasListView empresas={empresas} puedeCrear={puedeCrear} />
}

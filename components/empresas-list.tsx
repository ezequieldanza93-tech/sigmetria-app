import { createClient } from '@/lib/supabase/server'
import { canWrite } from '@/lib/types'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { EmpresasListView } from './empresas-list-view'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
}

export async function EmpresasList() {
  const supabase = await createClient()

  const effective = await getEffectiveRole()
  if (!effective) return null

  const { data: empresasRaw } = await supabase
    .from('empresas')
    .select(`id, razon_social, cuit, is_active, empresas_rubros(nombre), localidades(nombre, provincia), establecimientos(id, nombre, domicilio)`)
    .range(0, 99)
    .order('razon_social')

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

  const puedeCrear = canWrite(effective.effectiveUserRole, effective.effectiveSystemRole)
  const esAdminPrincipal = effective.effectiveUserRole === 'full_access_main' || effective.isSuperAdmin === true

  return <EmpresasListView empresas={empresas} puedeCrear={puedeCrear} esAdminPrincipal={esAdminPrincipal} />
}

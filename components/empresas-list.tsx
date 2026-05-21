import { createClient } from '@/lib/supabase/server'
import { canWrite, UserRole } from '@/lib/types'
import { EmpresasListView } from './empresas-list-view'

export async function EmpresasList() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: membership },
    { data: empresas },
  ] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase
      .from('empresas')
      .select(`
        id, razon_social, cuit, is_active,
        empresas_rubros(nombre),
        localidades(nombre, provincia),
        establecimientos(id, nombre, domicilio, is_active)
      `)
      .range(0, 99)
      .order('razon_social'),
  ])

  const puedeCrear = canWrite(
    membership?.role as UserRole ?? null,
    profile?.system_role ?? 'user',
  )

  return <EmpresasListView empresas={(empresas ?? []) as never} puedeCrear={puedeCrear} />
}

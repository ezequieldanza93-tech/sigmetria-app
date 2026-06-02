import { createClient } from '@/lib/supabase/server'
import { GlobalSectionsSidebar } from '@/components/layout/global-sections-sidebar'

// Layout de las vistas internas del dashboard.
// Monta el sidebar de secciones (Empresas/Ficha/Gestiones/Seguimiento/Dashboards)
// en TODAS las vistas que hoy no lo tienen, para poder navegar en 1 click sin
// volver al inicio. Las rutas que ya montan su propio shell (empresas/*) quedan
// excluidas dentro de GlobalSectionsSidebar para no duplicar el sidebar.
export default async function DashboardInnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let empresas: { id: string; razon_social: string }[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('empresas')
      .select('id, razon_social')
      .order('razon_social')
      .limit(500)
    empresas = (data ?? []) as { id: string; razon_social: string }[]
  } catch {
    // Si falla la carga (sin consultora, etc.), el sidebar se monta sin lista
    // de empresas — no rompemos la vista.
  }

  return <GlobalSectionsSidebar empresas={empresas}>{children}</GlobalSectionsSidebar>
}

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EstablecimientoProvider } from '@/lib/contexts/establecimiento-context'
import { SeccionesSidebar } from '@/components/establecimiento/secciones-sidebar'
import { SeccionesBottomNav } from '@/components/establecimiento/secciones-bottom-nav'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string; estId: string }>
}

export default async function EstablecimientoLegacyLayout({ children, params }: Props) {
  const { id: empresaId, estId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('nombre')
    .eq('id', estId)
    .single()

  if (!establecimiento) notFound()

  return (
    <EstablecimientoProvider establecimientoId={estId} nombre={establecimiento.nombre} empresaId={empresaId}>
      <SeccionesSidebar empresaId={empresaId} establecimientoId={estId} />
      <div className="lg:pl-14 lg:peer-hover/sidebar:pl-40 lg:transition-[padding] lg:duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+64px)] lg:pb-0">
        {children}
      </div>
      <SeccionesBottomNav empresaId={empresaId} establecimientoId={estId} />
    </EstablecimientoProvider>
  )
}

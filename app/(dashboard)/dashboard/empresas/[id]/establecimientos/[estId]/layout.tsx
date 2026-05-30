import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EstablecimientoProvider } from '@/lib/contexts/establecimiento-context'
import { EstablecimientoShell } from '@/components/establecimiento/establecimiento-shell'

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
      <Suspense fallback={<div className="lg:pl-14" />}>
        <EstablecimientoShell empresaId={empresaId} establecimientoId={estId}>
          {children}
        </EstablecimientoShell>
      </Suspense>
    </EstablecimientoProvider>
  )
}

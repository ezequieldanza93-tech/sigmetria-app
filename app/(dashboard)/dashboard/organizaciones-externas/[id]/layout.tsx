import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SubcontratistaProvider } from '@/lib/contexts/subcontratista-context'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function SubcontratistaDetailLayout({ children, params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify subcontratista exists and get org name
  const { data: sub } = await supabase
    .from('subcontratistas')
    .select('organizaciones_externas!organizacion_id(nombre)')
    .eq('id', id)
    .single()

  if (!sub) notFound()

  const nombre = (sub.organizaciones_externas as unknown as { nombre: string } | null)?.nombre ?? 'Subcontratista'

  return (
    <SubcontratistaProvider subcontratistaId={id} nombre={nombre}>
      {children}
    </SubcontratistaProvider>
  )
}

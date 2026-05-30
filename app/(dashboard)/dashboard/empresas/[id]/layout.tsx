import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EmpresaProvider } from '@/lib/contexts/empresa-context'
import { EmpresaShell } from '@/components/empresa/empresa-shell'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function EmpresaLegacyLayout({ children, params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: empresa }, { data: estData }] = await Promise.all([
    supabase.from('empresas').select('razon_social').eq('id', id).single(),
    supabase
      .from('establecimientos')
      .select('id, nombre')
      .eq('empresa_id', id)
      .neq('status', 'cancelled')
      .order('nombre'),
  ])

  if (!empresa) notFound()

  const establecimientos = (estData ?? []) as { id: string; nombre: string }[]

  return (
    <EmpresaProvider empresaId={id} razonSocial={empresa.razon_social}>
      <EmpresaShell empresaId={id} establecimientos={establecimientos}>
        {children}
      </EmpresaShell>
    </EmpresaProvider>
  )
}

import { Suspense } from 'react'
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

  const { data: empresa } = await supabase
    .from('empresas')
    .select('razon_social')
    .eq('id', id)
    .single()

  if (!empresa) notFound()

  return (
    <EmpresaProvider empresaId={id} razonSocial={empresa.razon_social}>
      <Suspense fallback={<div className="lg:pl-14" />}>
        <EmpresaShell empresaId={id}>
          {children}
        </EmpresaShell>
      </Suspense>
    </EmpresaProvider>
  )
}

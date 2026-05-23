import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DenunciasListClient } from './list-client'

export default async function DenunciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="p-6">
        <Card padding="lg">
          <p className="text-text-secondary text-center py-8">No tenés acceso a esta sección.</p>
        </Card>
      </div>
    )
  }

  const { data: denuncias } = await supabase
    .from('denuncias')
    .select('*, empresas!inner(razon_social), establecimientos(nombre)')
    .eq('empresas.consultora_id', membership.consultora_id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="text-text-tertiary" size={24} />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Denuncias</h1>
            <p className="text-sm text-text-tertiary">Reclamos formales y reportes</p>
          </div>
        </div>
        <Link href="/dashboard/denuncias/nueva">
          <Button>
            <Plus size={16} />
            Nueva Denuncia
          </Button>
        </Link>
      </div>

      <DenunciasListClient denuncias={denuncias ?? []} />
    </div>
  )
}

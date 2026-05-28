import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiKeysClient } from './api-keys-client'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role === 'full_access_main'

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, permisos, created_at, last_used_at, revoked_at')
    .eq('consultora_id', membership.consultora_id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">API Keys</h1>
        <p className="text-sm text-text-secondary mt-1">
          Claves de acceso externo para integración de datos según Art. 4.7 Res. SRT 48/2025.{' '}
          <a href="/api/v1/docs" target="_blank" rel="noopener" className="text-brand-primary hover:underline">
            Ver documentación →
          </a>
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Límite de uso: 60 requests por minuto por key</p>
        <p>Las keys tienen acceso de lectura a todas las empresas y establecimientos de tu consultora. Tratá cada key como una contraseña.</p>
      </div>

      <ApiKeysClient keys={keys ?? []} isAdmin={isAdmin} />
    </div>
  )
}

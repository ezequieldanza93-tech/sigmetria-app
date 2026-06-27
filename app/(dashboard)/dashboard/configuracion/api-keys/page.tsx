import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiKeysClient } from './api-keys-client'
import { ConnectionGuide } from './connection-guide'

export default async function ConexionesPage() {
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

      {/* ================================================================ */}
      {/* HERO — Conexiones                                                */}
      {/* ================================================================ */}
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-text-primary">Conexiones</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          Conectá Sigmetría con las herramientas que usás todos los días. Vas a poder consultar
          los datos de tu consultora desde el escritorio, sin tener que abrir el navegador.
        </p>
        <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/10 px-4 py-3 text-xs text-text-secondary leading-relaxed space-y-1">
          <p>
            <strong className="text-text-primary">¿Qué información se ve?</strong> Cada consultora
            se conecta con su propia clave de acceso y ve:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>La información general de Sigmetría que compartimos con todas las consultoras (catálogo de gestiones, normativa, etc.)</li>
            <li><strong className="text-text-primary">Su información exclusiva:</strong> empresas, establecimientos, empleados, incidentes, riesgos, vencimientos, librerías customizadas, directorios y todos los registros propios de la consultora</li>
            <li>Cada consultora ve <strong className="text-text-primary">solamente sus propios datos</strong>. La información de otras consultoras no es accesible.</li>
          </ul>
        </div>
      </div>

      {/* ================================================================ */}
      {/* GUÍA PASO A PASO                                                  */}
      {/* ================================================================ */}
      <ConnectionGuide />

      {/* ================================================================ */}
      {/* TUS CLAVES DE ACCESO                                              */}
      {/* ================================================================ */}
      <section className="space-y-4">
        <div className="border-t border-border-subtle pt-8">
          <h2 className="text-lg font-semibold text-text-primary">Tus claves de acceso</h2>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">
            Estas claves son como una contraseña que le das a cada aplicación para que pueda
            conectarse a Sigmetría. Cada conexión usa su propia clave.
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Límite de uso: 60 consultas por minuto por clave</p>
          <p>
            Tratá cada clave como una contraseña. Si una clave se pierde o ya no la usás,
            revocala y creá una nueva.
          </p>
        </div>

        <ApiKeysClient keys={keys ?? []} isAdmin={isAdmin} />
      </section>

    </div>
  )
}

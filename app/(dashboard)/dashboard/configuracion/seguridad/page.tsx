import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Seguridad — Sigmetría HyS',
}

const MFA_REQUIRED_ROLES = ['full_access_main', 'responsable_estandares']

export default async function SeguridadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: factors }, { data: member }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase
      .from('consultoras_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const activeFactor = factors?.totp?.find(f => f.status === 'verified') ?? null
  const requiresMfa = member ? MFA_REQUIRED_ROLES.includes(member.role) : false

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Seguridad de la cuenta</h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          Gestioná la seguridad de tu acceso a Sigmetría.
        </p>
      </div>

      <div className="rounded-xl border border-border-default overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle bg-surface-elevated">
          <h2 className="text-sm font-semibold text-text-primary">Verificación en dos pasos (2FA)</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Protección adicional con una app autenticadora (Google Authenticator, Authy, etc.)
          </p>
        </div>

        <div className="px-5 py-5">
          {activeFactor ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center" aria-hidden="true">
                  <ShieldCheck size={16} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Verificación en dos pasos activa</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Tu cuenta está protegida con autenticación TOTP.
                  </p>
                  {requiresMfa && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-full">
                      <Shield size={10} aria-hidden="true" />
                      Requerido para tu rol
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/mfa/setup"
                className="text-xs font-medium text-text-tertiary hover:text-text-primary border border-border-default px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Reconfigurar
              </Link>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-950 rounded-full flex items-center justify-center" aria-hidden="true">
                  <ShieldAlert size={16} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Verificación en dos pasos no configurada
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {requiresMfa
                      ? 'Tu rol requiere 2FA obligatorio. Configuralo para acceder al sistema.'
                      : 'Activar 2FA protege tu cuenta ante accesos no autorizados.'}
                  </p>
                  {requiresMfa && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                      <ShieldAlert size={10} aria-hidden="true" />
                      Obligatorio para tu rol
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/mfa/setup"
                className="text-xs font-medium text-white bg-brand-primary hover:bg-brand-hover px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Configurar ahora
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-text-tertiary bg-surface-elevated border border-border-subtle rounded-lg px-4 py-3 space-y-1.5">
        <p className="font-medium text-text-secondary">¿Qué es la verificación en dos pasos?</p>
        <p>
          Agrega una capa extra de seguridad a tu cuenta. Además de tu contraseña,
          necesitás ingresar un código temporal generado por tu app autenticadora
          cada vez que iniciás sesión.
        </p>
        <p>
          Apps compatibles: <strong className="text-text-primary">Google Authenticator</strong>,{' '}
          <strong className="text-text-primary">Authy</strong>,{' '}
          <strong className="text-text-primary">Microsoft Authenticator</strong>.
        </p>
      </div>
    </div>
  )
}

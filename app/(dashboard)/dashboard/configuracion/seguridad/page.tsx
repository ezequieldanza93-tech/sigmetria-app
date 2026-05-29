import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Shield, ShieldCheck, Mail } from 'lucide-react'
import { verifyMfaCookie, MFA_COOKIE_NAME } from '@/lib/mfa-cookie'

export const metadata = {
  title: 'Seguridad — Sigmetría HyS',
}

const MFA_REQUIRED_ROLES = ['full_access_main', 'responsable_estandares']

export default async function SeguridadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const mfaCookieValue = cookieStore.get(MFA_COOKIE_NAME)?.value

  const [isMfaVerified, { data: member }] = await Promise.all([
    mfaCookieValue
      ? verifyMfaCookie(mfaCookieValue, user.id).catch(() => false)
      : Promise.resolve(false),
    supabase
      .from('consultoras_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

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
            Segundo factor de autenticación via código por email. Res. SRT 48/2025 Art. 4.5.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                requiresMfa
                  ? 'bg-green-100 dark:bg-green-950'
                  : 'bg-surface-elevated'
              }`}
              aria-hidden="true"
            >
              {requiresMfa ? (
                <ShieldCheck size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <Shield size={16} className="text-text-tertiary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {requiresMfa
                  ? 'Verificación en dos pasos activa'
                  : 'Verificación en dos pasos no requerida'}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {requiresMfa
                  ? 'Tu rol requiere un código de verificación por email al iniciar sesión.'
                  : 'Tu rol actual no requiere verificación adicional.'}
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                {requiresMfa && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-full">
                    <Shield size={10} aria-hidden="true" />
                    Obligatorio para tu rol
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  isMfaVerified
                    ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50'
                    : 'text-text-tertiary bg-surface-elevated border border-border-subtle'
                }`}>
                  <Mail size={10} aria-hidden="true" />
                  {isMfaVerified ? 'Sesión verificada' : 'Sin verificar en esta sesión'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-text-tertiary bg-surface-elevated border border-border-subtle rounded-lg px-4 py-3 space-y-1.5">
        <p className="font-medium text-text-secondary">¿Cómo funciona?</p>
        <p>
          Al iniciar sesión, el sistema te envía automáticamente un código de 6 dígitos
          a tu email registrado. El código es válido por 10 minutos y de uso único.
        </p>
        <p>
          Una vez verificado, la sesión queda activa por <strong className="text-text-primary">24 horas</strong>{' '}
          sin necesidad de volver a ingresar el código.
        </p>
      </div>
    </div>
  )
}

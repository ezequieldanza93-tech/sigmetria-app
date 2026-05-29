import { redirect } from 'next/navigation'

// El MFA por email no requiere setup — siempre se verifica en el mismo flujo.
export default function MfaSetupPage() {
  redirect('/mfa/verify')
}

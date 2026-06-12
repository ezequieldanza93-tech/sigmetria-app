/**
 * Gate del módulo CRM. Por ahora solo el staff de Sigmetría ve y gestiona los leads:
 * cuentas con dominio @sigmetria.app + el mail del fundador. El mismo criterio se aplica
 * en la base con la función public.is_crm_admin() (migración 20260712000007), así que el
 * gate de UI y el de datos (RLS) no pueden divergir.
 *
 * Función pura y client-safe (no importa nada de servidor) para poder usarse también en el
 * sidebar (client component) y decidir si mostrar el item del CRM.
 *
 * A futuro: cuando se ofrezca como add-on a otras consultoras, el acceso pasa a scopearse por
 * consultora_id + suscripción al add-on (no por este allowlist).
 */
const CRM_DOMAIN_SUFFIX = '@sigmetria.app'
const CRM_FOUNDER_EMAILS = ['ezequieldanza93@gmail.com']

export function isCrmAdmin(email?: string | null): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return e.endsWith(CRM_DOMAIN_SUFFIX) || CRM_FOUNDER_EMAILS.includes(e)
}

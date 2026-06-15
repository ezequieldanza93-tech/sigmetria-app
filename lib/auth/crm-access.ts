/**
 * Gate del módulo CRM. El acceso está restringido a una lista explícita de emails permitidos.
 * El mismo criterio se aplica en la base con la función public.is_crm_admin()
 * (migración 20260718000003), así que el gate de UI y el de datos (RLS) no pueden divergir.
 *
 * Función pura y client-safe (no importa nada de servidor) para poder usarse también en el
 * sidebar (client component) y decidir si mostrar el item del CRM.
 *
 * A futuro: cuando se ofrezca como add-on a otras consultoras, el acceso pasa a scopearse por
 * consultora_id + suscripción al add-on (no por este allowlist).
 */
const CRM_ALLOWED_EMAILS = ['admin.main@sigmetria.app']

export function isCrmAdmin(email?: string | null): boolean {
  if (!email) return false
  return CRM_ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}

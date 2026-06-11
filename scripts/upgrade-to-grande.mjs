// Sube la suscripción de la consultora de un usuario a "Consultora Grande" ACTIVA.
// Correr DESPUÉS de que el usuario cree su consultora en el wizard (paso 1).
// Uso: node --env-file=.env.local scripts/upgrade-to-grande.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan envs SUPABASE'); process.exit(1) }

const admin = createClient(url, key, { auth: { persistSession: false } })
const EMAIL = 'ezequieldanza93@gmail.com'
const SEATS_MAX = 6 // Admin + 5 colaboradores (plan Consultora Grande)

// 1. Buscar usuario
let user = null
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { console.error('listUsers', error.message); process.exit(1) }
  user = data.users.find(u => (u.email || '').toLowerCase() === EMAIL)
  if (user || data.users.length < 200) break
}
if (!user) { console.error('Usuario no encontrado'); process.exit(1) }

// 2. Membresía activa → consultora
const { data: membership } = await admin
  .from('consultoras_members')
  .select('consultora_id, role')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .maybeSingle()
if (!membership?.consultora_id) {
  console.error('⚠️  El usuario todavía NO tiene consultora. Completá el paso 1 del wizard y volvé a correr esto.')
  process.exit(1)
}
const consultoraId = membership.consultora_id

// 3. Plan Consultora Grande
const { data: plan } = await admin.from('plans').select('id, nombre').eq('slug', 'consultora-grande').maybeSingle()
if (!plan) { console.error('Plan consultora-grande no encontrado'); process.exit(1) }

// 4. Subir la suscripción a Grande ACTIVA
const { data: sub } = await admin.from('subscriptions').select('id, estado').eq('consultora_id', consultoraId).maybeSingle()
const periodEndDays = 30
const now = new Date()
const end = new Date(now.getTime() + periodEndDays * 24 * 60 * 60 * 1000)

const subFields = {
  plan_id: plan.id,
  estado: 'active',
  periodo: 'monthly',
  current_period_start: now.toISOString(),
  current_period_end: end.toISOString(),
  updated_at: now.toISOString(),
}

if (sub) {
  const { error } = await admin.from('subscriptions').update(subFields).eq('id', sub.id)
  if (error) { console.error('update sub', error.message); process.exit(1) }
} else {
  const { error } = await admin.from('subscriptions').insert({ consultora_id: consultoraId, ...subFields })
  if (error) { console.error('insert sub', error.message); process.exit(1) }
}

// 5. Seats + tipo en la consultora
const { error: cErr } = await admin
  .from('consultoras')
  .update({ seats_max: SEATS_MAX, tipo: 'consultora', updated_at: now.toISOString() })
  .eq('id', consultoraId)
if (cErr) { console.error('update consultora', cErr.message); process.exit(1) }

console.log(`✅ Consultora ${consultoraId} en plan "${plan.nombre}" ACTIVO, seats_max=${SEATS_MAX}.`)

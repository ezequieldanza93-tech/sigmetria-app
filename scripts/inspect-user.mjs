// Inspección READ-ONLY de la cuenta y su entorno. No modifica nada.
// Uso: node --env-file=.env.local scripts/inspect-user.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan envs SUPABASE'); process.exit(1) }

const admin = createClient(url, key, { auth: { persistSession: false } })
const EMAIL = 'ezequieldanza93@gmail.com'

// Buscar el usuario por email (paginado).
let user = null
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { console.error('listUsers error', error.message); break }
  const found = data.users.find(u => (u.email || '').toLowerCase() === EMAIL)
  if (found) { user = found; break }
  if (data.users.length < 200) break
}

if (!user) { console.log('USER NOT FOUND:', EMAIL); process.exit(0) }
console.log('== USER ==')
console.log('id:', user.id, '| email:', user.email, '| created:', user.created_at)

const { data: profile } = await admin.from('profiles').select('full_name, system_role, is_super_admin').eq('id', user.id).maybeSingle()
console.log('profile:', JSON.stringify(profile))

const { data: members } = await admin.from('consultoras_members').select('id, consultora_id, role, is_active').eq('user_id', user.id)
console.log('memberships:', JSON.stringify(members))

for (const m of members ?? []) {
  const { data: c } = await admin.from('consultoras').select('nombre, cuit').eq('id', m.consultora_id).maybeSingle()
  const { count: empresas } = await admin.from('empresas').select('*', { count: 'exact', head: true }).eq('consultora_id', m.consultora_id)
  const { count: membersCount } = await admin.from('consultoras_members').select('*', { count: 'exact', head: true }).eq('consultora_id', m.consultora_id)
  const { data: subs } = await admin.from('subscriptions').select('estado, plan_id, trial_ends_at, current_period_end').eq('consultora_id', m.consultora_id)
  console.log(`  consultora ${m.consultora_id} "${c?.nombre}" | empresas: ${empresas} | miembros: ${membersCount} | subs: ${JSON.stringify(subs)}`)
}

const { count: superAdmins } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_super_admin', true)
console.log('== total super_admins en el sistema:', superAdmins)

const { data: otherAdmins } = await admin.from('profiles').select('id, full_name').eq('is_super_admin', true)
console.log('super_admin ids:', JSON.stringify(otherAdmins))

const { data: plans } = await admin.from('plans').select('id, nombre, slug, tipo, max_colaboradores, max_empresas, max_establecimientos').order('precio_mensual_neto', { nullsFirst: true })
console.log('== PLANS ==')
console.log(JSON.stringify(plans, null, 1))

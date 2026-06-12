// Resetea a ezequieldanza93@gmail.com a "sin consultora" para revivir el wizard
// de onboarding desde cero. Desactiva sus membresías activas (no borra data:
// la consultora vieja queda parada e invisible). node --env-file=.env.local scripts/reset-ezeq-onboarding.mjs
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EMAIL = 'ezequieldanza93@gmail.com'

let user = null
for (let p = 1; p <= 20; p++) {
  const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
  user = data.users.find(u => (u.email || '').toLowerCase() === EMAIL)
  if (user || data.users.length < 200) break
}
if (!user) { console.error('NO user'); process.exit(1) }

const { data: memberships } = await admin
  .from('consultoras_members')
  .select('id, consultora_id, role')
  .eq('user_id', user.id)
  .eq('is_active', true)

if (!memberships?.length) {
  console.log('Ya estaba sin consultora activa → el wizard va a aparecer.')
  process.exit(0)
}

for (const m of memberships) {
  const { error } = await admin.from('consultoras_members').update({ is_active: false }).eq('id', m.id)
  if (error) console.error(`No se pudo desactivar membresía ${m.id}: ${error.message}`)
  else console.log(`Membresía ${m.id} (consultora ${m.consultora_id}, rol ${m.role}) → DESACTIVADA.`)
}
console.log('Reset listo. Próximo login de ezequieldanza93 → wizard de onboarding desde cero.')

// Elimina la cuenta ezequieldanza93@gmail.com para empezar de cero (re-signup).
// Limpia dependencias para que el borrado no choque con FKs; si aún así falla,
// libera el email renombrándolo (fallback). node --env-file=.env.local scripts/delete-ezeq.mjs
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EMAIL = 'ezequieldanza93@gmail.com'

let user = null
for (let p = 1; p <= 20; p++) {
  const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
  user = data.users.find(u => (u.email || '').toLowerCase() === EMAIL)
  if (user || data.users.length < 200) break
}
if (!user) { console.log('No existe la cuenta — ya está libre el email.'); process.exit(0) }
const uid = user.id

// Consultoras donde el usuario tuvo membresía (activa o no).
const { data: mems } = await admin.from('consultoras_members').select('consultora_id').eq('user_id', uid)
const consultoraIds = [...new Set((mems ?? []).map(m => m.consultora_id))]

// Limpiar referencias del usuario.
await admin.from('user_access').delete().eq('user_id', uid)
await admin.from('user_access').delete().eq('granted_by', uid)
await admin.from('consultoras_members').update({ invited_by: null }).eq('invited_by', uid)
await admin.from('consultoras_members').delete().eq('user_id', uid)
await admin.from('personas_directorio').update({ user_id: null }).eq('user_id', uid)

// Borrar sus consultoras de prueba (best-effort: si una FK lo impide, se deja).
for (const cid of consultoraIds) {
  const { error } = await admin.from('consultoras').delete().eq('id', cid)
  console.log(`consultora ${cid}: ${error ? 'NO borrada (' + error.message + ')' : 'borrada'}`)
}

// Eliminar la cuenta de auth.
const { error: delErr } = await admin.auth.admin.deleteUser(uid)
if (delErr) {
  const freed = `ezequieldanza93+old-${Date.now()}@gmail.com`
  const { error: rnErr } = await admin.auth.admin.updateUserById(uid, { email: freed, email_confirm: true })
  if (rnErr) console.error(`No se pudo eliminar ni liberar el email: del=${delErr.message} / rename=${rnErr.message}`)
  else console.log(`deleteUser falló (${delErr.message}). Email LIBERADO renombrando la cuenta vieja a ${freed}. Ya podés registrar ezequieldanza93@gmail.com de cero.`)
} else {
  console.log('✅ Cuenta ezequieldanza93@gmail.com ELIMINADA. Email libre para registrar de cero.')
}

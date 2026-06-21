import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilForm } from '@/components/forms/perfil-form'
import type { MiPersona } from '@/components/perfil/mi-matricula-dni'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, persona_id')
    .eq('id', user.id)
    .single()

  // La persona del directorio vinculada al usuario logueado (puede no existir).
  // Traemos todos los campos editables porque updatePersona reescribe el registro
  // completo, y las imágenes del DNI / nº de DNI para mostrarlos en el perfil.
  const { data: personaRow } = await supabase
    .from('personas_directorio')
    .select(
      'id, nombre, apellido, tipo_id, dni, dni_frente_url, dni_dorso_url, legajo, ' +
      'fecha_nacimiento, fecha_ingreso, telefono, email, direccion, organizacion_id, notas, ' +
      'talle_calzado, talle_pantalon, talle_remera, talle_camisa, talle_buzo, talle_campera, ' +
      'beneficiario_seguro, contacto_emergencia_nombre, contacto_emergencia_telefono',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const miPersona = (personaRow as unknown as MiPersona | null) ?? null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <PerfilForm
        fullName={profile?.full_name ?? ''}
        email={user.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
        personaId={profile?.persona_id ?? null}
        miPersona={miPersona}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { ComentariosClient } from '@/components/crm/comentarios-client'

export const dynamic = 'force-dynamic'

export interface BlogComment {
  id: string
  post_slug: string
  nombre: string
  email: string
  texto: string
  aprobado: boolean
  auth_user_id: string | null
  created_at: string
}

export default async function ComentariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isCrmAdmin(user.email)) redirect('/dashboard')

  const { data, error } = await supabase
    .from('blog_comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    throw new Error(`No se pudieron cargar los comentarios: ${error.message}`)
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <ComentariosClient comentarios={(data ?? []) as BlogComment[]} />
    </div>
  )
}

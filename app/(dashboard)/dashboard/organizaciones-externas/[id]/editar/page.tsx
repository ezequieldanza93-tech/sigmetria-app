import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { updateSubcontratista } from '@/lib/actions/subcontratista'
import { SubcontratistaEditForm } from '@/components/subcontratista/subcontratista-edit-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarSubcontratistaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get subcontratista with org data
  const { data: sub } = await supabase
    .from('subcontratistas')
    .select(`
      *,
      subcontratistas_rubros!rubro_id(nombre),
      establecimientos_tipos!tipo_establecimiento_id(nombre),
      organizaciones_externas!organizacion_id(
        id, nombre, cuit, domicilio, email, telefono,
        tipo_identidad_impositiva, codigo_postal,
        localidades!localidad_id(nombre, provincia)
      )
    `)
    .eq('id', id)
    .single()

  if (!sub) notFound()

  // Load preguntas for this tipo_establecimiento
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let preguntas: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let respuestas: any[] = []

  if (sub.tipo_establecimiento_id) {
    const [{ data: preguntasData }, { data: respuestasData }] = await Promise.all([
      supabase
        .from('preguntas_tipos')
        .select(`
          pregunta_id, orden,
          riesgos_preguntas!pregunta_id(id, codigo, texto, orden, is_active)
        `)
        .eq('tipo_id', sub.tipo_establecimiento_id)
        .order('orden'),
      supabase
        .from('subcontratistas_respuestas')
        .select('pregunta_id, respuesta')
        .eq('subcontratista_id', id),
    ])

    preguntas = (preguntasData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.riesgos_preguntas)
      .filter(Boolean)
      .sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)

    respuestas = respuestasData ?? []
  }

  const updateAction = updateSubcontratista.bind(null, id)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/organizaciones-externas/${id}`}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← {sub.organizaciones_externas?.nombre ?? 'Subcontratista'}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mt-2">Editar Subcontratista</h1>
      </div>

      <div className="bg-surface-base rounded-xl border border-border-subtle p-6">
        <SubcontratistaEditForm
          action={updateAction}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sub={sub as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preguntas={preguntas as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          respuestas={respuestas as any}
        />
      </div>
    </div>
  )
}

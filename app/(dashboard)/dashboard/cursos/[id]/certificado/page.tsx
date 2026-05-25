'use client'

import { use, useState, useEffect } from 'react'
import { useCurso, useMisAsignaciones } from '@/lib/queries/curso'
import { CertificadoPreview } from '@/components/cursos/certificado-preview'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Award } from 'lucide-react'
import { useEmitirCertificado } from '@/lib/queries/curso'

export default function CertificadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cursoId } = use(params)
  const { data: curso } = useCurso(cursoId)
  const { data: asignaciones } = useMisAsignaciones()
  const emitCert = useEmitirCertificado()

  const asignacion = asignaciones?.find(a => (a as any)?.cursos?.id === cursoId)

  const [certificado, setCertificado] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!asignacion) { setLoading(false); return }
      const supabase = createClient()
      const { data } = await supabase
        .from('cursos_certificados')
        .select('*')
        .eq('asignacion_id', asignacion.id)
        .maybeSingle()
      setCertificado(data)
      setLoading(false)
    }
    load()
  }, [asignacion])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (asignacion?.estado !== 'aprobado' && !certificado) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <AlertTriangle size={40} className="mx-auto text-amber-500" />
        <h2 className="text-xl font-semibold text-text-primary">Aún no aprobaste este curso</h2>
        <p className="text-text-tertiary">Completá todas las lecciones y el quiz final para obtener tu certificado.</p>
      </div>
    )
  }

  if (!certificado) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <Award size={40} className="mx-auto text-text-tertiary" />
        <h2 className="text-xl font-semibold text-text-primary">Generando certificado...</h2>
        <button
          onClick={async () => {
            if (!asignacion) return
            try {
              await emitCert.mutateAsync(asignacion.id)
            } catch {}
          }}
          disabled={emitCert.isPending}
          className="px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {emitCert.isPending ? 'Generando...' : 'Generar certificado'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <CertificadoPreview
        pdfUrl={certificado.pdf_url}
        codigoValidacion={certificado.codigo_validacion}
        cursoTitulo={curso?.titulo ?? ''}
        personaNombre=""
        fechaEmision={certificado.fecha_emision}
        fechaVencimiento={certificado.fecha_vencimiento}
      />
    </div>
  )
}

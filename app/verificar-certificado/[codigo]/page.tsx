import { createClient } from '@/lib/supabase/server'
import { CheckCircle, XCircle, AlertTriangle, Award } from 'lucide-react'

// This page is PUBLIC — no auth required
export const dynamic = 'force-dynamic'

export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from('cursos_certificados')
    .select(`
      *,
      curso_asignaciones!asignacion_id (
        cursos!curso_id (titulo, consultora_id),
        directorio_personas!persona_id (nombre, apellido)
      )
    `)
    .eq('codigo_validacion', codigo)
    .maybeSingle()

  if (!cert || cert.invalidado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 text-center space-y-4">
          <XCircle size={48} className="mx-auto text-red-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Certificado no válido</h1>
          <p className="text-sm text-gray-500">
            El código ingresado no corresponde a un certificado válido.
          </p>
          <p className="text-xs text-gray-400 font-mono">{codigo}</p>
        </div>
      </div>
    )
  }

  const asig = (cert as any).curso_asignaciones
  if (!asig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Certificado no disponible</h1>
          <p className="text-sm text-gray-500">
            Este certificado no tiene asignación asociada.
          </p>
        </div>
      </div>
    )
  }

  const cursoData = asig.cursos
  const personaData = asig.directorio_personas
  const estaVencido = cert.fecha_vencimiento && new Date(cert.fecha_vencimiento) < new Date()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            estaVencido ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            {estaVencido ? (
              <AlertTriangle size={32} className="text-amber-600" />
            ) : (
              <CheckCircle size={32} className="text-green-600" />
            )}
          </div>

          <h1 className={`text-xl font-bold ${
            estaVencido ? 'text-amber-700' : 'text-green-700'
          }`}>
            {estaVencido ? '⚠ Certificado expirado' : '✓ Certificado válido'}
          </h1>
        </div>

        {/* Data */}
        <div className="space-y-4">
          <div className="text-center">
            <Award size={40} className="mx-auto text-brand-primary mb-2" />
            <p className="text-sm text-gray-500">Certificado otorgado a</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {personaData?.nombre} {personaData?.apellido}
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
            <DetailRow label="Curso" value={cursoData?.titulo} />
            <DetailRow label="Fecha de emisión" value={new Date(cert.fecha_emision).toLocaleDateString()} />
            {cert.fecha_vencimiento && (
              <DetailRow
                label="Válido hasta"
                value={`${new Date(cert.fecha_vencimiento).toLocaleDateString()}${estaVencido ? ' (Expirado)' : ''}`}
              />
            )}
            <DetailRow label="Código de validación" value={codigo} mono />
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Este certificado fue verificado electrónicamente en Sigmetría HyS.
          {estaVencido && ' El curso debe ser renovado.'}
        </p>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

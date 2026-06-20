import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle, XCircle, AlertTriangle, FileCheck } from 'lucide-react'

// Página PÚBLICA — sin auth. El SELECT de protocolo_verificaciones es público por RLS.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verificar protocolo',
  description: 'Verificá la autenticidad de un protocolo emitido por Sigmetría HyS.',
  robots: {
    index: true,
    follow: true,
  },
}

// ─── Tipo legible por enum de `tipo` ──────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  medicion_iluminacion: 'Medición de Iluminación',
  medicion_ruido: 'Medición de Ruido',
  medicion_pat: 'Medición de Puesta a Tierra',
  medicion_carga_termica: 'Medición de Carga Térmica',
  protocolo_ergonomia: 'Evaluación Ergonómica',
  calculo_carga_fuego: 'Cálculo de Carga de Fuego',
}

function tipoLegible(tipo: string | null | undefined): string {
  if (!tipo) return 'Protocolo'
  return TIPO_LABEL[tipo] ?? 'Protocolo'
}

/**
 * Parsea una fecha de la tabla (texto). Soporta DD/MM/YYYY (formato de emisión) e ISO.
 * Devuelve un Date válido o null.
 */
function parseFecha(raw: string | null | undefined): Date | null {
  if (!raw) return null
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(date.getTime()) ? null : date
  }
  // ISO u otro formato reconocible por Date
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export default async function VerificarProtocoloPage({
  params,
}: {
  params: Promise<{ folio: string }>
}) {
  const { folio } = await params
  const supabase = await createClient()

  const { data: prot } = await supabase
    .from('protocolo_verificaciones')
    .select('*')
    .eq('folio', folio)
    .maybeSingle()

  // ── No encontrado ───────────────────────────────────────────────────────────
  if (!prot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base dark:bg-gray-950 p-4">
        <div className="max-w-md w-full bg-surface-base dark:bg-gray-900 rounded-2xl shadow-lg border border-border-subtle dark:border-gray-800 p-8 text-center space-y-4">
          <XCircle size={48} className="mx-auto text-danger" aria-hidden="true" />
          <h1 className="text-xl font-bold text-text-primary dark:text-white">Protocolo no encontrado</h1>
          <p className="text-sm text-text-secondary">
            El folio ingresado no corresponde a un protocolo emitido por Sigmetría HyS.
          </p>
          <p className="text-xs text-text-tertiary font-mono">{folio}</p>
        </div>
      </div>
    )
  }

  const fechaVenc = parseFecha(prot.fecha_vencimiento as string | null)
  const estaVencido = fechaVenc != null && fechaVenc < new Date()

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base dark:bg-gray-950 p-4">
      <div className="max-w-md w-full bg-surface-base dark:bg-gray-900 rounded-2xl shadow-lg border border-border-subtle dark:border-gray-800 p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            estaVencido ? 'bg-amber-100' : 'bg-success-bg'
          }`}>
            {estaVencido ? (
              <AlertTriangle size={32} className="text-amber-600" aria-hidden="true" />
            ) : (
              <CheckCircle size={32} className="text-success" aria-hidden="true" />
            )}
          </div>

          <h1 className={`text-xl font-bold ${
            estaVencido ? 'text-amber-700' : 'text-success'
          }`}>
            <span aria-hidden="true">{estaVencido ? '⚠ ' : '✓ '}</span>
            {estaVencido ? 'Protocolo vencido' : 'Protocolo verificado'}
          </h1>
        </div>

        {/* Data */}
        <div className="space-y-4">
          <div className="text-center">
            <FileCheck size={40} className="mx-auto text-brand-primary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-secondary">{tipoLegible(prot.tipo as string | null)}</p>
            <p className="text-lg font-bold text-text-primary dark:text-white">
              {(prot.empresa as string | null) ?? '—'}
            </p>
          </div>

          <div className="border-t border-border-subtle dark:border-gray-700 pt-4 space-y-2">
            <DetailRow label="Establecimiento" value={(prot.establecimiento as string | null) ?? '—'} />
            <DetailRow label="Profesional" value={(prot.profesional as string | null) ?? '—'} />
            <DetailRow label="Tipo de protocolo" value={tipoLegible(prot.tipo as string | null)} />
            <DetailRow label="Fecha de ejecución" value={(prot.fecha_ejecucion as string | null) ?? '—'} />
            <DetailRow label="Fecha de emisión" value={(prot.fecha_emision as string | null) ?? '—'} />
            {prot.fecha_vencimiento && (
              <DetailRow
                label="Vence"
                value={`${prot.fecha_vencimiento as string}${estaVencido ? ' (Vencido)' : ''}`}
                amber={estaVencido}
              />
            )}
            <DetailRow label="Folio" value={folio} mono />
          </div>
        </div>

        <p className="text-xs text-text-tertiary text-center">
          Este protocolo fue verificado electrónicamente en Sigmetría HyS.
          {estaVencido && ' La vigencia del protocolo expiró.'}
        </p>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  amber = false,
}: {
  label: string
  value: string
  mono?: boolean
  amber?: boolean
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-sm text-text-secondary shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${
        amber ? 'text-amber-700' : 'text-text-primary dark:text-white'
      } ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { getProtocolosVencimientos, type ProtocoloVencimiento } from '@/lib/actions/protocolos-vencimientos'

// Color del vencimiento según proximidad (mismo criterio que el legajo de documentos).
function vencimientoClass(fecha: string | null, now: number | null): string {
  if (!fecha || now === null) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

function VencimientoCell({ fecha, now }: { fecha: string | null; now: number | null }) {
  if (!fecha) return <span className="text-xs text-text-tertiary">—</span>
  const base = formatDate(fecha)
  if (now === null) return <span className="text-xs text-text-secondary">{base}</span>
  const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
  let suffix = ''
  if (days < 0) suffix = ' · vencido'
  else if (days === 0) suffix = ' · hoy'
  else if (days <= 30) suffix = ` · ${days}d`
  return <span className={`text-xs ${vencimientoClass(fecha, now)}`}>{base}{suffix}</span>
}

export function ProtocolosVencimientos({ establecimientoId }: { establecimientoId: string }) {
  const [data, setData] = useState<ProtocoloVencimiento[] | null>(null)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    let cancelado = false
    getProtocolosVencimientos(establecimientoId)
      .then((res) => {
        if (cancelado) return
        setData(res.success ? res.data : [])
      })
      .catch(() => {
        if (!cancelado) setData([])
      })
    return () => {
      cancelado = true
    }
  }, [establecimientoId])

  const cargando = data === null
  const total = data?.length ?? 0

  return (
    <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <h4 className="text-sm font-semibold text-text-primary dark:text-white">Protocolos de medición</h4>
        <span className="text-xs text-text-tertiary dark:text-white bg-surface-elevated dark:bg-surface-base rounded-full px-2 py-0.5">{total}</span>
      </div>
      {cargando ? (
        <p className="text-xs text-text-tertiary px-4 py-3">Cargando…</p>
      ) : total === 0 ? (
        <p className="text-xs text-text-tertiary px-4 py-3">Sin protocolos de medición finalizados.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
            <tr className="text-left">
              <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Protocolo</th>
              <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Medición</th>
              <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">Vencimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
            {data!.map((p) => (
              <tr key={`${p.tipo}-${p.id}`} className="hover:bg-surface-base">
                <td className="px-4 py-3 font-medium text-text-primary dark:text-white text-sm">{p.tipo}</td>
                <td className="px-4 py-3 text-xs text-text-secondary">{p.fecha_medicion ? formatDate(p.fecha_medicion) : '—'}</td>
                <td className="px-4 py-3"><VencimientoCell fecha={p.fecha_vencimiento} now={now} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

'use client'

import { usePagos } from '@/lib/queries/mercadopago'
import { Card } from '@/components/ui/card'
import { Loader2, ExternalLink } from 'lucide-react'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

const ESTADO_LABELS: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
}

const ESTADO_COLORS: Record<string, string> = {
  approved: 'text-green-600 bg-green-50',
  pending: 'text-yellow-600 bg-yellow-50',
  rejected: 'text-red-600 bg-red-50',
  refunded: 'text-gray-600 bg-gray-50',
}

export function HistorialPagos() {
  const { data: pagos, isLoading, error: queryError } = usePagos()

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
        </div>
      </Card>
    )
  }

  if (queryError) {
    return (
      <Card>
        <p className="text-sm text-red-600">Error al cargar pagos</p>
      </Card>
    )
  }

  if (!pagos || pagos.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-tertiary">No hay pagos registrados.</p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-text-primary mb-4">Historial de pagos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left py-2 pr-4 text-text-tertiary font-medium">Fecha</th>
              <th className="text-left py-2 pr-4 text-text-tertiary font-medium">Monto</th>
              <th className="text-left py-2 pr-4 text-text-tertiary font-medium">Estado</th>
              <th className="text-left py-2 pr-4 text-text-tertiary font-medium">Método</th>
              <th className="text-left py-2 text-text-tertiary font-medium">Comprobante</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((pago) => (
              <tr key={pago.id} className="border-b border-border-subtle last:border-0">
                <td className="py-3 pr-4 text-text-primary">{formatFecha(pago.fecha)}</td>
                <td className="py-3 pr-4 text-text-primary font-medium">
                  {formatARS(pago.monto_total)}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[pago.estado] ?? ''}`}>
                    {ESTADO_LABELS[pago.estado] ?? pago.estado}
                  </span>
                </td>
                <td className="py-3 pr-4 text-text-secondary">{pago.metodo ?? '—'}</td>
                <td className="py-3">
                  {pago.receipt_url ? (
                    <a
                      href={pago.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver
                    </a>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

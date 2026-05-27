'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-brand-primary text-white hover:opacity-90 transition-opacity shadow-lg"
    >
      Imprimir reporte
    </button>
  )
}

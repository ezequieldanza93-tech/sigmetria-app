import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <h1 className="text-6xl font-bold text-sig-500 mb-4">404</h1>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Página no encontrada</h2>
        <p className="text-sm text-text-tertiary mb-6">La página que buscás no existe o fue movida.</p>
        <Link
          href="/dashboard/empresas"
          className="inline-block text-sm font-medium text-white bg-sig-600 hover:bg-sig-700 rounded-lg px-4 py-2 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}

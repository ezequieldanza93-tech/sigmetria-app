'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-xl font-bold">!</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Algo salió mal</h2>
        <p className="text-sm text-gray-500 mb-6">{error.message || 'Ocurrió un error inesperado.'}</p>
        <button
          onClick={reset}
          className="text-sm font-medium text-white bg-sig-600 hover:bg-sig-700 rounded-lg px-4 py-2 transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}

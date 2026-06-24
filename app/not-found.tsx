// NO usar `next/link` acá. La combinación de `notFound()` en un Server Component
// suspendido/interleaved (p. ej. el layout de establecimiento, que llama notFound()
// dentro de un <Suspense>) + un boundary not-found que renderiza <Link> dispara en
// producción el React error #310 ("Rendered more/fewer hooks than the previous render")
// por un bug del App Router de Next (vercel/next.js#63121, dups #63388/#78396).
// Un <a> plano (navegación completa) corta la cadena del trigger y es correcto en una 404.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <h1 className="text-6xl font-bold text-sig-500 mb-4">404</h1>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Página no encontrada</h2>
        <p className="text-sm text-text-tertiary mb-6">La página que buscás no existe o fue movida.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- <a> intencional: ver nota arriba (React #310 / next#63121) */}
        <a
          href="/dashboard/empresas"
          className="inline-block text-sm font-medium text-white bg-sig-600 hover:bg-sig-700 rounded-lg px-4 py-2 transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  )
}

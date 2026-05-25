'use client'

import { Download, ExternalLink } from 'lucide-react'

interface CertificadoPreviewProps {
  pdfUrl: string | null
  codigoValidacion: string
  cursoTitulo: string
  personaNombre: string
  fechaEmision: string
  fechaVencimiento: string | null
}

export function CertificadoPreview({ pdfUrl, codigoValidacion, cursoTitulo, personaNombre, fechaEmision, fechaVencimiento }: CertificadoPreviewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">Tu certificado</h1>
        <p className="text-text-tertiary">Curso: {cursoTitulo}</p>
      </div>

      {/* Certificado preview card */}
      <div className="relative p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-2 border-brand-primary/30 rounded-2xl shadow-lg">
        <div className="text-center space-y-4">
          {/* Logo */}
          <div className="flex justify-center">
            <svg viewBox="0 0 48 52" height="40" aria-hidden="true">
              <polygon points="24,2 2,50 24,50" fill="#4CAF50" />
              <polygon points="24,2 46,50 24,50" fill="none" stroke="#ccc" strokeWidth="2" />
            </svg>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-text-tertiary font-semibold">Sigmetría HyS</p>
            <h2 className="text-2xl font-bold text-text-primary mt-2">CERTIFICADO</h2>
          </div>

          <p className="text-text-secondary">
            Otorgado a
          </p>

          <p className="text-3xl font-bold text-brand-primary">
            {personaNombre}
          </p>

          <p className="text-text-secondary">
            Por haber completado satisfactoriamente el curso
          </p>

          <p className="text-xl font-semibold text-text-primary">
            {cursoTitulo}
          </p>

          <div className="flex items-center justify-center gap-8 text-sm text-text-tertiary">
            <div>
              <p className="font-medium text-text-secondary">Fecha de emisión</p>
              <p>{new Date(fechaEmision).toLocaleDateString()}</p>
            </div>
            {fechaVencimiento && (
              <div>
                <p className="font-medium text-text-secondary">Válido hasta</p>
                <p>{new Date(fechaVencimiento).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Código de validación */}
          <div className="pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-tertiary">Código de validación</p>
            <p className="text-sm font-mono font-bold text-text-primary">{codigoValidacion}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Download size={18} />
            Descargar PDF
          </a>
        ) : (
          <p className="text-sm text-text-tertiary">El PDF del certificado estará disponible pronto.</p>
        )}

        <a
          href={`/verificar-certificado/${codigoValidacion}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary border border-border-subtle rounded-lg transition-colors"
        >
          <ExternalLink size={16} />
          Verificar certificado
        </a>
      </div>
    </div>
  )
}

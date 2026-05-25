'use client'

import { useState } from 'react'
import { Upload, Search } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { importarAsignacionesCSV } from '@/lib/actions/curso'
import { AsignacionMasivaModal } from '@/components/cursos/asignacion-masiva-modal'

interface EditorAsignacionMasivaProps {
  cursoId: string
  onRefresh: () => void
}

export function EditorAsignacionMasiva({ cursoId, onRefresh }: EditorAsignacionMasivaProps) {
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await importarAsignacionesCSV(cursoId, fd)
      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success(`${res.data.creadas} asignaciones creadas, ${res.data.fallidas} fallidas`)
        onRefresh()
      }
    } catch {
      toast.error('Error al importar CSV')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Asignación masiva por criterios */}
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-2">Asignación por criterios</h4>
        <p className="text-sm text-text-tertiary mb-4">
          Asigná este curso a trabajadores según empresa, establecimiento, sector o puesto.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Search size={16} />
          Asignar por criterios
        </button>
      </div>

      {/* Importación CSV */}
      <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
        <h4 className="text-sm font-semibold text-text-primary mb-2">Importación CSV</h4>
        <p className="text-sm text-text-tertiary mb-4">
            Subí un archivo CSV con columnas <code className="text-brand-primary">dni</code> o <code className="text-brand-primary">email</code> para asignar masivamente.
        </p>
        <label className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border-subtle rounded-lg cursor-pointer hover:border-brand-primary/50 transition-colors ${importing ? 'opacity-50' : ''}`}>
          <Upload size={16} className="text-text-tertiary" />
          <span className="text-sm text-text-tertiary">
            {importing ? 'Importando...' : 'Seleccionar archivo CSV'}
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {showModal && (
        <AsignacionMasivaModal
          cursoId={cursoId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  tabla_nombre: string
  accion: 'INSERT' | 'UPDATE' | 'DELETE'
  registro_id: string
  user_id: string | null
  datos_antes: Record<string, unknown> | null
  datos_nuevo: Record<string, unknown> | null
  created_at: string
  profiles: { full_name: string } | null
}

interface Props {
  tabla: string
  registroId: string
}

// ── Helpers ────────────────────────────────────────────────────

const EXCLUDED_FIELDS = new Set(['updated_at', 'created_at'])

const ACCION_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  INSERT: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
}

const ACCION_LABEL: Record<string, string> = {
  INSERT: 'Creación',
  UPDATE: 'Edición',
  DELETE: 'Eliminación',
}

function formatAR(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ campo: string; antes: string; nuevo: string }> {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  return [...keys]
    .filter(k => !EXCLUDED_FIELDS.has(k))
    .filter(k => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]))
    .map(k => ({
      campo: k,
      antes: formatValue((before ?? {})[k]),
      nuevo: formatValue((after ?? {})[k]),
    }))
}

// ── Component ──────────────────────────────────────────────────

export function AuditLog({ tabla, registroId }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function handleToggle() {
    if (!open && entries === null) {
      setLoading(true)
      setFetchError(null)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('audit_log')
          .select('id, tabla_nombre, accion, registro_id, user_id, datos_antes, datos_nuevo, created_at, profiles(full_name)')
          .eq('tabla_nombre', tabla)
          .eq('registro_id', registroId)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        setEntries((data ?? []) as unknown as AuditEntry[])
      } catch {
        setFetchError('No se pudo cargar el historial de cambios.')
      } finally {
        setLoading(false)
      }
    }
    setOpen(prev => !prev)
  }

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 text-left',
          'bg-surface-base hover:bg-surface-elevated transition-colors',
          'text-text-secondary text-sm font-medium',
        )}
        aria-expanded={open}
      >
        <History size={15} className="text-text-tertiary shrink-0" />
        <span className="flex-1">Historial de cambios</span>
        {open
          ? <ChevronDown size={15} className="text-text-tertiary shrink-0" />
          : <ChevronRight size={15} className="text-text-tertiary shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border-subtle">
          {loading && (
            <p className="px-4 py-6 text-xs text-text-tertiary text-center">
              Cargando historial…
            </p>
          )}

          {fetchError && (
            <p className="px-4 py-6 text-xs text-danger text-center">{fetchError}</p>
          )}

          {!loading && !fetchError && entries !== null && entries.length === 0 && (
            <p className="px-4 py-6 text-xs text-text-tertiary text-center">
              Sin registros de cambios aún.
            </p>
          )}

          {!loading && !fetchError && entries && entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-base border-b border-border-subtle">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap">
                      Fecha / hora
                    </th>
                    <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">
                      Acción
                    </th>
                    <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">
                      Usuario
                    </th>
                    <th className="px-4 py-2.5 text-text-secondary font-medium text-xs">
                      Cambios
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {entries.map(entry => {
                    const diff = computeDiff(entry.datos_antes, entry.datos_nuevo)
                    return (
                      <tr key={entry.id} className="hover:bg-surface-base align-top">
                        <td className="px-4 py-3 text-xs text-text-tertiary whitespace-nowrap">
                          {formatAR(entry.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ACCION_VARIANT[entry.accion] ?? 'default'}>
                            {ACCION_LABEL[entry.accion] ?? entry.accion}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-primary whitespace-nowrap">
                          {entry.profiles?.full_name ?? 'Sistema'}
                        </td>
                        <td className="px-4 py-3">
                          {diff.length === 0 ? (
                            <span className="text-xs text-text-tertiary">
                              {entry.accion === 'INSERT' ? 'Registro creado' : 'Sin diferencias detectadas'}
                            </span>
                          ) : (
                            <ul className="space-y-0.5">
                              {diff.map(({ campo, antes, nuevo }) => (
                                <li key={campo} className="text-xs text-text-secondary">
                                  <span className="font-medium text-text-primary">{campo}</span>
                                  {': '}
                                  <span className="text-danger line-through">{antes}</span>
                                  {' → '}
                                  <span className="text-success">{nuevo}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

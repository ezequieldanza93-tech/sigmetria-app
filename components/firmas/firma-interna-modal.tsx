'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFirmarGestion } from '@/lib/queries/firmas'
import { createClient } from '@/lib/supabase/client'
import { PenLine, Loader2, FileText, Clock } from 'lucide-react'

interface FirmaInternaModalProps {
  open: boolean
  onClose: () => void
  gestionNombre: string
  gestionEstablecimientoId: string
  onSuccess: () => void
}

const ROLE_MAP: Record<string, string> = {
  full_access_main: 'Admin Principal',
  full_access_branch: 'Admin Branch',
  colaborador: 'Colaborador',
  full_viewer: 'Viewer Global',
  colaborador_viewer: 'Viewer Limitado',
}

export function FirmaInternaModal({
  open,
  onClose,
  gestionNombre,
  gestionEstablecimientoId,
  onSuccess,
}: FirmaInternaModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const firmarMutation = useFirmarGestion()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      ]).then(([profileRes, memberRes]) => {
        const p = profileRes.data as { full_name: string } | null
        const m = memberRes.data as { role: string } | null
        setUserName(p?.full_name ?? 'Usuario')
        setUserRole(m?.role ?? null)
        setLoading(false)
      })
    })
  }, [open])

  async function handleConfirmar() {
    setError(null)
    try {
      await firmarMutation.mutateAsync(gestionEstablecimientoId)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al firmar')
    }
  }

  const now = new Date()
  const fechaHora = now.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const roleLabel = userRole ? (ROLE_MAP[userRole] ?? userRole) : null

  return (
    <Modal open={open} onClose={onClose} title="Confirmar Firma Electrónica">
      <div className="space-y-4">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-surface-base rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <FileText size={16} />
            <span>Gestión: <strong className="text-text-primary">{gestionNombre}</strong></span>
          </div>

          <div className="border-t border-border-subtle pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <PenLine size={16} className="text-text-tertiary" />
              <span className="text-text-secondary">Firmante:</span>
              {loading ? (
                <Loader2 size={14} className="animate-spin text-text-tertiary" />
              ) : (
                <span className="font-medium text-text-primary">{userName}</span>
              )}
            </div>
            {!loading && roleLabel && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="info" className="text-xs">{roleLabel}</Badge>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock size={16} />
              <span>{fechaHora}</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Al confirmar, se registrará tu firma electrónica con fecha y hora. Esta acción quedará registrada en la auditoría del sistema.
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            onClick={handleConfirmar}
            disabled={firmarMutation.isPending || loading}
          >
            {firmarMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Firmando…</>
            ) : (
              <><PenLine size={16} /> Confirmar Firma</>
            )}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={firmarMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

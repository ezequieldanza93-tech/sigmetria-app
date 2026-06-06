'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShortcutAction } from '@/lib/contexts/shortcuts-context'
import { useNavigationLevel } from '@/lib/hooks/use-navigation-level'
import { Modal } from '@/components/ui/modal'
import { EmpresaEstablecimientoPicker } from '@/components/empresa-establecimiento-picker'

type LauncherAction = 'plan-gestion' | 'open-reporte-fotografico'

const ACTION_TITLES: Record<LauncherAction, string> = {
  'plan-gestion': 'Planificar gestión',
  'open-reporte-fotografico': 'Reporte fotográfico',
}

/**
 * Único suscriptor GLOBAL de los eventos 'plan-gestion' y
 * 'open-reporte-fotografico'. Resuelve el establecimiento destino según el
 * nivel de navegación y navega a la agenda con ?action=... para que
 * GestionesAgenda abra el modal correspondiente.
 *
 * - establecimiento: navega directo.
 * - empresa: pide establecimiento (empresa bloqueada).
 * - consultora: pide empresa + establecimiento (cascada).
 */
export function GestionLauncher() {
  const router = useRouter()
  const { level, empresaId, establecimientoId } = useNavigationLevel()
  const [pendingAction, setPendingAction] = useState<LauncherAction | null>(null)

  function navigateTo(empId: string, estId: string, action: LauncherAction) {
    router.push(
      `/dashboard/empresas/${empId}/establecimientos/${estId}?section=agenda&action=${action}`,
    )
  }

  function handle(action: LauncherAction) {
    if (level === 'establecimiento' && empresaId && establecimientoId) {
      navigateTo(empresaId, establecimientoId, action)
      return
    }
    // empresa o consultora → abrir picker
    setPendingAction(action)
  }

  useShortcutAction('plan-gestion', () => handle('plan-gestion'))
  useShortcutAction('open-reporte-fotografico', () => handle('open-reporte-fotografico'))

  if (!pendingAction) return null

  // Nivel empresa → empresa bloqueada, solo pedimos establecimiento.
  // Nivel consultora → cascada completa.
  const lockEmpresa = level === 'empresa'

  return (
    <Modal
      open
      title={ACTION_TITLES[pendingAction]}
      onClose={() => setPendingAction(null)}
    >
      <EmpresaEstablecimientoPicker
        initialEmpresaId={lockEmpresa ? empresaId : null}
        lockEmpresa={lockEmpresa}
        onPick={(empId, estId) => {
          const action = pendingAction
          setPendingAction(null)
          navigateTo(empId, estId, action)
        }}
      />
    </Modal>
  )
}

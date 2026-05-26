export type ShortcutAction =
  | 'plan-gestion'
  | 'open-reporte-fotografico'
  | 'goto-gestiones'
  | 'goto-seguimientos'
  | 'goto-dashboard'
  | 'open-sigia'
  | 'open-avatar-menu'
  | 'undo'
  | 'redo'

export type ShortcutCategory = 'Navegación' | 'Gestión' | 'Observaciones' | 'SIGIA' | 'Sistema'

export interface ShortcutDef {
  action: ShortcutAction
  /** Lowercase normalized combo, e.g. "ctrl+shift+p" */
  keys: string
  /** Display parts for rendering keyboard keys, e.g. ["Ctrl", "Shift", "P"] */
  keysDisplay: string[]
  label: string
  description: string
  category: ShortcutCategory
  /** Only works when a specific view is mounted */
  contextual?: boolean
  /** Warning or note shown in the reference page */
  note?: string
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // ── Navegación ───────────────────────────────────────────────
  {
    action: 'goto-dashboard',
    keys: 'ctrl+shift+d',
    keysDisplay: ['Ctrl', 'Shift', 'D'],
    label: 'Ir al Dashboard',
    description: 'Navegar a la pantalla principal de empresas',
    category: 'Navegación',
  },
  {
    action: 'goto-gestiones',
    keys: 'ctrl+shift+g',
    keysDisplay: ['Ctrl', 'Shift', 'G'],
    label: 'Ir a Gestiones',
    description: 'Cambiar a la vista de gestiones del establecimiento activo',
    category: 'Navegación',
    contextual: true,
  },
  {
    action: 'goto-seguimientos',
    keys: 'ctrl+shift+s',
    keysDisplay: ['Ctrl', 'Shift', 'S'],
    label: 'Ir a Seguimientos',
    description: 'Cambiar a la vista de seguimientos del establecimiento activo',
    category: 'Navegación',
    contextual: true,
  },
  // ── Gestión ──────────────────────────────────────────────────
  {
    action: 'plan-gestion',
    keys: 'ctrl+shift+p',
    keysDisplay: ['Ctrl', 'Shift', 'P'],
    label: 'Planificar Gestión',
    description: 'Abrir el modal de planificación de nueva gestión',
    category: 'Gestión',
    contextual: true,
  },
  // ── Observaciones ────────────────────────────────────────────
  {
    action: 'open-reporte-fotografico',
    keys: 'ctrl+shift+f',
    keysDisplay: ['Ctrl', 'Shift', 'F'],
    label: 'Reporte Fotográfico',
    description: 'Abrir el flujo de reporte fotográfico de campo',
    category: 'Observaciones',
    contextual: true,
  },
  // ── SIGIA ────────────────────────────────────────────────────
  {
    action: 'open-sigia',
    keys: 'ctrl+shift+i',
    keysDisplay: ['Ctrl', 'Shift', 'I'],
    label: 'Abrir SIGIA',
    description: 'Abrir el asistente de inteligencia artificial',
    category: 'SIGIA',
    note: 'Puede conflictuar con DevTools del navegador en algunos entornos',
  },
  // ── Sistema ──────────────────────────────────────────────────
  {
    action: 'open-avatar-menu',
    keys: 'ctrl+shift+a',
    keysDisplay: ['Ctrl', 'Shift', 'A'],
    label: 'Menú de cuenta',
    description: 'Desplegar el menú de la consultora y cuenta de usuario',
    category: 'Sistema',
  },
  {
    action: 'undo',
    keys: 'ctrl+shift+z',
    keysDisplay: ['Ctrl', 'Shift', 'Z'],
    label: 'Deshacer navegación',
    description: 'Volver a la vista anterior (hasta 5 pasos)',
    category: 'Sistema',
  },
  {
    action: 'redo',
    keys: 'ctrl+shift+y',
    keysDisplay: ['Ctrl', 'Shift', 'Y'],
    label: 'Rehacer navegación',
    description: 'Avanzar a la vista siguiente del historial',
    category: 'Sistema',
  },
]

/** Normalized key combo → ShortcutAction */
export const SHORTCUT_KEY_MAP: Record<string, ShortcutAction> = Object.fromEntries(
  SHORTCUT_DEFS.map(d => [d.keys, d.action]),
)

/** ShortcutAction → ShortcutDef */
export const SHORTCUT_ACTION_MAP: Record<ShortcutAction, ShortcutDef> = Object.fromEntries(
  SHORTCUT_DEFS.map(d => [d.action, d]),
) as Record<ShortcutAction, ShortcutDef>

/** All categories in display order */
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  'Navegación',
  'Gestión',
  'Observaciones',
  'SIGIA',
  'Sistema',
]

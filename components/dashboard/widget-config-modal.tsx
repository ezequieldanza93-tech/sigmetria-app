'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { ALL_WIDGETS, type WidgetKey, WIDGET_KEYS } from '@/lib/constants'
import { useVisibleWidgetKeys, useSaveUserWidgetConfig } from '@/lib/queries/dashboard'
import { cn } from '@/lib/utils'

interface WidgetConfigModalProps {
  open: boolean
  onClose: () => void
}

export function WidgetConfigModal({ open, onClose }: WidgetConfigModalProps) {
  const { widgetKeys: visibleKeys, isLoading } = useVisibleWidgetKeys()
  const saveConfig = useSaveUserWidgetConfig()
  const [selected, setSelected] = useState<Set<WidgetKey>>(new Set())

  useEffect(() => {
    if (open) {
      setSelected(new Set(visibleKeys))
    }
  }, [open, visibleKeys])

  function toggle(key: WidgetKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleSave() {
    const widgets = WIDGET_KEYS.map((key, i) => ({
      widget_key: key,
      visible: selected.has(key),
      position: i,
    }))
    await saveConfig.mutateAsync(widgets)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar Dashboard" size="default">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto -mx-2 px-2">
          {WIDGET_KEYS.map(key => {
            const widget = ALL_WIDGETS[key]
            const isSelected = selected.has(key)
            return (
              <label
                key={key}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                  isSelected ? 'bg-brand-primary/5' : 'hover:bg-surface-sunken',
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(key)}
                  className="w-4 h-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">{widget.label}</div>
                  <div className="text-xs text-text-tertiary truncate">{widget.description}</div>
                </div>
              </label>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saveConfig.isPending}
        >
          {saveConfig.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  )
}

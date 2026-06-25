'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { banderaClase } from '@/lib/paises'

/**
 * Input de teléfono reutilizable.
 *
 * El usuario escribe SOLO el número con código de área (ej. "11 1234-5678"),
 * sin el prefijo de país — ese lo aporta el selector de bandera. El componente
 * mantiene un <input type="hidden"> con el `name` recibido cuyo value es el
 * número COMPLETO en formato internacional (solo dígitos y el "+",
 * ej. "+541112345678"), de modo que las server actions que hacen
 * `formData.get('telefono')` siguen funcionando sin cambios.
 *
 * El input visible (type="tel") NO lleva `name` para no duplicar en el FormData.
 */

interface PaisTelefono {
  /** ISO 3166-1 alpha-2 en minúscula, para flag-icons (ej. 'ar'). */
  iso: string
  /** Nombre visible. */
  nombre: string
  /** Código de marcación sin el '+', en dígitos (ej. '54'). */
  dial: string
}

// Argentina primero (default). El resto en el orden pedido por negocio.
const PAISES: readonly PaisTelefono[] = [
  { iso: 'ar', nombre: 'Argentina', dial: '54' },
  { iso: 'uy', nombre: 'Uruguay', dial: '598' },
  { iso: 'cl', nombre: 'Chile', dial: '56' },
  { iso: 'py', nombre: 'Paraguay', dial: '595' },
  { iso: 'br', nombre: 'Brasil', dial: '55' },
  { iso: 'bo', nombre: 'Bolivia', dial: '591' },
  { iso: 'pe', nombre: 'Perú', dial: '51' },
  { iso: 'mx', nombre: 'México', dial: '52' },
  { iso: 'es', nombre: 'España', dial: '34' },
  { iso: 'us', nombre: 'Estados Unidos', dial: '1' },
] as const

const DEFAULT_PAIS = PAISES[0] // Argentina

/** Solo dígitos. */
function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Parsea un defaultValue en formato internacional (+54...) y devuelve el país
 * preseleccionado + el número local (sin el código de país, en dígitos).
 *
 * Estrategia: normalizar a dígitos, anteponer el '+' si venía, y buscar el país
 * cuyo `dial` sea prefijo de los dígitos. Para evitar colisiones (ej. '1' de US
 * vs '595' de Paraguay) se prueban los dial más largos primero.
 */
function parseDefault(raw: string | undefined): { pais: PaisTelefono; local: string } {
  if (!raw) return { pais: DEFAULT_PAIS, local: '' }

  const tieneMas = raw.trim().startsWith('+')
  const digitos = soloDigitos(raw)
  if (!digitos) return { pais: DEFAULT_PAIS, local: '' }

  // Solo intentamos descomponer si venía con '+' (formato internacional explícito).
  // Sin '+' asumimos que ya es número local del país por defecto.
  if (tieneMas) {
    const candidatos = [...PAISES].sort((a, b) => b.dial.length - a.dial.length)
    for (const pais of candidatos) {
      if (digitos.startsWith(pais.dial)) {
        return { pais, local: digitos.slice(pais.dial.length) }
      }
    }
    // Internacional pero país no listado: lo dejamos en el default y mostramos
    // los dígitos tal cual (mejor que perder el dato).
    return { pais: DEFAULT_PAIS, local: digitos }
  }

  return { pais: DEFAULT_PAIS, local: digitos }
}

export interface PhoneInputProps {
  /** Name del <input hidden> que viaja en el FormData. Default: 'telefono'. */
  name?: string
  /** Valor inicial. Si viene en formato +54..., se parsea país + número local. */
  defaultValue?: string
  /**
   * Modo controlado: valor completo en formato internacional (+54...).
   * Si se pasa junto con `onChange`, el componente NO usa FormData: el padre
   * es dueño del estado y recibe el valor por callback. El hidden input deja
   * de emitirse para no duplicar el dato.
   */
  value?: string
  /** Callback del modo controlado. Recibe el valor completo (+54... o ''). */
  onChange?: (value: string) => void
  /** Marca el campo visible como requerido (label con * y validación nativa). */
  required?: boolean
  /** Etiqueta visible asociada al input. */
  label?: string
  /** Placeholder del input visible. Default: '11 1234-5678'. */
  placeholder?: string
  /** id del input visible (para asociar el label). Default derivado de `name`. */
  id?: string
}

export function PhoneInput({
  name = 'telefono',
  defaultValue,
  value,
  onChange,
  required,
  label,
  placeholder = '11 1234-5678',
  id,
}: PhoneInputProps) {
  const controlled = onChange !== undefined
  // En modo controlado parseamos el `value` del padre; en no controlado el inicial.
  const parsed = useMemo(
    () => parseDefault(controlled ? value : defaultValue),
    [controlled, value, defaultValue],
  )

  const [paisIso, setPaisIso] = useState(parsed.pais.iso)
  const [local, setLocal] = useState(parsed.local)
  const [open, setOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputId = id ?? `phone-${name}`
  const listboxId = `${inputId}-listbox`

  const pais = useMemo(
    () => PAISES.find(p => p.iso === paisIso) ?? DEFAULT_PAIS,
    [paisIso],
  )

  // Valor que viaja en el FormData: '+' + dial + dígitos del número local.
  // Si no hay número, queda vacío (no mandamos un '+54' suelto sin teléfono).
  const valorCompleto = useMemo(() => {
    const localDigitos = soloDigitos(local)
    if (!localDigitos) return ''
    return `+${pais.dial}${localDigitos}`
  }, [pais.dial, local])

  // Modo controlado: avisar al padre cuando cambia el valor completo (país o número).
  useEffect(() => {
    if (controlled && onChange && valorCompleto !== value) {
      onChange(valorCompleto)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorCompleto, controlled])

  // Cerrar el dropdown al click afuera.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Al abrir, enfocar el país seleccionado para navegación por teclado.
  useEffect(() => {
    if (!open || !listRef.current) return
    const selected = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]')
    selected?.focus()
  }, [open])

  function selectPais(iso: string) {
    setPaisIso(iso)
    setOpen(false)
    // Devolver foco al input para seguir escribiendo el número.
    requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`)?.focus()
    })
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function onOptionKeyDown(e: React.KeyboardEvent<HTMLLIElement>, idx: number) {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    if (!items) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[Math.max(idx - 1, 0)]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectPais(PAISES[idx].iso)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}

      {/* Valor real para la server action (solo en modo FormData): dígitos y '+'. */}
      {!controlled && <input type="hidden" name={name} value={valorCompleto} />}

      <div ref={containerRef} className="relative">
        <div
          className={cn(
            'flex w-full items-stretch rounded-lg border border-border-default bg-surface-base',
            'focus-within:ring-2 focus-within:ring-[var(--brand-primary)] focus-within:border-transparent',
          )}
        >
          {/* Selector de país */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            onKeyDown={onTriggerKeyDown}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label={`Código de país: ${pais.nombre} (+${pais.dial})`}
            className={cn(
              'flex items-center gap-1.5 rounded-l-lg border-r border-border-default px-3 py-2',
              'text-sm text-text-primary hover:bg-surface-sunken',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:rounded-l-lg',
            )}
          >
            <span className={cn(banderaClase(pais.iso), 'text-base leading-none')} aria-hidden="true" />
            <span className="tabular-nums text-text-secondary">+{pais.dial}</span>
            <ChevronDown
              className={cn('h-4 w-4 text-text-tertiary transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {/* Número local (área + número). NO lleva name: no duplica en FormData. */}
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            value={local}
            onChange={e => setLocal(e.target.value)}
            placeholder={placeholder}
            aria-describedby={`${inputId}-help`}
            className={cn(
              'min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-tertiary focus:outline-none',
            )}
          />
        </div>

        {open && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Seleccionar país"
            className={cn(
              'absolute z-50 mt-1 max-h-64 w-72 overflow-auto rounded-lg border border-border-default bg-surface-base py-1 shadow-lg',
            )}
          >
            {PAISES.map((p, idx) => {
              const selected = p.iso === paisIso
              return (
                <li
                  key={p.iso}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => selectPais(p.iso)}
                  onKeyDown={e => onOptionKeyDown(e, idx)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-text-primary',
                    'hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none',
                    selected && 'bg-surface-sunken',
                  )}
                >
                  <span className={cn(banderaClase(p.iso), 'text-base leading-none')} aria-hidden="true" />
                  <span className="flex-1">{p.nombre}</span>
                  <span className="tabular-nums text-text-tertiary">+{p.dial}</span>
                  {selected && <Check className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p id={`${inputId}-help`} className="text-xs text-text-tertiary">
        Ingresá el código de área y el número, sin el código de país.
      </p>
    </div>
  )
}

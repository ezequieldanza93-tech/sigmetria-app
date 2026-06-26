'use client'

import { useState, useTransition } from 'react'
import {
  Loader2,
  Check,
  Globe,
  CreditCard,
  BarChart3,
  Activity,
  Save,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { upsertFinConfig } from '@/lib/actions/finanzas-config'
import { formatMonto } from '@/lib/finanzas/format'
import { toast } from '@/lib/hooks/use-toast'
import type { FinConfig } from '@/lib/finanzas/types'

interface ConfigFinanzasFormProps {
  /** Config actual (o defaults si nunca se guardó). */
  config: FinConfig
  /** true si la fila fin_config ya existe en la base (vs. defaults sin persistir). */
  yaConfigurada: boolean
}

/**
 * Monedas y locales más comunes para la región. NO acotamos la moneda real:
 * el módulo es multi-país, así que ofrecemos atajos pero permitimos teclear
 * cualquier ISO 4217 / BCP 47 vía el campo "Otra…".
 */
const MONEDAS_SUGERIDAS: { value: string; label: string }[] = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'UYU', label: 'Peso uruguayo (UYU)' },
  { value: 'CLP', label: 'Peso chileno (CLP)' },
  { value: 'BRL', label: 'Real brasileño (BRL)' },
  { value: 'PYG', label: 'Guaraní paraguayo (PYG)' },
  { value: 'BOB', label: 'Boliviano (BOB)' },
  { value: 'PEN', label: 'Sol peruano (PEN)' },
  { value: 'COP', label: 'Peso colombiano (COP)' },
  { value: 'MXN', label: 'Peso mexicano (MXN)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]

const LOCALES_SUGERIDOS: { value: string; label: string }[] = [
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-UY', label: 'Español (Uruguay)' },
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-PY', label: 'Español (Paraguay)' },
  { value: 'es-BO', label: 'Español (Bolivia)' },
  { value: 'es-PE', label: 'Español (Perú)' },
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'pt-BR', label: 'Portugués (Brasil)' },
  { value: 'en-US', label: 'Inglés (EE.UU.)' },
]

const OTRO = '__otro__'

/** Si el valor no está entre los sugeridos, arrancamos en modo "Otra…". */
function initialSelectMode(actual: string, sugeridos: { value: string }[]): string {
  return sugeridos.some((s) => s.value === actual) ? actual : OTRO
}

function Campo({
  icon,
  titulo,
  ayuda,
  children,
}: {
  icon: React.ReactNode
  titulo: string
  ayuda: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr] sm:items-start py-4 first:pt-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{titulo}</p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{ayuda}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

export function ConfigFinanzasForm({ config, yaConfigurada }: ConfigFinanzasFormProps) {
  // — Moneda / región —
  const [pais, setPais] = useState(config.pais)
  const [monedaSel, setMonedaSel] = useState(initialSelectMode(config.moneda, MONEDAS_SUGERIDAS))
  const [monedaLibre, setMonedaLibre] = useState(config.moneda)
  const [localeSel, setLocaleSel] = useState(initialSelectMode(config.locale, LOCALES_SUGERIDOS))
  const [localeLibre, setLocaleLibre] = useState(config.locale)

  // Valor efectivo (lo que se guarda y con lo que previsualizamos).
  const moneda = (monedaSel === OTRO ? monedaLibre : monedaSel).trim().toUpperCase()
  const locale = (localeSel === OTRO ? localeLibre : localeSel).trim()

  // — Parámetros financieros (string para inputs vacíos; se parsean al guardar) —
  const [ivaTasa, setIvaTasa] = useState(String(config.iva_tasa ?? ''))
  const [costoKm, setCostoKm] = useState(config.costo_km != null ? String(config.costo_km) : '')
  const [costoHora, setCostoHora] = useState(
    config.costo_hora != null ? String(config.costo_hora) : '',
  )
  const [vidaUtil, setVidaUtil] = useState(String(config.vida_util_meses_def ?? ''))

  const [pending, startTransition] = useTransition()
  const [guardado, setGuardado] = useState(false)

  function toNumOrNull(v: string): number | null {
    const t = v.trim()
    if (t === '') return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardado(false)

    const monedaTrim = moneda
    const localeTrim = locale
    if (!monedaTrim) {
      toast.error('Ingresá un código de moneda (ej. ARS, USD)')
      return
    }
    if (!localeTrim) {
      toast.error('Ingresá un formato regional (ej. es-AR)')
      return
    }

    const iva = toNumOrNull(ivaTasa)
    const vida = toNumOrNull(vidaUtil)

    startTransition(async () => {
      const res = await upsertFinConfig({
        pais: pais.trim().toUpperCase() || 'AR',
        moneda: monedaTrim,
        locale: localeTrim,
        iva_tasa: iva ?? 0,
        costo_km: toNumOrNull(costoKm),
        costo_hora: toNumOrNull(costoHora),
        vida_util_meses_def: vida && vida > 0 ? Math.round(vida) : 36,
      })

      if (res.success) {
        setGuardado(true)
        toast.success('Configuración guardada')
      } else {
        toast.error(res.error)
      }
    })
  }

  // Preview en vivo de cómo se ven los montos con la moneda + región elegidas.
  const previewMonto = formatMonto(1234567.89, moneda || 'ARS', locale || 'es-AR')

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Bloque: Moneda y región ── */}
      <section className="rounded-xl border border-border-subtle bg-surface-base p-5">
        <header className="flex items-start gap-3 pb-3 mb-1 border-b border-border-subtle">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-primary">
            <Globe size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Moneda y región</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Define en qué moneda llevás tus números y cómo se muestran. Pensado para
              que funcione en cualquier país, no solo Argentina.
            </p>
          </div>
        </header>

        <div className="divide-y divide-border-subtle">
          <Campo
            icon={<CreditCard size={16} />}
            titulo="Moneda"
            ayuda="La moneda en la que cargás tus gastos e inversiones. Todos los montos del módulo se muestran en esta moneda."
          >
            <Select
              label="Moneda"
              value={monedaSel}
              onChange={(e) => setMonedaSel(e.target.value)}
              options={[...MONEDAS_SUGERIDAS, { value: OTRO, label: 'Otra… (código ISO)' }]}
            />
            {monedaSel === OTRO && (
              <Input
                aria-label="Código de moneda ISO 4217"
                value={monedaLibre}
                onChange={(e) => setMonedaLibre(e.target.value)}
                placeholder="Ej. ARS, USD, EUR"
                maxLength={3}
                className="uppercase"
              />
            )}
          </Campo>

          <Campo
            icon={<Globe size={16} />}
            titulo="Formato regional"
            ayuda="Cómo se escriben los números y las fechas (separadores de miles, decimales, idioma del mes)."
          >
            <Select
              label="Región"
              value={localeSel}
              onChange={(e) => setLocaleSel(e.target.value)}
              options={[...LOCALES_SUGERIDOS, { value: OTRO, label: 'Otra… (código BCP 47)' }]}
            />
            {localeSel === OTRO && (
              <Input
                aria-label="Código de región BCP 47"
                value={localeLibre}
                onChange={(e) => setLocaleLibre(e.target.value)}
                placeholder="Ej. es-AR, pt-BR, en-US"
              />
            )}
          </Campo>

          <Campo
            icon={<Globe size={16} />}
            titulo="País"
            ayuda="Código de tu país (ISO 3166). Lo usamos para reportes y futuras integraciones impositivas."
          >
            <Input
              aria-label="País"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              placeholder="Ej. AR, UY, CL"
              maxLength={2}
              className="uppercase"
            />
          </Campo>
        </div>

        {/* Preview en vivo */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
          <span className="text-xs text-text-tertiary">Así se van a ver tus montos:</span>
          <span className="text-sm font-semibold text-text-primary tabular-nums">
            {previewMonto}
          </span>
        </div>
      </section>

      {/* ── Bloque: Parámetros financieros ── */}
      <section className="rounded-xl border border-border-subtle bg-surface-base p-5">
        <header className="flex items-start gap-3 pb-3 mb-1 border-b border-border-subtle">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-primary">
            <BarChart3 size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Parámetros de cálculo</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Valores que el módulo usa para estimar costos y amortizaciones. Podés
              dejarlos vacíos y completarlos cuando los tengas claros.
            </p>
          </div>
        </header>

        <div className="divide-y divide-border-subtle">
          <Campo
            icon={<Activity size={16} />}
            titulo="Tasa de IVA"
            ayuda="El porcentaje de IVA de tu país. Lo usamos para separar el impuesto de tus comprobantes (ej. 21 = 21%)."
          >
            <Input
              aria-label="Tasa de IVA"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={ivaTasa}
              onChange={(e) => setIvaTasa(e.target.value)}
              placeholder="21"
            />
          </Campo>

          <Campo
            icon={<Activity size={16} />}
            titulo="Costo por kilómetro"
            ayuda="Cuánto te cuesta moverte cada km (combustible, desgaste). Lo usamos para calcular cuánto te cuesta atender a un cliente lejano."
          >
            <Input
              aria-label="Costo por kilómetro"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={costoKm}
              onChange={(e) => setCostoKm(e.target.value)}
              placeholder={`Monto por km en ${moneda || 'tu moneda'}`}
            />
          </Campo>

          <Campo
            icon={<Activity size={16} />}
            titulo="Costo por hora"
            ayuda="Cuánto vale una hora de tu trabajo. Sirve para medir la rentabilidad de cada gestión según las horas que le dedicás."
          >
            <Input
              aria-label="Costo por hora"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={costoHora}
              onChange={(e) => setCostoHora(e.target.value)}
              placeholder={`Monto por hora en ${moneda || 'tu moneda'}`}
            />
          </Campo>

          <Campo
            icon={<BarChart3 size={16} />}
            titulo="Vida útil por defecto"
            ayuda="Cuántos meses dura, en promedio, un equipo que comprás (ej. un instrumento de medición). Lo usamos para repartir su costo mes a mes. Por defecto, 36 meses (3 años)."
          >
            <Input
              aria-label="Vida útil por defecto en meses"
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              value={vidaUtil}
              onChange={(e) => setVidaUtil(e.target.value)}
              placeholder="36"
            />
          </Campo>
        </div>
      </section>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-end gap-3">
        {guardado && !pending && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check size={14} /> Cambios guardados
          </span>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {yaConfigurada ? 'Guardar cambios' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  )
}

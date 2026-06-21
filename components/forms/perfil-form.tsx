'use client'

import { useState, useTransition, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Check, Eye, EyeOff, Globe, Sun, Moon, Loader2, ArrowLeft, UserPlus, Search, X } from 'lucide-react'
import Link from 'next/link'
import { vincularPersonaPerfil, crearYVincularPersona, updatePassword } from '@/lib/actions/perfil-usuario'
import { setLocale } from '@/lib/actions/locale'
import { EstablecimientoProgress, type ProgressCheck } from './establecimiento-progress'
import { PersonaSelector } from '@/components/persona-selector'
import { MiMatriculaDni, type MiPersona } from '@/components/perfil/mi-matricula-dni'

type SectionId = 1 | 2 | 3
type ModoPersona = 'vinculado' | 'selector' | 'nuevo'

interface SectionMeta {
  id: SectionId
  title: string
  shortTitle: string
  description: string
}

const SECTIONS: SectionMeta[] = [
  {
    id: 1,
    title: 'Datos personales',
    shortTitle: 'Perfil',
    description: 'Vinculá tu cuenta a una persona del directorio, o creá una nueva.',
  },
  {
    id: 2,
    title: 'Apariencia',
    shortTitle: 'Apariencia',
    description: 'Idioma de la interfaz y tema visual (claro u oscuro).',
  },
  {
    id: 3,
    title: 'Seguridad',
    shortTitle: 'Seguridad',
    description: 'Cambiá tu contraseña de acceso cuando lo necesites.',
  },
]

function SectionProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && done === total
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={isComplete ? 'text-success font-medium' : 'text-text-secondary'}>
          {isComplete ? 'Sección completa' : 'Progreso de esta sección'}
        </span>
        <span className="text-text-tertiary tabular-nums">{done}/{total} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
        <div
          className={['h-full rounded-full transition-[width] duration-500 ease-out', isComplete ? 'bg-success' : 'bg-sig-500'].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stepper({
  current, sectionStats, onJump,
}: {
  current: SectionId
  sectionStats: Record<SectionId, { done: number; total: number }>
  onJump: (id: SectionId) => void
}) {
  return (
    <nav aria-label="Pasos del formulario" className="flex items-center gap-2 mb-4">
      {SECTIONS.map((s, idx) => {
        const stats = sectionStats[s.id]
        const isCurrent = s.id === current
        const isComplete = stats.total > 0 && stats.done === stats.total
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              aria-current={isCurrent ? 'step' : undefined}
              className={[
                'flex items-center gap-2 flex-1 min-w-0 rounded-lg px-3 py-2 text-left transition-colors',
                isCurrent ? 'bg-sig-100 text-sig-800 ring-1 ring-sig-300'
                  : isComplete ? 'bg-success/10 text-success hover:bg-success/15'
                  : 'bg-surface-sunken text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              <span className={[
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0',
                isCurrent ? 'bg-sig-500 text-white' : isComplete ? 'bg-success text-white' : 'bg-surface-elevated text-text-tertiary border border-border-default',
              ].join(' ')}>
                {isComplete && !isCurrent ? '✓' : s.id}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{s.shortTitle}</span>
                <span className="text-[10px] tabular-nums opacity-75">{stats.done}/{stats.total}</span>
              </span>
            </button>
            {idx < SECTIONS.length - 1 && <span className="text-text-tertiary text-xs hidden sm:inline">—</span>}
          </div>
        )
      })}
    </nav>
  )
}

function FormSection({
  step, title, description, isActive, sectionStats, children,
}: {
  step: number; title: string; description: string; isActive: boolean
  sectionStats: { done: number; total: number }; children: React.ReactNode
}) {
  return (
    <section hidden={!isActive} aria-hidden={!isActive} className="border border-border-subtle rounded-xl bg-surface-base p-5 space-y-4">
      <header className="flex items-start gap-3 pb-3 border-b border-border-subtle">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-sig-100 text-sig-700 text-sm font-semibold shrink-0">{step}</span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
      </header>
      <SectionProgressBar done={sectionStats.done} total={sectionStats.total} />
      <div className="space-y-4">{children}</div>
    </section>
  )
}

interface Props {
  fullName: string
  email: string
  avatarUrl: string | null
  personaId: string | null
  miPersona: MiPersona | null
}

export function PerfilForm({ fullName, email, personaId: initialPersonaId, miPersona }: Props) {
  const locale = useLocale()
  const [currentSection, setCurrentSection] = useState<SectionId>(1)

  // — Sección 1: Persona vinculada —
  const [personaId, setPersonaId] = useState<string | null>(initialPersonaId)
  const [displayName, setDisplayName] = useState(fullName)
  const [modo, setModo] = useState<ModoPersona>(initialPersonaId ? 'vinculado' : 'selector')

  // Selector de persona existente
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
  const [vincularPending, startVincularTransition] = useTransition()
  const [vincularStatus, setVincularStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [vincularMsg, setVincularMsg] = useState('')

  // Crear nueva persona
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoApellido, setNuevoApellido] = useState('')
  const [nuevoDni, setNuevoDni] = useState('')
  const [nuevoTel, setNuevoTel] = useState('')
  const [crearPending, startCrearTransition] = useTransition()
  const [crearStatus, setCrearStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [crearMsg, setCrearMsg] = useState('')

  // — Sección 2: Apariencia —
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [localePending, startLocaleTransition] = useTransition()

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.theme')
    const current = document.documentElement.getAttribute('data-theme')
    setTheme((stored ?? current ?? 'light') as 'light' | 'dark')
  }, [])

  // — Sección 3: Seguridad —
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [pwStatus, setPwStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [pwMsg, setPwMsg] = useState('')
  const [pwPending, startPwTransition] = useTransition()

  // ── Checks de progreso ────────────────────────────────────────────────────
  const checks: ProgressCheck[] = [
    { id: 'persona', label: 'Nombre y apellido vinculados al directorio', done: !!personaId, section: 1 },
    { id: 'email', label: 'Email de la cuenta', done: email.length > 0, section: 1 },
    { id: 'idioma', label: 'Idioma configurado', done: true, section: 2 },
    { id: 'tema', label: 'Tema configurado', done: true, section: 2 },
    { id: 'password', label: 'Contraseña actualizada', done: pwStatus === 'ok', section: 3 },
  ]

  const sectionStats: Record<SectionId, { done: number; total: number }> = {
    1: { done: checks.filter(c => c.section === 1 && c.done).length, total: checks.filter(c => c.section === 1).length },
    2: { done: checks.filter(c => c.section === 2 && c.done).length, total: checks.filter(c => c.section === 2).length },
    3: { done: checks.filter(c => c.section === 3 && c.done).length, total: checks.filter(c => c.section === 3).length },
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleVincular() {
    if (!selectedPersonaId) return
    setVincularStatus('idle')
    startVincularTransition(async () => {
      const res = await vincularPersonaPerfil(selectedPersonaId)
      if (res?.error) { setVincularStatus('error'); setVincularMsg(res.error) }
      else {
        setPersonaId(selectedPersonaId)
        setDisplayName(res.full_name ?? displayName)
        setModo('vinculado')
        setVincularStatus('ok')
        setVincularMsg('Perfil vinculado correctamente')
      }
    })
  }

  function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setCrearStatus('idle')
    startCrearTransition(async () => {
      const res = await crearYVincularPersona({
        nombre: nuevoNombre,
        apellido: nuevoApellido,
        dni: nuevoDni,
        telefono: nuevoTel,
        email,
      })
      if (res?.error) { setCrearStatus('error'); setCrearMsg(res.error) }
      else {
        setDisplayName(res.full_name ?? displayName)
        setModo('vinculado')
        setCrearStatus('ok')
        setCrearMsg('Persona creada y vinculada correctamente')
      }
    })
  }

  function changeTheme(next: 'light' | 'dark') {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('sigmetria.theme', next)
  }

  function changeLocale(code: 'es' | 'en') {
    if (code === locale || localePending) return
    startLocaleTransition(() => { void setLocale(code) })
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwNext !== pwConfirm) { setPwStatus('error'); setPwMsg('Las contraseñas no coinciden'); return }
    if (pwNext.length < 8) { setPwStatus('error'); setPwMsg('Mínimo 8 caracteres'); return }
    setPwStatus('idle')
    startPwTransition(async () => {
      const res = await updatePassword({ current: pwCurrent, next: pwNext })
      if (res?.error) { setPwStatus('error'); setPwMsg(res.error) }
      else {
        setPwStatus('ok'); setPwMsg('Contraseña actualizada correctamente')
        setPwCurrent(''); setPwNext(''); setPwConfirm('')
      }
    })
  }

  function goNext() { if (currentSection < 3) setCurrentSection(s => (s + 1) as SectionId) }
  function goPrev() { if (currentSection > 1) setCurrentSection(s => (s - 1) as SectionId) }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors" aria-label="Volver">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Mi perfil</h1>
          <p className="text-xs text-text-secondary mt-0.5">Actualizá tus datos, apariencia y seguridad</p>
        </div>
      </div>

      <EstablecimientoProgress checks={checks} />
      <Stepper current={currentSection} sectionStats={sectionStats} onJump={setCurrentSection} />

      {/* ── Sección 1: Datos personales ── */}
      <FormSection step={1} title={SECTIONS[0].title} description={SECTIONS[0].description} isActive={currentSection === 1} sectionStats={sectionStats[1]}>

        {/* Estado: ya vinculado */}
        {modo === 'vinculado' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
              <Check size={16} className="text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{displayName}</p>
                <p className="text-[11px] text-text-tertiary">Vinculado al directorio de personas</p>
              </div>
              <button
                type="button"
                onClick={() => setModo('selector')}
                className="text-xs text-brand-primary hover:underline shrink-0"
              >
                Cambiar
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input type="email" value={email} readOnly className="w-full px-3 py-2 text-sm border border-border-subtle rounded-lg bg-surface-sunken text-text-tertiary cursor-not-allowed" />
              <p className="text-[11px] text-text-tertiary mt-1">El email no se puede cambiar desde aquí.</p>
            </div>
          </div>
        )}

        {/* Estado: selector de persona existente */}
        {modo === 'selector' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Search size={13} /> Buscar persona en el directorio
              </label>
              <PersonaSelector
                name="persona_id"
                value={selectedPersonaId}
                onChange={setSelectedPersonaId}
                placeholder="Buscar por apellido, nombre o DNI…"
              />
              <p className="text-[11px] text-text-tertiary mt-1">
                Buscá tu registro en el directorio de personas de tu consultora.
              </p>
            </div>

            {vincularStatus === 'error' && (
              <p className="text-xs text-danger">{vincularMsg}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVincular}
                disabled={vincularPending || !selectedPersonaId}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vincularPending && <Loader2 size={14} className="animate-spin" />}
                Vincular
              </button>
              <button
                type="button"
                onClick={() => setModo('nuevo')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors"
              >
                <UserPlus size={14} /> No estoy en el directorio
              </button>
              {personaId && (
                <button type="button" onClick={() => setModo('vinculado')} className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-elevated transition-colors" aria-label="Cancelar">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Estado: crear nueva persona */}
        {modo === 'nuevo' && (
          <form onSubmit={handleCrear} className="space-y-3 max-md:space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-secondary">Crear nueva persona en el directorio</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sig-100 text-sig-700 font-medium">Tipo: Profesionales</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
                <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} required className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="Juan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Apellido *</label>
                <input type="text" value={nuevoApellido} onChange={e => setNuevoApellido(e.target.value)} required className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="Pérez" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">DNI</label>
                <input type="text" value={nuevoDni} onChange={e => setNuevoDni(e.target.value)} className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="12345678" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono</label>
                <input type="text" value={nuevoTel} onChange={e => setNuevoTel(e.target.value)} className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="+54 11 1234-5678" />
              </div>
            </div>

            {crearStatus !== 'idle' && (
              <p className={`text-xs flex items-center gap-1.5 ${crearStatus === 'ok' ? 'text-success' : 'text-danger'}`}>
                {crearStatus === 'ok' && <Check size={13} />} {crearMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={crearPending || !nuevoNombre || !nuevoApellido}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crearPending && <Loader2 size={14} className="animate-spin" />}
                Crear y vincular
              </button>
              <button type="button" onClick={() => setModo('selector')} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors">
                ← Volver a buscar
              </button>
            </div>
          </form>
        )}

        {/* Matrícula y DNI de la persona del directorio vinculada al usuario */}
        <div className="pt-4 mt-2 border-t border-border-subtle">
          <MiMatriculaDni persona={miPersona} />
        </div>

        <div className="flex justify-end pt-1">
          <button type="button" onClick={goNext} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors">
            Siguiente →
          </button>
        </div>
      </FormSection>

      {/* ── Sección 2: Apariencia ── */}
      <FormSection step={2} title={SECTIONS[1].title} description={SECTIONS[1].description} isActive={currentSection === 2} sectionStats={sectionStats[2]}>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5"><Globe size={13} /> Idioma</label>
            <div className="flex gap-2">
              {(['es', 'en'] as const).map(code => (
                <button key={code} type="button" onClick={() => changeLocale(code)} disabled={localePending}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${locale === code ? 'border-brand-primary bg-brand-muted text-brand-primary' : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated'}`}>
                  {code === 'es' ? 'Español' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Tema</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => changeTheme('light')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg border transition-colors ${theme === 'light' ? 'border-brand-primary bg-brand-muted text-brand-primary' : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated'}`}>
                <Sun size={15} /> Claro
              </button>
              <button type="button" onClick={() => changeTheme('dark')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg border transition-colors ${theme === 'dark' ? 'border-brand-primary bg-brand-muted text-brand-primary' : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated'}`}>
                <Moon size={15} /> Oscuro
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={goPrev} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors">← Anterior</button>
          <button type="button" onClick={goNext} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors">Siguiente →</button>
        </div>
      </FormSection>

      {/* ── Sección 3: Seguridad ── */}
      <FormSection step={3} title={SECTIONS[2].title} description={SECTIONS[2].description} isActive={currentSection === 3} sectionStats={sectionStats[3]}>
        <form onSubmit={handleChangePassword} className="space-y-3 max-md:space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Contraseña actual</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={pwCurrent} onChange={e => { setPwCurrent(e.target.value); setPwStatus('idle') }}
                className="w-full px-3 py-2 pr-10 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} value={pwNext} onChange={e => { setPwNext(e.target.value); setPwStatus('idle') }}
                className="w-full px-3 py-2 pr-10 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="Mínimo 8 caracteres" required />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors">
                {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirmar nueva contraseña</label>
            <input type="password" value={pwConfirm} onChange={e => { setPwConfirm(e.target.value); setPwStatus('idle') }}
              className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30" placeholder="Repetí la nueva contraseña" required />
          </div>
          {pwStatus !== 'idle' && (
            <p className={`text-xs flex items-center gap-1.5 ${pwStatus === 'ok' ? 'text-success' : 'text-danger'}`}>
              {pwStatus === 'ok' && <Check size={13} />} {pwMsg}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={goPrev} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-surface-elevated transition-colors">← Anterior</button>
            <button type="submit" disabled={pwPending || !pwCurrent || !pwNext || !pwConfirm}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {pwPending && <Loader2 size={14} className="animate-spin" />}
              Cambiar contraseña
            </button>
          </div>
        </form>
      </FormSection>
    </div>
  )
}

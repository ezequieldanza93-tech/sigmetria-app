'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateConsultora, uploadConsultoraLogo } from '@/lib/actions/consultora'
import NextImage from 'next/image'
import { Save, Loader2, Building2, Globe, Mail, Phone, Image as LucideImage, Link as LinkIcon, Check, Upload, X } from 'lucide-react'
import type { Consultora } from '@/lib/types'

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  tiktok: 'TikTok',
}

export default function ConsultoraInfoPage() {
  const router = useRouter()
  const [consultora, setConsultora] = useState<Consultora | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: membership } = await supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!membership) { setLoading(false); return }

      const { data: c } = await supabase
        .from('consultoras')
        .select('*')
        .eq('id', membership.consultora_id)
        .single()

      if (c) {
        const consultora = c as unknown as Consultora
        setConsultora(consultora)
        setNombre(consultora.nombre ?? '')
        setTelefono(consultora.telefono ?? '')
        setEmail(consultora.email ?? '')
        setWebsite(consultora.website ?? '')
        setLogoUrl(consultora.logo_url ?? '')
        setSocialLinks(consultora.social_links ?? {})
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const result = await updateConsultora({
      nombre,
      telefono: telefono || null,
      email: email || null,
      website: website || null,
      logo_url: logoUrl || null,
      social_links: Object.fromEntries(
        Object.entries(socialLinks).filter(([, v]) => v.trim())
      ),
    })

    if (!result.success) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setLogoError(null)
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('El archivo supera 2 MB.')
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }

    setUploadingLogo(true)
    const fd = new FormData()
    fd.set('logo', file)
    const result = await uploadConsultoraLogo(fd)
    setUploadingLogo(false)

    if (!result.success) {
      setLogoError(result.error)
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }
    setLogoUrl(result.data.url)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  function updateSocial(key: string, value: string) {
    setSocialLinks(prev => ({ ...prev, [key]: value }))
  }

  function addSocial() {
    const key = prompt('Nombre de la red social (ej: instagram, linkedin):')
    if (key && key.trim()) {
      setSocialLinks(prev => ({ ...prev, [key.trim().toLowerCase()]: '' }))
    }
  }

  function removeSocial(key: string) {
    const next = { ...socialLinks }
    delete next[key]
    setSocialLinks(next)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (!consultora) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-tertiary">No se encontró información de la consultora</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center">
          <Building2 size={20} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Información de la Consultora</h1>
          <p className="text-sm text-text-tertiary">Configuración general de {consultora.nombre}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Datos básicos</h2>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre de la marca</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="+54 11 5555-5555"
                  className="w-full rounded-lg border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="info@consultora.com"
                  type="email"
                  className="w-full rounded-lg border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Sitio web</label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://www.consultora.com"
                type="url"
                className="w-full rounded-lg border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Logo */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Logo</h2>

          <div className="flex items-start gap-4">
            <div className="relative w-20 h-20 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <NextImage src={logoUrl} alt="Logo" fill className="object-contain" />
              ) : (
                <LucideImage size={24} className="text-text-tertiary" />
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">Archivo del logo</label>
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="consultora_logo_file"
                  className={`inline-flex items-center gap-2 px-3 py-2 bg-surface-base border border-border-subtle rounded-lg text-sm text-text-primary hover:bg-surface-sunken cursor-pointer transition-colors ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploadingLogo ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
                </label>
                <input
                  ref={logoInputRef}
                  id="consultora_logo_file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  disabled={uploadingLogo}
                  className="sr-only"
                />
                {logoUrl && !uploadingLogo && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <X size={14} /> Quitar
                  </button>
                )}
              </div>
              {logoError && <p className="text-xs text-red-600 mt-1.5">{logoError}</p>}
              {!logoError && (
                <p className="text-xs text-text-tertiary mt-1.5">PNG, JPG, WEBP o SVG. Máx 2 MB. Se sube y guarda al seleccionarlo.</p>
              )}
            </div>
          </div>
        </section>

        {/* Social networks */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Redes sociales</h2>
            <button
              onClick={addSocial}
              className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
            >
              + Agregar red
            </button>
          </div>

          {Object.keys(socialLinks).length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center">No hay redes sociales cargadas. Agregá una red social para empezar.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(socialLinks).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      value={value}
                      onChange={e => updateSocial(key, e.target.value)}
                      placeholder={`URL de ${SOCIAL_LABELS[key] ?? key}`}
                      className="w-full rounded-lg border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                    />
                  </div>
                  <span className="text-xs text-text-tertiary w-20 text-right shrink-0">{SOCIAL_LABELS[key] ?? key}</span>
                  <button
                    onClick={() => removeSocial(key)}
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Eliminar"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <Check size={16} />
              Guardado correctamente
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

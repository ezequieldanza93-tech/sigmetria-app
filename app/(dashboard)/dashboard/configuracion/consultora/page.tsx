'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateConsultora, uploadConsultoraLogo } from '@/lib/actions/consultora'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import { inviteUsuario } from '@/lib/actions/usuario'
import { InviteUsuarioForm } from '@/components/forms/invite-usuario-form'
import { PhoneInput } from '@/components/forms/phone-input'
import { ConnectionGuide } from '@/app/(dashboard)/dashboard/configuracion/api-keys/connection-guide'
import { ApiKeysClient } from '@/app/(dashboard)/dashboard/configuracion/api-keys/api-keys-client'
import NextImage from 'next/image'
import { Save, Loader2, Building2, Globe, Mail, Image as LucideImage, Check, Upload, X, UserPlus, Users, Shield, ShieldAlert, ChevronDown } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, UserRole, isFreeViewerRole } from '@/lib/types'
import type { Consultora } from '@/lib/types'

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
  // Color de marca para los PDF (white-label). Desactivado = verde Sigmetría.
  const [colorMarcaOn, setColorMarcaOn] = useState(false)
  const [colorPrimario, setColorPrimario] = useState('#2E7D33')
  const [secundarioOn, setSecundarioOn] = useState(false)
  const [colorSecundario, setColorSecundario] = useState('#4CAF50')
  const telefonoWrapRef = useRef<HTMLDivElement>(null)
  const [members, setMembers] = useState<any[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const [consultoraId, setConsultoraId] = useState<string | null>(null)

  const [autoDownload, setAutoDownload] = useState(true)
  const [autoDownloadSaved, setAutoDownloadSaved] = useState(false)
  const [savingAutoDownload, setSavingAutoDownload] = useState(false)
  const [mfaActive, setMfaActive] = useState<boolean | null>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [conexionesOpen, setConexionesOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: factors } = await supabase.auth.mfa.listFactors()
      setMfaActive((factors?.totp?.length ?? 0) > 0)

      const { data: membership } = await supabase
        .from('consultoras_members')
        .select('consultora_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!membership) { setLoading(false); return }

      setConsultoraId(membership.consultora_id)
      setIsMainAdmin(membership.role === 'full_access_main')

      const [cResult, membersResult] = await Promise.all([
        supabase.from('consultoras').select('*').eq('id', membership.consultora_id).single(),
        supabase
          .from('consultoras_members')
          .select('id, role, is_active, user_id, profiles(full_name, system_role)')
          .eq('consultora_id', membership.consultora_id)
          .eq('is_active', true)
          .order('role'),
      ])

      const c = cResult.data
      if (c) {
        const consultora = c as unknown as Consultora
        setConsultora(consultora)
        setNombre(consultora.nombre ?? '')
        setTelefono(consultora.telefono ?? '')
        setEmail(consultora.email ?? '')
        setWebsite(consultora.website ?? '')
        setLogoUrl(consultora.logo_url ?? '')
        const cMarca = consultora as unknown as {
          color_marca_primario?: string | null
          color_marca_secundario?: string | null
        }
        setColorMarcaOn(!!cMarca.color_marca_primario)
        if (cMarca.color_marca_primario) setColorPrimario(cMarca.color_marca_primario)
        setSecundarioOn(!!cMarca.color_marca_secundario)
        if (cMarca.color_marca_secundario) setColorSecundario(cMarca.color_marca_secundario)
      }
      setMembers((membersResult.data ?? []) as any[])

      const { data: profile } = await supabase
        .from('profiles')
        .select('auto_download_gestion')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) setAutoDownload(profile.auto_download_gestion ?? true)

      const { data: keys } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, permisos, created_at, last_used_at, revoked_at')
        .eq('consultora_id', membership.consultora_id)
        .order('created_at', { ascending: false })
      setApiKeys(keys ?? [])

      setLoading(false)
    }
    load()
  }, [router])

  async function handleSaveAutoDownload() {
    setSavingAutoDownload(true)
    setAutoDownloadSaved(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: saveErr } = await supabase
        .from('profiles')
        .update({ auto_download_gestion: autoDownload })
        .eq('id', user.id)
      if (saveErr) {
        setError(saveErr.message)
      } else {
        setAutoDownloadSaved(true)
        setTimeout(() => setAutoDownloadSaved(false), 3000)
      }
    } else {
      setError('No autenticado')
    }
    setSavingAutoDownload(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    // PhoneInput maneja su propio estado interno y expone el valor en un
    // <input hidden name="telefono">. Lo leemos acá al guardar.
    const telefonoValue =
      telefonoWrapRef.current?.querySelector<HTMLInputElement>('input[name="telefono"]')?.value ?? telefono

    const result = await updateConsultora({
      nombre,
      telefono: telefonoValue || null,
      email: email || null,
      website: website || null,
      logo_url: logoUrl || null,
      color_marca_primario: colorMarcaOn ? colorPrimario : null,
      color_marca_secundario: colorMarcaOn && secundarioOn ? colorSecundario : null,
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
            <div ref={telefonoWrapRef}>
              <PhoneInput
                name="telefono"
                label="Teléfono"
                defaultValue={telefono}
                placeholder="11 5555-5555"
              />
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

        {/* Preferencias */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Preferencias Personales</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Descargar PDF automáticamente</p>
              <p className="text-xs text-text-tertiary">Al finalizar una gestión, descarga el PDF de la evidencia sin preguntar.</p>
            </div>
            <div className="flex items-center gap-3">
              {autoDownloadSaved && (
                <span className="flex items-center gap-1 text-xs text-success"><Check size={12} />Guardado</span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={autoDownload}
                onClick={() => setAutoDownload(!autoDownload)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${autoDownload ? 'bg-brand-primary' : 'bg-border-subtle'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${autoDownload ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveAutoDownload}
              disabled={savingAutoDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingAutoDownload ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingAutoDownload ? 'Guardando...' : 'Guardar preferencia'}
            </button>
          </div>
        </section>

        {/* Seguridad */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Seguridad</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Verificación en dos pasos (MFA)</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Protege tu cuenta con un segundo factor de autenticación (TOTP).
              </p>
            </div>
            {mfaActive === null ? (
              <Loader2 size={16} className="animate-spin text-text-tertiary" />
            ) : mfaActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium shrink-0">
                <Shield size={13} />
                Activa
              </span>
            ) : (
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                  <ShieldAlert size={13} />
                  No configurada
                </span>
                <button
                  type="button"
                  onClick={() => router.push('/mfa/setup')}
                  className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors whitespace-nowrap"
                >
                  Configurar ahora
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Logo */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Logo</h2>

          <div className="flex items-start gap-4">
            <div className="relative w-20 h-20 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <NextImage src={publicAssetUrl('consultora', logoUrl) ?? logoUrl} alt="Logo" fill className="object-contain" />
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
                    className="inline-flex items-center gap-1 text-xs text-danger hover:text-danger px-2 py-1.5 rounded-lg hover:bg-danger-bg"
                  >
                    <X size={14} /> Quitar
                  </button>
                )}
              </div>
              {logoError && <p className="text-xs text-danger mt-1.5">{logoError}</p>}
              {!logoError && (
                <p className="text-xs text-text-tertiary mt-1.5">PNG, JPG, WEBP o SVG. Máx 2 MB. Se sube y guarda al seleccionarlo.</p>
              )}
            </div>
          </div>
        </section>

        {/* Color de marca (PDF) */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Color de marca</h2>
            <p className="text-xs text-text-tertiary mt-1">
              Reemplaza el verde de Sigmetría en los PDF que generás (protocolos, contrato y presupuesto).
              Si lo dejás desactivado, se usa el verde de Sigmetría.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-text-primary">Usar un color propio</p>
            <button
              type="button"
              role="switch"
              aria-checked={colorMarcaOn}
              onClick={() => setColorMarcaOn(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${colorMarcaOn ? 'bg-brand-primary' : 'bg-border-subtle'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${colorMarcaOn ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {colorMarcaOn && (
            <div className="space-y-4 border-t border-border-subtle pt-4">
              {/* Color principal */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colorPrimario}
                  onChange={e => setColorPrimario(e.target.value)}
                  aria-label="Color principal"
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border-subtle bg-surface-base"
                />
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Color principal</label>
                  <input
                    value={colorPrimario}
                    onChange={e => setColorPrimario(e.target.value.toUpperCase())}
                    placeholder="#2E7D33"
                    maxLength={7}
                    className="w-28 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm uppercase text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                  />
                </div>
              </div>

              {/* Color secundario (opcional) */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-primary">Color secundario</p>
                  <p className="text-xs text-text-tertiary">Opcional. Realces puntuales; si no lo activás, se usa el principal.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={secundarioOn}
                  onClick={() => setSecundarioOn(v => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${secundarioOn ? 'bg-brand-primary' : 'bg-border-subtle'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${secundarioOn ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {secundarioOn && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorSecundario}
                    onChange={e => setColorSecundario(e.target.value)}
                    aria-label="Color secundario"
                    className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border-subtle bg-surface-base"
                  />
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Color secundario</label>
                    <input
                      value={colorSecundario}
                      onChange={e => setColorSecundario(e.target.value.toUpperCase())}
                      placeholder="#4CAF50"
                      maxLength={7}
                      className="w-28 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm uppercase text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Vista previa del encabezado del PDF */}
              <div className="rounded-lg border border-border-subtle overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: colorPrimario }}>
                  Vista previa — encabezado del PDF
                </div>
                <div className="px-4 py-3 text-sm text-text-secondary" style={{ borderLeft: `4px solid ${colorPrimario}` }}>
                  Así se vería el acento de tu marca en los documentos.
                </div>
              </div>

              <p className="text-xs text-text-tertiary">
                El cambio se aplica con el botón <span className="font-medium">Guardar cambios</span> de abajo.
              </p>
            </div>
          )}
        </section>

        {/* Nuestro Equipo */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-brand-primary" />
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Nuestro Equipo</h2>
                <p className="text-xs text-text-tertiary mt-0.5">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {isMainAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-medium rounded-lg hover:bg-brand-primary/90 transition-colors"
              >
                <UserPlus size={14} />
                Agregar miembro
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-tertiary text-sm">
              No hay miembros activos.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-subtle bg-surface-sunken">
                <tr className="text-left">
                  <th className="px-6 py-3 text-text-tertiary font-medium">Nombre</th>
                  <th className="px-6 py-3 text-text-tertiary font-medium">Rol</th>
                  <th className="px-6 py-3 text-text-tertiary font-medium">Nivel sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {members.map((m: any) => {
                  const p = m.profiles as { full_name?: string; system_role?: string } | null
                  const isDev = p?.system_role === 'developer'
                  const displayRole = isDev ? 'developer' : m.role
                  return (
                    <tr key={m.id} className="hover:bg-surface-base transition-colors">
                      <td className="px-6 py-3.5 font-medium text-text-primary">
                        {p?.full_name ?? 'Sin nombre'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[displayRole as keyof typeof ROLE_COLORS] ?? 'bg-surface-elevated text-text-secondary'}`}>
                          {ROLE_LABELS[m.role as UserRole]}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {isDev ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                            Developer
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary">Agregar miembro</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-base">
                  <X size={16} />
                </button>
              </div>
              <InviteUsuarioForm
                action={inviteUsuario}
                seatsUsed={members.filter((m: any) => m.is_active !== false && !isFreeViewerRole(m.role as UserRole)).length}
                seatsMax={(consultora as unknown as { seats_max?: number }).seats_max ?? 3}
                onSuccess={() => {
                  setShowInviteModal(false)
                  // Reload members
                  const supabase = createClient()
                  supabase.from('consultoras_members')
                    .select('id, role, is_active, user_id, profiles(full_name, system_role)')
                    .eq('consultora_id', consultoraId!)
                    .eq('is_active', true)
                    .order('role')
                    .then(({ data }) => setMembers((data ?? []) as any[]))
                }}
              />
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Conexiones (MCP + API Keys)                                      */}
        {/* ================================================================ */}
        <section className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
          <button
            type="button"
            onClick={() => setConexionesOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-base transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-brand-primary" />
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Conexiones</h2>
                <p className="text-xs text-text-tertiary mt-0.5">API keys y guía de conexión MCP para Claude, Cursor y otros</p>
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`text-text-tertiary transition-transform duration-200 ${conexionesOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {conexionesOpen && (
            <div className="px-6 pb-6 space-y-6 border-t border-border-subtle pt-6">
              <ConnectionGuide />
              <div className="border-t border-border-subtle pt-6">
                <ApiKeysClient keys={apiKeys} isAdmin={isMainAdmin} />
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-success">
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

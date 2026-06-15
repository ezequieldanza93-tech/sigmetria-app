'use client'

import { useState } from 'react'
import { Globe, Plus, Save, Loader2, Check, X } from 'lucide-react'
import { updateSocialLinks } from '@/lib/actions/update-social-links'

// ---------------------------------------------------------------------------
// Íconos inline (mismos que usaba configuración)
// ---------------------------------------------------------------------------

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.73z"/>
    </svg>
  )
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

function XTwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.564 4.136 1.543 5.867L0 24l6.335-1.524A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.668-.523-5.184-1.432l-.371-.222-3.861.929.973-3.746-.242-.385A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
}

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Configuración de redes
// ---------------------------------------------------------------------------

export const DEFAULT_SOCIAL_KEYS = ['instagram', 'linkedin', 'facebook', 'tiktok', 'youtube', 'spotify'] as const
export type DefaultSocialKey = typeof DEFAULT_SOCIAL_KEYS[number]

interface SocialConfig {
  label: string
  icon: React.ReactNode
  placeholder: string
}

export const SOCIAL_CONFIG: Record<string, SocialConfig> = {
  instagram: { label: 'Instagram',   icon: <InstagramIcon />,  placeholder: 'https://instagram.com/tucuenta' },
  linkedin:  { label: 'LinkedIn',    icon: <LinkedInIcon />,   placeholder: 'https://linkedin.com/company/tucuenta' },
  facebook:  { label: 'Facebook',    icon: <FacebookIcon />,   placeholder: 'https://facebook.com/tupagina' },
  tiktok:    { label: 'TikTok',      icon: <TikTokIcon />,     placeholder: 'https://tiktok.com/@tucuenta' },
  youtube:   { label: 'YouTube',     icon: <YoutubeIcon />,    placeholder: 'https://youtube.com/@tucanal' },
  spotify:   { label: 'Spotify',     icon: <SpotifyIcon />,    placeholder: 'https://open.spotify.com/show/...' },
  twitter:   { label: 'X (Twitter)', icon: <XTwitterIcon />,   placeholder: 'https://x.com/tucuenta' },
  whatsapp:  { label: 'WhatsApp',    icon: <WhatsAppIcon />,   placeholder: 'https://wa.me/5491155555555' },
  telegram:  { label: 'Telegram',    icon: <TelegramIcon />,   placeholder: 'https://t.me/tucanal' },
  pinterest: { label: 'Pinterest',   icon: <PinterestIcon />,  placeholder: 'https://pinterest.com/tucuenta' },
}

const EXTRA_SOCIAL_OPTIONS = ['twitter', 'whatsapp', 'telegram', 'pinterest']

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface RedesConfigProps {
  initialLinks: Record<string, string> | null
}

export function RedesConfig({ initialLinks }: RedesConfigProps) {
  const buildInitial = (): Record<string, string> => {
    const db = initialLinks ?? {}
    return {
      ...Object.fromEntries(DEFAULT_SOCIAL_KEYS.map((k) => [k, db[k] ?? ''])),
      ...Object.fromEntries(
        Object.entries(db).filter(
          ([k]) => !DEFAULT_SOCIAL_KEYS.includes(k as DefaultSocialKey),
        ),
      ),
    }
  }

  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(buildInitial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addingNew, setAddingNew] = useState(false)
  const [newSocialKey, setNewSocialKey] = useState('')
  const [newSocialCustomKey, setNewSocialCustomKey] = useState('')

  function updateLink(key: string, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  function confirmAddSocial() {
    const key =
      newSocialKey === '__custom__'
        ? newSocialCustomKey.trim().toLowerCase().replace(/\s+/g, '_')
        : newSocialKey
    if (!key) return
    setSocialLinks((prev) => ({ ...prev, [key]: '' }))
    setAddingNew(false)
    setNewSocialKey('')
    setNewSocialCustomKey('')
  }

  function removeSocial(key: string) {
    if (DEFAULT_SOCIAL_KEYS.includes(key as DefaultSocialKey)) {
      setSocialLinks((prev) => ({ ...prev, [key]: '' }))
    } else {
      const next = { ...socialLinks }
      delete next[key]
      setSocialLinks(next)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const result = await updateSocialLinks(socialLinks)

    if (!result.success) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const alreadyAdded = Object.keys(socialLinks)
  const availableOptions = EXTRA_SOCIAL_OPTIONS.filter((k) => !alreadyAdded.includes(k))

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-tertiary">
        Pegá el link copiado desde cada red social (por ej.{' '}
        <span className="font-mono text-xs">https://instagram.com/tucuenta</span>) para que el
        botón de esa red funcione en tus publicaciones y en el perfil de tu consultora.
      </p>

      {/* Listado de redes */}
      <div className="space-y-2">
        {Object.entries(socialLinks).map(([key, value]) => {
          const config = SOCIAL_CONFIG[key]
          const isDefault = DEFAULT_SOCIAL_KEYS.includes(key as DefaultSocialKey)
          return (
            <div key={key} className="flex items-center gap-2 group">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary flex items-center">
                  {config?.icon ?? <Globe size={16} />}
                </span>
                <input
                  value={value}
                  onChange={(e) => updateLink(key, e.target.value)}
                  placeholder={config?.placeholder ?? `URL de ${key}`}
                  className="w-full rounded-lg border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                />
              </div>
              {value.trim() ? (
                <a
                  href={value.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-brand-primary hover:text-brand-primary/70 hover:underline w-20 text-right shrink-0 truncate transition-colors"
                  title={`Abrir ${config?.label ?? key}`}
                >
                  {config?.label ?? key}
                </a>
              ) : (
                <span className="text-xs text-text-tertiary w-20 text-right shrink-0 select-none">
                  {config?.label ?? key}
                </span>
              )}
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => removeSocial(key)}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-bg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  title="Quitar"
                >
                  <X size={14} />
                </button>
              )}
              {isDefault && <div className="w-[30px] shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Agregar nueva red */}
      {!addingNew ? (
        <button
          type="button"
          onClick={() => {
            setAddingNew(true)
            setNewSocialKey('')
          }}
          className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          <Plus size={13} /> Agregar red
        </button>
      ) : (
        <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
          <select
            value={newSocialKey}
            onChange={(e) => {
              setNewSocialKey(e.target.value)
              setNewSocialCustomKey('')
            }}
            className="flex-1 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
          >
            <option value="">Seleccioná una red…</option>
            {availableOptions.map((k) => (
              <option key={k} value={k}>
                {SOCIAL_CONFIG[k]?.label ?? k}
              </option>
            ))}
            <option value="__custom__">Otra (personalizada)</option>
          </select>
          {newSocialKey === '__custom__' && (
            <input
              value={newSocialCustomKey}
              onChange={(e) => setNewSocialCustomKey(e.target.value)}
              placeholder="Nombre (ej: behance)"
              className="w-36 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
            />
          )}
          <button
            type="button"
            onClick={confirmAddSocial}
            disabled={!newSocialKey || (newSocialKey === '__custom__' && !newSocialCustomKey.trim())}
            className="px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingNew(false)
              setNewSocialKey('')
              setNewSocialCustomKey('')
            }}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-base transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Feedback + botón guardar */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check size={14} /> Guardado correctamente
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Guardando...' : 'Guardar redes'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Globe, Monitor, Code, Smartphone, Download } from 'lucide-react'

type Platform = 'claude' | 'cursor' | 'vscode' | 'other'

const platforms: { id: Platform; label: string; icon: typeof Globe }[] = [
  { id: 'claude', label: 'Claude Desktop', icon: Monitor },
  { id: 'cursor', label: 'Cursor', icon: Code },
  { id: 'vscode', label: 'VS Code', icon: Code },
  { id: 'other', label: 'Otros', icon: Smartphone },
]

const SERVER_URL = 'https://hys-app-sig.vercel.app/api/mcp'

function generateBatContent(_apiKey: string) {
  const bridgePath = '%USERPROFILE%\\sigmetria-mcp.cmd'
  return `@echo off
title Configurador Sigmetria
echo ============================================
echo  Configurador automatico - Sigmetria MCP
echo ============================================
echo.

if not "%1"=="" set CLAVE=%1
if "%CLAVE%"=="" set /p CLAVE="Pega tu clave de acceso Sigmetria: "
if "%CLAVE%"=="" echo ERROR: No ingresaste una clave. & pause & exit /b

echo.
echo [1/3] Creando archivo de conexion...
echo @"C:\\Program Files\\nodejs\\npx.cmd" -y mcp-remote "${SERVER_URL}" --transport http-only --header "Authorization: Bearer %CLAVE%" > ${bridgePath}

echo [2/3] Configurando Claude Desktop...
set CFG=%LOCALAPPDATA%\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude\\claude_desktop_config.json
if not exist "%CFG%" set CFG=%APPDATA%\\Claude\\claude_desktop_config.json
if exist "%CFG%" (
  powershell -ExecutionPolicy Bypass -Command "$c='%CFG%';$j=Get-Content $c -Raw|ConvertFrom-Json;if(-not $j.mcpServers){$j|Add-Member -NotePropertyName mcpServers -NotePropertyValue @{}};$j.mcpServers.sigmetria=@{command='${bridgePath}';args=@()};$j|ConvertTo-Json -Depth 10|Set-Content $c -Encoding utf8;Write-Host 'OK'"
) else (
  echo No se encontro config de Claude.
  echo Abri Claude ^> Configuracion ^> Desarrollador y agrega el servidor
  echo "sigmetria" apuntando a: ${bridgePath}
)

echo [3/3] Reiniciando Claude...
taskkill /f /im Claude.exe 2>nul

echo.
echo =====================
echo  LISTO!
echo.
echo  Abri Claude y preguntale:
echo  "mostrame mis empresas"
echo =====================
pause
`
}

export function ConnectionGuide() {
  const [active, setActive] = useState<Platform>('claude')
  const [apiKey, setApiKey] = useState('')

  function handleDownload() {
    if (!apiKey.trim()) return
    const content = generateBatContent(apiKey.trim())
    const blob = new Blob([content], { type: 'application/bat' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'configurar-sigmetria.bat'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Paso a paso</h2>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2">
        {platforms.map(p => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              active === p.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-surface-base border border-border-subtle text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            <p.icon size={16} strokeWidth={1.75} />
            {p.label}
          </button>
        ))}
      </div>

      {/* Contenido de la guía */}
      <div className="rounded-xl border border-border-subtle bg-surface-base p-6 space-y-5">

        {/* ─── CLAUDE DESKTOP ─────────────────────────────────── */}
        {active === 'claude' && (
          <>
            <h3 className="text-sm font-semibold text-text-primary">Conectar con Claude Desktop</h3>

            <div className="space-y-4">
              <ol className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">1</span>
                  <span className="leading-relaxed pt-0.5">Creá una clave de acceso en &ldquo;Tus claves de acceso&rdquo; (más abajo en esta página).</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">2</span>
                  <span className="leading-relaxed pt-0.5">Pegá la clave acá y descargá el configurador:</span>
                </li>
              </ol>

              <div className="rounded-lg bg-gray-50 border border-border-subtle p-4 space-y-3">
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Pegá tu clave de acceso (empieza con sig_)"
                  className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
                <button
                  onClick={handleDownload}
                  disabled={!apiKey.trim()}
                  className="flex items-center gap-2 rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2.5 hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  Descargar configurador
                </button>
                <p className="text-xs text-text-tertiary">El archivo se va a llamar <strong>configurar-sigmetria.bat</strong>. No te asustes, solo hace doble click.</p>
              </div>

              <ol className="space-y-3" start={3}>
                <li className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">3</span>
                  <span className="leading-relaxed pt-0.5">Ejecutá el archivo descargado (doble click). Se va a configurar todo solo.</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">4</span>
                  <span className="leading-relaxed pt-0.5">Abrí Claude y preguntale: <strong>&ldquo;mostrame mis empresas&rdquo;</strong></span>
                </li>
              </ol>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold">💡 Tip</p>
              <p className="mt-1">Una vez conectado, Claude puede consultar tus empresas, establecimientos, gestiones, incidentes y mucho m&aacute;s. Prob&aacute; preguntarle cosas como &ldquo;qu&eacute; establecimientos tengo&rdquo; o &ldquo;mostrame los riesgos cr&iacute;ticos&rdquo;.</p>
            </div>
          </>
        )}

        {/* ─── CURSOR ──────────────────────────────────────────── */}
        {active === 'cursor' && (
          <>
            <h3 className="text-sm font-semibold text-text-primary">Conectar con Cursor</h3>
            <ol className="space-y-3">
              {[
                'Abrí Cursor y andá a Settings (Configuración).',
                'Buscá la sección "MCP Servers" o "Features → MCP".',
                'Agregá un nuevo servidor MCP con estos datos:',
                'Nombre: <strong>Sigmetría</strong>',
                `URL: <strong>${SERVER_URL}</strong>`,
                'Header: <strong>Authorization: Bearer TU_CLAVE</strong>',
                'Reemplazá TU_CLAVE por la clave de acceso que creaste más abajo.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">{i + 1}</span>
                  <span className="leading-relaxed pt-0.5" dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
          </>
        )}

        {/* ─── VSCODE ──────────────────────────────────────────── */}
        {active === 'vscode' && (
          <>
            <h3 className="text-sm font-semibold text-text-primary">Conectar con VS Code</h3>
            <ol className="space-y-3">
              {[
                'Abrí VS Code y andá a Extensiones (Ctrl+Shift+X).',
                'Buscá e instalá la extensión "MCP Client" o "Continue".',
                'Una vez instalada, andá a la configuración de la extensión.',
                'Agregá un nuevo servidor MCP:',
                'Nombre: <strong>Sigmetría</strong>',
                `URL: <strong>${SERVER_URL}</strong>`,
                'Header: <strong>Authorization: Bearer TU_CLAVE</strong>',
                'Reemplazá TU_CLAVE por la clave de acceso que creaste más abajo.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">{i + 1}</span>
                  <span className="leading-relaxed pt-0.5" dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
          </>
        )}

        {/* ─── OTROS ───────────────────────────────────────────── */}
        {active === 'other' && (
          <>
            <h3 className="text-sm font-semibold text-text-primary">Conectar con otras herramientas</h3>
            <ol className="space-y-3">
              {[
                'Cualquier herramienta que soporte el protocolo MCP puede conectarse a Sigmetría.',
                'Usá estos datos para configurar la conexión:',
                `URL: <strong>${SERVER_URL}</strong>`,
                'Autenticación: <strong>Bearer token</strong> en el header HTTP.',
                'Token: la clave de acceso que creaste más abajo.',
                'Modo: stateless (sin sesión persistente).',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">{i + 1}</span>
                  <span className="leading-relaxed pt-0.5" dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {/* Nota importante */}
      <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/10 px-4 py-3 space-y-2">
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">¿Cómo funciona?</strong> Estas conexiones usan el protocolo MCP 
          (Model Context Protocol), un estándar abierto que permite que aplicaciones de IA se conecten de forma 
          segura con tus datos. No necesitas saber ningún detalle técnico — solo creá una clave de acceso,
          copiala y pegala donde te indicamos.
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Privacidad garantizada.</strong> Cada clave de acceso está
          atada a tu consultora. La aplicación que conectes va a poder ver únicamente los datos de tu
          propia consultora — como si estuvieras adentro de Sigmetría con tu usuario.
        </p>
      </div>
    </section>
  )
}

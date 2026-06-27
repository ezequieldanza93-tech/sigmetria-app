'use client'

import { useState } from 'react'
import { Globe, Monitor, Code, Smartphone } from 'lucide-react'

type Platform = 'claude' | 'cursor' | 'vscode' | 'other'

const platforms: { id: Platform; label: string; icon: typeof Globe }[] = [
  { id: 'claude', label: 'Claude Desktop', icon: Monitor },
  { id: 'cursor', label: 'Cursor', icon: Code },
  { id: 'vscode', label: 'VS Code', icon: Code },
  { id: 'other', label: 'Otros', icon: Smartphone },
]

type Guide = { title: string; steps: string[]; code?: string; note?: string }

const guides: Record<Platform, Guide> = {
  claude: {
    title: 'Conectar con Claude Desktop',
    steps: [
      'Abrí Claude Desktop y andá a Configuración (el engranaje ⚙️).',
      'Andá a "Aplicación de escritorio → Desarrollador".',
      'En "Servidores MCP locales", hace click en "Editar configuración".',
      'Se va a abrir un archivo de texto. Agregá lo siguiente dentro de las llaves de "mcpServers":',
      'Reemplazá TU_CLAVE por la clave de acceso que creaste más abajo.',
      'Guardá el archivo y reiniciá Claude Desktop. ¡Listo!',
    ],
    code: `{
  "mcpServers": {
    "sigmetria": {
      "command": "C:\\\\Users\\\\TU_USUARIO\\\\sigmetria-mcp.cmd",
      "args": []
    }
  }
}`,
    note: 'Antes necesitás crear un archivo sigmetria-mcp.cmd en tu carpeta de usuario (C:\\Users\\TU_USUARIO\\) con este contenido (reemplazando TU_CLAVE): @\"C:\\Program Files\\nodejs\\npx.cmd\" -y mcp-remote \"https://hys-app-sig.vercel.app/api/mcp\" --transport http-only --header \"Authorization: Bearer TU_CLAVE\"',
  },

  cursor: {
    title: 'Conectar con Cursor',
    steps: [
      'Abrí Cursor y andá a Settings (Configuración).',
      'Buscá la sección "MCP Servers" o "Features → MCP".',
      'Agregá un nuevo servidor MCP con estos datos:',
      'Nombre: Sigmetría',
      'URL: https://hys-app-sig.vercel.app/api/mcp',
      'En "Headers" agregá: Authorization: Bearer TU_CLAVE',
      'Reemplazá TU_CLAVE por la clave de acceso que creaste más abajo.',
    ],
  },

  vscode: {
    title: 'Conectar con VS Code',
    steps: [
      'Abrí VS Code y andá a Extensiones (Ctrl+Shift+X).',
      'Buscá e instalá la extensión "MCP Client" o "Continue".',
      'Una vez instalada, andá a la configuración de la extensión.',
      'Agregá un nuevo servidor MCP:',
      'Nombre: Sigmetría',
      'URL: https://hys-app-sig.vercel.app/api/mcp',
      'Header: Authorization: Bearer TU_CLAVE',
      'Reemplazá TU_CLAVE por la clave de acceso que creaste más abajo.',
    ],
  },

  other: {
    title: 'Conectar con otras herramientas',
    steps: [
      'Cualquier herramienta que soporte el protocolo MCP puede conectarse a Sigmetría.',
      'Usá estos datos para configurar la conexión:',
      'URL del servidor: https://hys-app-sig.vercel.app/api/mcp',
      'Autenticación: Bearer token en el header HTTP.',
      'Token: la clave de acceso que creaste más abajo.',
      'Modo: stateless (sin sesión persistente). No necesita sessionId.',
      'Si la herramienta te pide un "transport type", elegí "Streamable HTTP".',
    ],
  },
}

export function ConnectionGuide() {
  const [active, setActive] = useState<Platform>('claude')

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
        <h3 className="text-sm font-semibold text-text-primary">{guides[active].title}</h3>

        <ol className="space-y-3">
          {guides[active].steps.map((step, i) => {
            // Detectar si el paso es un bloque de código
            const isCodeStep = step.startsWith('{') || step.startsWith('  "') || step.startsWith('    ') || step.startsWith('}')

            if (isCodeStep && 'code' in guides[active]) {
              return null // lo mostramos aparte
            }

            return (
              <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{step}</span>
              </li>
            )
          })}
        </ol>

        {/* Bloque de código (solo Claude Desktop) */}
        {guides[active].code && (
          <div className="rounded-lg bg-gray-950 p-4 overflow-x-auto">
            <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
              {guides[active].code}
            </pre>
            <button
              onClick={() => {
                if (guides[active].code) {
                  navigator.clipboard.writeText(guides[active].code)
                }
              }}
              className="mt-3 rounded-md bg-white/10 text-white text-xs font-medium px-3 py-1.5 hover:bg-white/20 transition-colors"
            >
              Copiar configuración
            </button>
          </div>
        )}

        {/* Nota adicional */}
        {guides[active].note && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 leading-relaxed">
            <p className="font-semibold mb-1">📝 Importante</p>
            <p>{guides[active].note}</p>
          </div>
        )}

        {/* Tips extra para Claude */}
        {active === 'claude' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">💡 Tip</p>
             <p>Una vez conectado, Claude va a poder consultar tus empresas, establecimientos, gestiones, incidentes y mucho m&aacute;s. Solo preguntale &ldquo;che, mostrame mis empresas&rdquo; o &ldquo;qu&eacute; establecimientos tengo&rdquo;.</p>
          </div>
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

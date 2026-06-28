#!/usr/bin/env node

/**
 * sigiagemini.mjs — REPL interactivo que conecta Gemini con el MCP de Sigmetría.
 *
 * Uso:
 *   npm run sigiagemini <tu_api_key_sigmetria>
 *
 *   La API key se crea en Sigmetría → Configuración → Conexiones → "Tus claves de acceso"
 *   La GEMINI_API_KEY va como variable de entorno (ver abajo).
 *
 * Ejemplo:
 *   $env:GEMINI_API_KEY = "AIza..."   # PowerShell
 *   npm run sigiagemini sig_abc123
 *
 * Requisitos:
 *   - Node.js 18+ (fetch nativo)
 *   - @google/generative-ai (en node_modules)
 *   - @modelcontextprotocol/sdk (en node_modules)
 *
 * Cómo funciona:
 *   El MCP server de Sigmetría es stateless (responde JSON-RPC directo vía HTTP POST,
 *   sin SSE). Este script se conecta directamente, descubre las tools disponibles,
 *   se las pasa a Gemini como function declarations, y en el bucle REPL Gemini decide
 *   qué tool llamar según lo que el usuario pregunte.
 */

import { createInterface } from 'node:readline'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Configuración ─────────────────────────────────────────────────
const MCP_URL = 'https://hys-app-sig.vercel.app/api/mcp'
const GEMINI_MODEL = 'gemini-2.0-flash' // o 'gemini-2.5-flash' si tenés acceso

// ── MCP Client bare-metal (HTTP directo, stateless) ───────────────
class McpClient {
  #apiKey
  #baseUrl
  #requestId = 0

  constructor(apiKey, baseUrl = MCP_URL) {
    this.#apiKey = apiKey
    this.#baseUrl = baseUrl
  }

  /** Envía un JSON-RPC request y devuelve el result. */
  async #request(method, params = {}) {
    this.#requestId++
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: String(this.#requestId),
      method,
      params,
    })

    const res = await fetch(this.#baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
        Accept: 'application/json',
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    if (data.error) {
      throw new Error(`MCP error [${data.error.code}]: ${data.error.message}`)
    }
    return data.result
  }

  async initialize() {
    return this.#request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {}, roots: { listChanged: false } },
      clientInfo: { name: 'sigiagemini', version: '1.0.0' },
    })
  }

  async listTools() {
    const result = await this.#request('tools/list')
    return result.tools
  }

  async callTool(name, args = {}) {
    return this.#request('tools/call', { name, arguments: args })
  }
}

// ── Gemini helper ─────────────────────────────────────────────────
function createGemini(systemPrompt, tools) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY. Seteala como variable de entorno:\n' +
      '  $env:GEMINI_API_KEY = "tu_key"  (PowerShell)\n' +
      '  o creá un archivo .env.local con GEMINI_API_KEY=tu_key'
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  })

  // Convertir tools de MCP a FunctionDeclaration de Gemini
  const geminiTools = tools.map(t => ({
    functionDeclarations: [{
      name: t.name,
      description: t.description,
      parameters: t.inputSchema?.properties
        ? {
            type: t.inputSchema.type ?? 'object',
            properties: Object.fromEntries(
              Object.entries(t.inputSchema.properties).map(([k, v]) => [
                k,
                {
                  type: v.type ?? 'string',
                  description: v.description ?? '',
                },
              ])
            ),
            required: t.inputSchema.required ?? [],
          }
        : undefined,
    }],
  }))

  return { model, geminiTools }
}

// ── Interactive REPL ──────────────────────────────────────────────
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt) {
  return new Promise(resolve => readline.question(prompt, resolve))
}

async function main() {
  // ── Leer API key de Sigmetría ──────────────────────────────────
  const sigApiKey = process.argv[2]
  if (!sigApiKey) {
    console.error(`
❌ Uso: npm run sigiagemini <tu_api_key_sigmetria>

   La API key la creás en Sigmetría → Configuración → Conexiones → "Tus claves de acceso"

   También necesitás la variable GEMINI_API_KEY:
     \$env:GEMINI_API_KEY = "AIza..."   (PowerShell)
`)
    process.exit(1)
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║       🧪 SIGIAGemini — MCP × Gemini REPL             ║
║       Asistente HyS con datos reales de Sigmetría     ║
╚═══════════════════════════════════════════════════════╝
`)

  // ── Conectar al MCP ─────────────────────────────────────────
  console.log('🔌 Conectando al servidor MCP...')
  const mcp = new McpClient(sigApiKey)

  try {
    const initResult = await mcp.initialize()
    console.log(`✅ Conectado — server: ${initResult.serverInfo?.name ?? 'MCP'} v${initResult.serverInfo?.version ?? '?'}`)
  } catch (err) {
    console.error(`❌ Error de conexión: ${err.message}`)
    process.exit(1)
  }

  // ── Descubrir herramientas ───────────────────────────────────
  console.log('\n🔧 Descubriendo herramientas...')
  const tools = await mcp.listTools()
  console.log(`   ${tools.length} herramientas disponibles:\n`)
  for (const t of tools) {
    const params = t.inputSchema?.properties
      ? Object.keys(t.inputSchema.properties).join(', ')
      : '—'
    console.log(`   📍 ${t.name}`)
    console.log(`      ${t.description}`)
    if (params !== '—') console.log(`      Parámetros: ${params}`)
    console.log()
  }

  // ── Inicializar Gemini ───────────────────────────────────────
  const systemPrompt = `Sos SIGIAGemini, un asistente de Higiene y Seguridad que ayuda al usuario a consultar datos de su consultora HyS usando el sistema Sigmetría.

Herramientas MCP disponibles:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Reglas:
1. SIEMPRE usá las herramientas para responder. No inventes datos ni los saques de tu conocimiento.
2. Si el usuario pide algo que requiere una herramienta, llamala sin preguntar.
3. Si no sabés qué herramienta usar o necesitás un ID que no tenés, preguntale al usuario.
4. Respondé en español rioplatense, con onda pero profesional.
5. Si el usuario pide "mostrame mis empresas" usá listar_empresas.
6. Si el resultado de una tool es muy extenso, resumilo para el usuario.`

  let gemini
  try {
    gemini = createGemini(systemPrompt, tools)
    console.log('🤖 Gemini conectado correctamente.\n')
  } catch (err) {
    console.error(`❌ Error configurando Gemini: ${err.message}`)
    process.exit(1)
  }

  // ── Modo interactivo ─────────────────────────────────────────
  console.log(`
─────────────────────────────────────────────────────
  Escribí una pregunta o "salir" para terminar.

  Ejemplos:
    • "mostrame mis empresas"
    • "qué establecimientos tengo"
    • "mostrame los datos de [nombre empresa]"

  💡 La primera pregunta puede demorar ~10 segundos
     (Gemini + MCP).
─────────────────────────────────────────────────────
`)

  const history = []

  while (true) {
    const input = await question('\n💬 Vos: ')
    const trimmed = input.trim()

    if (!trimmed) continue
    if (['salir', 'exit', 'quit', 'chau', 'adiós'].includes(trimmed.toLowerCase())) {
      console.log('\n👋 ¡Hasta la próxima!')
      break
    }

    try {
      const chat = gemini.model.startChat({
        history: history.slice(-20),
        tools: gemini.geminiTools,
      })

      const result = await chat.sendMessage(trimmed)
      const response = result.response
      const calls = response.functionCalls()

      if (calls && calls.length > 0) {
        for (const call of calls) {
          process.stdout.write(`\n   🛠️  ${call.name}...`)
          try {
            const toolResult = await mcp.callTool(call.name, call.args)
            const textContent = (toolResult.content ?? [])
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n')

            process.stdout.write(` ✅\n`)

            const result2 = await chat.sendMessage([
              { text: `Resultado de ${call.name}: ${textContent}` },
            ])
            const response2 = result2.response
            const text = response2.text()
            if (text) {
              console.log(`\n   🤖 SIGIAGemini:\n   ${text.replace(/\n/g, '\n   ')}`)
            }
          } catch (err) {
            console.error(` ❌\n   Error: ${err.message}`)
          }
        }
      } else {
        const text = response.text()
        if (text) {
          console.log(`\n   🤖 SIGIAGemini:\n   ${text.replace(/\n/g, '\n   ')}`)
        }
      }
    } catch (err) {
      console.error(`\n   ❌ Error: ${err.message}`)
    }
  }

  readline.close()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})

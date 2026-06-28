#!/usr/bin/env node

/**
 * test-mcp-gemini.mjs — Prueba interactiva del MCP de Sigmetría con Gemini.
 *
 * Uso:
 *   1. Creá una API key en Sigmetría → Configuración → Conexiones
 *   2. Configurá GEMINI_API_KEY como variable de entorno
 *      (o creá un archivo .env.local en la raíz)
 *   3. node test-mcp-gemini.mjs <tu_api_key_sigmetria>
 *
 * Ejemplo:
 *   node test-mcp-gemini.mjs sig_abc123def456
 *
 * Requisitos:
 *   - Node.js 18+ (con fetch nativo)
 *   - @google/generative-ai (ya está en node_modules)
 *   - @modelcontextprotocol/sdk (ya está en node_modules)
 *
 * El script se conecta al servidor MCP de Sigmetría via HTTP directo
 * (stateless, sin SSE), lista las herramientas disponibles, y usa Gemini
 * para decidir qué herramienta llamar según lo que le preguntes.
 */

// ── Dependencias ──────────────────────────────────────────────────
// Usamos las que ya están instaladas en el proyecto
import { createInterface } from 'node:readline'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Configuración ─────────────────────────────────────────────────
const MCP_URL = 'https://hys-app-sig.vercel.app/api/mcp'
const GEMINI_MODEL = 'gemini-2.0-flash' // o 'gemini-2.5-flash' si tenés acceso

// ── MCP Client bare-metal (sin SDK, HTTP directo) ─────────────────
class McpClient {
  #apiKey
  #baseUrl
  #requestId = 0

  constructor(apiKey, baseUrl = MCP_URL) {
    this.#apiKey = apiKey
    this.#baseUrl = baseUrl
  }

  /** Envía un JSON-RPC request al MCP server y devuelve el result. */
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

  /** Inicializa la conexión MCP (stateless, solo para verificar). */
  async initialize() {
    const result = await this.#request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {},
        roots: { listChanged: false },
      },
      clientInfo: {
        name: 'sigmetria-gemini-test',
        version: '1.0.0',
      },
    })
    return result
  }

  /** Lista las herramientas disponibles. */
  async listTools() {
    const result = await this.#request('tools/list')
    return result.tools
  }

  /** Llama a una herramienta MCP. */
  async callTool(name, args = {}) {
    const result = await this.#request('tools/call', { name, arguments: args })
    return result
  }
}

// ── Gemini helper ─────────────────────────────────────────────────
function createGemini(systemPrompt, tools) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY. Seteala como variable de entorno:\n' +
      '  $env:GEMINI_API_KEY = "tu_key"  (PowerShell)\n' +
      '  o agregala a .env.local'
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  })

  // Convertir tools de MCP a formato Gemini FunctionDeclaration
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
  // ── Leer API key ─────────────────────────────────────────────
  const sigApiKey = process.argv[2]
  if (!sigApiKey) {
    console.error(`
❌ Uso: node test-mcp-gemini.mjs <tu_api_key_sigmetria>

   La API key la creás en Sigmetría → Configuración → Conexiones → "Tus claves de acceso"

   También necesitás la variable GEMINI_API_KEY:
     \$env:GEMINI_API_KEY = "tu_key_de_google"   (PowerShell)
`)
    process.exit(1)
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║     🧪 Sigmetría MCP × Gemini — Test interactivo     ║
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

  // ── Listar herramientas ──────────────────────────────────────
  console.log('\n🔧 Listando herramientas disponibles...')
  const tools = await mcp.listTools()
  console.log(`   ${tools.length} herramientas encontradas:\n`)
  for (const t of tools) {
    const params = t.inputSchema?.properties
      ? Object.keys(t.inputSchema.properties).join(', ')
      : '—'
    console.log(`   📍 ${t.name}`)
    console.log(`      ${t.description}`)
    console.log(`      Parámetros: ${params}\n`)
  }

  // ── Inicializar Gemini ───────────────────────────────────────
  const systemPrompt = `Sos un asistente de Higiene y Seguridad que ayuda al usuario a consultar datos de su empresa de consultoría HyS.

TENÉS acceso a estas herramientas MCP para obtener datos REALES del sistema Sigmetría:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

REGLAS:
1. SIEMPRE usá las herramientas para responder. No inventes datos.
2. Si el usuario pide algo que requiere una herramienta, llamala.
3. Si no sabés qué herramienta usar, preguntale al usuario qué necesita.
4. Respondé en español rioplatense, con onda pero profesional.
5. Si el usuario pide "mostrame mis empresas" usá listar_empresas.
6. Si necesitás un ID que no tenés, preguntáselo al usuario.`

  let gemini
  try {
    gemini = createGemini(systemPrompt, tools)
    console.log('🤖 Gemini conectado correctamente.')
  } catch (err) {
    console.error(`❌ Error configurando Gemini: ${err.message}`)
    process.exit(1)
  }

  // ── Modo interactivo ─────────────────────────────────────────
  console.log(`
─────────────────────────────────────────────────────
  Escribí una pregunta o "salir" para terminar.
  Ej: "mostrame mis empresas" o "qué establecimientos tengo"

  Importante: es posible que la primer pregunta
  demore ~10 segundos (Gemini + MCP).
─────────────────────────────────────────────────────
`)

  const history = []

  while (true) {
    const input = await question('\n💬 Vos: ')
    const trimmed = input.trim()

    if (!trimmed) continue
    if (trimmed.toLowerCase() === 'salir' || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log('\n👋 ¡Hasta la próxima!')
      break
    }

    // ── Enviar a Gemini ────────────────────────────────────────
    try {
      const chat = gemini.model.startChat({
        history: history.slice(-20), // últimos 20 mensajes de contexto
        tools: gemini.geminiTools,
      })

      const result = await chat.sendMessage(trimmed)
      const response = result.response

      // ── Procesar function calls de Gemini ────────────────────
      const calls = response.functionCalls()

      if (calls && calls.length > 0) {
        for (const call of calls) {
          console.log(`\n   🛠️  Llamando a "${call.name}"...`)
          try {
            const toolResult = await mcp.callTool(call.name, call.args)
            const textContent = (toolResult.content ?? [])
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n')

            // Enviar el resultado de vuelta a Gemini
            const result2 = await chat.sendMessage([
              { text: `Resultado de ${call.name}: ${textContent}` },
            ])
            const response2 = result2.response
            const text = response2.text()
            if (text) {
              console.log(`\n   🤖 Gemini:\n   ${text.replace(/\n/g, '\n   ')}`)
            }
          } catch (err) {
            console.error(`   ❌ Error llamando ${call.name}: ${err.message}`)
          }
        }
      } else {
        // Respuesta directa de Gemini (sin function call)
        const text = response.text()
        if (text) {
          console.log(`\n   🤖 Gemini:\n   ${text.replace(/\n/g, '\n   ')}`)
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

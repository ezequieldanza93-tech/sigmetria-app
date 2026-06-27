import { NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateApiKey } from '@/lib/api/auth'
import { createMcpServer } from '@/lib/mcp/server'

/**
 * POST /api/mcp
 *
 * Entry point del servidor MCP de Sigmetría HyS.
 * Usa Streamable HTTP transport en modo stateless.
 *
 * Autenticación: Bearer token via API key (tabla api_keys).
 * Cada request crea un transport + server fresh (stateless).
 */
export async function POST(request: NextRequest) {
  // ── Autenticación ──────────────────────────────────────────
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'API key inválida o ausente. Usá Authorization: Bearer sig_<tu_key>' } },
      { status: 401 },
    )
  }

  // ── Crear server + transport ──────────────────────────────
  // Stateless: cada request es independiente, sin sesión persistente.
  // enableJsonResponse: devuelve JSON en vez de SSE (ideal para serverless).
  const server = createMcpServer({ consultoraId: auth.consultora_id })
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  })

  // Conectar server al transport (setea onmessage handler)
  await server.connect(transport)

  try {
    // Procesar el request HTTP y devolver la respuesta
    const response = await transport.handleRequest(request.clone() as unknown as Request)
    return response
  } finally {
    // Cerrar la conexión para permitir reconnect en próximos requests
    await server.close().catch(() => {})
  }
}

/**
 * GET /api/mcp
 *
 * El spec de Streamable HTTP requiere endpoint GET para SSE.
 * Como operamos en modo stateless con JSON responses, devolvemos 405.
 * En el futuro podríamos soportar SSE para notificaciones en tiempo real.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Usá POST para comunicación MCP.' },
      id: null,
    }),
    {
      status: 405,
      headers: {
        Allow: 'POST',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
      },
    },
  )
}

/**
 * OPTIONS /api/mcp
 *
 * CORS preflight para que Claude Desktop y otros clientes puedan conectar.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Accept',
      'Access-Control-Max-Age': '86400',
    },
  })
}

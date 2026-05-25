import crypto from 'crypto'

export interface WebhookHeaders {
  'x-signature': string
  'x-request-id': string
}

export interface WebhookVerificationResult {
  valid: boolean
  dataId: string | null
  ts: string | null
  error?: string
}

/**
 * Verifica la firma HMAC de un webhook de Mercado Pago.
 *
 * El header x-signature tiene formato:
 *   ts=1234567890;v1=abcdef123456...
 *
 * El manifest se construye como:
 *   id:{data.id};request-id:{x-request-id};ts:{ts};
 *
 * Se computa HMAC-SHA256 con MERCADOPAGO_WEBHOOK_SECRET
 * y se compara con el v1 del header.
 */
export function verifyWebhookSignature(
  headers: WebhookHeaders,
  dataId: string | null,
): WebhookVerificationResult {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    return { valid: false, dataId: null, ts: null, error: 'MERCADOPAGO_WEBHOOK_SECRET no configurado' }
  }

  const xSignature = headers['x-signature']
  const xRequestId = headers['x-request-id']

  if (!xSignature || !xRequestId) {
    return { valid: false, dataId: null, ts: null, error: 'Headers x-signature y x-request-id requeridos' }
  }

  if (!dataId) {
    return { valid: false, dataId: null, ts: null, error: 'data.id no encontrado' }
  }

  const tsMatch = xSignature.match(/ts=(\d+)/)
  const sigMatch = xSignature.match(/v1=([a-f0-9]+)/)

  if (!tsMatch || !sigMatch) {
    return { valid: false, dataId, ts: null, error: 'Formato de x-signature inválido' }
  }

  const ts = tsMatch[1]
  const sig = sigMatch[1]

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  if (hmac !== sig) {
    return { valid: false, dataId, ts, error: 'HMAC mismatch — firma inválida' }
  }

  return { valid: true, dataId, ts }
}

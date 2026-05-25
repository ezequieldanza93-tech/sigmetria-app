import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Payment } from 'mercadopago'

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
const isConfigured = !!accessToken

export const mpClient = new MercadoPagoConfig({
  accessToken: accessToken ?? '',
  options: { timeout: 10000, idempotencyKey: undefined },
})

export const mpPreApproval = new PreApproval(mpClient)
export const mpPreApprovalPlan = new PreApprovalPlan(mpClient)
export const mpPayment = new Payment(mpClient)

export function isMercadoPagoConfigured(): boolean {
  return isConfigured
}

export function getMercadoPagoEnv(): 'sandbox' | 'production' {
  return (process.env.MERCADOPAGO_ENV as 'sandbox' | 'production') ?? 'sandbox'
}

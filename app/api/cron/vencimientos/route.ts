import { NextResponse } from 'next/server'
import { refrescarNotificacionesCron } from '@/lib/actions/configuracion-vencimiento'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('CRON_SECRET no configurado — el endpoint no puede autenticarse')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refrescarNotificacionesCron()
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ procesadas: result.data.procesadas })
}

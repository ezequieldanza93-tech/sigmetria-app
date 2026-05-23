import { NextResponse } from 'next/server'
import { refrescarNotificacionesCron } from '@/lib/actions/configuracion-vencimiento'

export async function GET(request: Request) {
  // Protegido por CRON_SECRET (opcional)
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refrescarNotificacionesCron()
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ procesadas: result.data.procesadas })
}

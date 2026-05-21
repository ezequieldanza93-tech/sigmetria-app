import { NextResponse } from 'next/server'
import { seedKnowledgeBase } from '@/lib/agent/seed'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Solo disponible en desarrollo' }, { status: 403 })
  }

  try {
    const result = await seedKnowledgeBase()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Seed KB]', error)
    return NextResponse.json({ error: 'Error al seedear la base de conocimiento' }, { status: 500 })
  }
}

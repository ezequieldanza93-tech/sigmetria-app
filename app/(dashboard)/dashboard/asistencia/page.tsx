'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const ChatPanel = dynamic(() => import('@/components/agent/chat-panel').then(m => ({ default: m.ChatPanel })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-text-tertiary p-8">Cargando asistente...</div>,
})

export default function AsistenciaPage() {
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) redirect('/login')
    })
  }, [])

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border-subtle">
        <h1 className="text-xl font-bold text-text-primary">Asistente HyS</h1>
        <p className="text-sm text-text-tertiary">Consultá sobre tus empresas, establecimientos, incidentes y más.</p>
      </div>
      <div className="flex-1">
        <ChatPanel variant="full" />
      </div>
    </div>
  )
}

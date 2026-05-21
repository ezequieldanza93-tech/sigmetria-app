'use client'

import { ChatPanel } from './chat-panel'

interface AsistenteTabContentProps {
  establecimientoId: string
  empresaId: string
}

export function AsistenteTabContent({ establecimientoId: _establecimientoId, empresaId: _empresaId }: AsistenteTabContentProps) {
  return <ChatPanel variant="full" />
}

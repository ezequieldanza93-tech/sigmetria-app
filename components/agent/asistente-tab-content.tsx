'use client'

import { ChatPanel } from './chat-panel'

interface AsistenteTabContentProps {
  establecimientoId: string
  empresaId: string
}

export function AsistenteTabContent({ establecimientoId, empresaId }: AsistenteTabContentProps) {
  return <ChatPanel variant="full" establecimientoId={establecimientoId} empresaId={empresaId} />
}

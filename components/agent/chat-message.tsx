'use client'

import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-brand-muted flex items-center justify-center mt-0.5">
          <Bot size={16} className="text-brand-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-brand-primary text-white rounded-br-md'
            : 'bg-surface-elevated border border-border-subtle text-text-primary rounded-bl-md',
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center mt-0.5">
          <User size={16} className="text-text-tertiary" />
        </div>
      )}
    </div>
  )
}

'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface State {
  error: Error | null
  info: ErrorInfo | null
  copied: boolean
}

export class DevErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
  }

  copy() {
    const text = `ERROR: ${this.state.error?.message}\n\nSTACK:\n${this.state.error?.stack}\n\nCOMPONENT STACK:\n${this.state.info?.componentStack}`
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  render() {
    const { error, info, copied } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-xl">⚠</span>
              <h1 className="text-red-400 font-bold text-lg">Error de aplicación</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => this.copy()}
                className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1.5 rounded border border-gray-700 transition-colors"
              >
                {copied ? '✓ Copiado' : 'Copiar error'}
              </button>
              <button
                onClick={() => { this.setState({ error: null, info: null }); window.location.reload() }}
                className="bg-blue-700 hover:bg-blue-600 text-xs px-3 py-1.5 rounded transition-colors"
              >
                Recargar
              </button>
            </div>
          </div>

          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-300 text-sm font-bold mb-1">{error.name}</p>
            <p className="text-red-200 text-sm">{error.message}</p>
          </div>

          {error.stack && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Stack trace</p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {error.stack}
              </pre>
            </div>
          )}

          {info?.componentStack && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Component stack</p>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {info.componentStack}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }
}

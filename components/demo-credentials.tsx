export function DemoCredentials() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="mt-8 pt-8 border-t border-border-subtle">
      <p className="text-text-secondary text-xs font-medium mb-3">
        Usuarios de demostración
      </p>
      <div className="bg-surface-sunken rounded-lg p-4">
        <p className="text-text-tertiary text-xs mb-3">
          Contraseña para todos: <code className="bg-surface-base px-1.5 py-0.5 rounded text-text-primary">Demo1234!</code>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <DemoUser email="dev@sigmetria.app" role="Developer" />
          <DemoUser email="admin.main@sigmetria.app" role="Admin Principal" />
          <DemoUser email="admin.branch@sigmetria.app" role="Admin Branch" />
          <DemoUser email="colaborador@sigmetria.app" role="Colaborador" />
          <DemoUser email="viewer@sigmetria.app" role="Viewer Global" />
          <DemoUser email="colaborador.viewer@sigmetria.app" role="Viewer Limitado" />
        </div>
      </div>
    </div>
  )
}

function DemoUser({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-primary font-medium truncate">{email}</span>
      <span className="text-text-tertiary">{role}</span>
    </div>
  )
}

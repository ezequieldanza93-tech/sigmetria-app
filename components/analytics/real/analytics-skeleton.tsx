export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-elevated border border-border-subtle" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-surface-elevated border border-border-subtle" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-surface-elevated border border-border-subtle" />
    </div>
  )
}

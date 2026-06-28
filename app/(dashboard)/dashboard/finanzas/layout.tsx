import { FinanzasSubnav } from '@/components/finanzas/finanzas-subnav'

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <FinanzasSubnav />
      {children}
    </div>
  )
}

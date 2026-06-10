import { GlobalSectionsSidebar } from '@/components/layout/global-sections-sidebar'

export default function DashboardInnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <GlobalSectionsSidebar>{children}</GlobalSectionsSidebar>
}

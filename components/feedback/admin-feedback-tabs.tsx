'use client'

import { useState } from 'react'
import { Tabs } from '@/components/ui/tabs'
import { useFeedbackAdmin } from '@/lib/queries/feedback'
import { AdminFeedbackTable } from '@/components/feedback/admin-feedback-table'
import { AdminFeedbackDetailModal } from '@/components/feedback/admin-feedback-detail-modal'
import type { Feedback } from '@/lib/types'

export function AdminFeedbackTabs() {
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)

  // Always fetch all tipos separately so switching tabs doesn't refetch
  const npsQuery = useFeedbackAdmin('nps')
  const bugsQuery = useFeedbackAdmin('bug')
  const sugerenciasQuery = useFeedbackAdmin('sugerencia')
  const generalQuery = useFeedbackAdmin('general')

  const tabs = [
    {
      id: 'nps',
      label: `NPS (${npsQuery.data?.length ?? 0})`,
      content: (
        <AdminFeedbackTable
          feedbacks={npsQuery.data}
          isLoading={npsQuery.isLoading}
          tipo="nps"
          onSelect={setSelectedFeedback}
        />
      ),
    },
    {
      id: 'bug',
      label: `Bugs (${bugsQuery.data?.length ?? 0})`,
      content: (
        <AdminFeedbackTable
          feedbacks={bugsQuery.data}
          isLoading={bugsQuery.isLoading}
          tipo="bug"
          onSelect={setSelectedFeedback}
        />
      ),
    },
    {
      id: 'sugerencia',
      label: `Sugerencias (${sugerenciasQuery.data?.length ?? 0})`,
      content: (
        <AdminFeedbackTable
          feedbacks={sugerenciasQuery.data}
          isLoading={sugerenciasQuery.isLoading}
          tipo="sugerencia"
          onSelect={setSelectedFeedback}
        />
      ),
    },
    {
      id: 'general',
      label: `General (${generalQuery.data?.length ?? 0})`,
      content: (
        <AdminFeedbackTable
          feedbacks={generalQuery.data}
          isLoading={generalQuery.isLoading}
          tipo="general"
          onSelect={setSelectedFeedback}
        />
      ),
    },
  ]

  return (
    <>
      <Tabs tabs={tabs} defaultTab="nps" />
      <AdminFeedbackDetailModal
        feedback={selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
      />
    </>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboardKpis, getUserWidgetConfig, saveUserWidgetConfig } from '@/lib/actions/dashboard'
import type { WidgetKey } from '@/lib/constants'
import { WIDGET_KEYS } from '@/lib/constants'

export function useDashboardKpis(widgetKeys: WidgetKey[]) {
  return useQuery({
    queryKey: ['dashboard-kpis', widgetKeys],
    queryFn: async () => {
      const result = await getDashboardKpis(widgetKeys)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: widgetKeys.length > 0,
    staleTime: 1000 * 60 * 2,
  })
}

export function useUserWidgetConfig() {
  return useQuery({
    queryKey: ['user-widget-config'],
    queryFn: async () => {
      const result = await getUserWidgetConfig()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSaveUserWidgetConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (widgets: { widget_key: string; visible: boolean; position: number }[]) => {
      const result = await saveUserWidgetConfig(widgets)
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-widget-config'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useVisibleWidgetKeys(): { widgetKeys: WidgetKey[]; isLoading: boolean } {
  const { data: config, isLoading } = useUserWidgetConfig()

  if (!config || config.length === 0) {
    return { widgetKeys: WIDGET_KEYS, isLoading }
  }

  const visible = config
    .filter(w => w.visible)
    .map(w => w.widget_key as WidgetKey)
    .filter(k => (WIDGET_KEYS as string[]).includes(k))

  return { widgetKeys: visible.length > 0 ? visible : WIDGET_KEYS, isLoading }
}

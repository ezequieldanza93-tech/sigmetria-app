import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../src/lib/globals.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false } },
})

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark'
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: isDark ? '#0F1115' : '#FFFFFF' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="empresa/[id]" />
          <Stack.Screen name="establecimiento/[id]" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

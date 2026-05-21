import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Building2, Users, Package, BarChart3, Settings } from 'lucide-react-native'

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark'
  const tint = '#4CAF50'
  const inactiveTint = isDark ? '#888' : '#999'
  const bg = isDark ? '#1A1D23' : '#FFF'
  const border = isDark ? '#22262E' : '#E4E4E7'

  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: tint, tabBarInactiveTintColor: inactiveTint,
      tabBarStyle: { backgroundColor: bg, borderTopColor: border }, tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    }}>
      <Tabs.Screen name="empresas" options={{ title: 'Empresas', tabBarIcon: ({ size, color }) => <Building2 size={size} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="personas" options={{ title: 'Personas', tabBarIcon: ({ size, color }) => <Users size={size} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="productos" options={{ title: 'Productos', tabBarIcon: ({ size, color }) => <Package size={size} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="config" options={{ title: 'Ajustes', tabBarIcon: ({ size, color }) => <Settings size={size} color={color} strokeWidth={1.75} /> }} />
    </Tabs>
  )
}

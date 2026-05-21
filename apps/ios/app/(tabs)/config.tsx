import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/src/lib/supabase'
import { LogOut } from 'lucide-react-native'

export default function ConfigScreen() {
  const router = useRouter()
  return (
    <View className="flex-1 bg-[#0F1115] px-4 pt-12">
      <Text className="text-2xl font-bold text-white mb-6">Ajustes</Text>
      <TouchableOpacity onPress={() => { supabase.auth.signOut(); router.replace('/(auth)/login') }} className="flex-row items-center gap-3 bg-[#1A1D23] rounded-xl p-4 border border-[#22262E]" style={{ minHeight: 44 }}>
        <LogOut size={20} color="#EF4444" strokeWidth={1.75} /><Text className="text-red-400 font-medium">Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

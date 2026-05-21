import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/src/lib/supabase'
import { Building2 } from 'lucide-react-native'

export default function EmpresasScreen() {
  const router = useRouter()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => { const { data } = await supabase.from('empresas').select('id, razon_social, cuit, is_active').order('razon_social'); return data ?? [] },
  })
  if (isLoading) return <View className="flex-1 bg-[#0F1115] justify-center items-center"><ActivityIndicator color="#4CAF50" size="large" /></View>
  return (
    <View className="flex-1 bg-[#0F1115]">
      <View className="px-4 pt-12 pb-2"><Text className="text-2xl font-bold text-white">Empresas</Text><Text className="text-[#B0B0B0] text-sm mt-1">{data?.length ?? 0} empresas</Text></View>
      <FlatList data={data} keyExtractor={i => i.id} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#4CAF50" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/empresa/${item.id}`)} className="bg-[#1A1D23] rounded-xl p-4 border border-[#22262E] flex-row items-center gap-3" style={{ minHeight: 72 }}>
            <View className="w-10 h-10 bg-[#4CAF50]/10 rounded-xl items-center justify-center"><Building2 size={20} color="#4CAF50" strokeWidth={1.75} /></View>
            <View className="flex-1"><Text className="text-white font-semibold">{item.razon_social}</Text>{item.cuit ? <Text className="text-[#888] text-xs font-mono mt-0.5">{item.cuit}</Text> : null}</View>
            <View className={`px-2 py-0.5 rounded-full ${item.is_active ? 'bg-green-900/30' : 'bg-gray-800'}`}><Text className={`text-xs font-medium ${item.is_active ? 'text-green-400' : 'text-gray-500'}`}>{item.is_active ? 'Activa' : 'Inactiva'}</Text></View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View className="items-center py-12"><Text className="text-[#888] text-base">Sin empresas asignadas</Text></View>}
      />
    </View>
  )
}

import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/src/lib/supabase'
import { Factory, ArrowLeft } from 'lucide-react-native'

export default function EmpresaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['empresa', id],
    queryFn: async () => {
      const { data: empresa } = await supabase.from('empresas').select('*, empresas_rubros(nombre), localidades(nombre, provincia)').eq('id', id).single()
      const { data: establecimientos } = await supabase.from('establecimientos').select('id, nombre, establecimientos_tipos(nombre), localidades!localidad_id(nombre, provincia), cantidad_trabajadores').eq('empresa_id', id).neq('status', 'cancelled').order('nombre')
      return { empresa, establecimientos: establecimientos ?? [] }
    },
  })
  if (isLoading || !data) return <View className="flex-1 bg-[#0F1115] justify-center items-center"><ActivityIndicator color="#4CAF50" size="large" /></View>
  return (
    <View className="flex-1 bg-[#0F1115]">
      <View className="px-4 pt-12 pb-2 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}><ArrowLeft size={24} color="#FFF" /></TouchableOpacity>
        <View><Text className="text-white text-xl font-bold">{data.empresa.razon_social}</Text>{data.empresa.empresas_rubros ? <Text className="text-[#888] text-sm">{data.empresa.empresas_rubros.nombre}</Text> : null}</View>
      </View>
      <FlatList data={data.establecimientos} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={<View className="mb-2"><Text className="text-[#B0B0B0] text-sm font-medium">Establecimientos</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/establecimiento/${item.id}`)} className="bg-[#1A1D23] rounded-xl p-4 border border-[#22262E] flex-row items-center gap-3" style={{ minHeight: 72 }}>
            <View className="w-10 h-10 bg-[#4CAF50]/10 rounded-xl items-center justify-center"><Factory size={20} color="#4CAF50" strokeWidth={1.75} /></View>
            <View className="flex-1"><Text className="text-white font-semibold">{item.nombre}</Text>{item.localidades ? <Text className="text-[#888] text-xs mt-0.5">{item.localidades.nombre}, {item.localidades.provincia}</Text> : null}</View>
            {item.cantidad_trabajadores ? <Text className="text-[#888] text-xs">{item.cantidad_trabajadores} trab.</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/src/lib/supabase'
import { ArrowLeft, MapPin, Users } from 'lucide-react-native'

const TABS = [{ id: 'sectores', label: 'Sectores' }, { id: 'riesgos', label: 'Riesgos' }, { id: 'siniestros', label: 'Siniestros' }, { id: 'inspecciones', label: 'Inspecciones' }, { id: 'capacitaciones', label: 'Capacitaciones' }, { id: 'mediciones', label: 'Mediciones' }, { id: 'documentos', label: 'Documentos' }, { id: 'gestiones', label: 'Gestiones' }, { id: 'asistencia', label: 'Asistencia' }]

export default function EstablecimientoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['establecimiento', id],
    queryFn: async () => { const { data } = await supabase.from('establecimientos').select('*, establecimientos_tipos(nombre), localidades(nombre, provincia)').eq('id', id).single(); return data },
  })
  if (isLoading || !data) return <View className="flex-1 bg-[#0F1115] justify-center items-center"><ActivityIndicator color="#4CAF50" size="large" /></View>
  return (
    <View className="flex-1 bg-[#0F1115]">
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}><ArrowLeft size={24} color="#FFF" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold mt-2">{data.nombre}</Text>
        {data.localidades ? <View className="flex-row items-center gap-1 mt-1"><MapPin size={14} color="#888" /><Text className="text-[#888] text-sm">{data.localidades.nombre}, {data.localidades.provincia}</Text></View> : null}
        {data.cantidad_trabajadores ? <View className="flex-row items-center gap-1 mt-1"><Users size={14} color="#888" /><Text className="text-[#888] text-sm">{data.cantidad_trabajadores} trabajadores</Text></View> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-2">
        {TABS.map(tab => <TouchableOpacity key={tab.id} className="px-4 py-2 mr-2 bg-[#22262E] rounded-full" style={{ minHeight: 36 }}><Text className="text-[#B0B0B0] text-sm font-medium">{tab.label}</Text></TouchableOpacity>)}
      </ScrollView>
      <View className="flex-1 items-center justify-center"><Text className="text-[#888]">Seleccioná un tab</Text></View>
    </View>
  )
}

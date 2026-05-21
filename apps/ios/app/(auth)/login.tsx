import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/src/lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Completá todos los campos'); return }
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    await supabase.rpc('cache_user_permissions')
    router.replace('/(tabs)/empresas')
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#0F1115] justify-center px-4">
      <View className="w-full max-w-sm mx-auto">
        <View className="items-center mb-8">
          <View className="w-14 h-14 bg-[#4CAF50] rounded-2xl items-center justify-center mb-4"><Text className="text-white text-2xl font-bold">S</Text></View>
          <Text className="text-white text-2xl font-bold">Sigmetría HyS</Text>
          <Text className="text-[#B0B0B0] text-sm mt-1">Plataforma de Higiene y Seguridad</Text>
        </View>
        <View className="bg-[#1A1D23] rounded-2xl p-6" style={{ gap: 16 }}>
          {error ? <View className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"><Text className="text-red-400 text-sm">{error}</Text></View> : null}
          <View><Text className="text-[#F0F0F0] text-sm font-medium mb-1.5">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="usuario@sigmetria.app" placeholderTextColor="#888"
              className="w-full bg-[#22262E] border border-[#2D323B] text-white rounded-lg px-3 py-2.5 text-sm" /></View>
          <View><Text className="text-[#F0F0F0] text-sm font-medium mb-1.5">Contraseña</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor="#888"
              className="w-full bg-[#22262E] border border-[#2D323B] text-white rounded-lg px-3 py-2.5 text-sm" /></View>
          <TouchableOpacity onPress={handleLogin} disabled={loading}
            className="w-full bg-[#4CAF50] disabled:opacity-50 rounded-lg py-2.5 items-center" style={{ minHeight: 44 }}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-semibold text-sm">Ingresar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

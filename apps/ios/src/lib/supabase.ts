import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lslzhgmoaxgkcjeweqaz.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbHpoZ21vYXhna2NqZXdlcWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODA2MjUsImV4cCI6MjA5NDM1NjYyNX0.SKJYB9evAfn6fzsee37Lol5LXM7hPDei9SoY4XoJ7iQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

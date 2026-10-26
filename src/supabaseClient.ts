import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The anon key is meant to be public -- Supabase's own security boundary
// is Row Level Security policies on the database, not secrecy of this
// key, so shipping it in the client bundle (as every `VITE_*` var is) is
// the intended usage, not a leak.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = supabase !== null

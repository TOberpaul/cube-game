import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oxaofethipnpdxskajla.supabase.co';
// Supports both new publishable key (sb_publishable_...) and legacy anon key (eyJ...)
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

let _supabase: SupabaseClient | null = null;

if (SUPABASE_KEY) {
  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.warn('Supabase key not set — online multiplayer disabled. Set VITE_SUPABASE_KEY.');
}

export const supabase = _supabase;
export const isSupabaseAvailable = !!_supabase;

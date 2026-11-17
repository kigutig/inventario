import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Obter URL e Anon Key do ambiente ou do localStorage
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const customUrl = localStorage.getItem('custom_supabase_url');
  const customKey = localStorage.getItem('custom_supabase_anon_key');

  const url = customUrl || DEFAULT_URL;
  const anonKey = customKey || DEFAULT_KEY;

  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (url) localStorage.setItem('custom_supabase_url', url.trim());
  else localStorage.removeItem('custom_supabase_url');

  if (anonKey) localStorage.setItem('custom_supabase_anon_key', anonKey.trim());
  else localStorage.removeItem('custom_supabase_anon_key');

  // Recarregar cliente ou página para aplicar novo client
  window.location.reload();
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('http') &&
    !url.includes('sua-url-do-supabase') &&
    anonKey.length > 20
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    const { url, anonKey } = getSupabaseCredentials();
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseInstance;
}


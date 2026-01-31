import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Server-side client with service role key (lazy initialization)
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin() {
  if (!_supabaseAdmin && supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabaseAdmin;
}

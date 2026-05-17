import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cookie-free Supabase client for unauthenticated (public) pages.
// RLS on public_disclosures allows SELECT without auth via anon key.
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

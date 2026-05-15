import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function clean(s: string | undefined): string {
  return (s ?? '').replace(/^﻿/, '').trim()
}

export function createAdminClient() {
  return createClient<Database>(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

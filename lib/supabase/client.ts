// Supabase client for client-side usage
// TODO: Initialize Supabase client for browser usage
// TODO: Use environment variables for Supabase URL and anon key
// TODO: Configure auth settings

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}


import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Browser-side client — safe to import in Client Components */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

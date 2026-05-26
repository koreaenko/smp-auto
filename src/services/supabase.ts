import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
// Use Service Role Key for backend operations (cron, webhooks) to bypass RLS safely
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key-for-static-build-compilation-only';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("WARNING: NEXT_PUBLIC_SUPABASE_URL is missing in env.");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY / ANON_KEY is missing in env.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Server-side environment, no need for localStorage session
  }
});

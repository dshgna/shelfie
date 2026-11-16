// Landing page waitlist sign-up (Supabase edge function, Deno). The logic is in ./logic.ts and
// tested with Vitest; this file only wires it to Deno and supabase-js.
//
// Environment: SITE_URL (set with `supabase secrets set`), plus SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY, which Supabase provides to every function. No key is in this repo.
// Deployed with JWT verification off (supabase/config.toml), because a plain HTML form posts here.
//
// Privacy: never log email addresses, request bodies, database error details or the key.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleSignup, type SignupResult, type SignupRpc } from './logic.ts'

function signupRpc(): SignupRpc | null {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return null
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return async (email, notice) => {
    const { data, error } = await supabase.rpc('signup_add', { p_email: email, p_notice: notice })
    if (error) {
      // Only the error code: a database message can repeat the value that was sent.
      console.error(`signup: signup_add failed (${error.code ?? 'no code'})`)
      throw new Error('signup_add failed')
    }
    return data as SignupResult
  }
}

const rpc = signupRpc()

Deno.serve((request) => handleSignup(request, { siteUrl: Deno.env.get('SITE_URL'), rpc }))

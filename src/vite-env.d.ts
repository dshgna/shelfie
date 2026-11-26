/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** The Supabase project URL. Public by design; the only other VITE_ variable is the anon key. */
  readonly VITE_SUPABASE_URL?: string
  /** The Supabase anon (publishable) key. Never a service-role key (CLAUDE.md privacy rule 4). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

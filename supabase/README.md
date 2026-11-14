# Supabase

Created in step 5 with `supabase init`. Planned contents:

- `migrations/` - tables for encrypted records (ciphertext, nonce, `updated_at`, deletion marker) with row-level security so each user can only reach their own rows.
- `functions/ai-import/` - the AI proxy: requires login, rate-limits per user, enforces a monthly spend cap, keeps no logs or content. Its provider key lives in function secrets (`supabase secrets set`), never in this repo.

Use two projects, one for development and one for production, each with its own keys.

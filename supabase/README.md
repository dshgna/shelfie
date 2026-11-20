# Supabase

Created in step 5 with `supabase init`. Planned contents:

- `migrations/` - tables for encrypted records (ciphertext, nonce, `updated_at`, deletion marker) with row-level security so each user can only reach their own rows.
- `functions/ai-import/` - the AI proxy: requires login, rate-limits per user, enforces a monthly spend cap, keeps no logs or content. Its provider key lives in function secrets (`supabase secrets set`), never in this repo.

Use two projects, one for development and one for production, each with its own keys.

## Functions

### `signup` (landing page waitlist)

`functions/signup/`: the landing page's two sign-up forms (`form=hero` and `form=end`) post `email`, `website` (a honeypot) and `form` here; it calls `public.signup_add` with the service role. The result always shows on the landing page itself, under the form that was used:

- With JavaScript (`site/site-assets/signup.js`, `Accept: application/json`): JSON `{"result": "ok" | "invalid" | "rate_limited" | "error"}` with status 200, 400, 429 or 500, and `Access-Control-Allow-Origin: <SITE_URL>`.
- Without JavaScript (a plain form post): `303` to `<SITE_URL>/#signup-<form>-<result>` (for example `#signup-hero-ok`, `#signup-end-rate-limited`), where the page shows the matching message.

A missing or invalid `SITE_URL` is a bare `500`. The logic is in `logic.ts`, tested by Vitest (`logic.test.ts`); `index.ts` is the Deno entry point. JWT verification is off for this function only (`config.toml`). The table `marketing.signup_emails` and `public.signup_add` come from the owner's own migration. The landing page's CSP allows this project's origin (`SITE_SIGNUP_ORIGIN` in `security-headers.ts`) for `form-action` and `connect-src`.

Deploy (dev project first, then production):

```sh
supabase link --project-ref <project-ref>
supabase secrets set SITE_URL=<exact https origin of the landing page, e.g. https://example.com, no trailing slash>
supabase functions deploy signup --no-verify-jwt
```

Test a plain form post (expect `HTTP/2 303` and `location: <SITE_URL>/#signup-hero-ok`):

```sh
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/signup" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=<your test address>" \
  --data-urlencode "website=" \
  --data-urlencode "form=hero"
```

Test the script's request (expect `HTTP/2 200` and `{"result":"ok"}`):

```sh
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/signup" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  --data-urlencode "email=<your test address>" \
  --data-urlencode "website=" \
  --data-urlencode "form=end"
```

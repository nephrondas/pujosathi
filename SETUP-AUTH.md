# PujoSathi — Authentication & Personalization Setup

## What works right now (no configuration needed)

- **Guest mode** — full browsing, local saves (food / pandals / bhog), visited marks,
  My Pujo itinerary, share-link generation. All stored in `localStorage` on the device.
- **Email accounts & Mobile OTP (demo mode)** — accounts are created and verified in the
  browser and stored in `localStorage` (`pujoUsers`). Passwords are **hashed**
  (SHA-256 via WebCrypto with a per-user random salt; a JS fallback hash is used when
  WebCrypto is unavailable). Plain-text passwords are **never** stored.
  This is a demo store so the flows are testable without a server. It is **not** a
  production user database.

## What needs configuring for production

All config lives at the top of the account module inside `_template-source.html`:

```js
const PUJO_CONFIG = {
  googleClientId: '',   // Google OAuth 2.0 Client ID
  facebookAppId:  '',   // Facebook App ID
  authApiBase:    '',   // your auth backend base URL
};
```

### 1. Google OAuth
1. Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web).
2. Authorized redirect URI: `https://yourdomain/` (and your preview origin while testing).
3. Put the client ID in `PUJO_CONFIG.googleClientId`.
4. The "Continue with Google" button then starts a real OAuth redirect. You still need a
   small backend endpoint to exchange the `code` for tokens (Google requires a secret)
   and return `{name,email,sub}` to the site — set its URL in `authApiBase`.

### 2. Facebook OAuth
1. developers.facebook.com → Create App (Facebook Login product).
2. Valid OAuth redirect URI: `https://yourdomain/`.
3. Put the App ID in `PUJO_CONFIG.facebookAppId`; same backend exchange requirement.

### 3. Email accounts (production)
Replace the demo `emailSubmit()` flow with calls to your backend:
- `POST {authApiBase}/signup`  `{name,email,password}` → `{token,user}`
- `POST {authApiBase}/login`   `{email,password}`     → `{token,user}`
Run the same logic server-side with bcrypt/Argon2. Never store or log raw passwords.

### 4. Mobile OTP (production)
Connect an SMS provider (MSG91 / Twilio / Firebase Phone Auth):
- `POST {authApiBase}/otp/send` `{phone}`
- `POST {authApiBase}/otp/verify` `{phone,code}` → `{token,user}`
Remove the demo "OTP shown on screen" note once a gateway is connected.

## Recommended database schema (when you add a backend)

```
users:          id, name, email, phone, profile_photo, created_at
saved_places:   user_id, place_id, place_type (food|pandal|bhog), created_at
visited_places: user_id, place_id, visited_at
itinerary:      user_id, day (shashthi..dashami), place_id, place_type, sort_order, notes
```

## Storage keys used on the client

| Key | Meaning |
|---|---|
| `pujoSession` | current session (`{"mode":"guest"}` or user uid) |
| `pujoUsers` | **demo** account store (hashed passwords) |
| `pujo_saved2_<uid|guest>` | saved list `[{t:'food'|'pandal'|'bhog', id, at}]` |
| `pujo_visited_<uid|guest>` | visited refs `["food:id","pandal:id"]` |
| `pujo_plan_<uid|guest>` | My Pujo plan + `shareable` flag |
| `pujoSaved` | legacy food-only saves (auto-migrated on first load) |

## Privacy notes

- Emails / phone numbers are never rendered publicly; they appear only in the user's own
  Settings/Profile panel.
- Itineraries are **private by default**. The share button is only enabled after the user
  turns on sharing in Settings, and the generated link contains **place names only** —
  no name, email, phone or account reference.
- "Delete account" removes the demo user record and all personal data keys.

---

## Supabase (recommended production backend)

The product is prepared for Supabase. Only TWO PUBLIC values are needed (both safe
for frontend code — never put the service-role key or DB password in the frontend):

1. `VITE_SUPABASE_URL` (Project URL, e.g. https://xxxx.supabase.co)
2. `VITE_SUPABASE_ANON_KEY` (anon/public key)

Steps:
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run (creates profiles, saved_places,
   visited_places, pujo_plans, pujo_plan_items with RLS: users only access their own rows).
3. Authentication → Providers → enable Google (needs OAuth client ID/secret from
   Google Cloud Console) and Facebook (Meta app ID/secret); Email is on by default;
   add Phone for mobile OTP (Twilio/MessageBird via Supabase).
4. Put the two public values in `PUJO_CONFIG.supabaseUrl` / `supabaseAnonKey`
   (index.html) or serve them as env vars and inject at build time.
5. Auth > URL Configuration: set Site URL to your domain; add /pujo/plan/* to redirects.

Current status (honest): the live backend is the bundled Python server (`server.py`)
with the same data contract (saved/visited/plan sync, PBKDF2 passwords, private-by-default
share pages). The Supabase adapter activates only when the two public values are set;
nothing is faked in the meantime — the auth screens show provider setup steps instead
of pretending to log in.

---

## Supabase adapter — ACTIVE (env-driven)

`server.py` now has a real Supabase adapter. It activates automatically when BOTH
env vars are present (read at server start; never hardcoded):

    VITE_SUPABASE_URL      e.g. https://abcd.supabase.co
    VITE_SUPABASE_ANON_KEY ey…  (anon/public key only)

What runs through Supabase in that mode:
- Email signup/login → Supabase Auth (GoTrue). PujoSathi stores NO passwords.
- All user data → Postgres tables (profiles, saved_places, visited_places,
  pujo_plans, pujo_plan_items) via PostgREST **with the user's own access
  token**, so Row Level Security is the real enforcement layer.
- Access tokens auto-refresh server-side (opaque session tokens for the
  browser stay the same; only a dev-grade session map lives in data/sessions.json).
- profile rename → profiles table; account deletion → data + profile rows and
  the GoTrue user (best-effort DELETE /auth/v1/user).

Still local (honest limitations):
- Mobile OTP stays in demo mode until a phone provider is enabled in Supabase
  (or an SMS gateway is connected) — those accounts then live in the local
  fallback store until migrated.
- Public share snapshots (/pujo/plan/<id>) are server-side JSON by design
  (RLS correctly blocks anonymous reads; making plans publicly readable would
  need a policy/table change we deliberately avoided).
- Google/Facebook OAuth: intentionally NOT wired yet (your instruction) — the
  UI still shows the honest setup notice.

Verify which mode is live:  GET /api/health  → {"mode":"supabase"|"local", …}

Adapter verified end-to-end against a strict GoTrue/PostgREST contract mock
(mock_sb.py, RLS-simulating): 19/19 checks incl. cross-device sync, refresh
rotation, profile, share page, deletion, logout.

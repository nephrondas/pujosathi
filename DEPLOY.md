# PujoSathi — Production Deployment Guide
**Architecture:** Netlify (frontend, static) → proxies `/api/*` and `/pujo/plan/*` → Render (Python backend `server.py`) → Supabase (Postgres + Auth, env-driven)

> ⚠️ Nothing is deployed yet as of this guide. Production is NOT working until you finish steps 1–3 below.

---

## A. Files to deploy on RENDER (backend)

From the `pujo-food-guide/` folder, these are ALL Render needs:

| File | Why |
|---|---|
| `server.py` | The whole backend (API + Supabase adapter + share pages). stdlib-only. |
| `requirements.txt` | Empty on purpose (stdlib only) — lets Render detect Python. |
| `render.yaml` | Optional Blueprint (you can instead click "New Web Service" manually). |

**Do NOT upload** `mock_sb.py`, `deploy-netlify/`, `data/` (auto-created), or the static site.

## B. Files to deploy on NETLIFY (frontend)

Deploy the **`deploy-netlify/`** folder (Netlify Drop: drag THIS folder):

| File | Why |
|---|---|
| `index.html` | The CURRENT PujoSathi build (1,190,767 B — P13 My Pujo + P14 branding). Self-contained; images embedded. |
| `_redirects` | Proxy rules — **the only redirect mechanism Netlify Drop honours.** |
| `netlify.toml` | Same proxy rules for future git-connected deploys (Drop ignores it). |

⚠️ The live site today is an OLD static build (PujoEats branding). Redeploying this folder replaces it.

## C. Environment variables on RENDER

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | your real Supabase project URL (e.g. `https://abcd.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | your Supabase **anon/public** key |

*(Names keep the `VITE_` prefix as required; server.py reads them regardless of prefix.)*
`PORT` is injected by Render automatically. **Never** set the service-role key or DB password anywhere.

## D. Environment variables on NETLIFY

**None required.** The frontend is fully built/static; the backend reads the Supabase env vars. (If you later switch to a git-based build pipeline, `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` may be set there — still only anon-safe values.)

## E. Exact Render Start Command

```
python3 server.py
```
Build command: `pip install -r requirements.txt`
Health Check Path: `/api/health`

## F. Exact Netlify configuration

`deploy-netlify/_redirects` ( honoured by Drop):
```
/api/*        https://PUJOSATHI-BACKEND-URL.onrender.com/api/:splat        200!
/pujo/plan/*  https://PUJOSATHI-BACKEND-URL.onrender.com/pujo/plan/:splat  200!
```
→ Replace `PUJOSATHI-BACKEND-URL` with your real Render service name (same in `netlify.toml`).
`200!` = forced reverse-proxy (not a browser redirect) — URLs stay on your Netlify domain, so no CORS anywhere.

## G. Exact order

1. **Render first:** New → Web Service → upload/push `server.py` + `requirements.txt` (+ `render.yaml` optional) → set the 2 env vars from §C → Create. Wait for "Live". Note the URL `https://<name>.onrender.com`.
   Verify: `curl https://<name>.onrender.com/api/health` → `{"mode":"supabase",…}`
2. **Netlify second:** edit `_redirects` (and `netlify.toml`) with that URL, then drag `deploy-netlify/` to Netlify Drop.
   Verify: open your site → DevTools Network → sign-in request should hit `https://yoursite.netlify.app/api/…` → 200 (proxied), and `GET /api/health` on the site returns `{"mode":"supabase"}`.
3. **Retest the 10-step flow** (signup → save restaurant + pandal → plan → logout → login → data persists; Supabase Table Editor shows rows).

---

## Known production limitations (honest)

- **Render free tier disk is ephemeral:** on every redeploy/restart, `data/sessions.json` (opaque session cache → users must log in again) and `data/shares.json` (**public share links break**) are wiped. User DATA is safe (Supabase). For persistent share links: attach a Render Disk (paid) or we later move shares into the DB (needs a schema addition — your call).
- **Free tier spin-down:** after ~15 min idle the service sleeps; the first request takes ~30–50 s. Set up a keep-alive pinger if unacceptable.
- **Mobile OTP remains demo mode** until an SMS provider is connected (unchanged).
- Google/Facebook OAuth intentionally not wired yet.
- `server.py` uses the stdlib HTTP server (threaded, HTTP/1.1): fine to start; for heavy traffic we'd move to gunicorn+uvicorn-style stack later.

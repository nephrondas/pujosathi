# PujoSathi 🪔
A free Kolkata Durga Puja discovery & personal planning platform.
Frontend: Netlify (static) · Backend: Render (Python, stdlib-only) · Database/Auth: Supabase (env-driven adapter, RLS-enforced).

## Repository layout
```
├── server.py               # whole backend: /api/* + /pujo/plan/<id> share pages + Supabase adapter
├── requirements.txt        # intentionally empty (stdlib only) — signals Python runtime to Render
├── render.yaml             # optional Render Blueprint (service, start cmd, health check)
├── deploy-netlify/         # ← NETLIFY: deploy THIS folder (Drop: drag it; git: set publish dir to it)
│   ├── index.html          # current PujoSathi build (self-contained, images embedded)
│   ├── _redirects          # proxy /api/* + /pujo/plan/* → Render  (Drop honours this)
│   └── netlify.toml        # same rules for git-based deploys
├── supabase/schema.sql     # run once in Supabase SQL editor (tables + RLS + indexes + profile trigger)
├── DEPLOY.md               # step-by-step: Render → Netlify → verify (order matters)
└── SETUP-AUTH.md           # Supabase/auth configuration reference
```

## Deploy (summary — full details in DEPLOY.md)
1. **Render:** New Web Service from this repo → env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → start `python3 server.py` → verify `/api/health`.
2. **Netlify:** put the Render URL into `deploy-netlify/_redirects` + `netlify.toml` (replace `PUJOSATHI-BACKEND-URL`), then deploy the `deploy-netlify/` folder.
3. Verify: site `/api/health` → `{"mode":"supabase"}`; sign up; check Supabase Table Editor shows rows.

## Security
- Only the **anon/publishable** Supabase key is used, and only as an env var on the server. No secrets in the repo. `data/` (runtime) is git-ignored.

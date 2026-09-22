#!/usr/bin/env python3
"""
PujoSathi server: static site + real auth & sync API.

Two persistence modes (auto-detected, never mixed for the same user):

1. SUPABASE MODE (production) — active when VITE_SUPABASE_URL and
   VITE_SUPABASE_ANON_KEY are set in the environment. Auth goes through
   Supabase GoTrue (no passwords stored here), and all user data lives in
   the Supabase Postgres tables (profiles / saved_places / visited_places /
   pujo_plans / pujo_plan_items) enforced by Row Level Security — this
   server always calls PostgREST with the user's own access token, so RLS
   is the real gatekeeper. Access tokens are refreshed transparently.

2. LOCAL MODE (dev/preview fallback) — same API contract, data kept
   server-side in data/authdb.json (PBKDF2 passwords). Used when the env
   vars are absent, so the app never fakes a backend.

Public share pages (/pujo/plan/<id>) serve a privacy-safe snapshot
(name + places + times only, no emails/phones/user ids).
"""
import json, os, re, secrets, hashlib, threading, mimetypes, html as _h, time, base64
import urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, quote

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
DB_PATH = os.path.join(DATA, 'authdb.json')
SESS_PATH = os.path.join(DATA, 'sessions.json')
SHARES_PATH = os.path.join(DATA, 'shares.json')
LOCK = threading.Lock()
ITERS = 100_000
PORT = int(os.environ.get('PORT', '8080'))

SB_URL = (os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL') or '').rstrip('/')
SB_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY') or ''
SB_MODE = bool(SB_URL and SB_KEY)

def _load(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
        if isinstance(default, dict):
            for k, v in default.items():
                d.setdefault(k, v)
        return d
    except Exception:
        return json.loads(json.dumps(default))

def _save(path, d):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(tmp, path)

def db():
    return _load(DB_PATH, {'users': {}, 'tokens': {}, 'data': {}, 'shares': {}})

def save_db(d):
    _save(DB_PATH, d)

def sessions():
    return _load(SESS_PATH, {})

def save_sessions(s):
    _save(SESS_PATH, s)

def shares_db():
    return _load(SHARES_PATH, {})

def save_shares(d):
    _save(SHARES_PATH, d)

def hash_pass(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERS).hex()

def new_salt():
    return secrets.token_hex(8)

def public_user(u):
    return {'id': u.get('id'), 'name': u.get('name') or u.get('email', '').split('@')[0],
            'email': u.get('email', ''), 'phone': u.get('phone', ''), 'photo': u.get('photo', ''),
            'provider': u.get('provider', 'email')}

# ---------------- Supabase client helpers ----------------
def sb(path, method='GET', body=None, token=None, prefer=None):
    url = SB_URL + path if path.startswith('/') else path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('apikey', SB_KEY)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    if prefer:
        req.add_header('Prefer', prefer)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, (json.loads(raw) if raw else None)
        except Exception:
            return e.code, {'msg': raw.decode('utf-8', 'ignore')[:200]}
    except Exception as e:
        return 0, {'msg': 'network: ' + str(e)[:120]}

def jwt_exp(tok):
    try:
        p = tok.split('.')[1]
        p += '=' * (-len(p) % 4)
        return json.loads(base64.urlsafe_b64decode(p)).get('exp', 0)
    except Exception:
        return 0

def sess_refresh(sess):
    """Ensure the stored Supabase access token is fresh; refresh via GoTrue."""
    if sess.get('exp', 0) > time.time() + 60:
        return True
    st, r = sb('/auth/v1/token?grant_type=refresh_token', 'POST', {'refresh_token': sess.get('refresh')})
    if os.environ.get('SB_DEBUG'):
        with open(DATA + '/sbdebug.log', 'a') as f:
            f.write('refresh st=%s rt=%s… resp=%s\n' % (st, str(sess.get('refresh'))[:12], str(r)[:120]))
    if st != 200 or not r or not r.get('access_token'):
        return False
    sess['access'] = r['access_token']
    sess['refresh'] = r['refresh_token']
    sess['exp'] = jwt_exp(r['access_token'])
    with LOCK:
        s = sessions()
        if sess.get('tok') in s:
            s[sess['tok']] = {k: sess[k] for k in ('access', 'refresh', 'exp', 'sb')}
            save_sessions(s)
    return True

DAYS5 = ('shashthi', 'saptami', 'ashtami', 'navami', 'dashami')

def sb_plan_row(access, sb_uid):
    st, rows = sb('/rest/v1/pujo_plans?user_id=eq.' + sb_uid + '&select=id,share_slug', token=access)
    return (rows[0] if st == 200 and rows else None)

def sb_user_data(access, sb_uid):
    """Aggregate Supabase rows into the client data contract."""
    out = {'saved': [], 'visited': [], 'plan': {'shareable': False, 'days': {}}}
    st, saved = sb('/rest/v1/saved_places?user_id=eq.' + sb_uid + '&select=place_id,place_type,created_at&order=created_at.asc', token=access)
    if st == 200 and isinstance(saved, list):
        out['saved'] = [{'t': 'food' if r['place_type'] == 'restaurant' else r['place_type'], 'id': r['place_id'],
                         'at': r.get('created_at')} for r in saved]
    st, vis = sb('/rest/v1/visited_places?user_id=eq.' + sb_uid + '&select=place_id,place_type', token=access)
    if st == 200 and isinstance(vis, list):
        out['visited'] = [( 'food' if r['place_type'] == 'restaurant' else r['place_type']) + ':' + r['place_id'] for r in vis]
    prow = sb_plan_row(access, sb_uid)
    if prow:
        out['plan']['shareable'] = bool(prow.get('share_slug'))
        st, items = sb('/rest/v1/pujo_plan_items?plan_id=eq.' + str(prow['id']) + '&select=place_id,place_type,pujo_day,visit_time,sort_order,done&order=sort_order.asc', token=access)
        if st == 200 and isinstance(items, list):
            for it in items:
                d = it.get('pujo_day')
                if d not in DAYS5:
                    continue
                out['plan']['days'].setdefault(d, []).append({
                    't': 'food' if it['place_type'] == 'restaurant' else it['place_type'],
                    'id': it['place_id'], 'done': bool(it.get('done')), 'time': it.get('visit_time') or ''})
    return out

def sb_push_data(access, sb_uid, data):
    """Write the client's full data snapshot into Supabase (RLS-scoped)."""
    clean_saved = [{'user_id': sb_uid, 'place_id': str(x['id'])[:48], 'place_type': 'restaurant' if x['t'] == 'food' else 'pandal'}
                   for x in (data.get('saved') or [])[:2000] if isinstance(x, dict) and x.get('id') and x.get('t') in ('food', 'pandal')]
    clean_vis = [{'user_id': sb_uid, 'place_id': v.split(':', 1)[1][:48], 'place_type': 'restaurant' if v.startswith('food:') else 'pandal'}
                 for v in (data.get('visited') or [])[:2000] if isinstance(v, str) and ':' in v]
    plan = data.get('plan') or {}
    st, _ = sb('/rest/v1/saved_places?user_id=eq.' + sb_uid, 'DELETE', token=access)
    if clean_saved:
        sb('/rest/v1/saved_places?on_conflict=user_id,place_id,place_type', 'POST', clean_saved, access, 'resolution=merge-duplicates')
    st, _ = sb('/rest/v1/visited_places?user_id=eq.' + sb_uid, 'DELETE', token=access)
    if clean_vis:
        sb('/rest/v1/visited_places?on_conflict=user_id,place_id,place_type', 'POST', clean_vis, access, 'resolution=merge-duplicates')
    prow = sb_plan_row(access, sb_uid)
    if not prow:
        st, created = sb('/rest/v1/pujo_plans', 'POST', [{'user_id': sb_uid, 'name': 'My Pujo'}], access, 'return=representation')
        prow = created[0] if st == 201 and created else None
    if prow:
        sb('/rest/v1/pujo_plan_items?plan_id=eq.' + str(prow['id']), 'DELETE', token=access)
        rows = []
        for d in DAYS5:
            for i, it in enumerate((plan.get('days') or {}).get(d) or []):
                if not isinstance(it, dict) or it.get('t') not in ('food', 'pandal') or not it.get('id'):
                    continue
                rows.append({'plan_id': prow['id'], 'user_id': sb_uid, 'place_id': str(it['id'])[:48],
                             'place_type': 'restaurant' if it['t'] == 'food' else 'pandal', 'pujo_day': d,
                             'visit_time': str(it.get('time') or '')[:8], 'sort_order': i, 'done': bool(it.get('done'))})
        if rows:
            sb('/rest/v1/pujo_plan_items', 'POST', rows, access)
        share = bool(plan.get('shareable'))
        if share and not prow.get('share_slug'):
            pass  # slug is set by /share endpoint
        if not share and prow.get('share_slug'):
            sb('/rest/v1/pujo_plans?id=eq.' + str(prow['id']), 'PATCH', {'share_slug': None}, access)
    return {'ok': True}

class Handler(BaseHTTPRequestHandler):
    server_version = 'PujoSathi/1.0'
    protocol_version = 'HTTP/1.1'  # keep-alive behind Render's proxy; every response sends Content-Length
    def log_message(self, fmt, *args):
        pass
    def send_json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def err(self, msg, status=400, code=None):
        payload = {'error': msg}
        if code:
            payload['code'] = code
        self.send_json(payload, status)
    def body_json(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            return json.loads(self.rfile.read(n) or b'{}') if n else {}
        except Exception:
            return {}
    # ---- auth token resolution ----
    def uid_from_token(self):
        tok = self.headers.get('X-Auth', '')
        if not tok:
            return None
        s = sessions()
        sess = s.get(tok)
        if sess:
            if not sess_refresh(sess):
                return None
            return {'sb': sess['sb'], 'sess': sess, 'tok': tok}
        d = db()
        return d['tokens'].get(tok)  # local-mode opaque mapping {uid:...}
    def user_data(self, uid):
        d = db()
        return d['data'].get(uid) or {'saved': [], 'visited': [], 'plan': {'shareable': False, 'days': {}}}
    # ---------------- API ----------------
    def api(self, path):
        b = self.body_json()
        # ---------- health ----------
        if path == '/health' and self.command == 'GET':
            from urllib.parse import urlparse as _u
            return self.send_json({'mode': 'supabase' if SB_MODE else 'local',
                                   'supabase_host': _u(SB_URL).hostname if SB_MODE else None})
        # ---------- SUPABASE MODE: email auth ----------
        if SB_MODE and path == '/auth/signup' and self.command == 'POST':
            name = (b.get('name') or '').strip()[:40] or 'Pujo Friend'
            email = (b.get('email') or '').strip().lower()
            pw = b.get('password') or ''
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@]+$', email):
                return self.err('invalid email', 422)
            if len(pw) < 4:
                return self.err('weak password', 422)
            st, r = sb('/auth/v1/signup', 'POST', {'email': email, 'password': pw, 'data': {'name': name}})
            if st in (422, 400) and r and 'already registered' in json.dumps(r).lower():
                return self.err('email exists', 409)
            if st == 422 and r and 'password' in json.dumps(r).lower():
                return self.err('weak password', 422, code='weak_password')
            if st != 200 or not r:
                return self.err('auth unavailable, please try again', 502 if st == 0 else 503)
            if not r.get('access_token'):
                # Confirmation link / code sent — never treat the user as signed in yet.
                return self.send_json({'confirmation_required': True, 'email': email,
                                       'user': {'id': (r.get('user') or {}).get('id', ''), 'email': email}})
            u = r['user']
            tok = secrets.token_urlsafe(24)
            with LOCK:
                s = sessions(); s[tok] = {'access': r['access_token'], 'refresh': r['refresh_token'],
                                          'exp': jwt_exp(r['access_token']), 'sb': u['id'], 'tok': tok}
                save_sessions(s)
            prof = {'id': u['id'], 'name': name, 'email': email, 'phone': '', 'photo': '', 'provider': 'email'}
            data = sb_user_data(r['access_token'], u['id'])
            return self.send_json({'token': tok, 'user': prof, 'data': data})
        if SB_MODE and path == '/auth/login' and self.command == 'POST':
            email = (b.get('email') or '').strip().lower()
            pw = b.get('password') or ''
            st, r = sb('/auth/v1/token?grant_type=password', 'POST', {'email': email, 'password': pw})
            if st == 400:
                if r and 'email_not_confirmed' in json.dumps(r).lower():
                    return self.err('email not confirmed', 403, code='email_not_confirmed')
                return self.err('bad credentials', 401)
            if st != 200 or not r or not r.get('access_token'):
                return self.err('auth unavailable, please try again', 502 if st == 0 else 503)
            u = r['user']
            tok = secrets.token_urlsafe(24)
            with LOCK:
                s = sessions(); s[tok] = {'access': r['access_token'], 'refresh': r['refresh_token'],
                                          'exp': jwt_exp(r['access_token']), 'sb': u['id'], 'tok': tok}
                save_sessions(s)
            meta = u.get('user_metadata') or u.get('raw_user_meta_data') or {}
            prof = {'id': u['id'], 'name': meta.get('name') or (email.split('@')[0]), 'email': u.get('email', ''),
                    'phone': u.get('phone', ''), 'photo': meta.get('photo', '') or '', 'provider': 'email'}
            return self.send_json({'token': tok, 'user': prof, 'data': sb_user_data(r['access_token'], u['id'])})
        # ---------- SUPABASE MODE: session + data + profile + delete ----------
        if SB_MODE and path in ('/me', '/data', '/profile', '/auth/delete', '/share', '/auth/logout'):
            au = self.uid_from_token()
            if not au or 'sb' not in au:
                # fall through to local-mode handlers for phone accounts / old tokens
                if path in ('/auth/logout',):
                    return self._local_logout()
                if path not in ('/me', '/data', '/profile', '/auth/delete', '/share'):
                    return self.err('not found', 404)
                return self.err('unauthorized', 401)
            sess, access, sb_uid = au['sess'], au['sess']['access'], au['sb']
            if path == '/me' and self.command == 'GET':
                st, prof_row = sb('/rest/v1/profiles?id=eq.' + sb_uid + '&select=name,avatar_url,email,phone', token=access)
                prof_row = (prof_row[0] if st == 200 and isinstance(prof_row, list) and prof_row else {})
                prof = {'id': sb_uid, 'name': prof_row.get('name') or sess.get('name', 'Pujo Friend'),
                        'email': prof_row.get('email', ''), 'phone': prof_row.get('phone', ''),
                        'photo': prof_row.get('avatar_url', ''), 'provider': sess.get('provider', 'email')}
                return self.send_json({'user': prof, 'data': sb_user_data(access, sb_uid)})
            if path == '/data':
                if self.command == 'GET':
                    return self.send_json(sb_user_data(access, sb_uid))
                if self.command == 'PUT':
                    data = b.get('data') or b
                    try:
                        return self.send_json(sb_push_data(access, sb_uid, data))
                    except Exception as e:
                        return self.err('sync failed: ' + str(e)[:80], 502)
            if path == '/profile' and self.command == 'PATCH':
                nm = (b.get('name') or '').strip()[:40]
                if not nm:
                    return self.err('invalid name', 422)
                st, _ = sb('/rest/v1/profiles?id=eq.' + sb_uid, 'PATCH', {'name': nm}, token=access)
                if st in (200, 204):
                    return self.send_json({'ok': True})
                return self.err('update failed', 502 if st == 0 else 400)
            if path == '/auth/delete' and self.command == 'POST':
                for t in ('pujo_plan_items', 'pujo_plans', 'visited_places', 'saved_places'):
                    sb('/rest/v1/' + t + '?user_id=eq.' + sb_uid, 'DELETE', token=access)
                sb('/rest/v1/profiles?id=eq.' + sb_uid, 'DELETE', token=access)
                sb('/auth/v1/user', 'DELETE', token=access)  # best-effort; needs provider support
                with LOCK:
                    s = sessions(); s.pop(au['tok'], None); save_sessions(s)
                return self.send_json({'ok': True})
            if path == '/share' and self.command == 'POST':
                snap = self._mk_share(b, sb_uid)
                if not snap:
                    return self.err('empty plan', 422)
                prow = sb_plan_row(access, sb_uid)
                if prow:
                    sb('/rest/v1/pujo_plans?id=eq.' + str(prow['id']), 'PATCH', {'share_slug': snap['id'], 'updated_at': 'now()'}, token=access)
                return self.send_json({'id': snap['id']})
            if path == '/auth/logout' and self.command == 'POST':
                return self._local_logout()
        # ---------- LOCAL MODE / phone accounts / shared local fallbacks ----------
        # ---------- OAuth (Facebook) : exchange a Supabase OAuth session for our opaque session ----------
        if SB_MODE and path == '/auth/oauth-session' and self.command == 'POST':
            at = (b.get('access_token') or '').strip()
            rt = (b.get('refresh_token') or '').strip()
            if not at or not rt:
                return self.err('invalid input', 422)
            st, u = sb('/auth/v1/user', token=at)   # server-side validation — the token is only trusted after Supabase confirms it
            if st != 200 or not isinstance(u, dict) or not u.get('id'):
                return self.err('oauth session rejected', 401)
            meta = u.get('user_metadata') or u.get('raw_user_meta_data') or {}
            prov = 'oauth'
            for ident in (u.get('identities') or []):
                if isinstance(ident, dict) and ident.get('provider'):
                    prov = ident['provider']; break
            else:
                prov = (u.get('app_metadata') or {}).get('provider') or 'oauth'
            email = u.get('email') or ''
            name = (meta.get('name') or meta.get('full_name') or (email.split('@')[0] if email else '') or 'Pujo Friend')[:40]
            photo = meta.get('avatar_url') or meta.get('picture') or ''
            if not photo:
                for ident in (u.get('identities') or []):
                    idd = ident.get('identity_data') or {}
                    photo = idd.get('avatar_url') or idd.get('picture') or ''
                    if photo: break
            prof = {'id': u['id'], 'name': name, 'email': email, 'phone': '', 'photo': photo, 'provider': prov}
            tok = secrets.token_urlsafe(24)
            with LOCK:
                ssn = sessions(); ssn[tok] = {'access': at, 'refresh': rt, 'exp': jwt_exp(at), 'sb': u['id'], 'tok': tok}
                save_sessions(ssn)
            data = sb_user_data(at, u['id'])
            return self.send_json({'token': tok, 'user': prof, 'data': data})
        # ---------- email auth support: config / resend / verify / reset ----------
        if path == '/auth/config' and self.command == 'GET':
            if not SB_MODE:
                return self.send_json({'mode': 'local', 'autoconfirm': True, 'minPasswordLength': 4, 'otpEmail': False})
            st, r = sb('/auth/v1/settings')
            if st != 200 or not isinstance(r, dict):
                return self.send_json({'mode': 'supabase', 'autoconfirm': False, 'minPasswordLength': 6,
                                       'otpEmail': False, 'supabaseUrl': SB_URL, 'supabaseAnonKey': SB_KEY})
            ex = r.get('external') or {}
            em = ex.get('email') if isinstance(ex.get('email'), dict) else {}
            return self.send_json({'mode': 'supabase',
                                   'autoconfirm': bool(r.get('mailer_autoconfirm')),
                                   'minPasswordLength': int(em.get('min_length') or 6),
                                   'otpEmail': False,
                                   # PUBLIC client-safe values only (the anon key ships in every
                                   # standard Supabase frontend; RLS enforces per-user access)
                                   'supabaseUrl': SB_URL, 'supabaseAnonKey': SB_KEY})
        if path == '/auth/resend' and self.command == 'POST':
            email = (b.get('email') or '').strip().lower()
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@]+$', email):
                return self.err('invalid email', 422)
            if not SB_MODE:
                return self.err('no mailer in this environment', 501, code='no_mailer')
            st, r = sb('/auth/v1/resend', 'POST', {'email': email, 'type': 'signup'})
            if st == 429:
                return self.err('too many requests', 429, code='too_many')
            if st not in (200, 204):
                return self.err('auth unavailable, please try again', 502 if st == 0 else 503)
            return self.send_json({'ok': True})
        if path == '/auth/verify-email' and self.command == 'POST':
            email = (b.get('email') or '').strip().lower()
            tk = (b.get('token') or '').strip()
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@]+$', email) or not re.match(r'^\d{6}$', tk):
                return self.err('invalid input', 422)
            if not SB_MODE:
                return self.err('no mailer in this environment', 501, code='no_mailer')
            st, r = sb('/auth/v1/verify', 'POST', {'type': 'signup', 'email': email, 'token': tk})
            if st in (401, 403):
                txt = json.dumps(r or {}).lower()
                return self.err('bad or expired code', 401, code='expired_code' if 'expired' in txt else 'bad_code')
            if st != 200 or not r or not r.get('access_token'):
                return self.err('auth unavailable, please try again', 502 if st == 0 else 503)
            u = r['user']
            tok = secrets.token_urlsafe(24)
            with LOCK:
                ssn = sessions(); ssn[tok] = {'access': r['access_token'], 'refresh': r['refresh_token'],
                                              'exp': jwt_exp(r['access_token']), 'sb': u['id'], 'tok': tok}
                save_sessions(ssn)
            meta = u.get('user_metadata') or u.get('raw_user_meta_data') or {}
            prof = {'id': u['id'], 'name': meta.get('name') or email.split('@')[0], 'email': u.get('email', email),
                    'phone': '', 'photo': meta.get('photo', '') or '', 'provider': 'email'}
            return self.send_json({'token': tok, 'user': prof, 'data': sb_user_data(r['access_token'], u['id'])})
        if path == '/auth/reset' and self.command == 'POST':
            email = (b.get('email') or '').strip().lower()
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@]+$', email):
                return self.err('invalid email', 422)
            if not SB_MODE:
                return self.err('no mailer in this environment', 501, code='no_mailer')
            st, r = sb('/auth/v1/recover', 'POST', {'email': email})
            if st == 429:
                return self.err('too many requests', 429, code='too_many')
            if st not in (200, 204):
                return self.err('auth unavailable, please try again', 502 if st == 0 else 503)
            return self.send_json({'ok': True})
        if path == '/auth/signup' and self.command == 'POST':
            name = (b.get('name') or '').strip()
            email = (b.get('email') or '').strip().lower()
            pw = b.get('password') or ''
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@]+$', email):
                return self.err('invalid email', 422)
            if len(pw) < 4:
                return self.err('weak password', 422)
            with LOCK:
                d = db()
                uid = 'e:' + email
                if uid in d['users']:
                    return self.err('email exists', 409)
                salt = new_salt()
                u = {'id': uid, 'name': name or email.split('@')[0], 'email': email, 'phone': '',
                     'photo': '', 'provider': 'email', 'salt': salt, 'pass': hash_pass(pw, salt), 'created': 0}
                d['users'][uid] = u
                tok = secrets.token_urlsafe(24)
                d['tokens'][tok] = {'uid': uid}
                d['data'].setdefault(uid, {'saved': [], 'visited': [], 'plan': {'shareable': False, 'days': {}}})
                save_db(d)
            return self.send_json({'token': tok, 'user': public_user(u), 'data': self.user_data(uid)})
        if path == '/auth/login' and self.command == 'POST':
            email = (b.get('email') or '').strip().lower()
            pw = b.get('password') or ''
            d = db()
            u = d['users'].get('e:' + email)
            if not u or u['pass'] != hash_pass(pw, u.get('salt', '00')):
                return self.err('bad credentials', 401)
            tok = secrets.token_urlsafe(24)
            with LOCK:
                d = db()
                d['tokens'][tok] = {'uid': u['id']}
                save_db(d)
            return self.send_json({'token': tok, 'user': public_user(u), 'data': self.user_data(u['id'])})
        if path == '/auth/logout' and self.command == 'POST':
            return self._local_logout()
        if path == '/me' and self.command == 'GET':
            au = self.uid_from_token()
            uid = au['uid'] if au and isinstance(au, dict) else None
            if not uid:
                return self.err('unauthorized', 401)
            d = db()
            u = d['users'].get(uid)
            if not u:
                return self.err('unauthorized', 401)
            return self.send_json({'user': public_user(u), 'data': self.user_data(uid)})
        if path == '/data':
            au = self.uid_from_token()
            uid = au['uid'] if au and isinstance(au, dict) else None
            if not uid:
                return self.err('unauthorized', 401)
            if self.command == 'GET':
                return self.send_json(self.user_data(uid))
            if self.command == 'PUT':
                data = b.get('data') or b
                clean = {
                    'saved': [x for x in (data.get('saved') or []) if isinstance(x, dict) and x.get('t') in ('food', 'pandal') and x.get('id')],
                    'visited': [x for x in (data.get('visited') or []) if isinstance(x, str)][:2000],
                    'plan': data.get('plan') or {'shareable': False, 'days': {}},
                }
                with LOCK:
                    d = db()
                    d['data'][uid] = clean
                    save_db(d)
                return self.send_json({'ok': True})
        if path == '/profile' and self.command == 'PATCH':
            au = self.uid_from_token()
            uid = au['uid'] if au and isinstance(au, dict) else None
            if not uid:
                return self.err('unauthorized', 401)
            nm = (b.get('name') or '').strip()[:40]
            if not nm:
                return self.err('invalid name', 422)
            with LOCK:
                d = db()
                if uid not in d['users']:
                    return self.err('unauthorized', 401)
                d['users'][uid]['name'] = nm
                save_db(d)
            return self.send_json({'ok': True, 'user': public_user(d['users'][uid])})
        if path == '/auth/delete' and self.command == 'POST':
            au = self.uid_from_token()
            uid = au['uid'] if au and isinstance(au, dict) else None
            if not uid:
                return self.err('unauthorized', 401)
            with LOCK:
                d = db()
                d['users'].pop(uid, None)
                d['data'].pop(uid, None)
                d['tokens'] = {k: v for k, v in d['tokens'].items() if v.get('uid') != uid}
                d['shares'] = {k: v for k, v in d.get('shares', {}).items() if v.get('owner') != uid}
                save_db(d)
            return self.send_json({'ok': True})
        if path == '/share' and self.command == 'POST':
            au = self.uid_from_token()
            owner = (au.get('sb') if isinstance(au, dict) and 'sb' in au else None) or (au.get('uid') if au else None)
            if not owner:
                return self.err('unauthorized', 401)
            snap = self._mk_share(b, owner)
            if not snap:
                return self.err('empty plan', 422)
            return self.send_json({'id': snap['id']})
        return self.err('not found', 404)

    def _local_logout(self):
        tok = self.headers.get('X-Auth', '')
        with LOCK:
            s = sessions()
            if tok in s:
                s.pop(tok, None); save_sessions(s)
            d = db()
            if tok in d['tokens']:
                d['tokens'].pop(tok, None); save_db(d)
        return self.send_json({'ok': True})

    def _mk_share(self, b, owner):
        nm = re.sub(r'[<>]', '', str(b.get('name') or ''))[:24].strip() or 'Pujo Friend'
        plan = b.get('plan')
        if not isinstance(plan, list) or not plan:
            return None
        days = {}
        for g in plan[:5]:
            if not isinstance(g, dict):
                continue
            dk = str(g.get('d', ''))[:12]
            if dk not in DAYS5:
                continue
            items = []
            for it in (g.get('items') or [])[:40]:
                if not isinstance(it, dict) or it.get('t') not in ('food', 'pandal'):
                    continue
                pid = str(it.get('id', ''))[:48]
                if not pid:
                    continue
                items.append({'t': it['t'], 'id': pid, 'time': str(it.get('time', ''))[:8],
                              'n': re.sub(r'[<>]', '', str(it.get('n', '')))[:60]})
            if items:
                days[dk] = items
        if not days:
            return None
        with LOCK:
            sh = shares_db()
            sid = secrets.token_urlsafe(6)
            sh[sid] = {'owner': owner, 'name': nm, 'days': days}
            save_shares(sh)
        return {'id': sid, 'name': nm, 'days': days}

    # ---- public shared plan page ----
    def serve_share(self, sid):
        sh = shares_db().get(re.sub(r'[^A-Za-z0-9_-]', '', sid)[:24])
        self.send_response(200 if sh else 404)
        body = self.share_page_html(sh)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body.encode())))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(body.encode())

    def share_page_html(self, sh):
        DAY_BN = {'shashthi': 'ষষ্ঠী', 'saptami': 'সপ্তমী', 'ashtami': 'অষ্টমী', 'navami': 'নবমী', 'dashami': 'দশমী'}
        DAY_EN = {'shashthi': 'Shashthi', 'saptami': 'Saptami', 'ashtami': 'Ashtami', 'navami': 'Navami', 'dashami': 'Dashami'}
        if not sh:
            return ('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                    '<title>PujoSathi — plan not found</title></head><body style="font-family:system-ui;background:#fdf6e9;'
                    'color:#4a0d0d;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">'
                    '<div style="text-align:center;padding:24px"><div style="font-size:40px">🪔</div><h1>Plan not found</h1>'
                    '<p>This shared Pujo plan link is broken or was removed.</p>'
                    '<a href="/" style="color:#9c2b2b">Open PujoSathi</a></div></body></html>')
        days_html = ''
        for dk in DAYS5:
            items = sh['days'].get(dk)
            if not items:
                continue
            rows = ''.join(
                '<li><span class="tm">' + _h.escape(str(it.get('time') or '')) + '</span> '
                + ('🍛' if it.get('t') == 'food' else '🛕') + ' ' + _h.escape(str(it.get('n') or it.get('id', ''))) + '</li>'
                for it in items)
            days_html += ('<section><h2>🪔 ' + DAY_EN[dk] + ' · ' + DAY_BN[dk] + '</h2><ul>' + rows + '</ul></section>')
        name = _h.escape(sh.get('name', 'Pujo Friend'))
        return ('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                '<title>' + name + "\u2019s My Pujo Plan 🪔 · PujoSathi</title></head>"
                '<body style="margin:0;font-family:system-ui,-apple-system,&#39;Segoe UI&#39;,sans-serif;background:#fdf6e9;color:#3f2703">'
                '<div style="max-width:560px;margin:0 auto;padding:28px 18px 40px">'
                '<div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#b98a3c">PUJOSATHI · KOLKATA</div>'
                '<h1 style="color:#4a0d0d;font-size:26px;margin:8px 0 2px">' + name + '\u2019s My Pujo Plan 🪔</h1>'
                '<p style="color:#8a6d4a;font-size:13px;margin:0 0 18px">A shared Durga Puja plan — no personal information attached.</p>'
                + days_html +
                '<div style="margin-top:26px;padding:14px;border:1px dashed #d9c193;border-radius:12px;font-size:13px;color:#6b4a26">'
                'Plan your own Pujo — free, on <a href="/" style="color:#9c2b2b;font-weight:700">PujoSathi</a> 🪔</div>'
                '</div><style>section{background:#fffdf6;border:1px solid #ecd9ae;border-radius:14px;padding:14px 16px;margin:12px 0}'
                'h2{margin:0 0 8px;font-size:17px;color:#4a0d0d}ul{list-style:none;margin:0;padding:0}'
                'li{padding:6px 0;border-bottom:1px dashed #e2d0ab;font-size:14px}'
                'li:last-child{border-bottom:none}.tm{display:inline-block;min-width:64px;font-weight:700;color:#8a6d4a}</style>'
                '</body></html>')

    # ---- static ----
    def serve_static(self, path):
        path = unquote(path)
        if path == '/':
            path = '/index.html'
        fp = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not fp.startswith(ROOT) or not os.path.isfile(fp):
            return self.err('not found', 404)
        ct = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
        if fp.endswith('.js'):
            ct = 'text/javascript'
        with open(fp, 'rb') as f:
            body = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ct + ('; charset=utf-8' if ct.startswith('text') else ''))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    def handle_one(self):
        p = urlparse(self.path)
        if p.path.startswith('/api/'):
            self.api(p.path[len('/api'):])
        elif p.path.startswith('/pujo/plan/'):
            self.serve_share(p.path[len('/pujo/plan/'):])
        else:
            self.serve_static(p.path)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = handle_one

if __name__ == '__main__':
    os.chdir(ROOT)
    mode = 'SUPABASE (' + SB_URL + ')' if SB_MODE else 'local JSON (set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for production)'
    print('PujoSathi server on http://0.0.0.0:%d — mode: %s' % (PORT, mode), flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()

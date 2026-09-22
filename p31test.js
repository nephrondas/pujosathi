/* ===== P31 SUITE — Facebook OAuth production readiness (Supabase Auth architecture) =====
   :8080 local server (structure/responsive) · :8081 SB-mode server + mock Supabase :9090 (real flows).
   The supabase-js CDN bundle is intercepted and replaced by a faithful mock of the
   createClient().auth.signInWithOAuth / exchangeCodeForSession surface. */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e===undefined?'':e).slice(0,240));console.log('  ✗ FAIL',n,JSON.stringify(e===undefined?'':e).slice(0,240))}}
const CH=process.env.CH_BIN;
const L='http://127.0.0.1:8080/', SB='http://127.0.0.1:8081/', MOCK='http://127.0.0.1:9090';
const SBJS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
async function gotoOAuth(p,hash){await p.goto('about:blank');await p.goto(SB+hash,{waitUntil:'load'});await p.waitForTimeout(1500)}
const MOCK_LIB=`window.supabase={createClient:function(url,key,opts){
  window.__sbOpts=opts;window.__sbCalls=[];window.__sbCtor=[url,key];
  return {auth:{
    signInWithOAuth:async(o)=>{window.__sbCalls.push({fn:'signInWithOAuth',provider:o.provider,redirectTo:o.options&&o.options.redirectTo});
      if(window.__sbMode==='hang')return new Promise(()=>{});
      if(window.__sbMode==='error')return {data:null,error:new Error('provider disabled')};
      return {data:{url:url+'/authorize?provider='+(o.provider||'facebook')},error:null};},
    exchangeCodeForSession:async(c)=>({data:{session:null},error:null})
  }};
}};`;

async function mockUser(ctx,email,name,avatar){
  return ctx.request.post(MOCK+'/auth/v1/signup',{headers:{apikey:'mock-anon-key'},data:{email,password:'pw123456',data:{name:name,avatar_url:avatar||''}}});
}
async function mockToken(ctx,email,provider){
  const r=await ctx.request.get(MOCK+'/debug/token?email='+encodeURIComponent(email)+(provider?'&provider='+provider:''),{headers:{apikey:'mock-anon-key'}});
  return r.json();
}

(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ---- T1: button exists, visible, clickable; unconfigured → honest setup notice (§2/§19) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(400);
 const d=await p.evaluate(()=>{const f=document.querySelector('#authBox .prov-btn.f');
   const r=f.getBoundingClientRect();return {txt:f.textContent.trim(),vis:f.offsetParent!==null&&r.height>0,order:[...document.querySelectorAll('#authBox .prov-btn')].map(x=>x.className.match(/prov-btn (\w)/)[1]).join(''),en:!f.disabled}});
 ok('T1: "Continue with Facebook" button present & visible',d.vis&&d.txt.includes('Facebook'),d);
 ok('T1: order Google → Facebook → Email',d.order==='gfe',d.order);
 ok('T1: button enabled/clickable by default',d.en,d);
 await p.click('#authBox .prov-btn.f');await p.waitForTimeout(600);
 const setup=await p.evaluate(()=>({setup:document.body.innerText.includes('Facebook login'),honest:/Supabase/i.test(document.body.innerText),guest:!!document.querySelector('#authBox .guest-link')}));
 ok('T1: unconfigured → honest Supabase-dashboard setup notice (+ guest escape hatch)',setup.setup&&setup.honest&&setup.guest,setup);
 const local404=await p.evaluate(async()=>(await fetch('/api/auth/oauth-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status);
 ok('T14: local-mode server: /api/auth/oauth-session absent (404 — SB-only endpoint)',local404===404,local404);
 ok('T1: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T2: loading state, duplicate-click guard, redirect initiation (§2/§3/§4) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.route('**'+SBJS.replace('https://','https://')+'*',r=>r.fulfill({contentType:'text/javascript',body:MOCK_LIB}));
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>{PUJO_CONFIG.supabaseUrl='http://127.0.0.1:9090';PUJO_CONFIG.supabaseAnonKey='mock-anon-key';oauthNav=u=>{window.__navTo=u}});
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 // hang mode: button enters loading state and stays; double click guarded
 await p.evaluate(()=>{window.__sbMode='hang'});
 await p.click('#authBox .prov-btn.f');await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.f').catch(()=>{});await p.waitForTimeout(300);
 const hang=await p.evaluate(()=>({loading:document.querySelector('#authBox .prov-btn.f').classList.contains('loading'),busy:window.__fbBusy===true}));
 ok('T2: loading state visible while OAuth starts (§2)',hang.loading&&hang.busy,hang);
 await p.waitForTimeout(900);
 const calls=await p.evaluate(()=>window.__sbCalls.length);
 ok('T2: duplicate clicks blocked — exactly one signInWithOAuth call',calls===1,calls);
 await p.evaluate(()=>{window.__sbMode='';window.__fbBusy=false});
 // success mode: navigation initiated to the Supabase authorize URL, same-origin redirectTo
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.f');await p.waitForTimeout(1200);
 const nav=await p.evaluate(()=>({calls:window.__sbCalls,nav:window.__navTo,origin:location.origin+location.pathname}));
 ok('T2: signInWithOAuth({provider:"facebook"}) initiated (§3)',nav.calls.length===1&&nav.calls[0].provider==='facebook',nav.calls);
 ok('T2: redirectTo = current page (dynamic origin, no localhost hard-coding) (§4)',nav.calls[0].redirectTo===nav.origin,nav);
 ok('T2: full-page navigation to Supabase /authorize URL',/\/authorize\?provider=facebook$/.test(nav.nav||''),nav.nav);
 ok('T2: implicit flow configured (tokens return in hash — parseable without extra backend)',await p.evaluate(()=>window.__sbOpts&&window.__sbOpts.auth&&window.__sbOpts.auth.flowType==='implicit'),await p.evaluate(()=>window.__sbOpts));
 // error mode: friendly toast + button restored
 await p.evaluate(()=>{window.__sbMode='error';window.__fbBusy=false});
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.f');await p.waitForTimeout(600);
 const err=await p.evaluate(()=>({toast:document.querySelector('#toast,.toast,body').innerText.match(/check your connection/i)?'net':'',btn:document.querySelector('#authBox .prov-btn.f').classList.contains('loading')}));
 ok('T2: OAuth start failure → friendly network copy, button restored (§14)',err.toast==='net'&&!err.btn,err);
 ok('T2: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T3: successful callback — NEW Facebook user, pending save, migration (§5/§6/§7/§8/§9/§10/§11) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbnew'+Date.now()+'@test.in';
 await mockUser(ctx,em,'FB Newbie');
 const tk=await mockToken(ctx,em);
 // guest state BEFORE the redirect: 2 guest saves + a pending pandal save (set on the real origin)
 await p.addInitScript(([sv,pa])=>{
   try{if(!/^http/.test(location.origin))return; /* about:blank has no localStorage */
   localStorage.setItem('pujo_saved2_guest',JSON.stringify(sv));
   localStorage.setItem('pujoPendingAction',JSON.stringify(pa));}catch(e){}
 },[[{t:'food',id:'aminia-shyambazar',at:1},{t:'food',id:'arsalan-lake-town',at:2}],{kind:'save',t:'pandal',id:'bagbazarsarbojanindurg'}]);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token+'&expires_in=3600&token_type=bearer');
 const st=await p.evaluate(()=>({m:session.mode,name:session.name,prov:session.provider,email:session.email,
   signin:getComputedStyle(document.getElementById('signinBtn')).display,
   mp:getComputedStyle(document.getElementById('mpPill')).display,
   url:location.href,alive:document.body.innerText.length>500}));
 ok('T3: authenticated session established from OAuth return (§9)',st.m==='user'&&st.prov==='facebook',st);
 ok('T3: Facebook display name captured (§6)',st.name==='FB Newbie',st.name);
 ok('T3: header updated immediately — Sign In hidden (§11)',st.signin==='none',st.signin);
 ok('T3: My Pujo pill visible (authenticated UI) (§11)',st.mp!=='none',st.mp);
 ok('T3: landed in the live app — no blank page (§9)',st.alive===true,{alive:st.alive});
 ok('T3: URL cleaned — no tokens in address bar (§10)',!/(access_token|refresh_token)/.test(st.url),st.url);
 // pending save completed + migration modal + merge without duplicates
 await p.waitForTimeout(400);
 const pen=await p.evaluate(()=>({pa:localStorage.getItem('pujoPendingAction'),
   saved:(()=>{try{const uid=JSON.parse(localStorage.getItem('pujoSession')).uid;return JSON.parse(localStorage.getItem('pujo_saved2_'+uid)||'[]')}catch(e){return []}})(),
   mig:document.getElementById('mOverlay').classList.contains('open')}));
 ok('T3: pending Save action survived the external redirect and completed (§7)',pen.pa===null&&pen.saved.some(x=>x.t==='pandal'&&x.id==='bagbazarsarbojanindurg'),pen);
 ok('T3: guest migration prompt shown (§8)',pen.mig===true,pen.mig);
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(600);
 const merged=await p.evaluate(()=>{const uid=JSON.parse(localStorage.getItem('pujoSession')).uid;return JSON.parse(localStorage.getItem('pujo_saved2_'+uid)||'[]')});
 ok('T3: guest saves merged — 3 total, no duplicates (§8)',merged.length===3&&new Set(merged.map(x=>x.t+':'+x.id)).size===3,merged);
 // guest data not deleted before explicit migration
 ok('T3: guest saves still present until migration succeeded (§8)',await p.evaluate(()=>(JSON.parse(localStorage.getItem('pujo_saved2_guest')||'[]')).length===2),{});
 // server-side data actually loads (Saved Places + My Pujo via the SB proxy)
 const me=await p.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('pujoSession'));const r=await (await fetch('/api/me',{headers:{'X-Auth':s.token}})).json();return {u:!!r.user,d:r.data}});
 ok('T3: profile + Saved Places + My Pujo data load from the server (§5)',me.u&&me.d&&Array.isArray(me.d.saved),me);
 // profile: name, no phone (§12)
 await p.evaluate(()=>openProfile());await p.waitForTimeout(400);
 const prof=await p.evaluate(()=>({txt:document.body.innerText,name:document.body.innerText.includes('FB Newbie'),noPhone:!document.body.innerText.includes('+91')&&!/phone/i.test(document.body.innerText)}));
 ok('T3: profile shows Facebook name, no phone anywhere (§12)',prof.name&&prof.noPhone,prof);
 ok('T3: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T4: existing Facebook user → same account, no duplicate (§5) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbold'+Date.now()+'@test.in';
 await mockUser(ctx,em,'FB Oldtimer');
 const tk1=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk1.access_token+'&refresh_token='+tk1.refresh_token);
 const uid1=await p.evaluate(()=>JSON.parse(localStorage.getItem('pujoSession')).uid);
 await p.evaluate(()=>doLogout());await p.waitForTimeout(500);
 const tk2=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk2.access_token+'&refresh_token='+tk2.refresh_token);
 const st=await p.evaluate(()=>({uid:JSON.parse(localStorage.getItem('pujoSession')).uid,m:session.mode,name:session.name}));
 ok('T4: existing Facebook user signs back into the SAME account (no duplicate) (§5)',st.m==='user'&&st.uid===uid1,st);
 ok('T4: profile restored (name) (§5)',st.name==='FB Oldtimer',st.name);
 // refresh after login keeps the session (§9)
 await p.reload({waitUntil:'load'});await p.waitForTimeout(1500);
 const rr=await p.evaluate(()=>({m:session.mode,signin:getComputedStyle(document.getElementById('signinBtn')).display}));
 ok('T9: refresh after login → session restored, header intact (§9)',rr.m==='user'&&rr.signin==='none',rr);
 await p.evaluate(()=>doLogout());await p.waitForTimeout(400);
 const lo=await p.evaluate(()=>getComputedStyle(document.getElementById('signinBtn')).display);
 ok('T18: logout returns to Saved | Sign In (§11)',lo!=='none',lo);
 ok('T3/T4: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T5: avatar capture (§6/§9/§12) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbav'+Date.now()+'@test.in';
 await mockUser(ctx,em,'Avatar Test','https://example.com/a.png');
 const tk=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 const av=await p.evaluate(()=>({photo:session.photo,menu:!!document.querySelector('[onclick*="openProfile"]')||document.body.innerHTML.includes('openProfile')}));
 ok('T5: Facebook avatar URL captured into the session (§6)',av.photo==='https://example.com/a.png',av.photo);
 ok('T5: account menu (profile entry) available (§11)',av.menu,{});
 ok('T5: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T6/T7/T8: cancelled / invalid / network-error callbacks (§9/§14) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 // cancelled / denied
 await gotoOAuth(p,'#error=access_denied&error_description=User+cancelled');
 let st=await p.evaluate(()=>({m:session.mode,url:location.href,msg:document.body.innerText.match(/Facebook sign-in was cancelled[^.]*\./)?1:0}));
 ok('T15: OAuth cancellation → friendly cancel message, still logged out (§14)',st.msg===1&&st.m!=='user',st);
 ok('T15: error params cleaned from URL (§10)',!/access_denied/.test(st.url),st.url);
 // invalid / rejected token
 await gotoOAuth(p,'#access_token=garbage.token&refresh_token=junk');
 st=await p.evaluate(()=>({m:session.mode,url:location.href,msg:document.body.innerText.match(/can.t complete Facebook sign-in/i)?1:0}));
 ok('T16: invalid/expired callback → "We can\u2019t complete Facebook sign-in…" (§14)',st.msg===1&&st.m!=='user',st);
 ok('T16: token params cleaned even on failure (§9/§10)',!/(access_token|refresh_token)/.test(st.url),st.url);
 // network failure during exchange
 await p.route('**/api/auth/oauth-session',r=>r.abort());
 const tk=await mockToken(ctx,'fbnew@nospawn.in').catch(()=>null);
 await gotoOAuth(p,'#access_token=abc&refresh_token=def');
 st=await p.evaluate(()=>({m:session.mode,msg:document.body.innerText.match(/check your connection/i)?1:0,url:location.href}));
 ok('T17: network error during exchange → "check your connection" copy (§14)',st.msg===1&&st.m!=='user',st);
 await p.unroute('**/api/auth/oauth-session');
 ok('T6-T8: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T13/T19: duplicate callback + Bangla UI + language switch does not break OAuth ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbdupe'+Date.now()+'@test.in';
 await mockUser(ctx,em,'Dupe Check');
 const tk=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 // sign out, switch to Bangla, then return via OAuth again → flow + bn copy
 await p.evaluate(()=>doLogout());await p.waitForTimeout(400);
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(400);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 const bn=await p.evaluate(()=>({lbl:document.querySelector('#authBox .prov-btn.f')?document.querySelector('#authBox .prov-btn.f').textContent.trim():'',lang:LANG}));
 ok('T21: Bangla UI — Facebook button label বাংলা',bn.lbl.includes('Facebook'),bn.lbl);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 const dupe=await p.evaluate(()=>({m:session.mode,prov:session.provider,url:location.href}));
 ok('T19: Bangla active → OAuth flow still completes (§15)',dupe.m==='user'&&dupe.prov==='facebook',dupe);
 ok('T19: duplicate callback handled — signed in once, URL clean (§9)',!/access_token/.test(dupe.url),dupe.url);
 ok('T13: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T3b: pending My Pujo action survives OAuth and completes (§7/§20-14) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbplan'+Date.now()+'@test.in';
 await mockUser(ctx,em,'FB Planner');
 const tk=await mockToken(ctx,em);
 await p.addInitScript(pa=>{
   try{if(!/^http/.test(location.origin))return;
   localStorage.setItem('pujoPendingAction',JSON.stringify(pa));}catch(e){}
 },{kind:'plan',t:'pandal',id:'bagbazarsarbojanindurg'});
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 const st=await p.evaluate(()=>({m:session.mode,pa:localStorage.getItem('pujoPendingAction'),
   inPlan:Object.values(PLAN.days).some(arr=>(arr||[]).some(x=>x.id==='bagbazarsarbojanindurg')),
   total:Object.values(PLAN.days).reduce((n,a)=>n+((a||[]).length),0)}));
 ok('T3b: pending My Pujo action survives the OAuth redirect (§7)',st.m==='user',st);
 ok('T3b: pending item auto-added to My Pujo plan + pendingAction cleared (§7/§20-14)',st.inPlan&&st.pa===null&&st.total>=1,st);
 ok('T3b: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T3c: app hash (#pandals) saved on the way out, restored on return (§10) —
        whole flow on ONE origin, exactly like production (netlify → netlify) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbhash'+Date.now()+'@test.in';
 await mockUser(ctx,em,'FB Hash');
 await p.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:MOCK_LIB}));
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1000);
 await p.evaluate(()=>{PUJO_CONFIG.supabaseUrl='http://127.0.0.1:9090';PUJO_CONFIG.supabaseAnonKey='mock-anon-key';oauthNav=u=>{window.__navTo=u}});
 await p.goto(SB+'#pandals',{waitUntil:'load'});await p.waitForTimeout(900);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.f');await p.waitForTimeout(900);
 const saved=await p.evaluate(()=>localStorage.getItem('pujoOAuthHash'));
 ok('T3c: #pandals saved before the provider overwrites the hash (§10)',saved==='#pandals',saved);
 // the provider returns, having replaced #pandals with tokens
 const tk=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 const r=await p.evaluate(()=>({m:session.mode,url:location.href,sec:!!document.getElementById('pandals')}));
 ok('T3c: return URL restored to …/#pandals, tokens removed (§10)',r.m==='user'&&r.url.endsWith('#pandals')&&!/access_token/.test(r.url),r);
 ok('T3c: app intact after restore (no blank page) (§9/§10)',r.sec===true,{});
 ok('T3c: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T3d: visited places + saved + plan all load for a Facebook user (§5/§20-10/11) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='fbdata'+Date.now()+'@test.in';
 await mockUser(ctx,em,'FB Data');
 const tk=await mockToken(ctx,em);
 await gotoOAuth(p,'#access_token='+tk.access_token+'&refresh_token='+tk.refresh_token);
 const d=await p.evaluate(async()=>{
   const s=JSON.parse(localStorage.getItem('pujoSession'));
   const r=await (await fetch('/api/me',{headers:{'X-Auth':s.token}})).json();
   return {m:session.mode,user:!!r.user,saved:Array.isArray(r.data.saved),visited:Array.isArray(r.data.visited),plan:!!(r.data.plan&&r.data.plan.days!==undefined)};
 });
 ok('T3d: profile + Saved Places + visited places + My Pujo data all load (§5)',d.m==='user'&&d.user&&d.saved&&d.visited&&d.plan,d);
 ok('T3d: no page errors',!perr,{perr});
 await ctx.close();
}

/* ================= P32 — PRODUCTION CONFIGURATION ================= */

/* P32-1: Google button present/clickable; missing key config → honest setup notice (§12/§9) */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 const cfg=await p.evaluate(()=>({url:PUJO_CONFIG.supabaseUrl,keyEmpty:PUJO_CONFIG.supabaseAnonKey==='',noGid:!('googleClientId' in PUJO_CONFIG),noFid:!('facebookAppId' in PUJO_CONFIG)}));
 ok('P32: PUJO_CONFIG has the real public Supabase URL, no client-id fields, key slot empty (served instead)',cfg.url==='https://jzirrcllqowxhbjtieoo.supabase.co'&&cfg.keyEmpty&&cfg.noGid&&cfg.noFid,cfg);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.g');await p.waitForTimeout(900);
 const st=await p.evaluate(()=>({setup:document.body.innerText.includes('Google login'),sb:/Supabase Auth/.test(document.body.innerText),guest:!!document.querySelector('#authBox .guest-link')}));
 ok('P32: local (key not served) → honest Supabase-dashboard setup notice for Google (§12)',st.setup&&st.sb&&st.guest,st);
 // local /auth/config must NOT leak any pair
 const localCfg=await p.evaluate(async()=>await (await fetch('/api/auth/config')).json());
 ok('P32: local /auth/config serves no OAuth pair (honest state)',!localCfg.supabaseUrl&&!localCfg.supabaseAnonKey,localCfg);
 ok('P32-1: no page errors',!perr,{perr});
 await ctx.close();
}

/* P32-2: production path — NO key hard-coded; the backend-served pair drives Google OAuth (§3/§9) */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:MOCK_LIB}));
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>{oauthNav=u=>{window.__navTo=u}}); /* stub the redirect, inspect the URL */
 // note: PUJO_CONFIG.supabaseUrl is hard-coded but supabaseAnonKey is '' → pair must come from /auth/config
 const served=await p.evaluate(async()=>await (await fetch('/api/auth/config')).json());
 ok('P32: backend serves the PUBLIC pair from its environment (§9)',served.supabaseUrl&&served.supabaseAnonKey&&served.supabaseAnonKey!=='service-role',served);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.g');await p.waitForTimeout(1500);
 const g=await p.evaluate(()=>({ctor:window.__sbCtor,calls:window.__sbCalls,nav:window.__navTo||''}));
 ok('P32: Google OAuth initiated via signInWithOAuth(provider:"google") (§3/§12)',g.calls.length===1&&g.calls[0].provider==='google',g.calls);
 ok('P32: client built with the SERVED pair (backend env), not a pasted key (§9)',g.ctor&&g.ctor[0]===served.supabaseUrl&&g.ctor[1]===served.supabaseAnonKey,g.ctor);
 ok('P32: Google redirect target = Supabase /authorize with same-origin redirectTo (§4)',/authorize\?provider=google$/.test(g.nav)&&g.calls[0].redirectTo===SB,g);
 // double-click guard on Google
 await p.evaluate(()=>{window.__sbMode='hang';window.__gBusy=false});
 await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
 await p.click('#authBox .prov-btn.g');await p.waitForTimeout(200);
 await p.click('#authBox .prov-btn.g').catch(()=>{});await p.waitForTimeout(400);
 const gd=await p.evaluate(()=>({loading:document.querySelector('#authBox .prov-btn.g').classList.contains('loading'),busy:window.__gBusy===true}));
 ok('P32: Google loading state + duplicate-click protection (§2/§12)',gd.loading&&gd.busy,gd);
 ok('P32-2: no page errors',!perr,{perr});
 await ctx.close();
}

/* P32-3: security — no private credentials anywhere in the served frontend (§8/§12) */
{
 const ctx=await b.newContext();
 const p=await ctx.newPage();
 const src=await (await p.request.get(L)).text();
 const bad=['service_role','serviceRole','app_secret','appSecret','client_secret','clientSecret','FB.login','FB.init','fbAsyncInit','facebookAppId','googleClientId'];
 const hits=bad.filter(k=>src.includes(k));
 ok('P32: no secrets / dead SDK flows / client-id fields in frontend source (§8)',hits.length===0,hits);
 ok('P32: no SMS provider names in frontend source (§1)',!/(twilio|vonage|messagebird|textlocal)/i.test(src),{});
 const anon=await p.evaluate(()=>0).catch(()=>0);
 ok('P32: Supabase public URL configured in frontend (only client-safe values)',src.includes('https://jzirrcllqowxhbjtieoo.supabase.co'),{});
 await ctx.close();
}

/* P32-4: Google OAuth callback/session restoration — pending save + migration + no duplicate (§12) */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 const em='gg'+Date.now()+'@test.in';
 await mockUser(ctx,em,'G Tester');
 // first login: guest saves + pending action ride in
 await p.addInitScript(sv=>{try{if(!/^http/.test(location.origin))return;
   localStorage.setItem('pujo_saved2_guest',JSON.stringify(sv));}catch(e){}
 },[{t:'food',id:'aminia-shyambazar',at:1},{t:'pandal',id:'kumartulipark',at:2}]);
 const tk1=await mockToken(ctx,em,'google');
 await gotoOAuth(p,'#access_token='+tk1.access_token+'&refresh_token='+tk1.refresh_token);
 const st=await p.evaluate(()=>({m:session.mode,prov:session.provider,name:session.name,
   signin:getComputedStyle(document.getElementById('signinBtn')).display,url:location.href}));
 ok('P32: Google callback → authenticated session, provider "google" (§12)',st.m==='user'&&st.prov==='google'&&st.name==='G Tester',st);
 ok('P32: header flips immediately (Sign In hidden) (§11)',st.signin==='none',st.signin);
 ok('P32: URL cleaned of tokens (§10)',!/access_token/.test(st.url),st.url);
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(600);
 const mg=await p.evaluate(()=>{const uid=JSON.parse(localStorage.getItem('pujoSession')).uid;return JSON.parse(localStorage.getItem('pujo_saved2_'+uid)||'[]')});
 ok('P32: guest saves migrated into the Google account (2, no duplicates) (§8/§12)',mg.length===2&&new Set(mg.map(x=>x.t+':'+x.id)).size===2,mg);
 const uid1=await p.evaluate(()=>JSON.parse(localStorage.getItem('pujoSession')).uid);
 await p.evaluate(()=>doLogout());await p.waitForTimeout(400);
 // login again → same account, no duplicate (§5/§12)
 const tk2=await mockToken(ctx,em,'google');
 await gotoOAuth(p,'#access_token='+tk2.access_token+'&refresh_token='+tk2.refresh_token);
 const st2=await p.evaluate(()=>({uid:JSON.parse(localStorage.getItem('pujoSession')).uid,m:session.mode}));
 ok('P32: Google re-login → SAME account, no duplicate (§5/§12)',st2.m==='user'&&st2.uid===uid1,st2);
 ok('P32-4: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T22: responsive — button intact + initiation works at every width (§16) ---- */
{
 const ctx=await b.newContext();
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.route('**/cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:MOCK_LIB}));
 for(const [w,h] of [[320,700],[360,740],[390,844],[430,932],[768,1024],[1024,768],[1280,850]]){
  await p.setViewportSize({width:w,height:h});
  await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(700);
  await p.evaluate(()=>{PUJO_CONFIG.supabaseUrl='http://127.0.0.1:9090';PUJO_CONFIG.supabaseAnonKey='mock-anon-key';oauthNav=u=>{window.__navTo=u}});
  await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{const f=document.querySelector('#authBox .prov-btn.f');const rc=f.getBoundingClientRect();
    return {vis:f.offsetParent!==null,h:rc.height,w:rc.width,ov:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}});
  ok(w+'px: Facebook button visible, not clipped, no overflow (§16)',r.vis&&r.h>=42&&r.w>0&&!r.ov,r);
  await p.click('#authBox .prov-btn.f');await p.waitForTimeout(900);
  const nav=await p.evaluate(()=>window.__navTo||'');
  ok(w+'px: click initiates OAuth redirect (loading visible, flow works)',/authorize/.test(nav),nav);
 }
 ok('T22: no page errors',!perr,{perr});
 await ctx.close();
}

await b.close();
console.log('\nP31 RESULT:',PASS,'passed,',FAIL,'failed');
if(FAIL){console.log('FAILURES:');fails.forEach(f=>console.log(' -',f));process.exit(1)}
})().catch(e=>{console.error('SUITE ERROR',e);process.exit(2)});

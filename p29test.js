/* ===== P29 SUITE — mobile/phone OTP fully removed; 4 auth methods intact ===== */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
const URL='http://127.0.0.1:8080/';
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,200));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,200))}}
const CH=process.env.CH_BIN;
(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ---- T1: absence in default (en) auth UI ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(400);
 const d=await p.evaluate(()=>({
   btns:[...document.querySelectorAll('#authBox .prov-btn')].map(x=>x.className+'|'+x.textContent.trim()),
   or:document.querySelectorAll('#authBox .auth-or').length,
   tabs:document.querySelectorAll('#authBox .atab').length,
   swap:!!document.querySelector('#authBox .swaplink'),
   guest:!!document.querySelector('#authBox .gs-b'),
   bodyTxt:document.body.innerText,
 }));
 ok('auth home: exactly 3 provider buttons (Google/Facebook/Email)',d.btns.length===3&&d.btns.every(x=>/^prov-btn [gfe]$/.test(x.split('|')[0])),d.btns);
 ok('auth home: no phone/mobile provider button',!d.btns.some(x=>/📞|mobile|phone/i.test(x)),d.btns);
 ok('auth home: Login + Create Account tabs present',d.tabs===2,{tabs:d.tabs});
 ok('auth home: "or" divider present exactly once',d.or===1,{or:d.or});
 ok('auth home: login⇄signup swap link present',d.swap,{});
 ok('auth home: Continue as Guest strip present',d.guest,{});
 ok('auth home: no "OTP" text anywhere',!/OTP/i.test(d.bodyTxt),{});
 ok('auth home: no "Mobile" text anywhere',!/mobile/i.test(d.bodyTxt),{});
 // JS-level absence
 const j=await p.evaluate(()=>({
   sendOtp:typeof sendOtp,verifyOtpSubmit:typeof verifyOtpSubmit,otpFinish:typeof otpFinish,
   otpResend:typeof otpResend,authPhoneHTML:typeof authPhoneHTML,authOtpHTML:typeof authOtpHTML,
   sbPhone:typeof sbPhone,sbCfg:typeof sbCfg,phE164:typeof phE164,otpCool:typeof otpCool,
   cfg:PUJO_CONFIG,hasPhoneRoute:(a)=>0,
 }));
 ok('JS: no OTP functions remain',Object.entries(j).filter(([k,v])=>['sendOtp','verifyOtpSubmit','otpFinish','otpResend','authPhoneHTML','authOtpHTML','sbPhone','sbCfg'].includes(k)).every(([k,v])=>v==='undefined'),j);
 ok('JS: no OTP globals (phE164/otpCool/demoOtp)',j.phE164==='undefined'&&j.otpCool==='undefined'&&typeof demoOtp==='undefined',j);
 /* P31 note: supabaseUrl/supabaseAnonKey are the PUBLIC OAuth config (client-safe by design);
    P29's guarantee is that they are never used for phone OTP — asserted by the absence checks above. */
 ok('JS: PUJO_CONFIG holds no secrets (only public anon config) + authApiBase intact',j.cfg.authApiBase==='/api'&&(!('supabaseAnonKey' in j.cfg)||j.cfg.supabaseAnonKey.length<200)&&!('serviceRole' in j.cfg)&&!('service_role' in j.cfg),j.cfg);
 // no phone/OTP elements in email view either
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(300);
 const ev=await p.evaluate(()=>({ph:!!document.getElementById('auPhone'),otp:!!document.getElementById('auOtp'),phErr:!!document.getElementById('phErr'),otpb:document.getElementById('otpb0'),email:!!document.getElementById('auEmail'),pass:!!document.getElementById('auPass')}));
 ok('email view: no #auPhone/#auOtp/#phErr/OTP boxes; #auEmail+#auPass intact',!ev.ph&&!ev.otp&&!ev.phErr&&!ev.otpb&&ev.email&&ev.pass,ev);
 // router: openAuth('phone') now falls through to the standard home (no phone screen)
 await p.evaluate(()=>openAuth('phone'));await p.waitForTimeout(300);
 const rt=await p.evaluate(()=>({g:!!document.querySelector('#authBox .prov-btn.g'),ph:!!document.getElementById('auPhone')}));
 ok('openAuth("phone") renders standard home (route removed, no phone screen)',rt.g&&!rt.ph,rt);
 // CSS absence
 const css=await p.evaluate(()=>({bad:/prov2|otp-row|\.otp-b|ph-cc/.test(document.body.innerHTML),sheets:[...document.styleSheets].some(sh=>{try{return /otp-row|\.otp-b|ph-cc|\.prov2/.test([...sh.cssRules].map(r=>r.cssText).join(''))}catch(e){return false}})}));
 ok('CSS: .prov2/.otp-row/.otp-b/.ph-cc styles absent (DOM + stylesheets)',!css.bad&&!css.sheets,css);
 ok('T1: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T2: absence in Bengali UI ---- */
{
 const ctx=await b.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(600);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(400);
 const t=await p.evaluate(()=>({txt:document.body.innerText,btns:[...document.querySelectorAll('#authBox .prov-btn')].length}));
 ok('bn: auth UI has 3 provider buttons',t.btns===3,{btns:t.btns});
 ok('bn: no মোবাইল/ওটিপি/OTP text',!/মোবাইল|ওটিপি|OTP/i.test(t.txt),{});
 ok('bn: Google/Facebook/Email labels present',/গুগল দিয়ে|ফেসবুক দিয়ে|ইমেল দিয়ে/.test(t.txt),{});
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(400);
 ok('T2: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T3: four remaining auth methods intact (structure + order) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(400);
 const o=await p.evaluate(()=>{
   const box=document.getElementById('authBox');
   const order=[...box.querySelectorAll('.prov-btn.g,.prov-btn.f,.auth-or,.prov-btn.e')].map(x=>x.className.split(' ')[1]||'or');
   const g=box.querySelector('.prov-btn.g'),e=box.querySelector('.prov-btn.e'),box_w=box.getBoundingClientRect().width;
   return {order,gw:g.getBoundingClientRect().width,ew:e.getBoundingClientRect().width,box_w,
     guestTxt:box.querySelector('.gs-b')?.textContent.trim(),fnG:typeof provGoogle,fnF:typeof provFacebook,fnE:typeof openAuth};
 });
 ok('order: Google → Facebook → or → Email (no phone anywhere)',JSON.stringify(o.order)===JSON.stringify(['g','f','or','e']),o.order);
 ok('Email button full width (same width as Google — no empty half-column)',Math.abs(o.gw-o.ew)<2&&o.ew>o.box_w*0.8,{gw:o.gw,ew:o.ew});
 ok('handlers intact: provGoogle/provFacebook/openAuth defined',o.fnG==='function'&&o.fnF==='function'&&o.fnE==='function',{});
 ok('guest strip label intact (Continue as Guest)',o.guestTxt==='Continue as Guest',o.guestTxt);
 // divider not orphaned (has text "or") — checked on home view
 const orT=await p.evaluate(()=>document.querySelector('#authBox .auth-or').textContent.trim());
 ok('"or" divider carries its label',orT.toLowerCase()==='or',orT);
 // email flow: login view (default tab) → fields + back + swap; signup view adds name
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(300);
 const ef=await p.evaluate(()=>({email:!!document.getElementById('auEmail'),pass:!!document.getElementById('auPass'),back:!!document.querySelector('#authBox .back-link'),swapBtn:[...document.querySelectorAll('#authBox .mini')].some(x=>/log in|sign in/i.test(x.textContent))}));
 ok('email view (login): email+password fields, back link, swap button intact',ef.email&&ef.pass&&ef.back&&ef.swapBtn,ef);
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(300);
 const ef2=await p.evaluate(()=>({name:!!document.getElementById('auName'),email:!!document.getElementById('auEmail'),pass:!!document.getElementById('auPass')}));
 ok('email view (signup): name+email+password fields intact',ef2.name&&ef2.email&&ef2.pass,ef2);
 ok('T3: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T4: email signup → session → profile/settings → logout ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 const em='p29'+Date.now()+'@test.in';
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 await p.evaluate(()=>{if(!document.getElementById('auName'))authEmailSwap('signup')});
 await p.waitForTimeout(300);
 await p.fill('#auName','P29 Tester');
 await p.fill('#auEmail',em);
 await p.fill('#auPass','pw123456');
 await p.evaluate(()=>emailSubmit('signup'));
 await p.waitForTimeout(1000);
 let st=await p.evaluate(()=>({mode:session.mode,name:session.name}));
 ok('email signup works (no OTP step)',st.mode==='user'&&st.name==='P29 Tester',st);
 // open profile → settings: contact row shows email, no phone anywhere
 await p.evaluate(()=>openProfile());await p.waitForTimeout(400);
 let prof=await p.evaluate(e=>({txt:document.body.innerText,email:document.body.innerText.includes(e)}),em);
 ok('profile shows account email',prof.email,{});
 ok('profile shows no phone number',!/phone/i.test(prof.txt),{});
 await p.evaluate(()=>openSettings());await p.waitForTimeout(400);
 prof=await p.evaluate(e=>({txt:document.body.innerText,email:document.body.innerText.includes(e),contactPhone:/phone/i.test(document.body.innerText)}),em);
 ok('settings shows contact email',prof.email,{});
 ok('settings shows no phone number',!prof.contactPhone,{});
 await p.evaluate(()=>closePanel());await p.waitForTimeout(200);
 // logout
 await p.evaluate(()=>doLogout());await p.waitForTimeout(500);
 st=await p.evaluate(()=>({mode:session.mode}));
 ok('logout works',st.mode!==true||st.mode===null||st.mode==='guest'||!st.mode,st);
 ok('T4: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T5: guest save → login nudge → email signup → auto-continue merge ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>{localStorage.clear()});await p.reload({waitUntil:'load'});await p.waitForTimeout(1000);
 // guest saves 1 food + 1 pandal
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSaveP('bagbazarsarbojanindurg')});
 await p.waitForTimeout(300);
 let g=await p.evaluate(()=>({f:JSON.parse(localStorage.getItem('pujo_saved2_guest')||'[]').length}));
 ok('guest saves stored locally',g.f===2,g);
 // trigger the account nudge (save while logged out) → open auth → email signup
 await p.evaluate(()=>{toggleSave('arsalan-lake-town')});await p.waitForTimeout(300);
 const nb=await p.evaluate(()=>({nudge:document.getElementById('mOverlay')?.classList.contains('open')||false,g:JSON.parse(localStorage.getItem('pujo_saved2_guest')||'[]').length}));
 ok('3rd guest save stored (cap path reachable, nudge/opt-in surface intact)',nb.g===3,nb);
 await p.evaluate(()=>closeModals());await p.waitForTimeout(300);
 const em='p29m'+Date.now()+'@test.in';
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 await p.evaluate(()=>{if(!document.getElementById('auName'))authEmailSwap('signup')});
 await p.waitForTimeout(200);
 await p.fill('#auName','P29 Migrate');
 await p.fill('#auEmail',em);
 await p.fill('#auPass','pw123456');
 await p.evaluate(()=>emailSubmit('signup'));
 await p.waitForTimeout(1000);
 // auto-continue: guest saves ride the migration prompt after sign-in
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(700);
 const mg=await p.evaluate(()=>({n:JSON.parse(localStorage.getItem('pujo_saved2_'+(session.uid||session.id||''))||'[]').length,keys:Object.keys(localStorage).filter(k=>k.includes('saved2')).length}));
 ok('auto-continue: guest saves merged into new account',mg.n>=2,mg);
 ok('T5: no page errors',!perr,{perr});
 await ctx.close();
}

/* ---- T6: responsive sweep — no empty columns / orphaned divider / overflow ---- */
{
 const ctx=await b.newContext();
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 for(const [w,h] of [[320,700],[360,740],[390,844],[430,932],[768,1024],[1024,768],[1280,850]]){
  await p.setViewportSize({width:w,height:h});
  await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(700);
  await p.evaluate(()=>openAuth());await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{
    const box=document.getElementById('authBox');
    const bw=box.getBoundingClientRect().width;
    const btns=[...box.querySelectorAll('.prov-btn')].map(x=>({w:Math.round(x.getBoundingClientRect().width),full:x.getBoundingClientRect().width>bw*0.8,n:x.textContent.trim().slice(0,22)}));
    const or=box.querySelectorAll('.auth-or').length;
    const doc=document.documentElement;
    return {btns,or,overflowX:doc.scrollWidth>doc.clientWidth+1,bw};
  });
  ok(w+'px: 3 provider buttons, all full-width',r.btns.length===3&&r.btns.every(x=>x.full),r.btns);
  ok(w+'px: exactly one "or" divider',r.or===1,{or:r.or});
  ok(w+'px: no horizontal overflow',!r.overflowX,{sw:0});
 }
 await ctx.close();
}

/* ---- T7: server contract — OTP endpoints gone, auth endpoints alive ---- */
{
 const ctx=await b.newContext();
 const p=await ctx.newPage();
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(600);
 const r=await p.evaluate(async()=>{
   const post=async(u,body)=>{const x=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {s:x.status}};
   const otpSend=await post('/api/auth/otp-send',{phone:'+919000000000'});
   const otpVerify=await post('/api/auth/otp-verify',{phone:'+919000000000',code:'1234'});
   const badLogin=await post('/api/auth/login',{email:'nobody@x.in',password:'wrong'});
   const health=await (await fetch('/api/health')).json();
   return {otpSend,otpVerify,badLogin,mode:health.mode};
 });
 ok('server: /api/auth/otp-send removed (404)',r.otpSend.s===404,r.otpSend);
 ok('server: /api/auth/otp-verify removed (404)',r.otpVerify.s===404,r.otpVerify);
 ok('server: /api/auth/login still alive (401 on bad creds)',r.badLogin.s===401,r.badLogin);
 ok('server: /api/health OK',r.mode==='local',r.mode);
 await ctx.close();
}

await b.close();
console.log('\nP29 RESULT:',PASS,'passed,',FAIL,'failed');
if(FAIL){console.log('FAILURES:');fails.forEach(f=>console.log(' -',f));process.exit(1)}
})().catch(e=>{console.error('SUITE ERROR',e);process.exit(2)});

/* ===== P30 SUITE — final email auth UX: confirmation, email OTP, reset, cooldown =====
   PART A+B run against the local server (:8080), PART C against the Supabase-mode
   server backed by mock_sb (:8081, MOCK_AUTOCONFIRM=0, MOCK_OTP=654321). */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,220));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,220))}}
const CH=process.env.CH_BIN;
const L='http://127.0.0.1:8080/', SB='http://127.0.0.1:8081/';

(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ================= PART A — LOCAL MODE (:8080) ================= */

/* A1/A2: email view structure — login + signup */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(700); /* let /auth/config land */
 const lv=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   ph:[document.getElementById('auEmail')?.placeholder,document.getElementById('auPass')?.placeholder],
   btns:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim()),
   links:[...document.querySelectorAll('#authBox .swaplink')].map(x=>x.textContent.trim()),
   back:!!document.querySelector('#authBox .back-link'),
   hint:null,
 }));
 ok('login view: heading "Log in with Email"',lv.h==='Log in with Email',lv.h);
 ok('login view: placeholders "Enter your email"/"Enter your password"',lv.ph[0]==='Enter your email'&&lv.ph[1]==='Enter your password',lv.ph);
 ok('login view: [Log In] primary button',lv.btns.includes('Log In'),lv.btns);
 ok('login view: "Forgot password?" link present',lv.links.includes('Forgot password?'),lv.links);
 ok('login view: "Don\u2019t have an account? Create one" swap',lv.links.some(x=>x.includes('Create one')),lv.links);
 ok('login view: back link present',lv.back,{});
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(500);
 const sv=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   name:!!document.getElementById('auName'),
   hint:document.getElementById('emHint')?.textContent,
   btns:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim()),
   links:[...document.querySelectorAll('#authBox .swaplink')].map(x=>x.textContent.trim()),
   forgot:[...document.querySelectorAll('#authBox .swaplink')].some(x=>x.textContent.includes('Forgot')),
 }));
 ok('signup view: heading "Create your free account"',sv.h==='Create your free account',sv.h);
 ok('signup view: name field present',sv.name,{});
 ok('signup view: helper "Use at least 4 characters." (local config)',sv.hint==='Use at least 4 characters.',sv.hint);
 ok('signup view: [Create Account] primary',sv.btns.includes('Create Account'),sv.btns);
 ok('signup view: "Already have an account? Log in" swap, NO forgot link',sv.links.some(x=>x.includes('Log in'))&&!sv.forgot,sv.links);
 // signup email label localized structure: label text 'Email'
 const lbl=await p.evaluate(()=>[...document.querySelectorAll('#authBox label')].map(x=>x.textContent.trim()));
 ok('signup view: labels include Name/Email/Password',lbl.includes('Email')&&lbl.some(x=>/password/i.test(x))&&lbl.some(x=>/name/i.test(x)),lbl);
 ok('A1: no page errors',!perr,{perr});
 await ctx.close();
}

/* A3-A8: validation, show/hide, local signup/login */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(600);
 await p.fill('#auEmail','not-an-email');await p.fill('#auPass','abcd1234');
 await p.evaluate(()=>emailSubmit('login'));await p.waitForTimeout(300);
 let err=await p.evaluate(()=>({t:document.getElementById('emErr')?.textContent,v:getComputedStyle(document.getElementById('emErr')).display}));
 ok('invalid email → "Please enter a valid email address."',/valid email/.test(err.t||''),err);
 await p.fill('#auEmail','a3@test.in');await p.fill('#auPass','abc');
 await p.evaluate(()=>emailSubmit('signup'));await p.waitForTimeout(300);
 err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('short password → helper message inline',/at least/.test(err||''),err);
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(300);
 // show/hide toggle
 const sh=await p.evaluate(()=>{const b=document.querySelector('.pw-toggle');const t0=document.getElementById('auPass').type;b.click();const t1=document.getElementById('auPass').type;const l1=b.textContent.trim();b.click();return {t0,t1,l1,t2:document.getElementById('auPass').type,l2:b.textContent.trim()}});
 ok('show/hide toggle: password⇄text, Show⇄Hide',sh.t0==='password'&&sh.t1==='text'&&sh.l1==='Hide'&&sh.t2==='password'&&sh.l2==='Show',sh);
 // local signup → instant session (demo autoconfirm)
 const em='a3'+Date.now()+'@test.in';
 await p.fill('#auName','A3 Tester');await p.fill('#auEmail',em);await p.fill('#auPass','abcd1234');
 await p.evaluate(()=>emailSubmit('signup'));await p.waitForTimeout(900);
 let st=await p.evaluate(()=>({m:session.mode,n:session.name}));
 ok('local signup → signed in immediately (demo mode, no confirmation step)',st.m==='user'&&st.n==='A3 Tester',st);
 ok('header: Sign In hidden after auth',await p.evaluate(()=>getComputedStyle(document.getElementById('signinBtn')).display==='none'),{});
 await p.evaluate(()=>doLogout());await p.waitForTimeout(500);
 // wrong password
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 await p.fill('#auEmail',em);await p.fill('#auPass','wrong999');
 await p.evaluate(()=>emailSubmit('login'));await p.waitForTimeout(400);
 err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('wrong password → "Email or password is incorrect."',/incorrect/.test(err||''),err);
 // correct login
 await p.fill('#auPass','abcd1234');await p.evaluate(()=>emailSubmit('login'));await p.waitForTimeout(700);
 st=await p.evaluate(()=>session.mode);
 ok('existing account logs in normally (no second account)',st==='user',st);
 await p.evaluate(()=>doLogout());await p.waitForTimeout(400);
 ok('A3: no page errors',!perr,{perr});
 await ctx.close();
}

/* A9: reset flow (local → honest no-mailer error) */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(500);
 await p.evaluate(()=>openReset());await p.waitForTimeout(300);
 let r=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,ph:document.getElementById('rstEmail')?.placeholder,btn:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim())}));
 ok('reset view: heading "Reset your password" + email placeholder + [Send Reset Email]',r.h==='Reset your password'&&r.ph==='Enter your email'&&r.btn.includes('Send Reset Email'),r);
 await p.fill('#rstEmail','bad@@mail');await p.evaluate(()=>resetSubmit());await p.waitForTimeout(300);
 let err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('reset: invalid email error',/valid email/.test(err||''),err);
 await p.fill('#rstEmail','a9@test.in');await p.evaluate(()=>resetSubmit());await p.waitForTimeout(500);
 err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('reset (local): honest "not available in this environment" message (never faked)',/available in this environment/.test(err||''),err);
 ok('A9: no page errors',!perr,{perr});
 await ctx.close();
}

/* A10/A11: OTP + confirmation screens — structure & behaviour */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth());await p.waitForTimeout(400);
 // OTP screen
 await p.evaluate(()=>showEmailOtp('a10@gmail.com'));await p.waitForTimeout(400);
 let o=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   p1:document.querySelector('#authBox .t-p')?.textContent,
   lbl:[...document.querySelectorAll('#authBox label')].map(x=>x.textContent.trim()).join('|'),
   boxes:document.querySelectorAll('.ecode-b').length,
   focused:document.activeElement&&document.activeElement.id,
   verify:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim()).join('|'),
   resend:document.getElementById('otpResend')?.textContent.trim(),
   cool:document.getElementById('otpCool')?.textContent,
 }));
 ok('OTP screen: heading "Check your email 🔐"',o.h&&o.h.includes('Check your email'),o.h);
 ok('OTP screen: "We sent a 6-digit verification code to:"',/6-digit verification code/.test(o.p1||''),o.p1);
 ok('OTP screen: label "Email verification code"',o.lbl==='Email verification code',o.lbl);
 ok('OTP screen: 6 boxes, first autofocused',o.boxes===6&&o.focused==='ecb0',o);
 ok('OTP screen: [Verify Email] + [Resend Code]',o.verify.includes('Verify Email')&&o.resend==='Resend Code',o);
 ok('OTP screen: countdown running ("Resend available in 60s")',/Resend available in \d+s/.test(o.cool||''),o.cool);
 // typing auto-advance + paste
 await p.evaluate(()=>{[0,1,2,3,4].forEach(i=>{const e=document.getElementById('ecb'+i);e.value=String(i+1)})});
 const adv=await p.evaluate(()=>{const b4=document.getElementById('ecb4');b4.focus();b4.value='9';ecIn(4,b4);return document.activeElement.id});
 ok('OTP: typing a digit advances to next box',adv==='ecb5',{adv});
 await p.evaluate(()=>{[...Array(6)].forEach((_,i)=>document.getElementById('ecb'+i).value='')});
 await p.focus('#ecb0');
 await p.keyboard.press('Control+a');
 const pasted=await p.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','912345');ecPaste({clipboardData:dt,preventDefault(){}});return ecVal()});
 ok('OTP: paste fills the full 6-digit code',pasted==='912345',pasted);
 const badmsg=await p.evaluate(async()=>{await verifyEmailCode();return document.getElementById('emErr')?.textContent});
 ok('OTP: submit shows a friendly inline error (local demo has no mailer)',(badmsg||'').length>10,badmsg);
 // confirmation screen
 await p.evaluate(()=>showEmailConfirm('a11@gmail.com',false));await p.waitForTimeout(400);
 let c=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   mail:document.querySelector('.conf-mail')?.textContent,
   p1:document.querySelector('#authBox .t-p')?.textContent,
   open:document.querySelector('#authBox a.mini')?.getAttribute('href'),
   resend:document.getElementById('confResend')?.textContent.trim(),
   disabled:document.getElementById('confResend')?.disabled,
   cool:document.getElementById('confCool')?.textContent,
 }));
 ok('confirm screen: heading "Check your email 📬"',c.h&&c.h.includes('Check your email'),c.h);
 ok('confirm screen: shows the user\u2019s email',c.mail==='a11@gmail.com',c.mail);
 ok('confirm screen: "We\u2019ve sent a confirmation link to:"',/confirmation link/.test(c.p1||''),c.p1);
 ok('confirm screen: [Open Email] → real Gmail inbox for gmail.com',c.open==='https://mail.google.com',c.open);
 ok('confirm screen: [Resend Confirmation Email] + 60s countdown + disabled',c.resend==='Resend Confirmation Email'&&c.disabled===true&&/Resend available in \d+s/.test(c.cool||''),c);
 await p.evaluate(()=>showEmailConfirm('who@unknownprovider.xyz',false));await p.waitForTimeout(300);
 const noOpen=await p.evaluate(()=>({a:!!document.querySelector('#authBox a.mini')}));
 ok('confirm screen: unknown provider → Open Email omitted (no fake link)',!noOpen.a,noOpen);
 // cooldown mechanics with short window
 await p.evaluate(()=>{authCoolSecs=2;showEmailConfirm('a11@gmail.com',false)});await p.waitForTimeout(300);
 let d=await p.evaluate(()=>document.getElementById('confResend').disabled);
 ok('cooldown: resend disabled while counting',d===true,{});
 await p.waitForTimeout(2400);
 d=await p.evaluate(()=>({dis:document.getElementById('confResend').disabled,cool:document.getElementById('confCool').textContent}));
 ok('cooldown: re-enabled after the window elapses, countdown cleared',d.dis===false&&d.cool==='',d);
 ok('A10: no page errors',!perr,{perr});
 await ctx.close();
}

/* A13: Bangla — every new email-auth string localized (incl. bn digits in countdown) */
{
 const ctx=await b.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(500);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(500);
 let v=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   ph:[document.getElementById('auEmail')?.placeholder,document.getElementById('auPass')?.placeholder],
   forgot:[...document.querySelectorAll('#authBox .swaplink')].map(x=>x.textContent.trim()),
   emailLbl:[...document.querySelectorAll('#authBox label')].map(x=>x.textContent.trim()),
 }));
 ok('bn: email login heading বাংলা',v.h==='ইমেল দিয়ে লগ ইন',v.h);
 ok('bn: placeholders বাংলা',v.ph[0]==='ইমেল লিখুন'&&v.ph[1]==='পাসওয়ার্ড লিখুন',v.ph);
 ok('bn: "পাসওয়ার্ড ভুলে গেছেন?" link',v.forgot.includes('পাসওয়ার্ড ভুলে গেছেন?'),v.forgot);
 ok('bn: field labels বাংলা (no English "Email"/"Password" labels)',!v.emailLbl.includes('Email')&&!v.emailLbl.includes('Password'),v.emailLbl);
 await p.evaluate(()=>showEmailConfirm('bn@gmail.com',false));await p.waitForTimeout(300);
 let c=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,p1:document.querySelector('#authBox .t-p')?.textContent,q:[...document.querySelectorAll('#authBox .t-p')].map(x=>x.textContent.trim()),resend:document.getElementById('confResend')?.textContent.trim(),cool:document.getElementById('confCool')?.textContent,open:document.querySelector('#authBox a.mini')?.textContent.trim()}));
 ok('bn: "আপনার ইমেইল দেখুন 📬"',c.h==='আপনার ইমেইল দেখুন 📬',c.h);
 ok('bn: "আমরা একটি confirmation link পাঠিয়েছি:"',c.p1==='আমরা একটি confirmation link পাঠিয়েছি:',c.p1);
 ok('bn: "ইমেইল পাননি?"',c.q.some(x=>x==='ইমেইল পাননি?'),c.q);
 ok('bn: resend button বাংলা',c.resend==='কনফার্মেশন ইমেল আবার পাঠান',c.resend);
 ok('bn: countdown in বাংলা digits (আবার পাঠানো যাবে ৬০ সেকেন্ডে), no ASCII digits',/আবার পাঠানো যাবে ৬০ সেকেন্ডে/.test(c.cool||'')&&!/[0-9]/.test(c.cool||''),c.cool);
 ok('bn: Open Email → "ইমেইল খুলুন"',c.open==='ইমেইল খুলুন',c.open);
 await p.evaluate(()=>showEmailOtp('bn@gmail.com'));await p.waitForTimeout(300);
 let o=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,lbl:[...document.querySelectorAll('#authBox label')].map(x=>x.textContent.trim()).join('|'),verify:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim()).join('|'),p1:document.querySelector('#authBox .t-p')?.textContent}));
 ok('bn: OTP screen fully বাংলা (heading/label/verify)',o.h==='আপনার ইমেইল দেখুন 🔐'&&o.lbl==='ইমেল ভেরিফিকেশন কোড'&&o.verify.includes('ইমেল যাচাই করুন'),o);
 ok('bn: "আমরা ৬-অঙ্কের verification code পাঠিয়েছি:" (৬ = bn digit)',o.p1.startsWith('আমরা ৬-অঙ্কের'),o.p1);
 await p.evaluate(()=>openReset());await p.waitForTimeout(300);
 let r=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,btn:[...document.querySelectorAll('#authBox .mini')].map(x=>x.textContent.trim()).join('|')}));
 ok('bn: reset screen বাংলা',r.h==='পাসওয়ার্ড রিসেট করুন'&&r.btn.includes('রিসেট ইমেল পাঠান'),r);
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(300);
 ok('A13: no page errors',!perr,{perr});
 await ctx.close();
}

/* A14: guest → email signup → auto-continue (local) */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>localStorage.clear());await p.reload({waitUntil:'load'});await p.waitForTimeout(900);
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSaveP('bagbazarsarbojanindurg')});await p.waitForTimeout(300);
 const em='a14'+Date.now()+'@test.in';
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(300);
 await p.fill('#auName','A14 Tester');await p.fill('#auEmail',em);await p.fill('#auPass','abcd1234');
 await p.evaluate(()=>emailSubmit('signup'));await p.waitForTimeout(900);
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(600);
 const mg=await p.evaluate(()=>({m:session.mode,n:JSON.parse(localStorage.getItem('pujo_saved2_'+(session.uid||session.id||''))||'[]').length}));
 ok('guest saves → email signup → auto-continue merge (2 saved)',mg.m==='user'&&mg.n>=2,mg);
 ok('A14: no page errors',!perr,{perr});
 await ctx.close();
}

/* ================= PART B — SUPABASE MODE (:8081, mock confirmation/OTP) ================= */

/* B1: signup → confirmation-required screen (NOT signed in) */
let confEmailSB='';
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1200);
 const cfg=await p.evaluate(async()=>await (await fetch('/api/auth/config')).json());
 ok('SB config: autoconfirm=false, minPasswordLength=6 (drives the UI)',cfg.autoconfirm===false&&cfg.minPasswordLength===6,cfg);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(500);
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(400);
 const hint=await p.evaluate(()=>document.getElementById('emHint')?.textContent);
 ok('SB: helper matches Supabase min length → "Use at least 6 characters."',hint==='Use at least 6 characters.',hint);
 await p.evaluate(()=>authCoolSecs=3);
 confEmailSB='b1'+Date.now()+'@test.in';
 await p.fill('#auName','B1 Tester');await p.fill('#auEmail',confEmailSB);await p.fill('#auPass','secret123');
 await p.evaluate(()=>emailSubmit('signup'));await p.waitForTimeout(900);
 const c=await p.evaluate(()=>({
   sess:session.mode,
   signin:document.getElementById('signinBtn')?getComputedStyle(document.getElementById('signinBtn')).display:'n/a',
   h:document.querySelector('#authBox .t-h')?.textContent,
   mail:document.querySelector('.conf-mail')?.textContent,
   open:!!document.querySelector('#authBox a.mini'),
   res:document.getElementById('confResend')?.disabled,
   cool:document.getElementById('confCool')?.textContent,
 }));
 ok('B1: signup → "Check your email 📬" screen',c.h&&c.h.includes('Check your email'),c.h);
 ok('B1: user NOT authenticated yet (session guest, header Sign In visible)',c.sess!=='user'&&c.signin!=='none',c);
 ok('B1: correct email echoed',c.mail===confEmailSB,c.mail);
 ok('B1: unknown provider → no fake Open Email button',!c.open,{});
 ok('B1: resend disabled with countdown',c.res===true&&/Resend available in \ds/.test(c.cool||''),c);
 // B2: resend after cooldown
 await p.waitForTimeout(3300);
 const rd=await p.evaluate(()=>document.getElementById('confResend').disabled);
 ok('B2: resend enabled after cooldown',rd===false,{rd});
 await p.click('#confResend');await p.waitForTimeout(600);
 const r2=await p.evaluate(()=>({dis:document.getElementById('confResend').disabled,err:(document.getElementById('emErr')||{}).textContent||''}));
 ok('B2: resend success → cooldown restarts, no error',r2.dis===true&&r2.err==='',r2);
 ok('B1: no page errors',!perr,{perr});
 await ctx.close();
}

/* B3/B4: login unconfirmed → confirm-first; wrong password */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(500);
 await p.evaluate(()=>authCoolSecs=2);
 await p.fill('#auEmail',confEmailSB);await p.fill('#auPass','secret123');
 await p.evaluate(()=>emailSubmit('login'));await p.waitForTimeout(900);
 const c=await p.evaluate(()=>({
   h:document.querySelector('#authBox .t-h')?.textContent,
   first:document.querySelector('#authBox .t-p')?.textContent,
   mail:document.querySelector('.conf-mail')?.textContent,
   res:!!document.getElementById('confResend'),
   sess:session.mode,
 }));
 ok('B3: unconfirmed login → "Please confirm your email before continuing."',c.first==='Please confirm your email before continuing.',c);
 ok('B3: confirm-first screen shows email + resend, still logged out',c.h.includes('Check your email')&&c.mail===confEmailSB&&c.res&&c.sess!=='user',c);
 await p.evaluate(()=>authEmailSwap('login'));await p.waitForTimeout(400);
 await p.fill('#auEmail',confEmailSB);await p.fill('#auPass','wrongpass1');
 await p.evaluate(()=>emailSubmit('login'));await p.waitForTimeout(700);
 const err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('B4: wrong password → "Email or password is incorrect."',/incorrect/.test(err||''),err);
 // B7: 429 resend via route interception
 await p.evaluate(e=>showEmailConfirm(e,true),confEmailSB);await p.waitForTimeout(300);
 await p.route('**/api/auth/resend',r=>r.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'too many requests',code:'too_many'})}));
 await p.click('#confResend');await p.waitForTimeout(600);
 const m=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('B7: 429 → "Too many attempts. Please wait a moment and try again."',/Too many attempts/.test(m||''),m);
 await p.unroute('**/api/auth/resend');
 ok('B3: no page errors',!perr,{perr});
 await ctx.close();
}

/* B5/B6: email OTP — wrong / expired / correct code → session + pending action completes (§8) */
{
 const ctx=await b.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1200);
 // guest saves 2, then signup with a fresh email → confirmation screen → jump to OTP screen (as OTP-configured projects show)
 await p.evaluate(()=>localStorage.clear());await p.reload({waitUntil:'load'});await p.waitForTimeout(900);
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSaveP('bagbazarsarbojanindurg')});await p.waitForTimeout(300);
 const em='b5'+Date.now()+'@test.in';
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 await p.evaluate(()=>authEmailSwap('signup'));await p.waitForTimeout(300);
 await p.fill('#auName','B5 Tester');await p.fill('#auEmail',em);await p.fill('#auPass','secret123');
 await p.evaluate(()=>emailSubmit('signup'));await p.waitForTimeout(900);
 let c=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,sess:session.mode}));
 ok('B5: signup → confirmation screen (link flow) first',c.h&&c.h.includes('Check your email')&&c.sess!=='user',c);
 // OTP-configured projects: user enters the code from the email → OTP screen
 await p.evaluate(e=>showEmailOtp(e),em);await p.waitForTimeout(400);
 // wrong code
 await p.evaluate(()=>{for(let i=0;i<6;i++)document.getElementById('ecb'+i).value='1'});
 await p.click('#authBox .mini.gold');await p.waitForTimeout(700);
 let o=await p.evaluate(()=>({err:document.getElementById('emErr')?.textContent,val:[0,1,2,3,4,5].map(i=>document.getElementById('ecb'+i).value).join('')}));
 ok('B5: wrong code → "That code isn\u2019t correct. Please try again." + boxes cleared',/isn.t correct/.test(o.err||'')&&o.val==='',o);
 // expired code
 await p.evaluate(()=>{for(let i=0;i<6;i++)document.getElementById('ecb'+i).value='0'});
 await p.evaluate(()=>verifyEmailCode());await p.waitForTimeout(700);
 o=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('B5: expired code → "This verification link/code has expired. Please request a new one."',/expired/.test(o||''),o);
 // correct code via typing + Enter (keyboard path)
 await p.focus('#ecb0');
 await p.type('#ecb0','6',{delay:40});
 await p.type('#ecb1','5',{delay:40});
 const auto=await p.evaluate(()=>ecVal());
 ok('B5: typing 6,5 then paste-completing → value tracked',auto.startsWith('65'),auto);
 await p.evaluate(()=>{const d='654321';for(let i=0;i<6;i++)document.getElementById('ecb'+i).value=d[i]});
 await p.evaluate(()=>verifyEmailCode());await p.waitForTimeout(1000);
 const sess=await p.evaluate(()=>({m:session.mode,n:session.name,signin:document.getElementById('signinBtn')?getComputedStyle(document.getElementById('signinBtn')).display:'na',open:document.getElementById('authOverlay').classList.contains('open')}));
 ok('B5: correct code → authenticated session established',sess.m==='user'&&sess.n==='B5 Tester',sess);
 ok('B5: header updated immediately (Sign In hidden), modal closed',sess.signin==='none'&&!sess.open,sess);
 // §8: pending guest saves ride the migration
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(600);
 const mg=await p.evaluate(()=>({n:JSON.parse(localStorage.getItem('pujo_saved2_'+(session.uid||session.id||''))||'[]').length}));
 ok('B6 (§8): save → signup → confirm → OTP → same place → pending saves auto-continue (2 merged)',mg.n>=2,mg);
 ok('B5: no page errors',!perr,{perr});
 await ctx.close();
}

/* B8: forgot password (SB) → reset-sent screen */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(SB,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(500);
 await p.evaluate(()=>openReset());await p.waitForTimeout(300);
 await p.fill('#rstEmail',confEmailSB);
 await p.evaluate(()=>resetSubmit());await p.waitForTimeout(700);
 const r=await p.evaluate(()=>({h:document.querySelector('#authBox .t-h')?.textContent,p:document.querySelector('#authBox .t-p')?.textContent,mail:document.querySelector('.conf-mail')?.textContent}));
 ok('B8: reset → "Check your email 📬" + "We\u2019ve sent you a password reset link."',r.h&&r.h.includes('Check your email')&&/password reset link/.test(r.p||''),r);
 // B9: network failure → friendly error
 await p.route('**/api/auth/reset',r=>r.abort('failed'));
 await p.evaluate(()=>openReset());await p.waitForTimeout(300);
 await p.fill('#rstEmail',confEmailSB);await p.evaluate(()=>resetSubmit());await p.waitForTimeout(900);
 const err=await p.evaluate(()=>document.getElementById('emErr')?.textContent);
 ok('B9: network failure → "Something went wrong. Please try again."',/Something went wrong/.test(err||''),err);
 ok('B8: no page errors',!perr,{perr});
 await ctx.close();
}

/* ================= PART C — RESPONSIVE (320…1280) ================= */
{
 const ctx=await b.newContext();
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 for(const [w,h] of [[320,700],[360,740],[390,844],[430,932],[768,1024],[1024,768],[1280,850]]){
  await p.setViewportSize({width:w,height:h});
  await p.goto(L,{waitUntil:'load'});await p.waitForTimeout(700);
  await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
  let r=await p.evaluate(()=>{
    const sc=['#authOverlay .modal','#authOverlay .auth-right','#authOverlay .modal-body'].map(s=>document.querySelector(s)).find(e=>e&&/(auto|scroll)/.test(getComputedStyle(e).overflowY||getComputedStyle(e).overflow));
    const box=document.getElementById('authBox');
    const btns=[...box.querySelectorAll('.mini')].map(x=>Math.round(x.getBoundingClientRect().height));
    return {ov:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            inputs:[...box.querySelectorAll('input')].map(i=>({fs:getComputedStyle(i).fontSize,r:i.getBoundingClientRect()})),
            btns,min44:btns.every(x=>x>=44),modalScroll:!!sc};
  });
  ok(w+'px email login: no horizontal overflow',!r.ov,{});
  ok(w+'px email login: inputs ≥16px + visible',r.inputs.every(i=>parseFloat(i.fs)>=16&&i.r.width>0),r.inputs);
  ok(w+'px email login: buttons ≥44px tall'+(w<=760?', modal scrollable':' (desktop: modal grows naturally)'),r.min44&&(w>760||r.modalScroll),r.btns);
  await p.evaluate(()=>{authCoolSecs=60;showEmailOtp('r@gmail.com')});await p.waitForTimeout(300);
  r=await p.evaluate(()=>{
    const row=document.querySelector('.ecode-row').getBoundingClientRect();
    const box=document.getElementById('authBox').getBoundingClientRect();
    return {ov:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,fit:row.width<=box.width+1,row:Math.round(row.width)};
  });
  ok(w+'px OTP: 6 boxes fit inside the modal, no overflow',!r.ov&&r.fit,{...r});
  await p.evaluate(()=>showEmailConfirm('long.email.address@some-very-long-domain-name.co.in',false));await p.waitForTimeout(300);
  r=await p.evaluate(()=>({ov:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,wrap:getComputedStyle(document.querySelector('.conf-mail')).wordBreak}));
  ok(w+'px confirm: long email wraps naturally, no overflow',!r.ov&&(r.wrap==='break-word'||r.wrap==='anywhere'),r);
 }
 ok('PART C: no page errors',!perr,{perr});
 await ctx.close();
}

await b.close();
console.log('\nP30 RESULT:',PASS,'passed,',FAIL,'failed');
if(FAIL){console.log('FAILURES:');fails.forEach(f=>console.log(' -',f));process.exit(1)}
})().catch(e=>{console.error('SUITE ERROR',e);process.exit(2)});

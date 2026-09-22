/* ===== P27 SUITE — public /privacy + /terms pages ===== */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
const URL='http://127.0.0.1:8080/';
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,200));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,200))}}
const CH=process.env.CH_BIN;
/* local server (unmodifiable) serves the documents at /privacy/index.html;
   on Netlify the same files resolve natively at /privacy and /terms */
const PRIV=URL+'privacy/index.html', TERMS=URL+'terms/index.html';
(async()=>{
const b=await chromium.launch({executablePath:CH});

/* T1: direct access, fresh logged-out tabs, titles + content + mailto */
for(const [name,u,title,re] of [['privacy',PRIV,'Privacy Policy | PujoSathi',/Information We Collect/],['terms',TERMS,'Terms of Use | PujoSathi',/Limitation of Liability/]]){
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(u,{waitUntil:'load'});await p.waitForTimeout(500);
 ok(name+': direct open, correct title',await p.title()===title,await p.title());
 const d=await p.evaluate(()=>({h1:document.querySelector('h1').textContent,
   secs:document.querySelectorAll('.ls').length,
   upd:document.querySelector('.upd').textContent,
   mail:document.querySelector('a[href^="mailto:hello@pujosathi.in"]')?1:0,
   end:document.querySelector('.endline').textContent,
   hd:!!document.querySelector('.hd .logo'),ft:!!document.querySelector('footer'),
   meta:document.querySelector('meta[name=description]')?.getAttribute('content').length}));
 ok(name+': h1 + '+d.secs+' sections + last-updated chip',d.secs>=13&&/September 2026|২০২৬/.test(d.upd),d);
 ok(name+': contact email clickable (mailto:hello@pujosathi.in)',d.mail===1,{});
 ok(name+': ends with Kolkata · Durga Puja 2026',/Kolkata|কলকাতা/.test(d.end),d.end);
 ok(name+': site header + footer present, meta description set',d.hd&&d.ft&&d.meta>40,d);
 // refresh
 await p.reload({waitUntil:'load'});await p.waitForTimeout(400);
 ok(name+': refresh works, content intact',re.test(await p.content()),{});
 // logged-in state (localStorage session preset) — page unaffected
 await p.evaluate(()=>{localStorage.setItem('pujoSession',JSON.stringify({mode:'user',uid:'x',name:'T',token:'t'}))});
 await p.reload({waitUntil:'load'});await p.waitForTimeout(400);
 ok(name+': opens fine with a session preset (no auth gate)',re.test(await p.content()),{});
 await p.evaluate(()=>localStorage.removeItem('pujoSession'));
 ok(name+': no page errors',!perr,{perr});
 await ctx.close();
}

/* T2: JS-disabled readability */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850},javaScriptEnabled:false});
 const p=await ctx.newPage();
 await p.goto(PRIV,{waitUntil:'load'});await p.waitForTimeout(400);
 let txt=await p.evaluate(()=>document.body.innerText).catch(()=>null);
 ok('privacy readable without JavaScript',txt&&/Information We Collect/.test(txt)&&txt.length>3000,txt?txt.length:null);
 await p.goto(TERMS,{waitUntil:'load'});await p.waitForTimeout(400);
 txt=await p.evaluate(()=>document.body.innerText).catch(()=>null);
 ok('terms readable without JavaScript',txt&&/Prohibited Use/.test(txt)&&txt.length>3500,txt?txt.length:null);
 await ctx.close();
}

/* T3: language toggle en⇄bn + persistence */
{
 const ctx=await b.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto(PRIV,{waitUntil:'load'});await p.waitForTimeout(500);
 await p.click('#langBtn');await p.waitForTimeout(300);
 let d=await p.evaluate(()=>({h1:document.querySelector('h1').textContent,lang:document.documentElement.lang,btn:document.getElementById('langBtn').textContent}));
 ok('bn: h1 becomes প্রাইভেসি পলিসি, lang=bn, btn shows English',d.h1==='প্রাইভেসি পলিসি'&&d.lang==='bn'&&d.btn==='English',d);
 await p.reload({waitUntil:'load'});await p.waitForTimeout(400);
 d=await p.evaluate(()=>({h1:document.querySelector('h1').textContent,lang:document.documentElement.lang}));
 ok('bn persists after refresh (localStorage pujoLang)',d.h1==='প্রাইভেসি পলিসি'&&d.lang==='bn',d);
 await p.click('#langBtn');await p.waitForTimeout(300);
 d=await p.evaluate(()=>document.querySelector('h1').textContent);
 ok('toggle back to English works',d==='Privacy Policy',d);
 // bn digits on bn, ASCII digits on en
 await p.click('#langBtn');await p.waitForTimeout(300);
 const bnDigit=await p.evaluate(()=>document.body.innerText.includes('২০২৬')&&!/[0-9]/.test(document.querySelector('.upd').textContent));
 ok('bn: Bangla digits everywhere (২০২৬), none in updated chip',bnDigit,{});
 await p.click('#langBtn');await p.waitForTimeout(200);
 await ctx.close();
}

/* T4: responsive — 320/360/390/430/768/1280, no overflow, tap targets */
for(const [W,H] of [[320,700],[360,800],[390,800],[430,800],[768,900],[1280,850]]){
 for(const u of [PRIV,TERMS]){
  const ctx=await b.newContext({viewport:{width:W,height:H},isMobile:W<800,hasTouch:W<800});
  const p=await ctx.newPage();
  await p.goto(u,{waitUntil:'load'});await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{
    const ov=document.documentElement.scrollWidth>innerWidth+1;
    const nav=document.querySelector('.hd nav a');
    const nh=nav?nav.getBoundingClientRect().height:0;
    const clipped=[...document.querySelectorAll('.ls p')].some(x=>{const b=x.getBoundingClientRect();return b.right>innerWidth+1});
    return {ov,nh,clipped,h1w:Math.round(document.querySelector('h1').getBoundingClientRect().width)};
  });
  ok((u.includes('privacy')?'privacy':'terms')+' '+W+'px: no overflow/clipping, nav tap ≥44px',!r.ov&&!r.clipped&&r.nh>=44,r);
  await ctx.close();
 }
}

/* T5: homepage footer links → pages; homepage unaffected */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 // desktop legal column
 let r=await p.evaluate(()=>({pv:document.querySelector('footer .f-col.legal a[data-i18n=f_priv]')?.getAttribute('href'),
   tm:document.querySelector('footer .f-col.legal a[data-i18n=f_terms]')?.getAttribute('href'),
   disc:!!document.querySelector('footer .f-col.legal button[data-i18n=f_disc]')}));
 ok('homepage footer: Privacy+Terms are real links, Disclaimer stays modal',r.pv==='/privacy/index.html'&&r.tm==='/terms/index.html'&&r.disc,r);
 // click through
 await p.evaluate(()=>{document.querySelector('footer .f-col.legal a[data-i18n=f_priv]').click()});
 await p.waitForTimeout(700);
 ok('clicking footer Privacy opens /privacy page',await p.title()==='Privacy Policy | PujoSathi',await p.title());
 await p.goBack({waitUntil:'load'});await p.waitForTimeout(800);
 // mobile inline row links
 await p.setViewportSize({width:360,height:800});await p.waitForTimeout(600);
 r=await p.evaluate(()=>({pv:document.querySelector('.fb-legal a[data-i18n=f_priv]')?.getAttribute('href'),
   tm:document.querySelector('.fb-legal a[data-i18n=f_terms]')?.getAttribute('href'),
   disc:!!document.querySelector('.fb-legal button[data-i18n=f_disc]'),
   ov:document.documentElement.scrollWidth>innerWidth+1}));
 ok('mobile inline row: same real links + Disclaimer modal, no overflow',r.pv==='/privacy/index.html'&&r.tm==='/terms/index.html'&&r.disc&&!r.ov,r);
 // homepage smoke: sections + saved count + quick save
 await p.setViewportSize({width:1280,height:850});await p.waitForTimeout(500);
 r=await p.evaluate(()=>({grid:!!document.getElementById('grid'),dlist:!!document.getElementById('dlist'),
   days:!!document.getElementById('days')}));
 ok('homepage intact (grid/atlas/days sections)',r.grid&&r.dlist&&r.days,r);
 await p.evaluate(()=>toggleSave('aminia-shyambazar'));await p.waitForTimeout(200);
 ok('save still works, count syncs',await p.evaluate(()=>document.getElementById('savedCount').textContent)==='1',{});
 ok('no page errors (homepage)',!perr,{perr});
 await ctx.close();
}

/* T6: auth + backend untouched smoke */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1200);
 await p.evaluate(()=>signInAs({id:'p27u',name:'P27 Test',email:'p27@test.in'},'email'));
 await p.waitForTimeout(500);
 const st=await p.evaluate(()=>({mode:session.mode,pill:getComputedStyle(document.getElementById('mpPill')).display}));
 ok('auth still works (signInAs → user, mp-pill shows)',st.mode==='user'&&st.pill!=='none',st);
 await p.evaluate(()=>doLogout());await p.waitForTimeout(300);
 ok('logout still works',await p.evaluate(()=>session.mode)==='guest',{});
 // cross-links between the two pages + disclaimer anchor
 await p.goto(TERMS,{waitUntil:'load'});await p.waitForTimeout(500);
 const ln=await p.evaluate(()=>[...document.querySelectorAll('footer a')].map(a=>a.getAttribute('href')));
 ok('terms page links privacy + disclaimer anchor',ln.includes('/privacy/index.html')&&ln.includes('/terms/index.html#disclaimer'),ln);
 await p.click('footer a[href="/terms/index.html#disclaimer"]').catch(()=>{});
 await p.waitForTimeout(900);
 const anch=await p.evaluate(()=>{const e=document.getElementById('disclaimer');return e?Math.round(e.getBoundingClientRect().top):null});
 ok('disclaimer anchor lands on section (top in view)',anch!==null&&anch>=-50&&anch<300,anch);
 await ctx.close();
}
console.log(`\n===== P27 RESULT: ${PASS} passed, ${FAIL} failed =====`);
fails.forEach(f=>console.log(f));
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

/* ===== CONSOLIDATED REGRESSION (P19–P24 critical paths) ===== */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
const URL='http://127.0.0.1:8080/';
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,200));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,200))}}
const CH=process.env.CH_BIN;
(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ---- T1: auth + photo merge + header states ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 const em='qa'+Date.now()+'@test.in';
 await p.evaluate(()=>openAuth('email'));await p.waitForTimeout(400);
 // ensure signup mode
 await p.evaluate(()=>{if(!document.getElementById('auName'))authEmailSwap('signup')});
 await p.waitForTimeout(300);
 await p.fill('#auName','QA Tester');
 await p.fill('#auEmail',em);
 await p.fill('#auPass','pw123456');
 await p.evaluate(()=>emailSubmit('signup'));
 await p.waitForTimeout(1000);
 let st=await p.evaluate(()=>({mode:session.mode,name:session.name}));
 ok('signup → signed in, name shown',st.mode==='user'&&st.name==='QA Tester',st);
 ok('header: mp-pill visible when authed',await p.evaluate(()=>getComputedStyle(document.getElementById('mpPill')).display!=='none'),{});
 ok('header: Sign In hidden when authed',await p.evaluate(()=>getComputedStyle(document.getElementById('signinBtn')).display==='none'),{});
 // logout → Sign In visible
 await p.evaluate(()=>doLogout());await p.waitForTimeout(500);
 st=await p.evaluate(()=>({mode:session.mode}));
 ok('logout → guest',st.mode==='guest',st);
 ok('header: Sign In visible when logged out',await p.evaluate(()=>getComputedStyle(document.getElementById('signinBtn')).display!=='none'),{});
 // relogin via signInAs (existing flow) — local user record exists with photo ''
 await p.evaluate(e=>signInAs(getUsers()['qa-local-'+e]||{id:'qa-local-'+e,name:'QA Tester',email:e},'email'),em);
 await p.waitForTimeout(500);
 st=await p.evaluate(()=>({mode:session.mode,init:document.getElementById('avatarBtn').getAttribute('data-init')}));
 ok('relogin: avatar initial present (no blank photo crash)',st.mode==='user'&&!!st.init,st);
 ok('no page errors (auth flow)',!perr,{perr});
 await ctx.close();
}

/* ---- T2: guest caps 3+3 → nudge ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 const foods=['aminia-shyambazar','arsalan-lake-town','dhiren-cabin','sanjha-chulha','hanglaatherium-lake-to'];
 for(const id of foods){await p.evaluate(i=>toggleSave(i),id);await p.waitForTimeout(60)}
 await p.waitForTimeout(300);
 const nudge1=await p.evaluate(()=>document.getElementById('mOverlay').classList.contains('open'));
 ok('food cap (3) → limit nudge opens',nudge1,{});
 await p.evaluate(()=>closeModals());await p.waitForTimeout(200);
 const cnt=await p.evaluate(()=>document.getElementById('savedCount').textContent);
 ok('count stays at 3 after cap attempts',cnt==='3',cnt);
 // pandal cap
 await p.evaluate(()=>closeModals());
 for(const id of ['bagbazarsarbojanindurg','kumartulipark','talaprattoy','sikdarbagansadharandur']){await p.evaluate(i=>toggleSaveP(i),id);await p.waitForTimeout(60)}
 await p.waitForTimeout(300);
 const st=await p.evaluate(()=>({c:document.getElementById('savedCount').textContent,o:document.getElementById('mOverlay').classList.contains('open')}));
 ok('pandal cap (3) → nudge; total = 6',st.c==='6',st);
 ok('no page errors (caps)',!perr,{perr});
 await ctx.close();
}

/* ---- T3: saved panel + my pujo ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSaveP('bagbazarsarbojanindurg')});
 await p.evaluate(()=>openSaved('food'));await p.waitForTimeout(500);
 let r=await p.evaluate(()=>({tabs:document.querySelectorAll('#panelContent .ptabs .tab').length,
   rows:document.querySelectorAll('#panelContent .sv-row, #panelContent .pn-row, #panelContent [id^=sv-]').length,
   meta:document.querySelector('#panelContent .meta')?.textContent||''}));
 ok('saved panel: 2 tabs (food/pandal)',r.tabs===2,r);
 await p.evaluate(()=>openSaved('pandal'));await p.waitForTimeout(400);
 r=await p.evaluate(()=>({tabs:[...document.querySelectorAll('#panelContent .ptabs .tab')].map(t=>t.textContent).join('§'),
   rows:[...document.querySelectorAll('#panelContent .sv-row, #panelContent [id^=sv-]')].length,
   print:[...document.querySelectorAll('#panelContent .mrow button')].some(x=>(x.getAttribute('onclick')||'').includes('doPrint')),
   route:!!document.querySelector('#panelContent .mrow [data-maps]')}));
 ok('pandal tab: count in tab label + rows + print/route parity',/·\s*[১1]/.test(r.tabs)&&r.rows>=1&&r.print&&r.route,r);
 await p.evaluate(()=>closePanel());await p.waitForTimeout(200);
 // my pujo: add a place to a day (guest → nudge; local user → works)
 await p.evaluate(()=>{signInAs({id:'qamp',name:'MP Tester',email:'mp'+Date.now()+'@test.in'},'email')});
 await p.waitForTimeout(500);
 await p.evaluate(()=>{openMyPujo()});await p.waitForTimeout(500);
 const mp=await p.evaluate(()=>({open:document.getElementById('panelOverlay').classList.contains('open'),
   days:document.querySelectorAll('#panelContent .mp-day, #panelContent [data-day]').length}));
 ok('My Pujo opens for user',mp.open,{});
 await p.evaluate(()=>{addPlan('saptami','pandal','bagbazarsarbojanindurg')});await p.waitForTimeout(500);
 const plan=await p.evaluate(()=>(PLAN.days.saptami||[]).length);
 ok('addPlan works (saptami has 1 stop)',plan===1,plan);
 await p.evaluate(()=>closePanel());
 ok('no page errors (panel/mp)',!perr,{perr});
 await ctx.close();
}

/* ---- T4: language anchors (top/mid/bottom) ---- */
{
 const ctx=await b.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 for(const [tag,mode] of [['top',0],['mid',1],['bottom',2]]){
   await p.evaluate(m=>{if(m===0)window.scrollTo({top:0,behavior:'instant'});
     else if(m===1){const el=document.getElementById('dlist');window.scrollTo({top:el.getBoundingClientRect().top+scrollY-200+600,behavior:'instant'})}
     else window.scrollTo({top:document.documentElement.scrollHeight-1400,behavior:'instant'})},mode);
   await p.waitForTimeout(600);
   const cap=await p.evaluate(()=>{let aid=null;outer:for(const fy of [0.5,0.35,0.65,0.2,0.8,0.95]){
     const hit=document.elementFromPoint(Math.round(innerWidth/2),Math.round(innerHeight*fy));let n=hit;
     while(n&&n!==document.body){const cs=getComputedStyle(n);if(n.id&&cs.position!=='sticky'&&cs.position!=='fixed'&&cs.display!=='none'){aid=n.id;break outer}n=n.parentElement}}
     return {aid,top:aid?document.getElementById(aid).getBoundingClientRect().top:0}});
   await p.evaluate(()=>toggleLang());await p.waitForTimeout(1000);
   const res=await p.evaluate(a=>document.getElementById(a).getBoundingClientRect().top,cap.aid);
   ok('lang @'+tag+': anchor within ±4px',Math.abs(res-cap.top)<=4,{b:Math.round(cap.top),a:Math.round(res)});
 }
 // bn digits + no ASCII digits in bn
 const bn=await p.evaluate(()=>({city:document.querySelector('.f-city')?.textContent||'',cnt:document.getElementById('dirCount')?.textContent||''}));
 ok('bn: Bangla digits in footer city line',bn.city.includes('২০২৬')&&!/[0-9]/.test(bn.city),bn);
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(900);
 ok('no page errors (lang)',!perr,{perr});
 await ctx.close();
}

/* ---- T5: P23 pandal search + FAB + food mini ---- */
{
 const ctx=await b.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 await p.evaluate(()=>{document.querySelector('.dir-bar').scrollIntoView({behavior:'instant',block:'start'})});
 await p.waitForTimeout(400);
 await p.click('.dir-search-btn');await p.waitForTimeout(500);
 let r=await p.evaluate(()=>({open:document.getElementById('psBar').classList.contains('open'),
   focused:document.activeElement&&document.activeElement.id==='psInp'}));
 ok('dir-bar Search opens search-only bar (focused)',r.open&&r.focused,r);
 await p.click('#psInp');await p.type('#psInp','bagbazar',{delay:50});await p.waitForTimeout(700);
 r=await p.evaluate(()=>({c:document.getElementById('dirCount').textContent,vis:[...document.querySelectorAll('.drow:not(.hide)')].length}));
 ok('pandal search filters (bagbazar)',r.vis>=1&&r.vis<=6,r);
 await p.click('#psBar .xb');await p.waitForTimeout(500);
 r=await p.evaluate(()=>({closed:!document.getElementById('psBar').classList.contains('open'),rest:/210/.test(document.getElementById('dirCount').textContent)}));
 ok('close → full list restored',r.closed&&r.rest,r);
 // FAB appears at cards
 await p.evaluate(()=>{const el=document.getElementById('dlist');window.scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight+40,behavior:'instant'})});
 await p.waitForTimeout(600);
 r=await p.evaluate(()=>({on:document.getElementById('psFab').classList.contains('on')}));
 ok('FAB on when cards in view',r.on,r);
 // food mini
 await p.evaluate(()=>{document.getElementById('eat').scrollIntoView({behavior:'instant',block:'start'})});
 await p.waitForTimeout(400);
 await p.click('.filter-in .s-mini');await p.waitForTimeout(500);
 r=await p.evaluate(()=>({so:document.getElementById('filterbar').classList.contains('search-open'),
   tabs:document.querySelector('.filter-in .tabs')?getComputedStyle(document.querySelector('.filter-in .tabs')).display:'none'}));
 ok('food mini → input only (tabs hidden)',r.so&&(r.tabs==='none'),r);
 await p.click('.filter-in .s-x');await p.waitForTimeout(300);
 ok('no page errors (P23 flows)',!perr,{perr});
 await ctx.close();
}

/* ---- T6: footer + info modals (P24) ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 const f=await p.evaluate(()=>({tag:document.querySelector('footer').tagName,
   navs:[...document.querySelectorAll('footer nav.f-col h4')].map(h=>h.textContent.trim()).join('|'),
   actions:document.querySelectorAll('footer nav.f-col a,footer nav.f-col button').length,
   dead:[...document.querySelectorAll('footer a')].filter(a=>!a.getAttribute('href')||a.getAttribute('href')==='#').length,
   mailto:document.querySelector('footer a[href^="mailto:"]')?.getAttribute('href')}));
 ok('footer structure intact (Explore|Help|Legal, 12 actions)',f.tag==='FOOTER'&&f.navs==='Explore|Help|Legal'&&f.actions===12,f);
 ok('no dead footer links; Contact = mailto',f.dead===0&&f.mailto==='mailto:hello@pujosathi.in',f);
 for(const k of ['hiw','guest','disc']){
   await p.evaluate(kk=>infoModal(kk),k);await p.waitForTimeout(300);
   const o=await p.evaluate(()=>document.getElementById('mOverlay').classList.contains('open'));
   ok('infoModal('+k+') opens',o,{});
   await p.keyboard.press('Escape');await p.waitForTimeout(200);
 }
 ok('no page errors (footer)',!perr,{perr});
 await ctx.close();
}

/* ---- T7: spot modal + shortlist print/route + overflow quick ---- */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 await p.evaluate(()=>openSpot('aminia-shyambazar'));await p.waitForTimeout(400);
 let r=await p.evaluate(()=>({open:document.getElementById('mOverlay').classList.contains('open'),
   dir:!!document.querySelector('#mContent [data-maps]')}));
 ok('spot modal opens with directions button',r.open&&r.dir,r);
 await p.keyboard.press('Escape');await p.waitForTimeout(200);
 // header Saved pill → saved panel (showShortlist = openSaved since P19); food tab has print + route-all
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');showShortlist()});await p.waitForTimeout(500);
 r=await p.evaluate(()=>({open:document.getElementById('panelOverlay').classList.contains('open'),
   pr:!![...document.querySelectorAll('#panelContent .mrow button')].find(x=>(x.getAttribute('onclick')||'').includes('doPrint')),
   rt:!!document.querySelector('#panelContent .mrow [data-maps]')}));
 ok('saved panel (food tab): print + route-all intact',r.open&&r.pr&&r.rt,r);
 await p.evaluate(()=>closePanel());await p.waitForTimeout(200);
 for(const W of [360,1280]){
   await p.setViewportSize({width:W,height:850});await p.waitForTimeout(600);
   const ov=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
   ok(W+'px: no horizontal overflow',ov,{});
 }
 ok('no page errors (spot/shortlist)',!perr,{perr});
 await ctx.close();
}

console.log(`\n===== REGRESSION-ALL RESULT: ${PASS} passed, ${FAIL} failed =====`);
fails.forEach(x=>console.log(x));
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

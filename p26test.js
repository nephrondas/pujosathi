/* ===== P26 SUITE — ribbon/name overlap fix, Connect Everyplace, mobile footer legal ===== */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
const URL='http://127.0.0.1:8080/';
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,220));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,220))}}
const CH=process.env.CH_BIN;
(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ===== T1: PUJO DEAL ribbon no longer covers the name (en+bn) ===== */
for(const lang of ['en','bn']){
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 if(lang==='bn'){await p.evaluate(()=>toggleLang());await p.waitForTimeout(900)}
 const r=await p.evaluate(()=>{
   const card=document.querySelector('.card.featured');
   if(!card)return {none:true};
   const rib=card.querySelector('.ribbon');const h3=card.querySelector('h3');
   const rb=rib.getBoundingClientRect(),hb=h3.getBoundingClientRect();
   const txt=h3.textContent.trim();
   return {rb:Math.round(rb.bottom),ht:Math.round(hb.top),txt,
     clear:rb.bottom<=hb.top+2,full:hb.width>60,
     pad:getComputedStyle(card.querySelector('.card-top')).paddingTop};
 });
 ok(lang+': featured card name sits fully below the PUJO DEAL ribbon',r.clear&&r.ht>=r.rb,{ribBottom:r.rb,nameTop:r.ht,pad:r.pad});
 ok(lang+': featured name text intact ('+r.txt.slice(0,26)+')',r.full&&!r.none,r.txt);
 ok(lang+': no page errors (ribbon)',!perr,{perr});
 await ctx.close();
}

/* ===== T2: CONNECT EVERYPLACE — one route with food + pandals ===== */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSave('arsalan-lake-town');toggleSaveP('bagbazarsarbojanindurg')});
 await p.evaluate(()=>openSaved('food'));await p.waitForTimeout(500);
 let r=await p.evaluate(()=>{
   const bs=[...document.querySelectorAll('#panelContent .mrow button')];
   const con=bs.find(x=>(x.textContent||'').includes('Connect Everyplace'));
   let wp='';if(con){const a=con.getAttribute('data-maps');try{wp=decodeURIComponent(a.split('waypoints=')[1])}catch(e){wp=a}}
   return {label:!!con,wp,pts:wp?wp.split('|'):[],scheme:con?con.getAttribute('data-maps').startsWith('https://www.google.com/maps/dir/?api=1&waypoints='):false};
 });
 ok('Connect Everyplace button present (food tab)',r.label,{});
 ok('route combines food + pandal (3 waypoints)',r.pts.length===3,r.pts);
 ok('waypoints include real pandal coords',r.pts.some(x=>/^22\.\d+,88\.\d+$/.test(x)),r.pts);
 ok('same Maps URL scheme as existing mechanism',r.scheme,{});
 // click → openMaps
 await p.evaluate(()=>{window.__open=window.open;window.open=()=>({opener:null})});
 await p.evaluate(()=>{[...document.querySelectorAll('#panelContent .mrow button')].find(x=>(x.textContent||'').includes('Connect Everyplace')).click()});
 ok('click opens Maps via openMaps',await p.evaluate(()=>window.open!==window.__open),{});
 await p.evaluate(()=>{window.open=window.__open});
 // pandal tab also has it
 await p.evaluate(()=>openSaved('pandal'));await p.waitForTimeout(500);
 const r2=await p.evaluate(()=>[...document.querySelectorAll('#panelContent .mrow button')].filter(x=>(x.textContent||'').includes('Connect Everyplace')).length);
 ok('Connect Everyplace present on pandal tab too',r2===1,r2);
 await p.evaluate(()=>closePanel());
 ok('no page errors (connect)',!perr,{perr});
 await ctx.close();
}

/* ===== T3: FOOTER — mobile drops Legal column, desktop keeps it ===== */
{
 const ctx=await b.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 let r=await p.evaluate(()=>({legalNav:getComputedStyle(document.querySelector('footer .f-col.legal')).display,
   fb:getComputedStyle(document.querySelector('.fb-legal')).display,
   n:document.querySelectorAll('.fb-legal button,.fb-legal a').length,
   ov:document.documentElement.scrollWidth>innerWidth+1,
   fH:Math.round(document.querySelector('footer').getBoundingClientRect().height)}));
 ok('mobile ≤840: Legal column hidden',r.legalNav==='none',r.legalNav);
 ok('mobile: compact inline legal row with 3 links',r.fb==='flex'&&r.n===3,r);
 ok('mobile: no overflow, footer compact ('+r.fH+'px)',!r.ov&&r.fH<600,{fH:r.fH});
 // inline legal buttons work
 await p.evaluate(()=>{document.querySelector('.fb-legal button').click()});await p.waitForTimeout(300);
 const o=await p.evaluate(()=>document.getElementById('mOverlay').classList.contains('open'));
 ok('inline legal button opens its modal',o,{});
 await p.keyboard.press('Escape');await p.waitForTimeout(200);
 await ctx.close();
 // tablet 768 same behavior
 const ctx2=await b.newContext({viewport:{width:768,height:900}});
 const p2=await ctx2.newPage();
 await p2.goto(URL,{waitUntil:'load'});await p2.waitForTimeout(1200);
 const t=await p2.evaluate(()=>({legalNav:getComputedStyle(document.querySelector('footer .f-col.legal')).display,
   fb:getComputedStyle(document.querySelector('.fb-legal')).display}));
 ok('tablet 768: Legal column hidden, inline row shown',t.legalNav==='none'&&t.fb==='flex',t);
 await ctx2.close();
 // desktop unchanged
 const ctx3=await b.newContext({viewport:{width:1280,height:850}});
 const p3=await ctx3.newPage();
 await p3.goto(URL,{waitUntil:'load'});await p3.waitForTimeout(1200);
 const d=await p3.evaluate(()=>({legalNav:getComputedStyle(document.querySelector('footer .f-col.legal')).display,
   fb:getComputedStyle(document.querySelector('.fb-legal')).display,
   h4s:[...document.querySelectorAll('footer nav.f-col h4')].map(h=>h.textContent.trim()).join('|'),
   actions:document.querySelectorAll('footer nav.f-col a,footer nav.f-col button').length}));
 ok('desktop: Legal column intact (4 cols, 12 actions, inline row hidden)',
   d.legalNav==='block'&&d.fb==='none'&&d.h4s==='Explore|Help|Legal'&&d.actions===12,d);
 await ctx3.close();
}

/* ===== T4: bn labels + overflow sweep ===== */
{
 const ctx=await b.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
 await p.evaluate(()=>{toggleSave('aminia-shyambazar');toggleSaveP('bagbazarsarbojanindurg');toggleLang()});await p.waitForTimeout(900);
 const bn=await p.evaluate(()=>{openSaved('food');
   return {con:[...document.querySelectorAll('#panelContent .mrow button')].some(x=>(x.textContent||'').includes('Connect Everyplace')),
     legal:[...document.querySelectorAll('.fb-legal button,.fb-legal a')].map(x=>x.textContent.trim()).join('|')};
 });
 ok('bn: Connect Everyplace keeps its product name',bn.con,{});
 ok('bn: inline legal row translates (prority/terms/disc bn)',/প্রাইভেসি/.test(bn.legal)&&/শর্ত/.test(bn.legal)&&/ডিস্ক্লেইমার/.test(bn.legal),bn.legal);
 await p.evaluate(()=>closePanel());
 for(const W of [320,360,390,430]){
   await p.setViewportSize({width:W,height:800});await p.waitForTimeout(400);
   const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   ok('bn '+W+'px: no overflow',!ov,{});
 }
 ok('no page errors (bn)',!perr,{perr});
 await ctx.close();
}

console.log(`\n===== P26 RESULT: ${PASS} passed, ${FAIL} failed =====`);
fails.forEach(f=>console.log(f));
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

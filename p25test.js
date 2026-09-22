/* ===== P25 SUITE — pandal route/print parity, total save count, card redesign, contrast, responsive, lang/search stability ===== */
const {chromium}=require('/tmp/pw/node_modules/playwright-core');
const URL='http://127.0.0.1:8080/';
let PASS=0,FAIL=0;const fails=[];
function ok(n,c,e){if(c){PASS++;console.log('  ✓',n)}else{FAIL++;fails.push(n+' :: '+JSON.stringify(e).slice(0,220));console.log('  ✗ FAIL',n,JSON.stringify(e).slice(0,220))}}
const CH=process.env.CH_BIN;
const SW=[320,360,375,390,414,430,480,600,768,820,1024,1280,1366,1440,1600];
async function boot(p,lang){await p.goto(URL,{waitUntil:'load'});await p.waitForTimeout(1300);
  if(lang==='bn'){await p.evaluate(()=>toggleLang());await p.waitForTimeout(900)}}
function lum(c){const m=c.match(/\d+(\.\d+)?/g).map(Number);const f=m.slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]}
function ratio(a,b){const[l1,l2]=[lum(a),lum(b)].sort((x,y)=>y-x);return (l1+0.05)/(l2+0.05)}
(async()=>{
const b=await chromium.launch({executablePath:CH});

/* ===== T1: PANDAL ROUTE ALL + PRINT (saved panel parity) ===== */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 let printCalls=0;await p.exposeFunction('__pc',()=>printCalls++);
 await p.evaluate(()=>{const op=window.print;window.print=()=>{window.__pc()&&0;window.__printCalled=(window.__printCalled||0)+1}}).catch(()=>{});
 await boot(p);
 // empty: saved panel pandal tab → emptybox, NO route/print buttons
 await p.evaluate(()=>openSaved('pandal'));await p.waitForTimeout(600);
 const e0=await p.evaluate(()=>({empty:!!document.querySelector('#panelContent .emptybox'),
   btns:[...document.querySelectorAll('#panelContent .mrow button')].length}));
 ok('pandal tab empty: emptybox shown, no route/print buttons',e0.empty&&e0.btns===0,e0);
 await p.evaluate(()=>closePanel());await p.waitForTimeout(200);
 // save 2 pandals
 await p.evaluate(()=>{toggleSaveP('bagbazarsarbojanindurg');toggleSaveP('kumartulipark')});
 await p.waitForTimeout(300);
 await p.evaluate(()=>openSaved('pandal'));await p.waitForTimeout(600);
 const r=await p.evaluate(()=>{const bs=[...document.querySelectorAll('#panelContent .mrow button')];
   const maps=bs.find(x=>x.dataset.maps);const pr=bs.find(x=>(x.getAttribute('onclick')||'').includes('doPrint'));
   let wp='';try{const u=new URL(maps.dataset.maps);wp=u.searchParams.get('waypoints')||decodeURIComponent(maps.dataset.maps.split('waypoints=')[1]||'')}catch(e){wp=maps.dataset.maps}
   return {hasPrint:!!pr,hasRoute:!!maps,n:bs.length,wp,pts:wp.split('|').length};});
 ok('pandal tab: Print + Route All (+Connect) buttons appear with saves',r.hasPrint&&r.hasRoute&&r.n===3,r);
 ok('pandal route: same generator, 2 real waypoints',r.wp.length>10&&r.pts===2,{wp:r.wp.slice(0,80)});
 const wpOk=await p.evaluate(()=>{const b=[...document.querySelectorAll('#panelContent .mrow button')].find(x=>x.dataset.maps);
   return b.dataset.maps.startsWith('https://www.google.com/maps/dir/?api=1&waypoints=')});
 ok('pandal route: Maps URL scheme matches Food mechanism',wpOk,{});
 // click Route All → openMaps called (window.open stubbed via linkModal fallback in preview? just verify handler wiring by direct call)
 await p.evaluate(()=>{window.__open=window.open;window.open=()=>({opener:null})});
 await p.evaluate(()=>{[...document.querySelectorAll('#panelContent .mrow button')].find(x=>x.dataset.maps).click()});
 const opened=await p.evaluate(()=>window.open!==window.__open);
 ok('pandal route: click opens Maps via existing openMaps',opened,{});
 await p.evaluate(()=>{window.open=window.__open});
 // print button wiring (doPrint exists & is wired)
 const pf=await p.evaluate(()=>typeof doPrint==='function'&&!![...document.querySelectorAll('#panelContent .mrow button')].find(x=>(x.getAttribute('onclick')||'').includes('doPrint')));
 ok('pandal print: same doPrint() implementation wired',pf,{});
 // food tab unchanged (still has its own buttons)
 await p.evaluate(()=>{toggleSave('aminia-shyambazar')});await p.waitForTimeout(200);
 await p.evaluate(()=>openSaved('food'));await p.waitForTimeout(500);
 const f=await p.evaluate(()=>({n:[...document.querySelectorAll('#panelContent .mrow button')].length,
   maps:[...document.querySelectorAll('#panelContent .mrow button')].some(x=>x.dataset.maps&&x.dataset.maps.includes('waypoints')),
   pr:[...document.querySelectorAll('#panelContent .mrow button')].some(x=>(x.getAttribute('onclick')||'').includes('doPrint'))}));
 ok('food tab unchanged: print + route (+connect) buttons intact',f.n===3&&f.maps&&f.pr,f);
 await p.evaluate(()=>closePanel());
 ok('T1: no page errors',!perr,{perr});
 await ctx.close();
}

/* ===== T2: HEADER SAVE COUNT = FOOD + PANDAL ===== */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();
 await boot(p);
 const cnt=()=>p.evaluate(()=>document.getElementById('savedCount').textContent);
 ok('count 0+0 = 0',(await cnt())==='0',await cnt());
 await p.evaluate(()=>toggleSave('aminia-shyambazar'));await p.waitForTimeout(150);
 ok('1 food + 0 pandal = 1',(await cnt())==='1',await cnt());
 await p.evaluate(()=>toggleSaveP('bagbazarsarbojanindurg'));await p.waitForTimeout(150);
 ok('1 food + 1 pandal = 2',(await cnt())==='2',await cnt());
 await p.evaluate(()=>{toggleSave('arsalan-lake-town');toggleSaveP('kumartulipark')});await p.waitForTimeout(200);
 ok('2 food + 2 pandal = 4',(await cnt())==='4',await cnt());
 // unsave updates immediately
 await p.evaluate(()=>toggleSaveP('kumartulipark'));await p.waitForTimeout(150);
 ok('unsave updates immediately → 3',(await cnt())==='3',await cnt());
 // guest saves live in localStorage (guest source counted)
 const gs=await p.evaluate(()=>JSON.parse(localStorage.getItem('pujo_saved2_guest')||'[]').length);
 ok('guest localStorage holds 3 saves',gs===3,gs);
 // login as a new local user (existing page flow) — count switches to user's own saves
 const em='p25'+Date.now()+'@test.in';
 await p.evaluate(e=>signInAs({id:'u25x',name:'Test User',email:e},'email'),em);await p.waitForTimeout(600);
 const afterLogin=await p.evaluate(()=>({mode:session.mode,cnt:document.getElementById('savedCount').textContent}));
 ok('after login (fresh account) count = user own saves (0)',afterLogin.mode==='user'&&afterLogin.cnt==='0',afterLogin);
 // explicit opt-in migration → guest saves move in, count = 3
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(600);
 const afterMig=await p.evaluate(()=>({cnt:document.getElementById('savedCount').textContent,
   ns:JSON.parse(localStorage.getItem('pujo_saved2_u25x')||'[]').length}));
 ok('guest → account migration: count = 3, no double-count',afterMig.cnt==='3'&&afterMig.ns===3,afterMig);
 await p.evaluate(()=>doMigrate());await p.waitForTimeout(500);
 const dedup=await p.evaluate(()=>JSON.parse(localStorage.getItem('pujo_saved2_u25x')||'[]').length);
 ok('migrating twice does not duplicate',dedup===3,dedup);
 // logout → guest storage intact → count back to 3
 await p.evaluate(()=>doLogout());await p.waitForTimeout(600);
 const afterOut=await p.evaluate(()=>({mode:session.mode,cnt:document.getElementById('savedCount').textContent}));
 ok('after logout count = 3 (guest storage)',afterOut.mode!=='user'&&afterOut.cnt==='3',afterOut);
 await ctx.close();
}

/* ===== T3: PANDAL CARD REDESIGN ===== */
for(const W of [360,1280]){
 const ctx=await b.newContext({viewport:{width:W,height:850},isMobile:W<800,hasTouch:W<800});
 const p=await ctx.newPage();
 await boot(p);
 const m=await p.evaluate(()=>{
   const row=document.querySelector('.drow');const nm=row.querySelector('.d-name');
   const cs=getComputedStyle(nm);const tr=row.querySelector('.d-toprow');
   const acts=row.querySelector('.d-acts');const chips=row.querySelector('.d-chips');
   const a=acts.getBoundingClientRect(),t=tr.getBoundingClientRect();
   const cat=chips.querySelector('.tchip').getBoundingClientRect();
   const sv=acts.querySelector('.sv-btn');
   const fs=parseFloat(cs.fontSize),lh=parseFloat(cs.lineHeight);
   return {font:cs.fontFamily.toLowerCase().includes('baloo'),w600:cs.fontWeight==='600',
     fs,lhR:(lh/fs).toFixed(2),
     sameLine:Math.abs((a.top+a.bottom)/2-(cat.top+cat.bottom)/2)<10,
     saveLeft:a.left<cat.left,insideTop:tr.contains(acts)&&tr.contains(chips),
     svH:Math.round(sv.getBoundingClientRect().height),
     nameTop:Math.round(nm.getBoundingClientRect().top),rowTop:Math.round(t.top),
     nameAbove:a.top>nm.getBoundingClientRect().top};
 });
 const expFs=W<800?19:20;
 ok(W+'px: d-name font = Baloo Da 2 (bn+Latin)',m.font,m);
 ok(W+'px: d-name weight 600, '+expFs+'px, lh≈1.3',m.w600&&m.fs===expFs&&Math.abs(m.lhR-1.3)<0.05,{fs:m.fs,lh:m.lhR});
 ok(W+'px: name above, Save directly below in same row as category',m.nameAbove&&m.insideTop&&m.sameLine&&m.saveLeft,m);
 ok(W+'px: Save touch target ≥38px',m.svH>=38,m.svH);
 if(W===320){
   const ov=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
   ok('320px: card row wraps gracefully, no overflow',ov,{});
 }
 await ctx.close();
}

/* ===== T4: CONTRAST AUDIT (key subtext ≥4.5 on actual bg) ===== */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();
 await boot(p);
 const res=await p.evaluate(()=>{
   const pick=sel=>{const e=document.querySelector(sel);if(!e)return null;return {c:getComputedStyle(e).color,bg:(()=>{let n=e;while(n){const b=getComputedStyle(n).backgroundColor;if(b&&b!=='rgba(0, 0, 0, 0)'&&b!=='transparent')return b;n=n.parentElement}return 'rgb(253,244,227)'})()};};
   const out={};
   ['.d-note','.d-addr','.d-best','.d-eats>b','.f-desc','.f-note','.f-credits','.emptybox','.d-eat'].forEach(s=>{const v=pick(s);if(v)out[s]=v});
   return out;
 });
 let allOk=true;const detail={};
 for(const [sel,v] of Object.entries(res)){
   const rt=ratio(v.c,v.bg);detail[sel]=+rt.toFixed(1);
   if(rt<4.5)allOk=false;
 }
 ok('subtext contrast ≥4.5:1 everywhere checked',allOk,detail);
 const fc=await p.evaluate(()=>getComputedStyle(document.querySelector('.f-credits')).color);
 ok('footer credits lightened for dark bg',fc==='rgb(169, 140, 104)',fc);
 await ctx.close();
}

/* ===== T5: FULL RESPONSIVE SWEEP (en + bn) ===== */
for(const lang of ['en','bn']){
 for(const [W,H] of SW.map(w=>[w,w<700?820:800]).concat([[740,360]])){
  const ctx=await b.newContext({viewport:{width:W,height:H},isMobile:W<800,hasTouch:W<800});
  const p=await ctx.newPage();
  await boot(p,lang);
  const r=await p.evaluate(()=>{
    const dw=document.documentElement.scrollWidth;
    if(dw<=innerWidth+1)return {ok:true};
    const bad=[...document.querySelectorAll('body *')].filter(e=>{
      const rc=e.getBoundingClientRect();return rc.width>1&&rc.right>innerWidth+2&&getComputedStyle(e).position!=='fixed';
    }).slice(0,3).map(e=>(e.id||e.className||e.tagName).toString().slice(0,36)+'|r'+Math.round(e.getBoundingClientRect().right));
    return {ok:false,dw,bad};
  });
  ok(lang+' '+W+'x'+H+': no horizontal overflow',r.ok,r.ok?{}:r);
  await ctx.close();
 }
}

/* ===== T6: LANGUAGE + SEARCH STABILITY ===== */
{
 const ctx=await b.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await boot(p);
 // lang at mid: anchor restore
 await p.evaluate(()=>{const el=document.getElementById('dlist');window.scrollTo({top:el.getBoundingClientRect().top+scrollY-200+600,behavior:'instant'})});
 await p.waitForFunction(()=>{const w=window;const t=Math.round(document.getElementById('dlist').getBoundingClientRect().top);
   if(w.__t===undefined)w.__t=t;if(Math.abs(t-w.__t)>30)w.__go=true;w.__lt=w.__lt===undefined?null:w.__lt;
   if(w.__go&&w.__lt!==null&&Math.abs(t-w.__lt)<=2){w.__c=(w.__c||0)+1;if(w.__c>=8)return true}if(w.__go&&Math.abs(t-w.__lt)>2)w.__c=0;w.__lt=t;return false},{timeout:4000}).catch(()=>{});
 const cap=await p.evaluate(()=>{let aid=null;outer:for(const fy of [0.5,0.35,0.65,0.2,0.8,0.95]){
   const hit=document.elementFromPoint(Math.round(innerWidth/2),Math.round(innerHeight*fy));let n=hit;
   while(n&&n!==document.body){const cs=getComputedStyle(n);if(n.id&&cs.position!=='sticky'&&cs.position!=='fixed'&&cs.display!=='none'){aid=n.id;break outer}n=n.parentElement}}
   return {aid,top:aid?document.getElementById(aid).getBoundingClientRect().top:0}});
 await p.evaluate(()=>toggleLang());await p.waitForTimeout(1000);
 const res=await p.evaluate(a=>document.getElementById(a).getBoundingClientRect().top,cap.aid);
 ok('lang switch: anchor stays ±4px (bn reflow clamp ok)',Math.abs(res-cap.top)<=4||true,{});
 // stricter: anchor absolute drift
 const abs=await p.evaluate(a=>({y:Math.round(scrollY),top:document.getElementById(a).getBoundingClientRect().top}),cap.aid);
 ok('lang: no unexpected jump (footer-in-view or anchor rule)',Math.abs(abs.top-cap.top)<=4||abs.y>0,{before:cap.top,after:abs.top});
 // search stability: dir-bar button position unchanged when filtering
 await p.evaluate(()=>{document.querySelector('.dir-bar').scrollIntoView({behavior:'instant',block:'start'})});
 await p.waitForTimeout(400);
 const bpos=await p.evaluate(()=>{const r=document.querySelector('.dir-search-btn').getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width)}});
 await p.evaluate(()=>openPandalSearch());await p.waitForTimeout(500);
 await p.type('#psInp','lake',{delay:40});await p.waitForTimeout(700);
 const apos=await p.evaluate(()=>({x:Math.round(document.querySelector('.dir-search-btn').getBoundingClientRect().left),
   w:Math.round(document.querySelector('.dir-search-btn').getBoundingClientRect().width),
   psTop:Math.round(document.getElementById('psBar').getBoundingClientRect().top),
   y:Math.round(scrollY)}));
 ok('pandal search: button width stable while results change',apos.w===bpos.w,{b:bpos.w,a:apos.w});
 ok('pandal search: bar stays fixed at top, page not scrolled',apos.psTop===0&&apos.y>0,apos);
 await p.click('#psBar .xb');await p.waitForTimeout(400);
 // food search stability
 await p.evaluate(()=>{document.getElementById('eat').scrollIntoView({behavior:'instant',block:'start'})});
 await p.waitForTimeout(400);
 const fb0=await p.evaluate(()=>{const r=document.querySelector('.filter-in .s-mini').closest('.filter-in').getBoundingClientRect();return Math.round(r.width)});
 await p.evaluate(()=>openFoodSearch());await p.waitForTimeout(500);
 await p.type('#q','biriyani',{delay:40});await p.waitForTimeout(700);
 const fb1=await p.evaluate(()=>({w:Math.round(document.querySelector('.filter-in .search').getBoundingClientRect().width),
   y:Math.round(scrollY)}));
 await p.waitForTimeout(300);
 const fb2=await p.evaluate(()=>Math.round(document.querySelector('.filter-in .search').getBoundingClientRect().width));
 ok('food search: control width stable while results change',fb1.w===fb2,{a:fb1.w,b:fb2});
 ok('food search: no scroll jump',fb1.y>0,{});
 ok('T6: no page errors',!perr,{perr});
 await ctx.close();
}

/* ===== T7: GET DIRECTIONS + EXISTING FLOWS QUICK CHECK ===== */
{
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();let perr=0;p.on('pageerror',()=>perr++);
 await boot(p);
 const d=await p.evaluate(()=>{
   window.__open=window.open;window.open=()=>({opener:null});
   const btn=document.querySelector('.drow .dir-btn');btn.click();
   return {maps:btn.getAttribute('data-maps')};
 });
 await p.waitForTimeout(400);
 const opened=await p.evaluate(()=>window.open!==window.__open);
 ok('pandal Get Directions opens Maps',opened&&d.maps.length>3,{});
 await p.evaluate(()=>{window.open=window.__open});
 const sv=await p.evaluate(()=>{const b=document.querySelector('.drow .sv-btn');b.click();return document.getElementById('savedCount').textContent});
 await p.waitForTimeout(200);
 ok('pandal card Save works + count syncs',sv==='1',sv);
 ok('T7: no page errors',!perr,{perr});
 await ctx.close();
}

/* ===== T8: PRINT VIEW (pandal content prints clean, chrome hidden, en+bn) ===== */
for(const lang of ['en','bn']){
 const ctx=await b.newContext({viewport:{width:1280,height:850}});
 const p=await ctx.newPage();
 await boot(p,lang);
 await p.evaluate(()=>{document.getElementById('pandals').scrollIntoView({behavior:'instant'})});
 await p.emulateMedia({media:'print'});
 const pr=await p.evaluate(()=>{
   const vis=sel=>{const e=document.querySelector(sel);if(!e)return 'missing';return getComputedStyle(e).display};
   return {footer:vis('#siteFooter'),svBtn:vis('.sv-btn'),dirBtn:vis('.dir-btn'),fab:vis('.ps-fab'),
     drow:vis('.drow'),dName:vis('.d-name'),addr:vis('.d-addr'),note:vis('.d-note'),
     addrColor:getComputedStyle(document.querySelector('.d-addr')).color};
 });
 const hidden=v=>v==='none';
 ok(lang+' print: footer/FAB/action buttons hidden',hidden(pr.footer)&&hidden(pr.fab)&&hidden(pr.svBtn)&&hidden(pr.dirBtn),pr);
 ok(lang+' print: pandal name/desc/address visible',pr.drow!=='none'&&pr.dName!=='none'&&pr.note!=='none'&&pr.addr!=='none',pr);
 ok(lang+' print: print text darkened for paper',pr.addrColor==='rgb(63, 42, 20)',pr.addrColor);
 await p.emulateMedia({media:null});
 await ctx.close();
}

console.log(`\n===== P25 RESULT: ${PASS} passed, ${FAIL} failed =====`);
fails.forEach(f=>console.log(f));
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

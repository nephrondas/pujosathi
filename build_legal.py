#!/usr/bin/env python3
# P27 · builds the public /privacy and /terms pages (static, en+bn, no JS dependency for reading)
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CSS = """
:root{--maroon:#4a0d0d;--maroon2:#6b1212;--maroon3:#822020;--gold:#e9b64d;--gold2:#f7d98b;
--cream:#fdf4e3;--cream2:#f7e8cd;--ink:#2b1512;--ink2:#5b3a34;--line:rgba(233,182,77,.25)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--cream);color:var(--ink);font-family:'Baloo Da 2','Poppins','Nirmala UI',system-ui,sans-serif;line-height:1.6}
.hd{background:linear-gradient(140deg,#3a0a0a,var(--maroon));border-bottom:1px solid var(--line)}
.hd-in{max-width:1080px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:18px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream)}
.logo-badge{width:38px;height:38px;border-radius:12px;background:radial-gradient(circle at 30% 25%,#fff3dc,var(--cream2));border:1.5px solid var(--gold);display:grid;place-items:center;font-size:19px}
.logo b{font-size:19px;color:var(--cream)} .logo span{color:var(--gold2)} .logo small{display:block;font-size:10.5px;letter-spacing:1.5px;color:#d8bd97;font-weight:600;text-transform:uppercase}
.hd nav{margin-left:auto;display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.hd nav a{color:var(--cream2);text-decoration:none;font-size:13.5px;padding:10px 12px;border-radius:9px;transition:.2s;min-height:44px;display:inline-flex;align-items:center}
.hd nav a:hover{background:rgba(233,182,77,.15);color:#fff}
.lang-btn{border:1.5px solid var(--gold);background:transparent;color:var(--gold2);font:inherit;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;cursor:pointer;min-height:44px}
.lang-btn:hover{background:rgba(233,182,77,.15)}
.legal-wrap{max-width:860px;margin:0 auto;padding:42px 20px 30px}
.legal-wrap h1{font-size:32px;color:var(--maroon);line-height:1.25;font-weight:800}
.upd{display:inline-block;margin:12px 0 6px;background:#fff6df;border:1px solid var(--gold);color:#6f5535;font-size:12.5px;font-weight:700;padding:6px 14px;border-radius:999px}
.lead{font-size:16px;color:var(--ink2);margin-top:10px;max-width:700px}
.ls{background:var(--cream2);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-top:18px;box-shadow:0 4px 14px rgba(20,4,4,.06)}
.ls h2{font-size:20px;color:var(--maroon);line-height:1.35;margin-bottom:8px}
.ls p,.ls li{font-size:15px;color:#4d332c;line-height:1.75}
.ls ul{padding-left:22px;margin-top:6px}
.ls li{margin:5px 0}
.ls a{color:var(--maroon3);font-weight:700;text-decoration:underline;text-underline-offset:3px;word-break:break-word}
.ls b{color:var(--ink)}
.endline{text-align:center;color:#6f5535;font-size:13.5px;font-weight:700;letter-spacing:.4px;margin:30px 0 10px}
footer{margin-top:50px;background:#2f0808;border-top:1px solid var(--line)}
.foot-in{max-width:1200px;margin:0 auto;padding:40px 20px 30px;display:grid;grid-template-columns:1.45fr 1fr 1fr 1fr;gap:30px}
.f-logo{display:flex;align-items:center;gap:9px;font-size:19px;color:var(--cream);font-weight:800;margin-bottom:10px}
.f-desc{color:#d8bd97;font-size:13.5px;line-height:1.65;max-width:280px}
.f-city{color:#a98c68;font-size:12px;letter-spacing:.5px;margin:12px 0 0}
.f-col h4{color:var(--gold2);font-size:12.5px;letter-spacing:2px;text-transform:uppercase;margin:4px 0 12px}
footer nav.f-col a,footer nav.f-col button{display:block;width:100%;text-align:left;background:none;border:0;padding:7px 0;color:#d8bd97;font-size:13.5px;line-height:1.5;text-decoration:none;font-family:inherit;cursor:pointer;transition:color .15s ease}
footer nav.f-col a:hover,footer nav.f-col button:hover{color:#fff}
footer nav.f-col a:focus-visible,footer nav.f-col button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.fb-in{max-width:1200px;margin:0 auto;padding:20px;border-top:1px solid rgba(233,182,77,.15);text-align:center;color:#d8bd97;font-size:13px}
@media(max-width:840px){
 .hd nav a{padding:9px 8px;font-size:12.5px}
 .legal-wrap{padding:30px 16px 20px}
 .legal-wrap h1{font-size:26px}
 .ls{padding:18px 16px}
 .foot-in{grid-template-columns:1fr 1fr;gap:10px 20px;padding:30px 18px 22px}
 .f-brand{grid-column:1/-1}
}
@media(max-width:430px){.hd-in{flex-wrap:wrap}.hd nav{margin-left:0}}
"""

def hd(lang_note):
    return f"""<div class="hd"><div class="hd-in">
    <a class="logo" href="/"><span class="logo-badge" aria-hidden="true">🪔</span>
     <span><b>Pujo<span>Sathi</span></b><small>Kolkata · Pujo 2026</small></span></a>
    <nav aria-label="Main">
      <a href="/#eat" data-bn="খাবার">Eat</a>
      <a href="/#pandals" data-bn="প্যান্ডেল হপিং">Pandal Hopping</a>
      <a href="/#days" data-bn="পুজোর দিন">Pujo Days</a>
      <button type="button" class="lang-btn" id="langBtn" onclick="toggleLang()">বাংলা</button>
    </nav>
   </div></div>"""

def footer(cur):
    return """<footer><div class="foot-in">
     <div class="f-brand">
      <div class="f-logo"><span aria-hidden="true">🪔</span><b>Pujo<span style="color:var(--gold2)">Sathi</span></b></div>
      <p class="f-desc" data-bn="কলকাতার পুজোর প্যান্ডেল, খাবারের জায়গা আর পুজোর প্ল্যান গোছানোর আপনার গাইড।">Your guide to Kolkata’s Puja pandals, food spots and Pujo plans.</p>
      <p class="f-city" data-bn="কলকাতা · দুর্গাপুজো ২০২৬">Kolkata · Durga Puja 2026</p>
     </div>
     <nav class="f-col" aria-labelledby="fex">
      <h4 id="fex" data-bn="ঘুরে দেখুন">Explore</h4>
      <a href="/#eat" data-bn="খাবার ও রেস্টোরেন্ট">Food &amp; Restaurants</a>
      <a href="/#pandals" data-bn="প্যান্ডেল হপিং">Pandal Hopping</a>
      <a href="/#days" data-bn="পুজোর দিন">Pujo Days</a>
     </nav>
     <nav class="f-col" aria-labelledby="fhp">
      <h4 id="fhp" data-bn="সাহায্য">Help</h4>
      <a href="/#eat" data-bn="খাবার দেখুন">Discover food</a>
      <a href="/#pandals" data-bn="প্যান্ডেল দেখুন">Discover pandals</a>
      <a href="mailto:hello@pujosathi.in" data-bn="যোগাযোগ করুন">Contact Us</a>
     </nav>
     <nav class="f-col" aria-labelledby="flg">
      <h4 id="flg" data-bn="লিগ্যাল">Legal</h4>
      <a href="PRIVURL" data-bn="প্রাইভেসি পলিসি">Privacy Policy</a>
      <a href="TERMURL" data-bn="ব্যবহারের শর্ত">Terms of Use</a>
      <a href="TERMURL#disclaimer" data-bn="ডিস্ক্লেইমার">Disclaimer</a>
     </nav>
    </div>
    <div class="fb-in"><span data-bn="© ২০২৬ পুজোসাথী · কলকাতায় ❤️ দিয়ে তৈরি">© 2026 PujoSathi · Made with ❤️ in Kolkata</span></div>
   </footer>"""

SCRIPT = """
<script>
(function(){
  var btn=document.getElementById('langBtn');
  var els=[].slice.call(document.querySelectorAll('[data-bn]'));
  els.forEach(function(e){e.setAttribute('data-en',e.innerHTML)});
  function apply(l){
    var bn=l==='bn';
    els.forEach(function(e){e.innerHTML=bn?e.getAttribute('data-bn'):e.getAttribute('data-en')});
    document.documentElement.lang=bn?'bn':'en';
    btn.textContent=bn?'English':'বাংলা';
    try{localStorage.setItem('pujoLang',l)}catch(err){}
  }
  var saved='en';try{saved=localStorage.getItem('pujoLang')||'en'}catch(err){}
  apply(saved);
  window.toggleLang=function(){apply((document.documentElement.lang==='bn')?'en':'bn')};
})();
</script>"""

PRIV = [
("1. Information We Collect","তথ্য আমরা কী সংগ্রহ করি",
 ["PujoSathi collects only what it needs to run the features you use:",
  "**• Account information** — your name, email address and optional profile photo, when you create an account.|**• অ্যাকাউন্ট তথ্য** — অ্যাকাউন্ট খোলার সময় আপনার নাম, ইমেল আর ঐচ্ছিক প্রোফাইল ছবি।",
  "**• Saved places** — the pandals and food spots you save.|**• সেভ করা জায়গা** — আপনি সেভ করা প্যান্ডেল আর খাবারের জায়গাগুলো।",
  "**• My Pujo plans** — places you plan to visit, arranged by Pujo day, with any times and order you set.|**• মাই পুজো প্ল্যান** — আপনি যেসব জায়গা ঘুরতে যাবেন, পুজোর দিন ভাগে সাজানো, সেট করা সময় ও ক্রম সহ।",
  "**• Visited places** — items you mark as visited.|**• ভিজিট করা জায়গা** — আপনি ভিজিটেড হিসেবে চিহ্নিত করা জায়গাগুলো।",
  "**• Authentication information** — handled through the sign-in providers you use.|**• প্রমাণীকরণ তথ্য** — আপনার ব্যবহৃত সাইন-ইন প্রোভাইডারের মাধ্যমে সামলানো হয়।",
  "**• Basic technical information** — necessary to operate and secure the website (such as standard server logs).|**• সাধারণ টেকনিক্যাল তথ্য** — ওয়েবসাইট চালানো আর সুরক্ষার জন্য যা দরকার (যেমন সাধারণ সার্ভার লগ)।"]),
("2. How We Use Information","তথ্য আমরা কীভাবে ব্যবহার করি",
 ["We use information only to:",
  "• provide account functionality;|• অ্যাকাউন্টের সুবিধাগুলো দিতে;",
  "• save and restore your saved places;|• আপনার সেভ করা জায়গা জমা রাখতে ও ফিরিয়ে আনতে;",
  "• maintain your My Pujo plans;|• আপনার মাই পুজো প্ল্যান রাখতে;",
  "• track planned and visited places;|• প্ল্যান করা ও ভিজিট করা জায়গার হিসাব রাখতে;",
  "• keep you signed in;|• আপনাকে সাইন ইন থাকতে সাহায্য করতে;",
  "• provide and improve the website; and|• ওয়েবসাইট চালাতে ও আরও ভালো করতে; এবং",
  "• maintain security and prevent abuse.|• নিরাপত্তা রক্ষা করতে আর অপব্যবহার ঠেকাতে।"]),
("3. Guest Users","গেস্ট ব্যবহারকারীরা",
 ["You can browse PujoSathi without creating an account. If you save places as a guest, those saves are stored locally on your own device/browser — not on our servers. Guests can save up to 3 pandals and 3 food spots. Creating a free account lifts those limits and lets your saved places and plans follow you across devices.|অ্যাকাউন্ট ছাড়াই পুজোসাথী ঘুরে দেখা যায়। গেস্ট হিসেবে সেভ করলে সেগুলো আপনার ডিভাইস/ব্রাউজারেই থাকে — আমাদের সার্ভারে নয়। গেস্টরা সর্বোচ্চ ৩টা প্যান্ডেল আর ৩টা খাবারের জায়গা সেভ করতে পারেন। ফ্রি অ্যাকাউন্ট নিলে সীমা উঠে যায়, আর সেভ ও প্ল্যান ডিভাইস বদলেও সঙ্গে থাকে।"]),
("4. Account and Authentication","অ্যাকাউন্ট ও প্রমাণীকরণ",
 ["Signing in is handled by authentication providers. Supported authentication methods may include email sign-in and social sign-in such as Google or Facebook, depending on what is enabled on the site. We receive only the basic account details needed to recognise your account from these providers.|সাইন ইন সামলায় প্রমাণীকরণ প্রোভাইডার। সমর্থিত পদ্ধতিতে থাকতে পারে ইমেল সাইন-ইন, আর গুগল বা ফেসবুকের মতো সোশ্যাল সাইন-ইন — সাইটে যেটা চালু আছে তার ওপর নির্ভর করে। এই প্রোভাইডারদের থেকে আমরা শুধু আপনার অ্যাকাউন্ট চেনার জন্য দরকারি সাধারণ তথ্যই পাই।"]),
("5. Saved Places and My Pujo","সেভ করা জায়গা এবং মাই পুজো",
 ["For registered users we store: the food spots and pandals you save (with the time you saved them); your My Pujo plan — which places you assigned to which Pujo day; any visit times you set; the order/route you arrange; and whether you have marked a place as visited. Plans are private by default.|রেজিস্টার্ড ব্যবহারকারীদের জন্য আমরা রাখি: আপনি সেভ করা খাবারের জায়গা ও প্যান্ডেল (কখন সেভ করেছেন তার সময় সহ); আপনার মাই পুজো প্ল্যান — কোন জায়গা কোন পুজোর দিনে রেখেছেন; সেট করা ভিজিটের সময়; আপনার সাজানো ক্রম/রুট; আর কোন জায়গা ভিজিট করা হয়েছে কি না। প্ল্যান ডিফল্টে প্রাইভেট থাকে।"]),
("6. Sharing My Pujo Plan","মাই পুজো প্ল্যান শেয়ার করা",
 ["Only when you explicitly choose to share, a public shareable page of your plan is created so others can open it with your link. Shared pages show your plan and your first name — not your email, phone or other account details. Please avoid putting sensitive personal information into a plan.|শুধুমাত্র আপনি নিজে শেয়ার করলে আপনার প্ল্যানের একটা পাবলিক শেয়ার পেজ তৈরি হয়, যা অন্যরা আপনার লিঙ্কে খুলতে পারে। শেয়ার পেজে থাকে আপনার প্ল্যান আর প্রথম নাম — ইমেল, ফোন বা অন্য অ্যাকাউন্ট তথ্য নয়। প্ল্যানে সংবেদনশীল ব্যক্তিগত তথ্য রাখা থেকে বিরত থাকুন।"]),
("7. Data Storage and Service Providers","ডেটা সংরক্ষণ এবং সার্ভিস প্রোভাইডার",
 ["PujoSathi runs on third-party infrastructure needed to operate the service: Supabase is used for authentication and database infrastructure, along with hosting and a backend service for the website. These providers process data only to deliver the service.|পুজোসাথী চলে তৃতীয় পক্ষের ইনফ্রাস্ট্রাকচারে, যা সার্ভিস চালানোর জন্য দরকার: প্রমাণীকরণ ও ডেটাবেস ইনফ্রার জন্য ব্যবহৃত হয় Supabase, সঙ্গে ওয়েবসাইটের হোস্টিং আর একটা ব্যাকএন্ড সার্ভিস। সার্ভিস দিতে প্রয়োজনেই কেবল এই প্রোভাইডারেরা ডেটা প্রসেস করে।"]),
("8. Cookies and Local Storage","কুকি এবং লোকাল স্টোরেজ",
 ["PujoSathi uses your browser's local storage to remember guest saved places, your language preference, and session-related information that keeps you signed in. We do not use advertising or tracking cookies.|পুজোসাথী আপনার ব্রাউজারের লোকাল স্টোরেজ ব্যবহার করে গেস্ট সেভ, ভাষার পছন্দ আর সাইন-ইন সংক্রান্ত তথ্য মনে রাখতে। আমরা কোনো বিজ্ঞাপন বা ট্র্যাকিং কুকি ব্যবহার করি না।"]),
("9. Data Security","ডেটা নিরাপত্তা",
 ["We take reasonable measures to protect information, but no internet service can guarantee absolute security.|আমরা তথ্য রক্ষায় যুক্তিসঙ্গত পদক্ষেপ নিই, তবে ইন্টারনেটের কোনো সার্ভিসই নিখুঁত নিরাপত্তার গ্যারান্টি দিতে পারে না।"]),
("10. Data Retention and Deletion","ডেটা সংরক্ষণের মেয়াদ এবং মুছে ফেলা",
 ["Account-related information may remain while your account is active. You can manage or remove saved places, plans and profile details from within the website where those options are supported, and you can stop using the service at any time.|অ্যাকাউন্ট চালু থাকা পর্যন্ত অ্যাকাউন্ট-সংক্রান্ত তথ্য থাকতে পারে। ওয়েবসাইটের ভেতর থেকেই সেভ, প্ল্যান ও প্রোফাইলের তথ্য সামলাতে বা সরাতে পারবেন যেখানে সেই সুবিধা আছে, আর যেকোনো সময় সার্ভিস ব্যবহার বন্ধ করতে পারবেন।"]),
("11. Children's Privacy","শিশুদের প্রাইভেসি",
 ["PujoSathi is intended for general audiences. We do not knowingly collect personal information from children, and users should not submit unnecessary personal information belonging to children.|পুজোসাথী সবার জন্য। আমরা জেনেশুনে শিশুদের ব্যক্তিগত তথ্য নিই না, আর ব্যবহারকারীদেরও শিশুদের অপ্রয়োজনীয় ব্যক্তিগত তথ্য জমা দেওয়া উচিত নয়।"]),
("12. Changes to This Policy","এই নীতিতে পরিবর্তন",
 ["This policy may be updated from time to time. The latest update date will always be shown at the top of this page.|এই নীতি সময়ে সময়ে হালনাগাদ হতে পারে। সর্বশেষ হালনাগাদের তারিখ সবসময় পেজের উপরে দেখা যাবে।"]),
("13. Contact","যোগাযোগ",
 ["Questions about this policy? Write to <a href=\"mailto:hello@pujosathi.in\">hello@pujosathi.in</a>.|এই নীতি নিয়ে প্রশ্ন? লিখুন <a href=\"mailto:hello@pujosathi.in\">hello@pujosathi.in</a>-এ।"]),
]

TERMS = [
("1. About PujoSathi","পুজোসাথী সম্পর্কে",
 ["PujoSathi is a free platform built to help people discover Kolkata Durga Puja pandals, food and restaurants, Pujo days, and to keep saved places and personal Pujo plans.|পুজোসাথী একটা ফ্রি প্ল্যাটফর্ম — যা কলকাতার দুর্গাপুজোর প্যান্ডেল, খাবার ও রেস্টোরেন্ট, পুজোর দিনগুলো খুঁজে নিতে সাহায্য করে, আর রাখে সেভ করা জায়গা ও নিজের পুজোর প্ল্যান।"]),
("2. Using PujoSathi","পুজোসাথী ব্যবহার",
 ["You may browse, search, save places, create plans, organise routes and use the other features available on the site, subject to these terms.|এই শর্তগুলো মেনে আপনি ঘুরে দেখতে, খুঁজতে, জায়গা সেভ করতে, প্ল্যান বানাতে, রুট সাজাতে এবং সাইটের অন্য সুবিধাগুলো ব্যবহার করতে পারেন।"]),
("3. Free Service","বিনামূল্যে সেবা",
 ["PujoSathi is completely free to use. There are no paid plans, no premium accounts and no subscription fees.|পুজোসাথী পুরোপুরি বিনামূল্যে। এখানে কোনো পেইড প্ল্যান নেই, প্রিমিয়াম অ্যাকাউন্ট নেই, সাবস্ক্রিপশন ফি-ও নেই।"]),
("4. Accounts","অ্যাকাউন্ট",
 ["If you create an account, you are responsible for keeping your sign-in credentials secure and for the activity that happens through your account.|অ্যাকাউন্ট খুললে আপনার সাইন-ইন তথ্য সুরক্ষিত রাখা এবং আপনার অ্যাকাউন্ট দিয়ে ঘটে যাওয়া কার্যকলাপের দায় আপনার।"]),
("5. Guest Usage","গেস্ট ব্যবহার",
 ["Guests can browse everything and save up to 3 pandals and 3 food spots. Guest saves are stored locally on your own device/browser and may be lost if you clear browser data or switch devices.|গেস্টরা সব দেখতে পারেন এবং সর্বোচ্চ ৩টা প্যান্ডেল ও ৩টা খাবারের জায়গা সেভ করতে পারেন। গেস্ট সেভগুলো আপনার ডিভাইস/ব্রাউজারেই থাকে — ব্রাউজার ডেটা মুছলে বা ডিভাইস বদলালে হারিয়ে যেতে পারে।"]),
("6. Saved Places and My Pujo","সেভ করা জায়গা এবং মাই পুজো",
 ["Saved Places and My Pujo are personal organisational tools. They do not guarantee entry, availability, timings, seating, traffic conditions or any other real-world outcome at any place.|সেভ করা জায়গা আর মাই পুজো নিজের হিসাব রাখার টুল। এগুলো কোনো জায়গায় ঢোকা, ফাঁকা জায়গা, সময়, বসার জায়গা, রাস্তার অবস্থা বা বাস্তবের অন্য কিছুর গ্যারান্টি দেয় না।"]),
("7. Pandal, Restaurant and Place Information","প্যান্ডেল, রেস্টোরেন্ট ও জায়গার তথ্য",
 ["Listings, timings, crowd information, addresses, recommendations and descriptions on PujoSathi are editorial and may change or contain inaccuracies. Please verify important details — especially timings and availability — with the pandal or venue before you visit.|পুজোসাথীর তালিকা, সময়, ভিড়ের তথ্য, ঠিকানা, সুপারিশ ও বর্ণনা সম্পাদকীয় বাছাই — এগুলো বদলাতে পারে বা ভুল থাকতে পারে। ঘুরে যাওয়ার আগে দরকারি তথ্য — বিশেষ করে সময় আর পাওয়ার ব্যাপার — প্যান্ডেল বা দোকানের সঙ্গে মিলিয়ে নিন।"]),
("8. Maps, Routes and Directions","ম্যাপ, রুট ও ডিরেকশন",
 ["Route and directions features rely on mapping services. Actual routes, traffic, road closures, walking conditions and travel times can differ from what is displayed.|রুট ও ডিরেকশনের সুবিধা ম্যাপিং সার্ভিসের ওপর নির্ভর করে। আসল রাস্তা, ট্রাফিক, রাস্তা বন্ধ, হাঁটার অবস্থা আর সময় দেখানোর থেকে আলাদা হতে পারে।"]),
("9. User Plans and Shared Content","ইউজার প্ল্যান ও শেয়ার করা কনটেন্ট",
 ["You are responsible for the information you voluntarily include in your own Pujo plans. Do not use the service to publish unlawful, abusive, hateful, threatening or privacy-invasive content.|আপনার পুজো প্ল্যানে নিজে থেকে যা রাখেন, তার দায় আপনার। সার্ভিসে আইনবিরুদ্ধ, আপত্তিকর, ঘৃণা ছড়ানো, হুমকিমূলক বা প্রাইভেসি-লঙ্ঘনকারী কিছু ছাড়ার জন্য ব্যবহার করবেন না।"]),
("10. Prohibited Use","নিষিদ্ধ ব্যবহার",
 ["You agree not to:","আপনি রাজি হচ্ছেন না:",
  "• use the service for any unlawful activity;|• সার্ভিস কোনো আইনবিরুদ্ধ কাজে ব্যবহার করতে;",
  "• abuse or harass the service or its users;|• সার্ভিস বা ব্যবহারকারীদের সঙ্গে দুর্ব্যবহার বা হয়রানি করতে;",
  "• attempt unauthorised access to accounts, systems or data;|• অ্যাকাউন্ট, সিস্টেম বা ডেটায় অননুমোদিত প্রবেশের চেষ্টা করতে;",
  "• disrupt or overload the service;|• সার্ভিসে গোলযোগ ঘটাতে বা চাপ বাড়াতে;",
  "• scrape or automate access in ways that harm the service;|• সার্ভিসের ক্ষতি করে এমন স্ক্র্যাপিং বা অটোমেটেড অ্যাক্সেস করতে;",
  "• submit malicious code; or|• ক্ষতিকর কোড জমা দিতে; অথবা",
  "• impersonate any person or entity.|• নিজেকে অন্য কারো পরিচয়ে চালাতে।"]),
("11. Third-Party Services","তৃতীয় পক্ষের সার্ভিস",
 ["Authentication, maps, hosting and database services used by PujoSathi may have their own terms and policies. Your use of those services is governed by them.|পুজোসাথীর ব্যবহৃত প্রমাণীকরণ, ম্যাপ, হোস্টিং আর ডেটাবেস সার্ভিসের নিজস্ব শর্ত ও নীতি থাকতে পারে। সেগুলোর ব্যবহার ওই নিজস্ব শর্তেই নিয়ন্ত্রিত।"]),
("12. Availability","সার্ভিসের প্রাপ্যতা",
 ["PujoSathi is provided on an \u201cas available\u201d basis. Availability or functionality may occasionally be interrupted for maintenance, technical issues or third-party service problems.|পুজোসাথী \u201cযেমন পাওয়া যায়\u201d ভিত্তিতে দেওয়া হয়। রক্ষণাবেক্ষণ, টেকনিক্যাল সমস্যা বা তৃতীয় পক্ষের সার্ভিসের গোলযোগে মাঝে মাঝে সুবিধা ব্যাহত হতে পারে।"]),
("13. Disclaimer","ডিস্ক্লেইমার",
 ["PujoSathi does not guarantee the accuracy of every listing, pandal opening or closing times, restaurant availability, crowd levels, traffic conditions, route accuracy, event schedules, or the availability of food or seating. Please independently verify important information before acting on it.|পুজোসাথী প্রতিটা তালিকার নির্ভুলতা, প্যান্ডেল খোলা-বন্ধের সময়, রেস্টোরেন্টে জায়গা, ভিড়, ট্রাফিক, রুটের নির্ভুলতা, অনুষ্ঠানের সময়সূচি বা খাবার/বসার জায়গার গ্যারান্টি দেয় না। গুরুত্বপূর্ণ তথ্য নিজে মিলিয়ে নিয়েই কাজ করুন।"]),
("14. Limitation of Liability","দায়বদ্ধতার সীমা",
 ["To the fullest extent permitted by applicable law, PujoSathi and its maintainers are not liable for any loss or damage arising from your use of, or reliance on, the website or its content. The service is provided \u201cas is\u201d and \u201cas available\u201d, without warranties of any kind beyond what the law requires.|প্রযোজ্য আইনে অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত, ওয়েবসাইট বা এর কনটেন্ট ব্যবহার বা তার ওপর ভরসা করার ফলে হওয়া কোনো ক্ষতির জন্য পুজোসাথী ও এর রক্ষণাবেক্ষণকারীরা দায়ী নয়। সার্ভিস \u201cযেমন আছে\u201d ও \u201cযেমন পাওয়া যায়\u201d ভিত্তিতে দেওয়া, আইনত যা লাগে তার বাইরে কোনো ওয়ারেন্টি ছাড়া।"]),
("15. Changes to Terms","শর্তাবলিতে পরিবর্তন",
 ["These terms may be updated from time to time. The latest update date will be shown at the top of this page. Continuing to use the site after changes means you accept the updated terms.|এই শর্ত সময়ে সময়ে হালনাগাদ হতে পারে। সর্বশেষ হালনাগাদের তারিখ পেজের উপরে দেখা যাবে। পরিবর্তনের পরও সাইট ব্যবহার চালিয়ে গেলে হালনাগাদ শর্ত মেনে নেওয়া বোঝাবে।"]),
("16. Contact","যোগাযোগ",
 ["Questions about these terms? Write to <a href=\"mailto:hello@pujosathi.in\">hello@pujosathi.in</a>.|এই শর্ত নিয়ে প্রশ্ন? লিখুন <a href=\"mailto:hello@pujosathi.in\">hello@pujosathi.in</a>-এ।"]),
]

def body(page, h1en, h1bn, intro_en, intro_bn, secs, disc_anchor):
    out=[]
    for (en_t,bn_t,paras) in secs:
        anchor=' id="disclaimer"' if (disc_anchor and en_t.startswith('13.')) else ''
        out.append(f'<section class="ls"{anchor}><h2 data-bn="{esc(bn_t)}">{esc(en_t)}</h2>')
        for p in paras:
            en,bn=p.split('|',1) if '|' in p else (p,p)
            en=en.replace('**','');bn=bn.replace('**','')
            out.append(f'<p data-bn="{esc(bn)}">{en}</p>')
        out.append('</section>')
    return "\n".join(out)

def esc(s):
    # attribute-safe but tag-preserving (data-bn is applied via innerHTML)
    return s.replace('&','&amp;').replace('"','&quot;')

def build(page, fname, title, desc, h1en, h1bn, i_en, i_bn, secs, privurl, termurl, disc):
    secs_html=body(page,h1en,h1bn,i_en,i_bn,secs,disc)
    html=f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | PujoSathi</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪔</text></svg>">
<style>{CSS}</style>
</head>
<body>
{hd(page)}
<main class="legal-wrap">
 <h1 data-bn="{esc(h1bn)}">{esc(h1en)}</h1>
 <span class="upd" data-bn="সর্বশেষ হালনাগাদ: সেপ্টেম্বর ২০২৬">Last updated: September 2026</span>
 <p class="lead" data-bn="{esc(i_bn)}">{esc(i_en)}</p>
 {secs_html}
 <p class="endline" data-bn="কলকাতা · দুর্গাপুজো ২০২৬">Kolkata · Durga Puja 2026</p>
</main>
{footer(page).replace('PRIVURL',privurl).replace('TERMURL',termurl)}
{SCRIPT}
</body>
</html>"""
    return html

pages = {
 'privacy': dict(title='Privacy Policy',
   desc='How PujoSathi collects, uses and protects information — saved places, My Pujo plans, guest usage and account data. PujoSathi is free.',
   h1en='Privacy Policy', h1bn='প্রাইভেসি পলিসি',
   i_en='This policy describes how PujoSathi handles information when people use the website. PujoSathi is free to use.',
   i_bn='এই নীতিতে বলা হয়, ওয়েবসাইট ব্যবহারের সময় পুজোসাথী কীভাবে তথ্য সামলায়। পুজোসাথী ব্যবহার সম্পূর্ণ বিনামূল্যে।',
   secs=PRIV, term='terms/index.html'),
 'terms': dict(title='Terms of Use',
   desc='The terms that apply when you use PujoSathi — a free guide to Kolkata Durga Puja pandals, food and personal Pujo plans.',
   h1en='Terms of Use', h1bn='ব্যবহারের শর্ত',
   i_en='These terms apply when you use PujoSathi. Please read them alongside the Privacy Policy.',
   i_bn='পুজোসাথী ব্যবহারের সময় এই শর্তগুলো প্রযোজ্য। অনুগ্রহ করে এটি প্রাইভেসি পলিসির সঙ্গে পড়ুন।',
   secs=TERMS, term='privacy/index.html'),
}

targets=[ROOT, os.path.join(ROOT,'deploy-netlify'), os.path.join(ROOT,'github-repo','deploy-netlify')]
for key,cfg in pages.items():
    priv='privacy/index.html' if key!='privacy' else 'terms/index.html'  # cross links
    html=build(key,cfg['title'],cfg['title'],cfg['desc'],cfg['h1en'],cfg['h1bn'],cfg['i_en'],cfg['i_bn'],
               cfg['secs'],
               '/privacy/index.html', '/terms/index.html', key=='terms')
    for t in targets:
        d=os.path.join(t,key)
        os.makedirs(d,exist_ok=True)
        open(os.path.join(d,'index.html'),'w',encoding='utf-8').write(html)
    print(f"built {key}/index.html -> {len(targets)} locations, {len(html)} bytes")
print("done")

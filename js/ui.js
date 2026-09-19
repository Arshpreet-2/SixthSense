/* SixthSense — navigation shell and all screens */
"use strict";

/* ============================================================ NAV */
function go(s,keep){ if(!keep) S.stack.push(S.screen); S.screen=s; S.drawer=false; render(); toTop(); }
function back(){ S.screen = S.stack.pop() || "home"; S.drawer=false; render(); toTop(); }
function tab(t){ S.stack=[]; S.tab=t; S.drawer=false;
  if(t==="map"){
    if(typeof askLocationQuietly==="function") setTimeout(askLocationQuietly, 150);
    if(typeof ensureArea==="function") setTimeout(()=>ensureArea(), 250);
  }
  S.screen = {home:"home",map:"map",audit:"audit",connect:"connect"}[t]; render(); toTop(); }
function toTop(){ const s=document.querySelector(".scroll"); if(s) s.scrollTop=0; }
const first = () => (S.user.name||"there").trim().split(" ")[0];
const ini = n => (n||"?").replace(/[^\p{L}\s]/gu,"").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "?";
const acts = () => S.contacts.filter(c=>c.n&&c.p);

function bar(title,opts){ opts=opts||{};
  const off = S.offline ? '<span class="offtag plain">'+ic("wifi-off",12)+'Offline</span>' : '';
  opts = {...opts, right:(opts.right||'')+off};
  return '<div class="top plain">'+(opts.noBack?'':'<button class="back" data-a="back" aria-label="Back">'+ic("back",18)+'</button>')+
    '<h2 class="grow">'+title+'</h2>'+(opts.right||'')+'</div>'; }
function nav(){
  return '<nav class="nav">'+[["home","home","Home"],["map","pin","Map"],["audit","doc","Audit"],["connect","users","Community"]]
    .map(([k,i,l])=>'<button class="nv" data-a="tab" data-v="'+k+'" '+(S.tab===k?'aria-current="page"':'')+'>'+
    '<span>'+ic(i,21)+'</span>'+l+'</button>').join('')+'</nav>';
}
function sensingChip(){
  const on = LIVE.sensing;
  if(!on || !on.length) return "";
  return '<div class="senschip"><span class="pulse" style="background:var(--danger);color:var(--danger)"></span>'+
    esc(on.join(" and "))+' in use<button data-a="stopsensing">Stop</button></div>';
}
const shell = (b,n,extra) => '<div class="scroll fade">'+b+'</div>'+sensingChip()+(extra||'')+(n?nav():'');

const V = {};

/* ---------------- onboarding ---------------- */
V.welcome = () => '<div class="scroll fade" style="display:flex;flex-direction:column;justify-content:center;padding:26px 26px 30px">'+
  '<div class="blob a"></div><div class="blob b"></div>'+
  '<div class="center" style="display:flex;flex-direction:column;align-items:center;gap:13px">'+logo(70)+
  '<div><h1 class="gradtext" style="font-size:34px;font-weight:700">SixthSense</h1>'+
  '<p style="margin:5px 0 0;font-size:15px;font-weight:500;color:var(--ink-2)">Your Silent Protector</p></div></div>'+
  '<h2 style="font-size:20px;margin:26px 0 4px">Sign in</h2>'+
  '<p class="small sec" style="margin:0 0 16px">A college or work email also verifies your institution, so your reports count for other women.</p>'+
  '<div class="field"><label for="li">Email</label>'+
  '<input id="li" data-b="user.email" value="'+esc(S.user.email)+'" placeholder="name@college.ac.in" inputmode="email" autocomplete="email"></div>'+
  '<button class="btn" style="padding:17px 18px;font-size:16px" data-a="emaillogin">Send me a sign-in link</button>'+
  '<button class="btn ghost" style="margin-top:10px" data-a="googlelogin">'+ic("users",17)+'Continue with Google</button>'+
  (S.showPw
    ? '<div class="field" style="margin-top:12px"><label for="lp">Password</label>'+
      '<input id="lp" type="password" data-b="loginPw" value="'+esc(S.loginPw||"")+'" placeholder="Your password" autocomplete="current-password"></div>'+
      '<button class="btn line" data-a="pwlogin">Sign in with password</button>'
    : '')+
  '<div style="margin-top:12px">'+tgl("staysignedin","",S.staySignedIn,"Stay signed in on this phone","Turn this off on a shared phone")+'</div>'+
  '<div class="row" style="gap:10px;margin:18px 0 14px"><span style="flex:1;height:1px;background:var(--line)"></span>'+
  '<span class="tiny sec">or</span><span style="flex:1;height:1px;background:var(--line)"></span></div>'+
  '<button class="btn line" data-a="go" data-v="ob1">Create an account</button>'+
  '<button class="btn line" style="margin-top:10px" data-a="login">'+ic("eye",16)+'Try the demo account</button>'+
  '<p class="tiny sec center" style="margin-top:8px;line-height:1.5">The demo account is a sample profile for trying the app. Phone sign-in with OTP comes with the launch build.</p>'+
  '<button class="btn line sm" style="margin:16px auto 0" data-a="theme">'+ic("moon",15)+'Switch theme</button></div>';

V.linksent = () => shell(bar("Check your email")+'<div class="hero">'+
  '<span style="color:var(--purple)">'+ic("sms",46,1.3)+'</span>'+
  '<h2 style="font-size:21px">Sign-in link sent</h2>'+
  '<p class="small sec" style="max-width:30ch">We sent a link to <b>'+esc(S.user.email)+'</b>. Open it on this phone to sign in.</p>'+
  '<button class="btn" style="margin-top:16px" data-a="linkopened">I opened the link</button>'+
  '<button class="btn ghost" style="margin-top:10px" data-a="back">Use another email</button>'+
  '<p class="tiny sec" style="max-width:32ch;margin-top:14px">Demo: the link is not really sent yet. Real email sign-in starts when the backend is connected.</p></div>');

V.ob1 = () => shell(bar("")+'<div class="pad">'+
  '<h1 style="font-size:26px">Let\'s get to know you</h1>'+
  '<p class="sec small" style="margin:6px 0 22px">Your name is what SixthSense will greet you with.</p>'+
  '<div class="field"><label for="f1">Name</label><input id="f1" data-b="user.name" value="'+S.user.name+'" placeholder="e.g. Akshi" autocomplete="name"></div>'+
  phoneField("f2","user.phone",S.user.phone,"Phone Number")+
  '<div class="field"><label>Gender</label><div class="chips">'+
    ["Female","Male","Other","Prefer not to say"].map(g=>
      '<button class="chip" data-a="gender" data-v="'+g+'" aria-pressed="'+(S.user.gender===g)+'">'+g+'</button>').join('')+
  '</div></div>'+
  '<div class="field"><label for="f3">Email <span class="sec" style="font-weight:400">(optional)</span></label><input id="f3" data-b="user.email" value="'+esc(S.user.email)+'" inputmode="email"></div>'+
  '<button id="ob1go" class="btn'+((S.user.name||"").trim()&&phoneOk(S.user.phone)&&S.user.gender?'':' dim')+'" style="margin-top:8px" data-a="ob1next">Continue</button>'+
  '<p id="ob1hint" class="tiny sec center" style="margin-top:8px'+((S.user.name||"").trim()&&phoneOk(S.user.phone)&&S.user.gender?';display:none':'')+'">Name, gender and a valid 10-digit mobile number are needed</p></div>');

V.ob2 = () => shell(bar("")+'<div class="pad">'+
  '<h1 style="font-size:26px">Build your Safety Circle</h1>'+
  '<p class="sec small" style="margin:6px 0 20px">Add up to 3 trusted contacts who can be alerted when you need help.</p>'+
  slots()+'<button class="btn" style="margin-top:18px" data-a="go" data-v="ob3">Continue</button></div>');

function slots(){
  return '<div class="rows">'+S.contacts.map((c,i)=>
    (c.n&&c.p)
      ? '<div class="rw"><span class="av s">'+ini(c.n)+'</span><div class="grow"><h4>'+c.n+'</h4><p>'+c.p+'</p></div>'+
        '<button class="icb" data-a="ec" data-v="'+i+'" aria-label="Edit">'+ic("edit",16)+'</button>'+
        '<button class="icb" data-a="rc" data-v="'+i+'" aria-label="Remove">'+ic("trash",16)+'</button></div>'
      : '<button class="rw" data-a="ec" data-v="'+i+'"><span class="av s" style="background:var(--wash);color:var(--ink-3)">'+ic("plus",16)+'</span>'+
        '<div class="grow"><h4 style="color:var(--ink-2)">Add contact</h4><p>Slot '+(i+1)+' of 3</p></div>'+ic("chev",16)+'</button>'
  ).join('')+'</div>';
}
V.cedit = () => { const c = S.contacts[S.ei];
  return shell(bar("Trusted contact")+'<div class="pad">'+
  '<div class="field"><label for="c1">Name</label><input id="c1" data-b="contact.n" value="'+(c.n||'')+'" placeholder="e.g. Maa"></div>'+
  phoneField("c2","contact.p",c.p||"","Phone number","SOS messages and calls go to this number.")+
  '<button id="csave" class="btn'+((c.n||"").trim()&&phoneOk(c.p)?'':' dim')+'" data-a="savecontact">Save contact</button>'+
  '<p id="chint" class="tiny sec center" style="margin-top:8px'+((c.n||"").trim()&&phoneOk(c.p)?';display:none':'')+'">A name and a valid 10-digit mobile number are needed.</p></div>'); };

V.ob3 = () => shell(bar("")+'<div class="pad">'+
  '<h1 style="font-size:26px">Verify your identity</h1>'+
  '<p class="sec small" style="margin:8px 0 18px">Optional now, but required to submit safety audits — audits shape the data other women rely on.</p>'+
  '<div class="card p14" style="margin-bottom:18px"><div class="row" style="align-items:flex-start">'+
  '<span style="color:var(--purple)">'+ic("vf",24)+'</span><div class="grow">'+
  '<h4 style="font-size:14.5px">Why we verify</h4>'+
  '<p class="small sec" style="margin:3px 0 0">It decides how much your audits and Angel answers count. Routes, SOS and Guardians work without it.</p></div></div></div>'+
  '<button class="btn" data-a="go" data-v="verify">Verify Now</button>'+
  '<button class="btn ghost" style="margin-top:10px" data-a="finish">I\'ll do this later</button>'+
  '<div class="notice" style="margin-top:18px"><span>'+ic("shield",15)+'</span><span>ID and selfie images are deleted after the check. Permissions are asked later, only when a feature needs them.</span></div></div>');

/* ---------------- shared helpers (new features) ---------------- */
const TIERCOL = t => ({gold:"#9A6A05",partner:"var(--safe)",woman:"var(--purple)",other:"var(--ink-2)",basic:"var(--ink-3)",none:"var(--ink-3)"}[t]||"var(--ink-3)");
const tag = (txt, cls) => '<span class="tag '+(cls||"")+'">'+txt+'</span>';
const ago = t => { const m = Math.round((Date.now()-t)/60000); return m<1?"just now":m<60?m+" min ago":Math.round(m/60)+" h ago"; };
// Indian mobile: 10 digits starting 6-9, with an optional +91
const phoneDigits = v => String(v||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^91(?=\d{10}$)/,"");
// Only digits are accepted; nothing is silently corrected
const phoneClean = v => /^(\+?91[ -]?)?[0-9 -]*$/.test(String(v||"").trim());
const phoneOk = v => phoneClean(v) && /^[6-9]\d{9}$/.test(phoneDigits(v));
const phoneHint = v => {
  const t = String(v||"").trim();
  if(!t) return "";
  if(!phoneClean(t)) return "Numbers only";
  const d = phoneDigits(t);
  if(d.length < 10) return "Enter all 10 digits";
  if(d.length > 10) return "Too many digits";
  return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9";
};
const errLine = t => t ? '<p class="tiny phmsg" style="color:var(--danger);margin:5px 0 0">'+t+'</p>' : '<p class="tiny phmsg" style="margin:5px 0 0"></p>';
// the field itself: numeric keypad, 10 digits maximum, a green tick when it is right
function phoneField(id, bind, value, label, hint){
  const ok = phoneOk(value);
  return '<div class="field"><label for="'+id+'">'+label+'</label>'+
    '<div class="phwrap'+(ok?' ok':'')+'"><span class="cc">+91</span>'+
    '<input id="'+id+'" data-b="'+bind+'" value="'+esc(phoneDigits(value))+'" placeholder="10-digit mobile" '+
    'inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="tel-national">'+
    (ok?'<span class="phok" aria-label="Looks right">'+ic("check",15,3)+'</span>':'')+'</div>'+
    errLine(phoneHint(value))+(hint?'<p class="tiny sec" style="margin:4px 0 0">'+hint+'</p>':'')+'</div>';
}
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tgl = (a, v, on, title, sub) => '<button class="tgl" data-a="'+a+'" data-v="'+v+'" aria-pressed="'+!!on+'"><span class="grow">'+
  '<span style="font-size:14px;font-weight:600;display:block">'+title+'</span>'+(sub?'<span class="tiny sec">'+sub+'</span>':'')+'</span><span class="sw"></span></button>';
const MODEICON = {walk:"walk", auto:"car", cab:"car", scooty:"car", metro:"metro", bus:"bus", mixed:"metro"};
const MODELABEL = {walk:"Walk", auto:"Auto", cab:"Cab", scooty:"Scooty", metro:"Metro", bus:"Bus"};
const confWord = c => c==="high" ? "Based on plenty of recent information"
  : c==="medium" ? "Based on some recent information" : "Based on very little recent information";
const hm = d => d ? String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") : "";
const smsBtn = (label, x, cls) => x.body && Native.canSendSmsDirectly
  ? '<button class="btn sm '+(cls||"")+'" data-a="sendsms" data-v="'+encodeURIComponent(JSON.stringify({n:x.numbers,b:x.body}))+'">'+label+'</button>'
  : '<a class="btn sm '+(cls||"")+'" href="'+x.href+'">'+label+'</a>';

/* ---------------- home ---------------- */
// The status card is now the SixthSense Agent card
function statusCard(){
  const a = Agent.state, st = SensorHub.state;
  let k = "safe", h, s, act = "";
  if(a.trip){
    const b = a.battery;
    h = "SixthSense Agent is with you";
    s = "To "+esc(a.trip.destName)+(b?" · about "+b.needMin+" min left · battery lasts ~"+b[st.mode]+" min":"")+
        (a.channel==="sms"?" · messages by SMS":"");
    act = '<button class="btn line sm" data-a="go" data-v="journey">Open</button>';
    if(a.level>=2){ k="dang"; h="Agent: help needed"; }
    else if(a.ask){ k="mod"; h="Agent is asking: are you okay?"; }
  } else if(packActive()){ k="mod"; h="Dog pack heard nearby"; s="Heard "+packMins()+" min ago · route comparisons include it"; }
  else if(LIVE.net.diag && !["ok","weak"].includes(LIVE.net.diag.diagnosis)){ k="mod"; h=LIVE.net.diag.text; s=LIVE.net.diag.fix||"Messages will go by SMS."; }
  else if(LIVE.cam.on && LIVE.cam.bright!=null && LIVE.cam.bright<25 && LIVE.sun.dark){ k="mod"; h="It is very dark where you are"; s="Light level "+brightIdx()+"/100 · plan a route before you go"; }
  else {
    h = "SixthSense Agent is ready";
    s = [LIVE.batt.on?"Battery "+LIVE.batt.level+"%":null,
         S.offline?"Offline mode · working from saved data":"Plan a trip and I'll watch battery, signal and movement"].filter(Boolean).join(" · ");
  }
  const c = k==="safe"?"var(--safe)":k==="mod"?"var(--mod)":"var(--danger)";
  return '<div class="status '+k+'"><span class="pulse" style="background:'+c+';color:'+c+'"></span>'+
    '<div class="grow"><h4 style="font-size:15px;color:'+c+'">'+h+'</h4>'+
    '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+s+'</p></div>'+
    (act || (liveCount()?'<span class="tiny" style="font-weight:700;color:'+c+'">LIVE</span>':''))+'</div>';
}
function offlineRow(){
  const on = S.offline;
  return '<button class="offrow'+(on?' on':'')+'" data-a="offline">'+
    '<span class="oi">'+ic(on?"wifi-off":"wifi",17)+'</span>'+
    '<span class="grow"><b>'+(on?"Offline mode is on":"Offline mode")+'</b>'+
    '<small>'+(on?"Data off. Protection on."+(S.offlineBy&&S.offlineBy!=="you"?" Turned on by the agent.":"")
                 :"Data off. Protection on. Tap to switch on.")+'</small></span>'+
    '<span class="sw'+(on?" on":"")+'"></span></button>';
}

function homeSos(){
  return '<button class="hsos" data-a="go" data-v="sos" aria-label="Open emergency mode">'+
    '<span class="lbl" id="hsosb" role="button" tabindex="0" aria-label="Hold two seconds to alert your guardians and call 112">'+
      '<svg class="hsosarc" viewBox="0 0 60 60" aria-hidden="true">'+
      '<circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4"/>'+
      '<circle id="hsosa" cx="30" cy="30" r="27" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" '+
      'stroke-dasharray="170" stroke-dashoffset="170" transform="rotate(-90 30 30)"/></svg>SOS</span>'+
    '<span class="txt"><b>Emergency Mode</b><small>'+
      (acts().length ? 'Hold SOS for 2 seconds, or tap for all options'
                     : 'Add an emergency contact so the alert can reach someone')+'</small></span>'+
    ic("chev",20)+
    '</button>';
}
const tile = (cls,icon,t,sub,a,v) => '<button class="tile '+cls+'" data-a="'+a+'" data-v="'+v+'">'+
  '<span class="ti">'+ic(icon,19)+'</span><h4>'+t+'</h4><p>'+sub+'</p></button>';

function evaFace(size){
  const id = "eg" + Math.random().toString(36).slice(2,7);
  return '<svg class="evaface" viewBox="0 0 64 64" width="'+size+'" height="'+size+'" aria-hidden="true">'+
    '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1">'+
      '<stop offset="0" stop-color="#E0218A"/><stop offset=".5" stop-color="#B21FB0"/><stop offset="1" stop-color="#8B1FC9"/>'+
    '</linearGradient></defs>'+
    '<circle cx="32" cy="32" r="31" fill="url(#'+id+')"/>'+
    // hair behind: long, falling past the shoulders
    '<path d="M14 34c0-13 8-21 18-21s18 8 18 21c0 7-1 12-3 16 1-8-1-13-2-16-3 3-8 4-13 4s-10-1-13-4c-1 3-3 8-2 16-2-4-3-9-3-16z" fill="#2A1033"/>'+
    '<path d="M13 52c1-6 3-10 5-12l2 12z" fill="#2A1033"/><path d="M51 52c-1-6-3-10-5-12l-2 12z" fill="#2A1033"/>'+
    // face
    '<path d="M32 17c-8 0-13 6-13 14v4c0 8 6 14 13 14s13-6 13-14v-4c0-8-5-14-13-14z" fill="#F7D9C4"/>'+
    // fringe over the forehead
    '<path d="M19 30c0-9 5-14 13-14s13 5 13 14c-2-4-5-6-8-7-3 2-6 3-10 3-3 0-6 1-8 4z" fill="#2A1033"/>'+
    // bun
    '<circle cx="32" cy="12" r="6" fill="#2A1033"/>'+
    // eyes with lashes, brows, smile, blush
    '<path d="M24 28.5c1.4-1.2 3.2-1.2 4.6 0M35.4 28.5c1.4-1.2 3.2-1.2 4.6 0" stroke="#2A1033" stroke-width="1.5" fill="none" stroke-linecap="round"/>'+
    '<circle cx="26.3" cy="32.4" r="2.1" fill="#2A1033"/><circle cx="37.7" cy="32.4" r="2.1" fill="#2A1033"/>'+
    '<circle cx="27" cy="31.7" r=".7" fill="#fff"/><circle cx="38.4" cy="31.7" r=".7" fill="#fff"/>'+
    '<circle cx="22.5" cy="36.5" r="2.2" fill="#F0A6B8" opacity=".55"/>'+
    '<circle cx="41.5" cy="36.5" r="2.2" fill="#F0A6B8" opacity=".55"/>'+
    '<path d="M28.5 39.5c2 1.8 5 1.8 7 0" stroke="#B4405C" stroke-width="1.7" fill="none" stroke-linecap="round"/>'+
    // shoulders
    '<path d="M16 60c3-6 9-9 16-9s13 3 16 9z" fill="#fff" opacity=".92"/>'+
    '</svg>';
}

function chatSheet(){
  const c = S.chat;
  if(!c.open) return '<button class="evafab" data-a="askopen" aria-label="Ask EVA">'+evaFace(42)+
    '<span class="evaname">EVA</span><span class="evadot"></span></button>';
  return '<div class="sheet" data-a="askclose"></div><div class="asksheet">'+
    '<div class="row" style="margin-bottom:10px">'+evaFace(40)+
    '<div class="grow" style="margin-left:10px"><h3 style="font-size:16px;margin:0">EVA</h3>'+
    '<p class="tiny sec" style="margin:1px 0 0">Everyday Virtual Assistant · always with you</p></div>'+
    '<button class="btn line sm" data-a="askclose">Close</button></div>'+
    '<div class="askbody" id="askbody">'+
      (c.msgs.length ? c.msgs.map(m=>
        '<div class="msg '+(m.me?'me':'it')+'">'+esc(m.text).replace(/\n/g,'<br>')+
        (m.source?'<span class="src">'+esc(m.source)+'</span>':'')+'</div>').join('')
      : '<div class="msg it" style="margin-top:2px"><b>I am EVA, your everyday virtual assistant.</b><br>'+
        'I am your sixth sense. I show what your five senses don\'t. Ask me anything.'+
        '<span class="src">works offline for your own data</span></div>'+
        '<div class="chips">'+Ask.starters.map(q=>'<button class="chip" data-a="askthis" data-v="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div>')+
      (c.busy?'<div class="msg it">Thinking…</div>':'')+
    '</div>'+
    '<div class="findrow" style="margin-top:8px"><input id="askin" placeholder="Type your question" autocomplete="off">'+
    '<button class="clr" data-a="asksend" aria-label="Send">&rarr;</button></div></div>';
}

V.home = () => {
  const un = S.alerts.filter(a=>a.unread).length;
  const tone = t => t==="mod"?"var(--mod)":t==="safe"?"var(--safe)":"var(--purple)";
  const inbox = Store.inbox().length;
  return shell(
  '<div class="top" style="padding-top:20px"><div class="grow">'+
    '<p class="tiny" style="margin:0 0 1px;color:var(--ink-2);font-weight:600">'+(Store.me().demo?'Demo account':'Welcome back')+'</p>'+
    '<h2 style="font-size:22px">Hi, '+esc(first())+'</h2></div>'+
    '<button class="icb" data-a="go" data-v="alerts" aria-label="Alerts">'+ic("bell",18)+(un?'<span class="badge">'+un+'</span>':'')+'</button>'+
    '<button class="av" data-a="go" data-v="profile" aria-label="Profile">'+ini(S.user.name)+'</button>'+
    '<div class="herostats glass">'+
      '<div><b>'+(S.points||0)+'</b><span>Halo points</span></div>'+
      '<div><b>'+(S.audits||[]).length+'</b><span>Audits</span></div>'+
      '<div><b>'+((S.trips||[]).length)+'</b><span>Journeys</span></div>'+
    '</div></div>'+
  '<div class="pad" style="margin-top:12px">'+offlineRow()+'</div>'+
  '<div class="pad sect" style="margin-top:14px"><div class="tiles">'+
    tile("t-travel","route","Safe Travel","Compare your routes","tmode","")+
    tile("t-audit","doc","Instant Audit","Your words, one photo, done","instant","")+
    tile("t-sos","users","Ask Angels","Live answers from women near you","go","askangels")+
    tile("t-help","help","Help Center","Explore resources","go","help")+
  '</div></div>'+
  '<div class="pad" style="margin-top:14px">'+homeSos()+'</div>'+
  '<div class="pad" style="margin-top:20px"><span class="lbl">My space</span><div class="circles">'+
    '<button class="qc" data-a="go" data-v="rewards"><span class="c">'+ic("trophy",20)+'</span><span>My<br>Halo</span></button>'+
    '<button class="qc" data-a="go" data-v="guardians"><span class="c">'+ic("shield",20)+'</span><span>My<br>Guardians</span></button>'+
    '<button class="qc" data-a="go" data-v="signals"><span class="c">'+ic("eye",20)+'</span><span>Live<br>Signals</span></button>'+
  '</div></div>'+
  (inbox?'<div class="pad" style="margin-top:14px"><button class="rw card" data-a="go" data-v="inbox"><span style="color:var(--purple)">'+ic("bell",18)+'</span>'+
    '<div class="grow"><h4>'+inbox+' question'+(inbox>1?'s':'')+' near you</h4><p>Someone is asking Angels about a place you are near</p></div>'+ic("chev",16)+'</button></div>':'')+
  '<div class="sect"><div class="pad between" style="margin-bottom:10px"><h3>Safety Measures</h3>'+
    '<span class="tiny sec" style="font-weight:600">Swipe</span></div><div class="hs">'+
    tipCards(tone)+'</div></div>'+
  '<div style="height:16px"></div>', true, chatSheet());
};

/* Home slider: battery first, then signal and mode, then advice and nearby
   alerts in a shuffled order so it does not read the same every time. */
function tipCards(tone){
  const b = LIVE.batt, n = LIVE.net, sig = LIVE.sig;
  const card = (label, colour, title, body, foot) =>
    '<div class="hc"><span class="tiny" style="font-weight:700;color:'+colour+'">'+label+'</span>'+
    '<h4 style="font-size:13.5px;margin:5px 0 4px">'+title+'</h4>'+
    '<p class="tiny" style="margin:0;color:var(--ink-2);line-height:1.4">'+body+'</p>'+
    (foot?'<p class="tiny" style="margin:6px 0 0;color:var(--ink-3)">'+foot+'</p>':'')+'</div>';

  /* 1. battery, and how long it lasts at the rate it is draining */
  const plan = (()=>{ try{ return Agent.batteryPlan ? Agent.batteryPlan(30) : null; }catch(e){ return null; } })();
  const mins = plan ? plan[S.offline||plan.mode==="critical" ? "critical" : plan.mode] : null;
  const hhmm = m => m==null ? null : (m>=60 ? Math.floor(m/60)+" h "+(m%60)+" min" : m+" min");
  const battery = card("BATTERY", b.level!=null && b.level<=20 ? "var(--danger)" : "var(--purple)",
    b.on ? "Battery "+b.level+"%" : "Battery not readable",
    b.on ? (mins!=null
        ? "About "+hhmm(mins)+" left at the rate it is draining now"+(plan&&plan.measured?", measured on your phone.":", using typical rates.")
        : "Measuring how fast it drains; an estimate appears after a few minutes.")
      : "This browser does not report battery. The Android app does.",
    b.on ? (b.level<=8 ? "Critical power saving: sound and camera off, last message ready."
          : b.level<=15 ? "Power saving is on: camera off, sound checked once a minute."
          : "Full sensing while you travel.") : null);

  /* 2. signal around her, and which mode suits it */
  const weak = sig.weak || (n.diag && n.diag!=="ok") || !n.online;
  const suggestion = S.offline
    ? "Offline mode is on, which is the right choice here."
    : weak ? "Signal is weak here. Offline mode would keep everything working without waiting on data."
           : "Signal is fine. Online mode gives you live readings and Angel answers.";
  const signal = card("SIGNAL AND MODE", weak ? "var(--mod)" : "var(--safe)",
    !n.online ? "No network" : weak ? "Weak signal here" : "Signal is good",
    suggestion,
    "Running now: "+(S.offline ? "Offline mode — saved data only" : "Online mode — live data")+
    (sig.dbm!=null ? " · "+sig.dbm+" dBm" : ""));

  /* 3. advice, and 4. alerts nearby — shuffled together */
  const advice = (DATA.tips || TIPS).map(t =>
    card("SAFETY ADVICE","var(--safe)", esc(t.t), esc(t.b)));
  const live = (()=>{ try{ const u = userPos();
      return (Store.unusualNear ? Store.unusualNear(u.lat, u.lng, 2000) : []).slice(0,3).map(r =>
        card("UNUSUAL NEARBY", "var(--mod)", esc(r.unusual.what.charAt(0).toUpperCase()+r.unusual.what.slice(1)),
          esc(r.note || r.place || "Reported nearby"),
          (r.distM < 1000 ? r.distM+" m away" : (r.distM/1000).toFixed(1)+" km away")+" · "+ago(r.t)+
          " · counted until "+hm(new Date(r.unusualUntil || r.t + 6*3600000))));
    }catch(e){ return []; } })();

  const near = live.concat(DATA.news.map(x =>
    card(x.tag.toUpperCase(), tone(x.tone), esc(x.t), esc(x.b), x.where ? esc(x.where) : null)));

  // the order is decided once per visit to Home, not on every redraw —
  // reshuffling mid-render is what made the page look like it was flickering
  const rest = advice.concat(near);
  if(!S.tipOrder || S.tipOrder.length !== rest.length){
    const idx = rest.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; }
    S.tipOrder = idx;
  }
  return battery + signal + S.tipOrder.map(i=>rest[i]).join("");
}



const TIPS = [
  {t:"Wait where people are", b:"If an auto is a few minutes away, wait by an open shop or a staffed place rather than at the corner."},
  {t:"Tell one person before you leave", b:"A single message with your route and the time you expect to arrive does more than any app feature."},
  {t:"Keep 20% battery for the last mile", b:"The end of a trip is when you most need a call, a map and a message. The agent watches this for you."},
];

/* ---------------- profile ---------------- */
V.profile = () => { const m = Store.me();
  const badges = (m.badges || []);
  return shell(bar("Profile")+'<div class="pad">'+
  '<div class="row" style="gap:14px;margin-bottom:6px">'+
    '<button class="avwrap" data-a="go" data-v="avatar" aria-label="Change your avatar">'+
      (S.user.avatar ? '<span class="av l" style="background:'+esc(S.user.avatar.bg)+'">'+esc(S.user.avatar.face)+'</span>'
                     : '<span class="av l">'+ini(S.user.name)+'</span>')+
      '<span class="avedit">'+ic("edit",13)+'</span></button>'+
    '<div class="grow"><h2 style="font-size:21px">'+esc(S.user.name||"Your profile")+'</h2>'+
    '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+esc(S.user.phone||"—")+'</p>'+
    '<span class="tiny" style="display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-weight:700;color:'+TIERCOL(m.tier)+'">'+
    ic("vf",13)+m.tierLabel+(m.demo?' (demo)':'')+'</span></div></div>'+

  '<div class="card p14" style="margin-bottom:12px">'+
    '<div class="between"><span class="lbl" style="margin:0">Reputation</span>'+
    '<b style="font-variant-numeric:tabular-nums;font-size:17px">'+m.reputation.toFixed(2)+'</b></div>'+
    '<div class="repbar"><i style="width:'+Math.round(m.reputation*100)+'%"></i></div>'+
    '<p class="small sec" style="margin:7px 0 0">'+esc(m.reputationWord)+' · '+(m.confirmed||0)+' confirmed, '+
      ((m.rejected||0)+(m.rejectedPositive||0))+' rejected. It starts low and rises as your record grows, '+
      'so nobody looks trustworthy after two lucky reports.</p>'+
  '</div>'+
  '<div class="card p14" style="margin-bottom:16px">'+
    '<div class="row" style="gap:18px">'+
      '<div><b style="font-size:22px;font-variant-numeric:tabular-nums">'+(S.points||0)+'</b>'+
      '<span class="tiny sec" style="display:block">Points earned</span></div>'+
      '<div><b style="font-size:22px;font-variant-numeric:tabular-nums">'+badges.length+'</b>'+
      '<span class="tiny sec" style="display:block">Badge'+(badges.length===1?'':'s')+' earned</span></div>'+
    '</div>'+
    '<p class="small sec" style="margin:10px 0 0">'+((S.points||0)===0
      ? 'Earn points to gain rewards.' : 'Keep going — every confirmed audit and Angel answer adds points.')+'</p>'+
    '<button class="btn line sm" style="margin-top:10px" data-a="go" data-v="rewards">Learn how to collect points</button>'+
  '</div>'+

  '<div class="rows">'+
    mi("vf","Verification",m.tier==="none"?"verify":"trust")+mi("users","Vouching","vouch")+mi("doc","Personal Details","personal")+
    mi("route","Travel preferences","style")+
    mi("users","Emergency Contacts","contacts")+mi("star","Your badges and rewards","rewards")+
    mi("route","My journeys","trips")+mi("route","What SixthSense learned","learned")+mi("bell","Alerts","alerts")+
    mi("doc","What data we use","sources")+mi("shield","Privacy","privacy")+mi("gear","Settings","settings")+
  '</div>'+
  '<button class="btn" style="margin-top:16px;background:var(--danger);box-shadow:0 6px 16px rgba(192,34,59,.25)" data-a="signout">Sign out</button>'+
  '<button class="btn ghost" style="margin-top:9px" data-a="theme">'+ic("moon",16)+'Switch to '+(isDark()?'light':'dark')+' mode</button>'+
  '<button class="btn ghost" style="margin-top:9px" data-a="reset">Reset demo data</button>'+
  '<p class="tiny sec center" style="margin-top:10px">Your profile is kept on this phone; audits and Angel answers sync when you are signed in.</p></div>'); };

/* choose an avatar: a face and a colour, no photo needed */
const AV_FACES = ["👩","👩🏽","👩🏾","👧","🧕","👩‍🎓","👩‍💻","👩‍🔬","🦸‍♀️","🌸","⭐","🦋"];
const AV_BGS = ["linear-gradient(135deg,#E0218A,#6C2BD9)","linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#10B981,#0EA5E9)","linear-gradient(135deg,#6366F1,#A855F7)",
  "linear-gradient(135deg,#F472B6,#FB7185)","linear-gradient(135deg,#0F766E,#65A30D)"];
V.avatar = () => { const a = S.user.avatar || {face:AV_FACES[0], bg:AV_BGS[0]};
  return shell(bar("Your avatar")+'<div class="pad">'+
  '<div class="center" style="margin-bottom:18px"><span class="av l" style="background:'+esc(a.bg)+';font-size:34px;width:92px;height:92px;border-radius:28px">'+esc(a.face)+'</span>'+
  '<p class="small sec" style="margin:10px 0 0">Pick a face and a colour. Nothing is uploaded.</p></div>'+
  '<span class="lbl">Face</span><div class="chips" style="margin-bottom:16px">'+
    AV_FACES.map(f=>'<button class="chip" style="font-size:19px;padding:6px 10px" data-a="avface" data-v="'+f+'" aria-pressed="'+(a.face===f)+'">'+f+'</button>').join('')+'</div>'+
  '<span class="lbl">Colour</span><div class="chips" style="margin-bottom:20px">'+
    AV_BGS.map((b,i)=>'<button class="chip" data-a="avbg" data-v="'+i+'" aria-pressed="'+(a.bg===b)+'" style="width:44px;height:36px;background:'+b+';border:0"></button>').join('')+'</div>'+
  '<button class="btn" data-a="back">Done</button></div>'); };

const mi = (i,l,d) => '<button class="rw" data-a="go" data-v="'+d+'"><span style="color:var(--purple)">'+ic(i,18)+'</span>'+
  '<span class="grow" style="font-size:14px;font-weight:600">'+l+'</span>'+ic("chev",16)+'</button>';

/* trust details */
V.trust = () => { const m = Store.me();
  return shell(bar("Verification")+'<div class="pad">'+
  '<div class="card p14"><p class="tiny sec" style="margin:0;font-weight:600">Your tier</p>'+
  '<h3 style="font-size:19px;color:'+TIERCOL(m.tier)+'">'+m.tierLabel+(m.demo?' (demo)':'')+'</h3>'+
  '<div class="row" style="gap:16px;margin-top:10px">'+
    '<div><p class="tiny sec" style="margin:0">Tier weight</p><b>'+Math.round(m.weight*100)+'%</b></div>'+
    '<div><p class="tiny sec" style="margin:0">Reputation</p><b>'+m.reputation+'</b></div>'+
    '<div><p class="tiny sec" style="margin:0">Your data counts</p><b>'+Math.round(m.trust*100)+'%</b></div></div></div>'+
  '<div class="notice" style="margin-top:12px"><span>'+ic("shield",15)+'</span><span>Reports that make a route look <b>better</b> (well lit, busy, shops open) count only after women-verified members or phone sensors confirm them. Warnings count earlier at reduced weight.</span></div>'+
  '<div class="sect"><h3>Tiers</h3><div class="rows">'+
  Object.entries(Store.TIERS).filter(([k])=>k!=="none").map(([k,t])=>'<div class="rw"><span class="dot" style="background:'+TIERCOL(k)+'"></span>'+
  '<div class="grow"><h4>'+t.label+'</h4><p>'+Math.round(t.weight*100)+'% weight'+(t.canConfirmPositive?' · can confirm better-route claims':'')+'</p></div>'+
  (k===m.tier?tag("You","soft"):'')+'</div>').join('')+'</div></div>'+
  '<button class="btn ghost" style="margin-top:14px" data-a="go" data-v="verify">Verify again</button></div>'); };

/* verification flow */
V.verify = () => {
  const v = S.v;
  const head = bar("Verify your identity");
  const other = '<button class="btn ghost" style="margin-top:10px" data-a="vback">Choose another method</button>';
  if(v.step===0) return shell(head+'<div class="pad">'+
    '<p class="small sec" style="margin:0 0 14px">Verification decides how much your data counts. We match a live selfie to your ID photo, then delete both images.</p>'+
    '<div class="rows">'+
    [["igdtuw","Student or staff","Highest trust · institution email + ID + selfie"],["photo-id","Other photo ID","Verified · ID + selfie"],
     ["partner","Partner organisation","Invite code from a partner NGO"],["digilocker-woman","DigiLocker","Verified woman · coming soon"]]
    .map(([k,t,d])=>'<button class="rw" data-a="vmethod" data-v="'+k+'" '+(k==="digilocker-woman"?'style="opacity:.5"':'')+'>'+
      '<span style="color:var(--purple)">'+ic("vf",18)+'</span><div class="grow"><h4>'+t+'</h4><p>'+d+'</p></div>'+ic("chev",16)+'</button>').join('')+'</div>'+
    '<div class="notice" style="margin-top:12px"><span>'+ic("shield",15)+'</span><span>No Aadhaar is collected. Gender is never guessed from a face; it comes from your institution or an official document.</span></div></div>');
  if(v.step===1) return shell(head+'<div class="pad">'+
    (v.method==="igdtuw"
      ? '<div class="field"><label for="ve">College email</label><input id="ve" data-b="v.email" value="'+esc(v.email)+'" placeholder="name@igdtuw.ac.in" inputmode="email"></div>'+
        (v.linkSent?'<div class="notice"><span>'+ic("check",15)+'</span><span>Sign-in link sent to <b>'+esc(v.email)+'</b>. Open it on this phone. <span class="sec">(Demo: tap below.)</span></span></div>'+
          '<button class="btn" style="margin-top:12px" data-a="vlinked">I opened the link</button>'
         :'<button class="btn" data-a="vsend">Send sign-in link</button>'+(v.err?'<p class="tiny" style="color:var(--danger);margin-top:8px">'+v.err+'</p>':''))
      : v.method==="partner"
      ? '<div class="field"><label for="vc">Partner invite code</label><input id="vc" data-b="v.code" value="'+esc(v.code||"")+'" placeholder="e.g. NGO-4821"></div><button class="btn" data-a="vnext">Continue</button>'
      : '<p class="small sec">You will photograph your photo ID, then take a live selfie.</p><button class="btn" data-a="vnext">Start</button>')+
    other+'</div>');
  if(v.step===2) return shell(head+'<div class="pad">'+
    '<h3 style="font-size:16px;margin-bottom:6px">Step 1 of 2 · Photo of your ID card</h3>'+
    '<p class="small sec" style="margin:0 0 12px">'+(v.method==="igdtuw"?"College ID card":"Any photo ID (college or office ID)")+'. It stays on this phone and is deleted after the check.</p>'+
    (v.idImg?'<div class="card" style="overflow:hidden"><img src="'+v.idImg+'" alt="Your ID photo" style="width:100%;display:block;max-height:200px;object-fit:cover"></div>'+
      '<button class="btn" style="margin-top:12px" data-a="vnext">Continue to selfie</button>'
     :'<label class="btn line">'+ic("cam",18)+'Take photo of ID<input id="vid" type="file" accept="image/*" capture="environment" hidden></label>')+other+'</div>');
  if(v.step===3) return shell(head+'<div class="pad">'+
    '<h3 style="font-size:16px;margin-bottom:6px">Step 2 of 2 · Live selfie</h3>'+
    '<p class="small sec" style="margin:0 0 10px">When asked: <b>'+v.instr+'</b>. This shows it is really you, not a photo.</p>'+
    '<div class="card" style="overflow:hidden;background:#000;aspect-ratio:3/4;display:grid;place-items:center">'+
    '<video id="vsv" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video></div>'+
    (v.checking?'<p class="small center" style="margin-top:12px">Matching your selfie to the ID photo…</p>'
      :'<button class="btn" style="margin-top:12px" data-a="vselfie">Capture</button>')+
    '<p class="tiny sec center" style="margin-top:8px">Face match runs on this phone. <b>Demo:</b> the match is simulated for now.</p>'+other+'</div>');
  const m = Store.me();
  return shell(head+'<div class="hero"><span style="width:70px;height:70px;border-radius:50%;display:grid;place-items:center;background:var(--grad);color:#fff">'+ic("check",32,2.6)+'</span>'+
    '<h2 style="font-size:22px">You are verified</h2><p class="small sec">Tier: <b style="color:'+TIERCOL(m.tier)+'">'+m.tierLabel+'</b></p>'+
    '<p class="tiny sec" style="max-width:30ch">Your ID photo and selfie were deleted from this phone. Only "verified, tier and date" is kept.</p>'+
    '<button class="btn" style="margin-top:14px" data-a="vdone">Done</button></div>');
};

V.trips = () => shell(bar("My journeys")+'<div class="pad">'+
  ((S.trips||[]).length
    ? '<div class="rows">'+S.trips.map((t,i)=>
        '<div class="rw" style="align-items:flex-start"><span class="av s" style="background:var(--wash);color:var(--purple)">'+ic("route",16)+'</span>'+
        '<div class="grow"><div class="between"><h4>'+esc(t.to)+'</h4><span class="tiny sec">'+ago(t.t)+'</span></div>'+
        '<p>'+esc(t.title)+' · '+t.minutes+' min'+(t.fare?' · Rs. '+t.fare:'')+' · '+(t.metres/1000).toFixed(1)+' km</p>'+
        '<p class="tiny sec" style="margin-top:2px">'+(t.reached?"Reached":"Ended early")+(t.did&&t.did.length?' · '+esc(t.did.slice(0,2).join(" · ")):'')+'</p></div>'+
        (t.place?'<button class="btn line sm" data-a="repeattrip" data-v="'+i+'">Again</button>':'')+'</div>').join('')+'</div>'
    : '<div class="card p14 center"><p class="small sec" style="margin:0">No journeys yet. Plan one from Safe Travel and it will be listed here.</p>'+
      '<button class="btn" style="margin-top:12px" data-a="tmode">Plan a trip</button></div>')+
  '<p class="tiny sec center" style="margin-top:10px">Kept on this phone only.</p></div>');

V.learned = () => {
  const trips = Prefs.Trips.list(), M = Prefs.Model; M.train();
  const src = M.sources||{};
  const ex = [{d:0.9,h:16,l:"0.9 km at 4 pm"},{d:1.2,h:21,l:"1.2 km at 9 pm"},{d:6,h:18,l:"6 km at 6 pm"}]
    .map(x=>({x, p:M.predict({distKm:x.d,hour:x.h,familiar:1,battery:60,rain:0})}));
  return shell(bar("What SixthSense learned")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 12px">Learned from '+(src.real||0)+' of your trips'+(src.mock?' and '+src.mock+' sample trips':'')+'. Nothing to fill in; it stays on this phone.</p>'+
  '<div class="rows">'+ex.map(({x,p})=>'<div class="rw" style="align-items:flex-start"><span style="color:var(--purple)">'+ic(MODEICON[p.mode]||"route",18)+'</span>'+
    '<div class="grow"><h4>'+x.l+': '+(p.label||"not enough data")+'</h4><p>'+esc(p.why||"")+'</p></div>'+
    (p.mode?tag(Math.round(p.confidence*100)+"%","soft"):'')+'</div>').join('')+'</div>'+
  '<div class="sect"><h3>Recent trips</h3>'+(trips.length?'<div class="rows">'+trips.slice(-6).reverse().map(t=>
    '<div class="rw"><span style="color:var(--ink-3)">'+ic(MODEICON[t.mode]||"route",16)+'</span><div class="grow"><h4>'+(MODELABEL[t.mode]||t.mode)+' · '+t.distKm+' km</h4>'+
    '<p>'+t.hour+':00'+(t.source==="mock"?' · sample':'')+'</p></div></div>').join('')+'</div>':'<p class="small sec">No trips yet.</p>')+'</div>'+
  '<button class="btn ghost" style="margin-top:14px" data-a="mocktrips">Load sample trip history (demo)</button>'+
  '<button class="btn ghost" style="margin-top:9px;color:var(--danger)" data-a="cleartrips">Delete my trip history</button></div>');
};

V.settings = () => { const o = Agent.options;
  return shell(bar("Settings")+'<div class="pad">'+
  '<h3 style="font-size:16px;margin-bottom:9px">What the agent may do by itself</h3>'+
  '<div style="display:flex;flex-direction:column;gap:9px">'+
  tgl("agopt","autoPower",o.autoPower,"Save power automatically","When the battery won't last the trip")+
  tgl("agopt","checkins",o.checkins,"Ask \"Are you okay?\"","After a long stop, a sudden run or a jolt")+
  tgl("agopt","deadZone",o.deadZone,"Prepare for low-signal stretches","Save offline data and suggest a check-in")+
  tgl("agopt","autoSms",o.autoSms,"Send alerts if I can't respond","Android app only; the web app opens the message for you")+
  '</div>'+
  '<h3 style="font-size:16px;margin:22px 0 9px">Offline</h3>'+
  tgl("offline","",S.offline,"Offline mode","Data off. Protection on. Your saved route, the agent, SOS and guardians keep working.")+
  '<div class="card p14" style="margin-top:10px">'+
    '<h4 style="font-size:14.5px">Save this area</h4>'+
    '<p class="small sec" style="margin:5px 0 10px">Streets, help points, lighting and the map for about 2 km around you, so everything works with no signal.</p>'+
    (S.pack?'<p class="tiny sec" style="margin:0 0 10px">Saved '+ago(S.pack.at)+' · '+esc(S.pack.name)+' · '+S.pack.help+' places · '+S.pack.tiles+' map tiles'+(S.pack.streets?' · '+S.pack.streets.toLocaleString()+' street points, so routes work offline':'')+'</p>':'')+
    (S.packBusy?'<p class="small" style="margin:0"><span class="pulse" style="display:inline-block;background:var(--purple);color:var(--purple)"></span> '+esc(S.packMsg||"Saving…")+'</p>'
      :'<button class="btn line sm" data-a="savearea">'+ic("loc",15)+'Save this area</button>')+
  '</div>'+
  '<h3 style="font-size:16px;margin:22px 0 9px">Look</h3>'+
  '<div class="chips">'+[["aurora","Aurora"],["studio","Studio"],["classic","Classic"]].map(([k,l])=>
    '<button class="chip" data-a="skin" data-v="'+k+'" aria-pressed="'+((localStorage.getItem("ss.skin")||"aurora")===k)+'">'+l+'</button>').join('')+'</div>'+
  '<p class="tiny sec" style="margin:6px 0 0">Three visual styles, same app. Aurora has the gradient headers and motion, Studio is quiet and flat, Classic is the original.</p>'+
  '<h3 style="font-size:16px;margin:22px 0 9px">Language</h3>'+
  '<div class="chips">'+[["en","English"],["hi","हिंदी"]].map(([k,l])=>
    '<button class="chip" data-a="lang" aria-pressed="'+((S.lang||"en")===k)+'">'+l+'</button>').join('')+'</div>'+
  '<p class="tiny sec" style="margin:6px 0 0">Main screens are translated; some detail text stays in English for now.</p>'+
  '<h3 style="font-size:16px;margin:22px 0 9px">Sharing</h3>'+
  tgl("sharereadings","",S.shareReadings,"Share anonymous street readings","Numbers only, deleted after 2 hours. Helps other women.")+
  '<div class="sect"><h3>Account and backend</h3><div class="rows">'+
    '<div class="rw"><div class="grow"><h4>Backend</h4><p>'+esc(Store.backend)+(Cloud.error?' · '+esc(Cloud.error):'')+'</p></div>'+
    '<span class="dot" style="background:'+(Cloud.signedIn?'var(--safe)':Cloud.status==="connected"?'var(--mod)':'var(--ink-3)')+'"></span></div>'+
    '<div class="rw"><div class="grow"><h4>Signed in as</h4><p>'+esc(Cloud.user?(Cloud.user.email||"account"):(Store.me().demo?"Demo account (this phone only)":"Not signed in"))+'</p></div></div>'+
    '<div class="rw"><div class="grow"><h4>Running as</h4><p>'+Native.platform+'</p></div></div>'+
  '</div>'+
  '<button class="btn ghost" style="margin-top:12px" data-a="signout">Sign out</button>'+
  '</div></div>'); };

V.personal = () => shell(bar("Personal Details")+'<div class="pad">'+
  '<div class="field"><label for="p1">Name</label><input id="p1" data-b="user.name" value="'+S.user.name+'"></div>'+
  phoneField("p2","user.phone",S.user.phone,"Phone")+
  '<div class="field"><label>Gender</label><div class="chips">'+
    ["Female","Male","Other","Prefer not to say"].map(g=>
      '<button class="chip" data-a="gender" data-v="'+g+'" aria-pressed="'+(S.user.gender===g)+'">'+g+'</button>').join('')+
  '</div></div>'+
  '<div class="field"><label for="p3">Email</label><input id="p3" data-b="user.email" value="'+S.user.email+'" inputmode="email"></div>'+
  '<button class="btn" data-a="back">Save changes</button></div>');
V.contacts = () => shell(bar("Emergency Contacts")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 15px">Your guardians: used for SOS, SMS updates and calls. Maximum 3.</p>'+slots()+'</div>');
V.alerts = () => { S.alerts.forEach(a=>a.unread=false); save();
  return shell(bar("Alerts")+'<div class="pad"><div class="rows">'+S.alerts.map(a=>
  '<div class="rw" style="align-items:flex-start"><span style="color:var(--purple);margin-top:2px">'+ic("bell",17)+'</span>'+
  '<div class="grow"><div class="between"><h4>'+a.t+'</h4><span class="tiny sec">'+a.w+'</span></div>'+
  '<p style="margin-top:2px">'+a.m+'</p></div></div>').join('')+'</div></div>'); };

/* ---------------- map ---------------- */
// Help points near a place; the bundled list is only used when it is actually nearby
function helpList(near, radiusM){
  const u = near || userPos(), r = radiusM || 4000;
  const live = Light.helpPoints();
  const all = live.length ? live : HELP_FALLBACK;
  const close = all.filter(p => SensorHub.distanceM(u.lat, u.lng, p.lat, p.lng) <= r);
  return close.length ? close : (live.length ? live : []);
}
function userPos(){ return LIVE.geo.lat!=null ? {lat:LIVE.geo.lat, lng:LIVE.geo.lon} : {lat:HOME.lat, lng:HOME.lng}; }
const haveFix = () => LIVE.geo.lat != null;
V.map = () => {
  const u = userPos();
  // the nearest ones only, so the map stays readable
  const pins = S.heat ? helpList(u, 3000)
    .map(p=>({...p, d:SensorHub.distanceM(u.lat,u.lng,p.lat,p.lng)}))
    .sort((a,b)=>a.d-b.d).slice(0,45) : [];
  const L = S.lightLayer ? Light.layers([u.lng-0.01,u.lat-0.01,u.lng+0.01,u.lat+0.01]) : {ways:[],lamps:[],sky:[]};
  const src = Light.sourcesFor([[u.lng,u.lat]]);
  return shell(
  '<div class="top plain" style="padding-bottom:10px"><h2 class="grow">Map</h2>'+
  '<span class="tiny sec" style="font-weight:600;max-width:52%;text-align:right">'+esc(haveFix() ? (S.hereName||("±"+Math.round(LIVE.geo.acc||0)+" m")) : "Finding your location…")+'</span></div>'+
  '<div class="mapbox" style="height:296px;margin:0 20px;border-radius:12px;border:1px solid var(--line)">'+
    mapSVG({h:296, fit:[[u.lng-0.007,u.lat-0.007],[u.lng+0.007,u.lat+0.007]], pins, user:u,
            sky:L.sky, litWays:L.ways, lamps:L.lamps})+(S.lightLayer?lightLegend():S.heat?legend():'')+osmCredit()+
    (S.mapTapped?'':'<button class="mhint" data-a="tap">Tap to see what the agent knows here</button>')+
  '</div>'+
  (S.mapTapped?'<div class="pad" style="margin-top:12px">'+statusCard()+'</div>':'')+
  '<div class="pad" style="margin-top:12px;display:flex;flex-direction:column;gap:9px">'+
    tgl("heat","",S.heat,"Show help points","Police, hospitals, metro, shops and fuel stations (OpenStreetMap)")+
    tgl("lightlayer","",S.lightLayer,"Show street light","Roads tagged lit, mapped street lamps and satellite night light")+
  '</div>'+
  (S.areaLoading?'<div class="pad" style="margin-top:10px"><div class="notice"><span>'+ic("loc",15)+'</span><span>Loading places and lighting for this area…</span></div></div>':'')+
  (S.areaErr?'<div class="pad" style="margin-top:10px"><div class="notice"><span>'+ic("sos",15)+'</span><span>'+esc(S.areaErr)+' <button class="linkbtn" data-a="retryarea">Try again</button></span></div></div>':'')+
  (S.lightLayer?'<div class="pad" style="margin-top:10px"><div class="notice"><span>'+ic("eye",15)+'</span><span>'+
    '<b>'+L.ways.length+'</b> roads tagged lit or unlit, <b>'+L.lamps.length+'</b> street lamps mapped here'+(L.sky.length?', plus satellite night light':'')+'.<br>'+
    esc(src.map||"OpenStreetMap")+(src.mapCoverage?' · '+esc(src.mapCoverage):'')+'<br>'+esc(src.satellite||"")+'</span></div></div>':'')+
  '<div class="pad sect"><span class="lbl">What would you like to do</span><div class="tiles">'+
    tile("t-travel","route","Safe Travel","Compare your routes","tmode","")+
    tile("t-audit","eye","View Live Signals","What the phone senses","go","signals")+
    tile("t-help","pin","Explore Nearby","Help points around you","go","explore")+
    tile("t-sos","share","Share Live Location","Let your circle follow","go","share")+
  '</div></div>'+
  '<div class="pad" style="margin-top:12px"><button class="rw" style="border:1px solid var(--line);border-radius:11px" data-a="go" data-v="guardians">'+
    '<span style="color:var(--purple)">'+ic("shield",18)+'</span><div class="grow"><h4>Guardians</h4>'+
    '<p>Keep your family informed during a journey</p></div>'+ic("chev",16)+'</button></div>'+
  '<div style="height:16px"></div>', true);
};

V.signals = () => {
  const sim = SensorHub.state.injected;
  const chip = k => {
    const m = {live:["LIVE","var(--safe-bg);color:var(--safe)"], est:["ESTIMATE","var(--mod-bg);color:var(--mod)"],
               calc:["CALC","var(--tint);color:var(--plum)"], sim:["SIM","var(--wash2);color:var(--ink-3)"], app:["APP","var(--wash2);color:var(--ink-3)"]}[k];
    return '<span class="tiny" style="font-weight:700;padding:2px 7px;border-radius:5px;background:'+m[1]+'">'+m[0]+'</span>';
  };
  const row = (sense,label,id,kind) =>
    '<div class="rw"><span class="tiny" style="width:42px;font-weight:700;color:var(--ink-3)">'+sense+'</span>'+
    '<span class="grow" style="font-size:13.5px;font-weight:600">'+label+'</span>'+
    '<span class="tiny" id="'+id+'" style="font-weight:600;color:var(--ink-2);text-align:right;max-width:44%">—</span>'+chip(sim?"sim":kind)+'</div>';
  const on = LIVE.mic.on || LIVE.cam.on || LIVE.geo.on;
  return shell(bar("Live Signals")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 14px">What this phone measures right now. Running as <b>'+Native.platform+'</b>.</p>'+
  '<div class="rows">'+
    row("SEE",LIVE.cam.real?"Light level (sensor)":"Light level (camera)","lv-light",LIVE.cam.on?"live":"sim")+
    row("SEE","Daylight or after dark","lv-sun","calc")+
    row("SEE","Openness from GPS fix","lv-geo",LIVE.geo.on?"live":"sim")+
    row("HEAR","Sound level","lv-db",LIVE.mic.on?"live":"sim")+
    row("HEAR","Street activity (YamNet)","lv-act",LIVE.mic.on?"live":"sim")+
    row("RUN","Movement and footpath","lv-run",LIVE.run.on?"live":"sim")+
    row("CALL","Battery","lv-batt",LIVE.batt.on?"live":"sim")+
    row("CALL","Network","lv-net","live")+
    row("CALL","Signal strength","lv-sig",LIVE.sig.source==="android"?"live":LIVE.sig.on?"est":"sim")+
    row("TRIBE","Devices nearby","lv-ble","app")+
    row("GUT","Dog-pack detection (YamNet)","lv-gut",LIVE.mic.on?"live":"sim")+
  '</div>'+
  (on?'<div class="notice" style="margin-top:12px"><span>'+ic("shield",15)+'</span><span>'+
    'Sound is analysed on the phone in 1-second pieces that are overwritten; camera frames give one brightness number and are discarded. <b>No audio or image leaves this phone.</b></span></div>':'')+
  (!on
    ? '<button class="btn" style="margin-top:12px" data-a="live">'+ic("mic",17)+'Enable live sensing</button>'+
      '<p class="tiny sec" style="margin:8px 0 0;line-height:1.45">One tap starts location, motion, camera light and the sound model. Play a dog-bark clip nearby to see detection.</p>'+
      '<button class="btn ghost sm" style="margin-top:9px;width:100%" data-a="sound">Use sound only (no camera)</button>'
    : '<button class="btn ghost sm" style="margin-top:10px;width:100%" data-a="stoplive">Stop live sensing</button>')+
  '</div><div style="height:16px"></div>');
};

/* ---------------- safe travel ---------------- */
const PRESETS = [
  {name:"IGDTUW, Kashmere Gate", lat:28.6644969, lng:77.2325612},
  {name:"Kashmere Gate Metro", lat:28.6676254, lng:77.2280795},
  {name:"Civil Lines Metro", lat:28.6767184, lng:77.2250249},
  {name:"Lal Quila Metro", lat:28.6586999, lng:77.2371695},
  {name:"Tis Hazari Metro", lat:28.6671323, lng:77.216628},
  {name:"New Delhi Metro", lat:28.6432957, lng:77.2232493},
];
const todayStr = () => new Date().toISOString().slice(0,10);
const nowStr = () => { const d=new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
function departAt(t){
  t = t || S.travel;
  if(!t.date && !t.at) return Date.now();
  const [h,m] = (t.at||nowStr()).split(":").map(Number);
  const d = t.date ? new Date(t.date+"T00:00:00") : new Date();
  d.setHours(h, m, 0, 0);
  if(!t.date && d.getTime() < Date.now()-3600000) d.setDate(d.getDate()+1);   // "9 pm" after midnight means tonight
  return d.getTime();
}
function whenLine(t){
  const when = departAt(t), d = new Date(when);
  const mins = Math.round((when - Date.now())/60000);
  const day = d.toDateString() === new Date().toDateString() ? "today"
            : d.toDateString() === new Date(Date.now()+86400000).toDateString() ? "tomorrow"
            : d.toLocaleDateString(undefined,{weekday:"short", day:"numeric", month:"short"});
  const dark = Light.isDark(userPos().lat, userPos().lng, when);
  return "Leaving "+day+" at "+hm(d)+(mins>0&&mins<180?" (in "+mins+" min)":"")+" · "+(dark?"after dark, so light is compared":"daylight, so light is not counted");
}

function suggestList(f){
  const g = (S.travel.sugg||{})[f];
  if(!g) return "";
  if(g.loading) return '<div class="rows"><div class="rw"><p>Looking…</p></div></div>';
  if(!g.list || !g.list.length) return g.msg ? '<div class="rows"><div class="rw"><p>'+esc(g.msg)+'</p></div></div>' : "";
  return '<div class="rows">'+g.list.map((p,i)=>
    '<button class="rw" data-a="pickplace" data-v="'+f+'|'+i+'">'+
    '<span style="color:'+(p.kind==="recent"?"var(--ink-3)":p.kind==="metro"?"var(--purple)":"var(--pink)")+'">'+
      ic(p.kind==="recent"?"clock":p.kind==="metro"?"metro":"pin",16)+'</span>'+
    '<div class="grow"><h4>'+esc(p.name)+'</h4><p>'+esc(p.area||(p.kind==="recent"?"Recent":p.kind==="metro"?"Metro station":""))+'</p></div></button>').join('')+'</div>';
}

function travelSuggestion(){
  const t = S.travel, a = placeOf("from"), b = placeOf("to");
  if(!a || !b) return null;
  const km = SensorHub.distanceM(a.lat,a.lng,b.lat,b.lng)*1.3/1000;
  const hour = t.at ? +t.at.split(":")[0] : new Date().getHours();
  const p = Prefs.Model.predict({distKm:km, hour, familiar:1, battery:LIVE.batt.level||60, rain:0});
  if(!p.mode) return null;
  const tileOf = {walk:"walk", auto:"auto", cab:"auto", scooty:"auto", metro:"metro", bus:"metro"}[p.mode];
  return {...p, tile:tileOf, km};
}
function placeOf(f){
  const t = S.travel;
  if(f==="from"){ if(t.fromPlace) return t.fromPlace;
    if(/current|finding/i.test(t.from||"")) return haveFix()?{name:S.hereName||"Current location",lat:LIVE.geo.lat,lng:LIVE.geo.lon}:null;
    return null; }
  return t.toPlace;
}
V.tmode = () => {
  const t = S.travel, sug = travelSuggestion();
  const modes = [["any","route","Compare all"],["walk","walk","Walking"],["auto","car","Auto or cab"],["metro","metro","Metro + walk/auto"]];
  const list = t.search && t.search.list;
  // Suggestions appear as you type; the list is updated in place so the field keeps focus
  const field = (f,label,ph) => '<div class="field"><label class="fieldlbl" for="t-'+f+'">'+label+'</label>'+
    '<div class="findrow"><input id="t-'+f+'" data-b="travel.'+f+'" value="'+esc(t[f])+'" placeholder="'+ph+'" autocomplete="off">'+
    (t[f] ? '<button class="clr" data-a="pclear" data-v="'+f+'" aria-label="Clear">×</button>' : '')+
    (f==="from" ? '<button class="clr" data-a="usehere" title="Use my location" aria-label="Use my location">◎</button>' : '')+'</div>'+
    '<div class="sugg" id="sg-'+f+'">'+suggestList(f)+'</div></div>';
  return shell(bar("Safe Travel")+'<div class="pad">'+
  field("from","Starting point","Current Location")+
  (haveFix() && LIVE.geo.acc>600 ? '<p class="tiny sec" style="margin:-4px 0 8px">Accurate to about '+Math.round(LIVE.geo.acc)+' m here — on a laptop this comes from wifi, so type your starting point if it looks wrong.</p>' : '')+
  '<div class="center" style="margin:-6px 0 4px"><button class="btn line sm" data-a="swapends">'+ic("route",14)+'Swap</button></div>'+
  field("to","Destination","Where do you want to go?")+

  '<div class="field"><label class="fieldlbl">When are you leaving?</label>'+
    '<div class="whenbox">'+
      '<div class="row" style="gap:8px"><input type="date" data-b="travel.date" value="'+esc(t.date||todayStr())+'" style="flex:1">'+
      '<input id="t-at" type="time" data-b="travel.at" value="'+esc(t.at||nowStr())+'" style="flex:1"></div>'+
      '<p class="tiny" style="margin:8px 0 0;color:var(--plum)">'+esc(whenLine(t))+'</p>'+
    '</div></div>'+
  (()=>{ try{
      let h = null;
      const r = t.result && t.result.options && t.result.options[0];
      if(r && r.coords) h = Normals.quietHourAlong(r.coords, 19);
      if(h == null){
        const pts = [t.toPlace, haveFix() ? {lat:LIVE.geo.lat, lng:LIVE.geo.lon} : null].filter(Boolean);
        for(const p of pts){ h = Normals.quietHour(p.lat, p.lng, 19); if(h != null) break; }
      }
      if(h == null) return "";
      const leaves = departAt(t), leaveHour = new Date(leaves).getHours();
      if(leaveHour < h - 2) return "";       // only worth saying when she is travelling near that hour
      return '<div class="notice" style="margin:12px 0 0"><span>'+ic("clock",15)+'</span>'+
        '<span>This route usually empties after about '+((h%12)||12)+(h<12?' am':' pm')+
        '. Fewer people about is what the comparison will show.</span></div>';
    }catch(e){ return ""; } })()+
  '<h3 style="font-size:16px;margin:14px 0 3px">Anything different for this trip?</h3>'+
  ((S.user.style && S.user.style.length)
    ? '<p class="small sec" style="margin:0 0 8px">Your usual style is <b>'+esc(S.user.style.map(k=>PREF_SETS[k].label.toLowerCase()).join(", "))+'</b>. Add anything extra that matters tonight.</p>'
    : '<p class="small sec" style="margin:0 0 8px">You have not set a usual travel style yet. <button class="linkbtn" data-a="go" data-v="style">Set it now</button>, or just pick for this trip.</p>')+
  '<div class="chips" style="margin-bottom:6px">'+
    STYLE_ORDER.map(k=>'<button class="chip" data-a="pref" data-v="'+k+'" aria-pressed="'+((t.prefs||[]).includes(k))+'">+ '+PREF_SETS[k].label+'</button>').join('')+'</div>'+
  ((t.prefs||[]).length?'<p class="tiny sec" style="margin:0 0 12px">Added for this trip: '+esc(t.prefs.map(k=>PREF_SETS[k].label.toLowerCase()).join(", "))+'. These count double against your usual style.</p>':'<div style="height:8px"></div>')+
  '<h3 style="font-size:16px;margin:6px 0 3px">How are you travelling?</h3>'+
  (sug?'<div class="notice" style="margin:6px 0 10px"><span style="color:var(--purple)">'+ic(MODEICON[sug.mode]||"route",15)+'</span>'+
    '<span><b>Suggested for you: '+sug.label+'</b> ('+Math.round(sug.confidence*100)+'% sure). '+esc(sug.why)+'</span></div>'
      :'<p class="small sec" style="margin:0 0 10px">Choose places to get a suggestion from your past trips.</p>')+

  '<div class="tiles">'+modes.map(([k,i,l])=>{ const on=(t.mode||"any")===k;
    return '<button class="tile" data-a="mode" data-v="'+k+'" style="min-height:78px;background:'+(on?'var(--tint)':'var(--surface)')+
    ';border-color:'+(on?'var(--purple)':'var(--line)')+';color:var(--purple)">'+
    '<span class="ti" style="background:var(--wash)">'+ic(i,19)+'</span><h4 style="font-size:14px">'+l+(sug&&sug.tile===k?' ★':'')+'</h4></button>'; }).join('')+'</div>'+
  '<button class="btn" style="margin-top:16px" data-a="find" '+(t.toPlace?'':'style="opacity:.45;margin-top:16px"')+'>Compare routes</button>'+
  (t.toPlace?'':'<p class="tiny sec center" style="margin-top:9px">Choose a destination to continue</p>')+'</div>');
};

function senseBars(bars){
  if(!bars) return '<p class="tiny sec">No sense data for this option.</p>';
  return '<div class="senses">'+Object.entries(bars).map(([k,b])=>
    '<div class="sense"><span class="sk">'+k+'</span><div class="bar sb">'+(b.pct==null?'<i class="nod"></i>':'<i style="width:'+b.pct+'%;background:var(--grad)"></i>')+'</div>'+
    '<span class="sw2">'+b.word+'</span></div>').join('')+'</div>';
}
function railLine(o){
  if(!o.rail) return "";
  const r = o.rail, l0 = r.legs[0];
  if(r.afterLast) return ' · <b style="color:var(--danger)">last train has already gone at this time</b>';
  const bits = [r.stops||l0.stops ? (r.stations||l0.stops)+" stops" : null,
                r.waitMin ? "about "+r.waitMin+" min wait" : null,
                r.changes ? "change at "+esc(r.legs[1].from) : "no change",
                r.lastTrain ? "last train "+r.lastTrain : null].filter(Boolean);
  return " · "+bits.join(" · ");
}
function legsRow(o){
  return '<div class="legs">'+o.legs.map((l,i)=>(i?'<span class="sep">'+ic("chev",12)+'</span>':'')+
    '<span class="leg" style="color:'+(LEG_COLORS[l.mode]||"var(--ink-2)")+'">'+ic(MODEICON[l.mode]||"route",16)+
    (l.mode==="metro"?(l.lines||[]).map(x=>'<b class="line">'+x+'</b>').join(''):'')+
    '<small>'+l.minutes+'</small></span>').join('')+'</div>';
}
V.routes = () => {
  const t = S.travel, R = t.result;
  const head = bar("Choose your route");
  if(t.err && !R) return shell(head+'<div class="pad"><div class="card p14">'+
    '<h4 style="font-size:15px">Could not compare routes</h4>'+
    '<p class="small sec" style="margin:6px 0 0">'+esc(t.err)+'</p>'+
    '<button class="btn" style="margin-top:12px" data-a="find">Try again</button>'+
    '<button class="btn ghost" style="margin-top:9px" data-a="back">Change the destination</button></div></div>');
  if(t.loading || !R) return shell(head+'<div class="pad">'+
    '<div class="skel map"></div>'+
    '<p class="small sec" style="margin:12px 0 10px">Finding routes, then checking light, activity, signal and help points along each one…</p>'+
    '<div class="skel card"></div><div class="skel card"></div><div class="skel card"></div></div>');
  const opts = R.options, sel = opts.find(o=>o.id===t.sel) || null;
  const fit = opts.flatMap(o=>o.coords);
  const routesOnMap = (sel?[sel]:opts).flatMap((o,i)=>o.legs.map(l=>({coords:l.route?l.route.coords:[], color:sel?LEG_COLORS[l.mode]:ROUTE_COLORS[opts.indexOf(o)%3],
    dashed:l.mode==="metro", selected: sel?true:undefined})));
  const ordered = R.pick ? [opts.find(o=>o.id===R.pick)].concat(opts.filter(o=>o.id!==R.pick)).filter(Boolean) : opts;
  const body = t.compare ? compareTable(opts) : ordered.map((o,i)=>routeCard(o,i,o.id===t.sel)).join('');
  return shell(head+
  '<div class="mapbox" style="height:210px;margin:0 20px;border-radius:12px;border:1px solid var(--line)">'+
    mapSVG({h:210, fit, dest:placeOf("to"), user:placeOf("from"),
            routes: (sel && S.travel.showLight) ? routesOnMap.filter(r=>r.dashed) : routesOnMap,
            lightSegs: sel && S.travel.showLight ? sel.legs.filter(l=>l.mode==="walk").flatMap(l=>lightSegments(l.route.coords, S.travel.at?atTime(S.travel.at):Date.now())) : []})+
    (sel&&S.travel.showLight?lightLegend():'')+osmCredit()+'</div>'+
  (sel?'<div class="pad" style="margin-top:8px">'+tgl("showlight","",S.travel.showLight,"Show street light on this route","Each 50 m coloured by phone readings, map tags and satellite")+'</div>':'')+
  '<div class="pad" style="margin-top:12px">'+
  '<p class="tiny" style="margin:0 0 8px;font-weight:600;color:var(--ink-2)">'+esc((placeOf("from")||{}).name||"Start")+' → '+esc(t.toPlace.name)+(t.at?' · leaving '+t.at:'')+'</p>'+
  '<div class="notice" style="margin-bottom:8px"><span>'+ic("eye",15)+'</span><span><b>'+esc(R.lead)+'</b>'+
    (R.warnings&&R.warnings.length?'<br>'+R.warnings.map(esc).join('<br>'):'')+'</span></div>'+
  modeGrid(opts, R)+
  (acts().length ? '<div class="tellbox">'+
    '<h3 style="font-size:16px;margin:0">Someone should know.</h3>'+
    '<p class="small" style="margin:5px 0 10px;color:var(--ink-2)">One message now: where you are headed, when you are due, and when to worry.</p>'+
    '<div class="chips">'+
      acts().map((c,i)=>'<button class="chip" data-a="tellpick" data-v="'+i+'" aria-pressed="'+(t.tell===i)+'">'+esc(c.n)+'</button>').join('')+
      '<button class="chip" data-a="tellpick" data-v="none" aria-pressed="'+(t.tell==="none")+'">Nobody tonight</button>'+
    '</div>'+
    (t.tell!=null && t.tell!=="none"
      ? '<p class="tiny" style="margin:9px 0 0;color:var(--plum);font-weight:600">'+esc(acts()[t.tell].n)+
        ' will get your due time the moment you start. If anything changes, I tell her before you go quiet.</p>'
      : t.tell==="none"
      ? '<p class="tiny sec" style="margin:9px 0 0">Nobody will be told for this trip. The agent still watches and SOS still works.</p>'
      : '')+
  '</div>' : '')+
  '<div class="between" style="margin-bottom:10px"><button class="btn line sm" data-a="go" data-v="how">'+ic("help",14)+'How we compare routes</button>'+
    '<button class="tgl mini" data-a="ctoggle" aria-pressed="'+!!t.compare+'"><span class="tiny" style="font-weight:600">Compare</span><span class="sw"></span></button></div>'+
  '<div style="display:flex;flex-direction:column;gap:9px">'+body+'</div>'+
  '<button class="btn" style="margin-top:14px'+(sel?'':';opacity:.45')+'" data-a="start">Start Journey</button>'+
  (S.offline?'<div class="notice" style="margin:10px 0 0"><span>'+ic("wifi-off",15)+'</span><span>Offline mode: this comparison uses what was saved'+(S.pack?' '+ago(S.pack.at):'')+'.</span></div>':'')+
  (R.refining ? '<p class="tiny sec center" style="margin-top:8px">Street lighting for this area is still loading; the comparison will sharpen in a moment.</p>' : '')+
  '<p class="tiny sec center" style="margin-top:8px;line-height:1.45">A comparison between these options, not a guarantee about any area.'+(R.sim?' Readings from other members are simulated for now.':'')+'</p>'+
  '</div><div style="height:14px"></div>');
};
function modeGrid(opts, R){
  const fastest = Math.min(...opts.map(o=>o.minutes));
  return '<div class="modegrid">'+opts.map(o=>{
    const pick = R.pick===o.id, on = S.travel.sel===o.id;
    return '<button class="mg'+(on?' on':'')+'" data-a="pick" data-v="'+o.id+'">'+
      (pick?'<span class="mgtag">Recommended</span>':'')+
      '<span class="mgi">'+o.legs.map(l=>ic(MODEICON[l.mode]||"route",15)).join('')+'</span>'+
      '<b>'+o.minutes+' min</b>'+
      '<small>'+(o.fare?'Rs. '+o.fare:'Free')+(o.minutes>fastest?' · +'+(o.minutes-fastest)+' min':'')+'</small>'+
      '</button>';
  }).join('')+'</div>';
}

/* Turn the short signal phrases into a sentence a person can read */
const PLACE_WORDS = {
  "pickup":"where you get picked up", "drop":"where you get dropped",
  "auto to station":"on the way to the station", "walk to station":"walking to the station",
  "auto from station":"on the way from the station", "walk from station":"walking from the station",
};
function readable(line){
  const parts = String(line).split(":").map(x=>x.trim()).filter(Boolean);
  const cond = parts.pop().toLowerCase()
    .replace(/\(phones\)/,"from phones nearby").replace(/\(map\)/,"from the map")
    .replace(/\(satellite\)/,"from satellite");
  const where = parts.map(x=>PLACE_WORDS[x.toLowerCase()] || x.toLowerCase()).pop();
  const verb = /^(no|few|none)/.test(cond) ? "" : "is ";
  if(!where) return cond.charAt(0).toUpperCase()+cond.slice(1);
  return where.charAt(0).toUpperCase()+where.slice(1)+" "+verb+cond;
}
function plainWhy(o){
  const seen = new Set();
  const uniq = list => (list||[]).map(readable).filter(t => !seen.has(t) && seen.add(t));
  const good = uniq(o.pros), bad = uniq(o.cons);
  const parts = [];
  if(good.length) parts.push("In its favour: "+good.slice(0,2).join(", and ").toLowerCase()+".");
  if(bad.length) parts.push("Worth knowing: "+bad.slice(0,2).join("; ").toLowerCase()+".");
  return parts.join(" ");
}

/* One line at the top of the card: why this option, or what it costs */
function headline(o){
  const R = S.travel.result; if(!R) return "";
  if(R.pick===o.id) return R.why;
  const win = R.options.find(x=>x.id===R.pick);
  if(!win) return "";
  const d = o.minutes - win.minutes;
  if(o.conditions!=null && win.conditions!=null && o.conditions > win.conditions + 4)
    return "Better conditions than the pick, but "+(d>0?d+" min slower":"it costs more")+".";
  if(d < 0) return Math.abs(d)+" min quicker, but conditions are weaker on this one.";
  return "Slower and no better on conditions than the recommended option.";
}

function routeCard(o,i,sel){
  const open = S.travel.open[o.id];
  const leave = o.leaveBy ? hm(o.leaveBy) : "";
  return '<div class="rr" aria-pressed="'+sel+'">'+
    '<button data-a="pick" data-v="'+o.id+'" style="width:100%;display:block">'+
    (S.travel.result && S.travel.result.pick===o.id ? '<span class="rectag">'+ic("check",12,2.6)+'Recommended</span>' : '')+
    '<div class="between" style="margin-bottom:6px"><div><h4 style="font-size:15px">'+esc(o.title)+'</h4>'+
    '<p class="tiny" style="margin:1px 0 0;font-weight:700;color:var(--ink-2)">'+confWord(o.confidenceLabel)+'</p></div>'+
    '<div style="text-align:right"><span class="score">'+o.minutes+'</span><span class="tiny sec"> min</span>'+
    '<p class="tiny sec" style="margin:0">'+(o.fare?'Rs. '+o.fare:'Free')+' · '+(o.metres/1000).toFixed(1)+' km</p></div></div>'+
    legsRow(o)+
    '<p class="tiny sec" style="margin:6px 0 0">Leave '+(leave?'at '+leave:'now')+railLine(o)+'</p>'+
    (o.offline ? '<p class="tiny" style="margin:4px 0 0;color:var(--purple);font-weight:600">Built on this phone from the streets you saved'+(o.route&&o.route.partial?' — the last '+o.route.lastGapM+' m are not mapped here':'')+'</p>' : '')+
    (o.estimateNote ? '<p class="tiny sec" style="margin:4px 0 0">'+esc(o.estimateNote)+'</p>' : '')+
    '<p class="why" style="margin:8px 0 0">'+esc(headline(o))+'</p>'+
    (plainWhy(o) ? '<p class="small sec" style="margin:5px 0 0;line-height:1.5">'+esc(plainWhy(o))+'</p>' : '')+
    (o.fix?'<p class="tiny why" style="margin-top:7px;color:var(--plum);font-weight:600"><span>'+ic("route",12,2.2)+'</span>'+esc(o.fix)+'</p>':'')+
    (open?'<div style="margin-top:9px">'+
      '<span class="lbl" style="margin-bottom:5px">What the readings said</span>'+
      o.pros.map(w=>'<p class="tiny why"><span style="color:var(--safe)">'+ic("check",12,2.6)+'</span>'+esc(w)+'</p>').join('')+
      o.cons.map(w=>'<p class="tiny why"><span style="color:var(--danger)">'+ic("sos",12,2.2)+'</span>'+esc(w)+'</p>').join('')+
      '<p class="tiny sec" style="margin:4px 0 0">'+esc(o.freshness||"")+'</p></div>':'')+
    '</button>'+
    '<div class="between" style="margin-top:8px;gap:8px">'+
      '<button class="btn line sm" data-a="senses" data-v="'+o.id+'">'+(open?'Hide':'See')+' the six senses</button>'+
      '<button class="btn line sm" data-a="askdest">'+ic("users",13)+'Ask Angels</button></div>'+
    (open?'<div style="margin-top:10px">'+senseBars(o.bars)+'</div>':'')+
  '</div>';
}
function compareTable(opts){
  const L = opts.map((o,i)=>String.fromCharCode(65+i));
  return '<div class="card p14">'+
    '<div class="rows" style="border:0">'+opts.map((o,i)=>'<div class="tiny" style="padding:2px 0"><b>'+L[i]+'</b> = '+esc(o.title)+' · '+o.minutes+' min · '+(o.fare?'Rs. '+o.fare:'Free')+'</div>').join('')+'</div>'+
    Object.keys(Scoring.SENSES).map(k=>'<div style="margin-top:10px"><p class="tiny" style="margin:0 0 4px;font-weight:700">'+k+'</p>'+
      opts.map((o,i)=>{ const b=o.bars&&o.bars[k];
        return '<div class="sense"><span class="sk">'+L[i]+'</span><div class="bar sb">'+(b&&b.pct!=null?'<i style="width:'+b.pct+'%;background:var(--grad)"></i>':'<i class="nod"></i>')+'</div><span class="sw2">'+(b?b.word:'no data')+'</span></div>'; }).join('')+'</div>').join('')+
    '<p class="tiny sec" style="margin:10px 0 0">Tap "Compare" again to pick a route.</p></div>';
}

V.style = () => {
  const picked = S.styleDraft || [];
  const n = picked.length;
  const row = k => { const p = PREF_SETS[k], on = picked.includes(k);
    return '<button class="strow'+(on?' on':'')+'" data-a="stylepick" data-v="'+k+'">'+
      '<span class="grow"><b>'+p.label+'</b>'+
      (S.styleInfo===k?'<small>'+esc(p.note)+'</small>':'')+'</span>'+
      '<span class="sinfo" data-a="styleinfo" data-v="'+k+'" role="button" aria-label="What this does">'+ic("help",17)+'</span>'+
      '<span class="stick">'+ic("check",14,3)+'</span></button>'; };
  return shell('<div class="top plain"><div class="grow"><h2>Your travel preferences</h2></div></div>'+
  '<div class="pad" style="padding-top:8px">'+
  '<p class="small sec" style="margin:0 0 14px">Choose your travel preferences to help us personalise your journey and tailor it exactly to your choice.</p>'+
  '<div class="strows">'+STYLE_ORDER.map(row).join('')+'</div>'+

  '<div class="row" style="gap:10px;margin:14px 0 6px">'+
    '<button class="btn ghost" style="flex:1" data-a="styleskip">Skip for now</button>'+
    '<button class="btn" style="flex:1.4" data-a="stylesave">Save my preferences</button></div>'+
  '<div style="height:10px"></div></div>'); };

V.instant = () => {
  const a = S.inst || {};
  return shell(bar("Instant Audit")+'<div class="pad" style="padding-top:10px">'+
  '<h3 style="font-size:17px;margin:2px 0 4px">Share your journey in your words</h3>'+
  '<p class="small sec" style="margin:0 0 10px">However you say it — English, हिंदी or Hinglish. Two lines is plenty.</p>'+
  '<div class="field"><textarea id="instw" data-b="inst.remark" rows="4" '+
    'placeholder="e.g. Lothian Road was pitch dark, koi nahi tha, dogs near the crossing">'+esc(a.remark||"")+'</textarea></div>'+

  '<h3 style="font-size:17px;margin:16px 0 4px">Show us the journey through your lens</h3>'+
  '<p class="small sec" style="margin:0 0 10px">One photo of the street helps other women more than any form.</p>'+
  (a.photo
    ? '<div class="card" style="overflow:hidden"><img src="'+a.photo+'" alt="Your photo" style="width:100%;display:block;max-height:220px;object-fit:cover">'+
      '<div class="row" style="padding:10px;gap:8px"><button class="btn line sm grow" data-a="instclear">Remove photo</button></div></div>'
    : '<label class="btn line" style="width:100%">'+ic("cam",17)+'Quick scan — take or choose a photo'+
      '<input id="instf" type="file" accept="image/*" hidden></label>')+

  (a.reading ? instResult(a) : '')+
  '<button class="btn" style="margin-top:14px'+((a.remark||a.photo)&&!a.busy?'':';opacity:.45')+'" data-a="instread">'+
    (a.busy ? "Reading…" : a.reading ? "Read again" : "Read my audit")+'</button>'+
  (a.reading ? '<button class="btn ghost" style="margin-top:9px" data-a="instsave">Submit this audit</button>' : '')+
  '<p class="tiny sec center" style="margin-top:10px;line-height:1.5">'+
    (a.photo ? 'Your photo is sent to be read, then discarded. It is never stored or shown to anyone. '
             : '')+'Only the conditions are saved, never anything about a person.</p>'+
  '<div style="height:16px"></div></div>'); };

function instResult(a){
  const r = a.reading;
  const chip = (label, val) => val ? '<span class="chip" aria-pressed="true" style="pointer-events:none">'+label+': '+val+'</span>' : '';
  return '<div class="card p14" style="margin-top:14px">'+
    '<span class="lbl">What we read</span>'+
    '<p style="margin:0 0 8px;font-size:14.5px;font-weight:600">'+esc(r.summary||"")+'</p>'+
    '<div class="chips" style="margin-bottom:8px">'+
      chip("light", r.light)+chip("people", r.people)+chip("shops", r.shops)+chip("path", r.path)+
      (r.dogs?'<span class="chip" aria-pressed="true" style="pointer-events:none">dogs</span>':'')+'</div>'+
    (r.unusual ? '<div class="notice" style="margin:8px 0 0"><span style="color:var(--mod)">'+ic("sos",15)+'</span>'+
      '<span><b>Unusual: '+esc(r.unusual.what)+'</b><br>Counted for '+
      Math.round(Instant.unusualLife(r.unusual)/3600000)+' hours and shown to women near here, not just on your routes.</span></div>' : '')+
    (r.targets_person ? '<p class="tiny" style="margin:8px 0 0;color:var(--danger)">This mentions a person. Only the place conditions will be saved; nothing about anyone is shared.</p>' : '')+
    '<p class="tiny sec" style="margin:8px 0 0">'+esc(r.why||"")+' · how sure: '+Math.round((r.confidence||0)*100)+'%. Correct anything by editing your words and reading again.</p>'+
  '</div>';
}

/* ---------------- The guardian's page ----------------
   One line, a countdown that runs on their own phone, and a reading of any
   silence. No map, no trail, no live position — this is not a tracking screen. */
V.watching = () => {
  const w = S.watching;
  if(!w || !w.data) return shell('<div class="top plain"><h2 class="grow">SixthSense</h2></div><div class="pad">'+
    '<div class="card p14"><h4>'+(w && w.error ? esc(w.error) : 'Opening…')+'</h4>'+
    '<p class="small sec" style="margin:6px 0 0">'+(w && w.error
      ? 'The link may have expired, or she has arrived and it was deleted.'
      : 'Reading her trip.')+'</p></div></div>');

  const d = w.data, now = Date.now();
  const verdict = readSilence(d, w.coverage, now);
  const tone = { fine:"safe", waiting:"mod", nudge:"mod", alarm:"danger" }[verdict.level];
  const mins = n => Math.max(0, Math.round(n/60000));

  return shell('<div class="top plain"><h2 class="grow">'+esc(d.name||"She")+'</h2></div>'+
  '<div class="pad">'+
  '<div class="status '+tone+'"><span class="pulse" style="background:var(--'+(tone==="danger"?"danger":tone==="mod"?"mod":"safe")+');color:var(--'+(tone==="danger"?"danger":tone==="mod"?"mod":"safe")+')"></span>'+
    '<div class="grow"><h4 style="color:var(--'+(tone==="danger"?"danger":tone==="mod"?"mod":"safe")+')">'+esc(verdict.headline)+'</h4>'+
    '<p class="small" style="margin:3px 0 0;color:var(--ink-2)">'+esc(verdict.line)+'</p></div></div>'+

  '<div class="card p14" style="margin-top:12px">'+
    '<div class="between"><span class="lbl" style="margin:0">Due</span><b>'+hm(new Date(d.dueAt))+'</b></div>'+
    '<div class="between" style="margin-top:6px"><span class="lbl" style="margin:0">Call if nothing by</span><b>'+hm(new Date(d.callByAt))+'</b></div>'+
    '<div class="between" style="margin-top:6px"><span class="lbl" style="margin:0">Last note</span><b>'+
      (d.lastSeen ? mins(now-d.lastSeen)+' min ago' : '—')+'</b></div>'+
  '</div>'+

  (verdict.evidence.length ? '<div class="card p14" style="margin-top:12px"><span class="lbl">What her phone last said</span>'+
    verdict.evidence.map(e=>'<p class="small" style="margin:4px 0 0;color:var(--ink-2)">'+esc(e)+'</p>').join('')+'</div>' : '')+

  (verdict.level==="alarm" ? '<a class="btn callbig" style="margin-top:12px" href="tel:112">'+ic("sos",20)+'Call 112</a>' : '')+
  '<p class="tiny sec center" style="margin-top:12px;line-height:1.5">This page shows no map and no live position. '+
  'It is deleted the moment she arrives.</p><div style="height:16px"></div></div>'); };

/* The reading itself. Everything here runs on the guardian's phone, because
   the free plan has no server timers. */
function readSilence(d, coverage, now){
  const gap = now - (d.lastSeen || d.startedAt || now);
  const quietFor = Math.round(gap/60000);
  const late = now > d.callByAt;
  const ev = [];
  if(d.battery != null) ev.push('Battery '+d.battery+'%.');
  if(d.signal != null) ev.push('Signal '+d.signal+' dBm.');
  if(d.moving != null) ev.push(d.moving ? 'She was walking.' : 'She was standing still.');
  if(d.onRoute === false) ev.push('She had left the planned route.');
  if(d.metresLeft != null) ev.push(Math.round(d.metresLeft)+' m still to go.');

  if(d.arrived) return { level:"fine", headline:"Home", line:"She reached "+(d.destName||"her destination")+".", evidence:[] };

  // notes still arriving
  if(gap < 150000){
    if(!late) return { level:"fine", headline:"Walking, due "+hm(new Date(d.dueAt)),
      line:"Her phone is reporting normally.", evidence:[] };
    return { level:"nudge", headline:"Late, but her phone is fine",
      line:"Still reporting, still moving. Being late is not an emergency — a message would do.", evidence:ev };
  }

  // the silence was predicted
  if(d.expect && now < (d.expect.to || 0) + 120000){
    const what = d.expect.kind === "battery"
      ? "Her phone said at "+hm(new Date(d.expect.at))+" that its battery was about to run out."
      : "Her phone said at "+hm(new Date(d.expect.at))+" that a no-signal stretch was coming.";
    return { level:"waiting", headline:"Quiet, and it was expected",
      line:what+" The silence was explained before it began. Wait.",
      evidence:[d.expect.detail].filter(Boolean).concat(ev) };
  }

  // unexplained: ask the street
  if(coverage && coverage.streetQuiet)
    return { level:"waiting", headline:"The street lost coverage",
      line:coverage.devices+" phones on that street went quiet at the same time. This is the area, not her.", evidence:ev };

  if(coverage && !coverage.streetQuiet)
    return { level:"alarm", headline:"Nothing for "+quietFor+" minutes",
      line:"Other phones on that street are still reporting, so the street has coverage. Her phone alone stopped. Call her now.",
      evidence:ev };

  // no other phones nearby: fall back to her last note
  if(d.battery != null && d.battery <= 10)
    return { level:"waiting", headline:"Quiet for "+quietFor+" minutes",
      line:"Her battery was "+d.battery+"% at the last note, so the phone most likely died. Wait a little.", evidence:ev };

  return { level:"alarm", headline:"Nothing for "+quietFor+" minutes",
    line:"No warning beforehand, and her phone was healthy at the last note. Call her now.", evidence:ev };
}

V.vouch = () => { const v = S.vouch, m = Store.me();
  return shell(bar("Vouching")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 14px">A vouch says "I know her." Two live vouches from Verified women lift a member a tier. '+
  'Whoever vouches carries the risk: if the person she vouched for is later found reporting falsely, her own reputation drops.</p>'+

  '<div class="card p14"><h4 style="font-size:15px">Ask someone to vouch for you</h4>'+
  '<p class="small sec" style="margin:5px 0 10px">Show this to a Verified woman standing with you. It lasts ten minutes.</p>'+
  (v.code
    ? '<div id="vqr" class="vqr"></div><p class="vcode">'+esc(v.code)+'</p>'+
      '<p class="tiny sec center" style="margin:6px 0 0">She can scan it, or type the six letters.</p>'+
      '<button class="btn line sm" style="margin-top:10px" data-a="vnew">New code</button>'
    : '<button class="btn'+(v.busy?' dim':'')+'" data-a="vnew">'+(v.busy?"Making a code…":"Show my code")+'</button>')+
  (v.have ? '<p class="tiny" style="margin:10px 0 0;color:var(--safe);font-weight:600">'+v.have.count+' live vouch'+(v.have.count===1?'':'es')+
    (v.have.from.length?' — from '+esc(v.have.from.join(", ")):'')+'</p>' : '')+
  '</div>'+

  '<div class="card p14" style="margin-top:12px"><h4 style="font-size:15px">Vouch for someone</h4>'+
  (m.canAngel
    ? '<p class="small sec" style="margin:5px 0 10px">Scan her code, or type the six letters she is showing you.</p>'+
      (v.scanning
        ? '<video id="vcam" playsinline muted style="width:100%;border-radius:14px;background:#000"></video>'+
          '<button class="btn ghost sm" style="margin-top:9px" data-a="vstop">Stop the camera</button>'
        : '<button class="btn line" data-a="vscan">'+ic("cam",16)+'Scan her code</button>')+
      '<div class="field" style="margin-top:10px"><label for="vc">Or type the code</label>'+
      '<input id="vc" data-b="vouch.typed" value="'+esc(v.typed||"")+'" placeholder="e.g. K7P2QM" '+
      'style="text-transform:uppercase;letter-spacing:.2em;font-weight:700" maxlength="6"></div>'+
      '<button class="btn'+((v.typed||"").length===6?'':' dim')+'" data-a="vcommit">Vouch for her</button>'+
      (v.given && v.given.length ? '<p class="tiny sec" style="margin:10px 0 0">You have vouched for '+
        esc(v.given.map(x=>x.forName).join(", "))+'. '+(Cloud.VOUCH_CAP - v.given.length)+' left this month.</p>' : '')
    : '<p class="small sec" style="margin:5px 0 0">Only a <b>Verified woman</b> can vouch. You are <b>'+m.tierLabel+'</b>.</p>')+
  '</div>'+
  (v.msg ? '<p class="small" style="margin-top:12px;color:'+(v.ok?'var(--safe)':'var(--danger)')+';font-weight:600">'+esc(v.msg)+'</p>' : '')+
  '<div style="height:16px"></div></div>'); };

V.permissions = () => {
  const rows = [
    ["loc","Location","Your route, when you go off it, when you arrive, and the link in an SOS message.","Kept on the phone. Shared only when you send an SOS, start a guardian trip, or accept an Angel."],
    ["walk","Movement","Whether you are still, walking, running, or the phone was jolted — that is what starts a check-in.","Never leaves the phone."],
    ["mic","Microphone","How busy a street sounds, and whether dogs are barking. The sound is turned into one number a second on the phone.","No audio is recorded, stored or uploaded. Ever."],
    ["cam","Camera","How lit the street is. One frame is measured for brightness and thrown away.","No image is stored or uploaded, except photos you choose to keep in an SOS."],
  ];
  return shell(bar("Before we start")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 14px">SixthSense asks for these only when a feature needs them. You can refuse any of them and the app still works — routes, the agent, guardians and SOS all keep running, with lower confidence in the street comparison.</p>'+
  '<div class="rows">'+rows.map(([i,t,use,keep])=>
    '<div class="rw" style="align-items:flex-start"><span style="color:var(--purple)">'+ic(i,18)+'</span>'+
    '<div class="grow"><h4>'+t+'</h4><p style="margin-top:2px">'+use+'</p>'+
    '<p class="tiny" style="margin-top:4px;color:var(--safe);font-weight:600">'+keep+'</p></div></div>').join('')+'</div>'+
  '<button class="btn" style="margin-top:16px" data-a="permsok">I understand — continue</button>'+
  '<button class="btn ghost" style="margin-top:9px" data-a="back">Not now</button>'+
  '<p class="tiny sec center" style="margin-top:10px">You can change any of this later in Settings → Privacy.</p></div>'); };

/* privacy page: what is read, what is kept, what is shared */
V.privacy = () => {
  const c = S.consentAt ? new Date(S.consentAt) : null;
  const row = (t,d) => '<div class="rw" style="align-items:flex-start"><div class="grow"><h4>'+t+'</h4><p style="margin-top:2px">'+d+'</p></div></div>';
  return shell(bar("Privacy")+'<div class="pad">'+
  '<div class="card p14" style="background:var(--wash)"><h4 style="font-size:14.5px">The short version</h4>'+
  '<p class="small" style="margin:5px 0 0;color:var(--ink-2)">Sound becomes a number. A camera frame becomes a brightness value. Both are thrown away immediately. Your location stays on the phone unless you send it. Street readings you share carry no name and expire after 2 hours.</p></div>'+
  '<div class="sect"><span class="lbl">What is read, and what is kept</span><div class="rows">'+
    row("Location","Read while a trip is on, or when you open the map. Kept on this phone. Sent only in an SOS message, a guardian trip you started, or an Angel session you accepted.")+
    row("Movement","Read during a trip to notice a long stop, a run or a jolt. Never leaves the phone.")+
    row("Sound","Understood on the phone by a model that runs here. One loudness number and one activity score per second. No audio is stored or uploaded.")+
    row("Camera light","One frame measured for brightness, then discarded. SOS photos are the only images kept, encrypted on the phone, deleted after 30 days.")+
    row("Street readings you share","A place and a few numbers, with no name or phone number. Used for 2 hours, then unusable.")+
    row("Your audits and Angel answers","Stored with your account so they can be confirmed. You can delete them below.")+
  '</div></div>'+
  '<div class="sect"><span class="lbl">What we never do</span>'+
  '<div class="card p14 small" style="line-height:1.55">Never sell or share location data · never keep a permanent rating of any area · never guess anyone\'s gender from a face or a name · never record audio or video · never label a street safe or unsafe.</div></div>'+
  '<div class="sect"><span class="lbl">Your choices</span>'+
  tgl("sharereadings","",S.shareReadings,"Share anonymous street readings","Numbers only, deleted after 2 hours. Turning this off does not affect your own routes.")+
  '<div style="margin-top:10px">'+tgl("preciseloc","",S.preciseLoc!==false,"Share exact location with guardians","Off means they see the area, not the street.")+'</div>'+
  (c?'<p class="tiny sec" style="margin-top:10px">You agreed to sensing on '+c.toLocaleDateString()+' at '+hm(c)+'.</p>':'')+
  '<button class="btn line" style="margin-top:12px" data-a="go" data-v="permissions">See what each sensor does</button>'+
  '</div>'+
  '<div class="sect"><span class="lbl">Delete</span>'+
  '<div class="card p14"><h4 style="font-size:14.5px">Delete my data</h4>'+
  '<p class="small sec" style="margin:5px 0 10px">Removes your audits, Angel answers and profile from the backend, and everything saved on this phone. This cannot be undone.</p>'+
  (S.delBusy?'<p class="small" style="margin:0">Deleting…</p>'
    :'<button class="btn" style="background:var(--danger)" data-a="delmine">Delete everything</button>')+
  '</div></div><div style="height:16px"></div></div>'); };

V.sources = () => {
  const L = Light.layers();
  const tagged = L.ways.length, lamps = L.lamps.length, help = Light.helpPoints().length;
  const row = (t,d,tag) => '<div class="rw" style="align-items:flex-start"><div class="grow"><h4>'+t+'</h4><p>'+d+'</p></div>'+
    (tag?tag:'')+'</div>';
  return shell(bar("What data we use")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 12px">Every number in this app comes from one of these. Where we have nothing, we say so rather than guessing.</p>'+
  '<h3 style="font-size:16px;margin-bottom:8px">Real</h3><div class="rows">'+
    row("Routes and streets","OpenStreetMap routing and map data, for any city",tag("Live","confirmed"))+
    row("Places and stations","OpenStreetMap search; station names from the DMRC network file",tag("Live","confirmed"))+
    row("Help points near you","Police, hospitals, clinics, pharmacies, metro, fuel — from OpenStreetMap"+(help?" · "+help+" loaded for this area":""),tag("Live","confirmed"))+
    row("Street lighting","OpenStreetMap <i>lit</i> tags and mapped street lamps"+(tagged||lamps?" · "+tagged+" roads tagged, "+lamps+" lamps here":"")+". Coverage is thin, which is why phone readings matter.",tag("Live","confirmed"))+
    row("Night light from satellite","NASA VIIRS day/night band, about 500 m cells, median of four clear nights",tag("Real","confirmed"))+
    row("Metro times and fares","DMRC timetable from Delhi Open Transit Data: lines, stops, typical waits, last trains. Delhi only.",tag("Real","confirmed"))+
    row("Auto and metro fares","DMRC slabs and Delhi auto rates; cab and fuel figures are estimates",tag("Real","confirmed"))+
    row("Your phone's senses","Battery, network, signal, GPS, movement, camera light, and sound understood on the phone (YamNet)",tag("On phone","confirmed"))+
    row("Your own trips","The travel-mode suggestion is learned on this phone from your past trips",tag("On phone","confirmed"))+
  '</div>'+
  '<h3 style="font-size:16px;margin:18px 0 8px">Simulated, and labelled everywhere it appears</h3><div class="rows">'+
    row("Other members' street readings","Generated for the demo, anchored to the real lighting, shops and transport of that place, and to the time of day",tag("Simulated","pending"))+
    row("Angel Nearby and Walk Together","Real when you are signed in: presence, requests and the live session are on the backend. Simulated only when signed out",tag("Live","confirmed"))+
    row("Low-signal stretches","A sample list, until enough real readings exist",tag("Simulated","pending"))+
    row("Face match in verification","The steps are real; the comparison itself is not built",tag("Simulated","pending"))+
    row("Demo walk","A scripted replay so the agent can be shown indoors",tag("Simulated","pending"))+
  '</div>'+
  '<h3 style="font-size:16px;margin:18px 0 8px">What we never do</h3>'+
  '<div class="card p14 small" style="line-height:1.55">Never label a street safe or unsafe · never store audio, photos or video from sensing · never guess anyone\'s gender from a face or a name · never keep a permanent rating of any area · never sell or share location data.</div>'+
  '<p class="tiny sec" style="margin-top:12px;line-height:1.5">OpenStreetMap contributors (ODbL). NASA VIIRS via NASA GIBS, public domain. DMRC static data via Delhi Open Transit Data. Metro timings are typical weekday times from that feed, not a live timetable.</p>'+
  '</div>');
};

V.how = () => shell(bar("How we compare routes")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 12px">Each route is split into 50 m pieces. Each piece is checked on six senses. We compare routes; we never label a street safe or unsafe.</p>'+
  '<div class="rows">'+[
    ["SEE","25","Light (phones, map tags, satellite), open surroundings, even lighting"],
    ["HEAR","20","Sound level, people and traffic heard (YamNet), open shops"],
    ["RUN","20","Footpath steadiness, how close help or transport is"],
    ["CALL","15","Signal strength and known low-signal stretches, staffed help within 200 m"],
    ["TRIBE","10","Verified people who passed recently"],
    ["GUT","10","Dog packs heard or reported"]
  ].map(([k,p,d])=>'<div class="rw" style="align-items:flex-start"><span class="tiny" style="width:46px;font-weight:700;color:var(--purple)">'+k+'</span>'+
    '<div class="grow"><h4>'+p+' points</h4><p>'+d+'</p></div></div>').join('')+'</div>'+
  '<div class="sect"><h3>Rules</h3><div class="card p14 small" style="line-height:1.55">'+
    '• Readings older than <b>2 hours</b> are ignored; newer ones count more.<br>'+
    '• <b>Missing data never counts as safe</b>: it lowers "How sure".<br>'+
    '• Light is not counted in daylight.<br>'+
    '• Claims that make a route look better count only after <b>women-verified members or phone sensors</b> confirm them.<br>'+
    '• Each extra minute costs a little; a route is named only if it leads clearly.<br>'+
    '• The weakest stretch is always mentioned.</div></div>'+
  '<div class="sect"><div class="between" style="margin-bottom:8px"><h3>Data sources</h3>'+
    '<button class="btn line sm" data-a="go" data-v="sources">See all sources</button></div><div class="card p14 small" style="line-height:1.55">'+
    'Routes, streets and help points: OpenStreetMap. Night light: NASA VIIRS (area level). Street readings: phones of verified members '+
    '<b>(simulated until real members join)</b>. Low-signal stretches: simulated for now. Metro times and last trains: the real DMRC timetable.</div></div>'+
  '<div class="sect"><h3>Never</h3><div class="card p14 small" style="line-height:1.55">No safe/unsafe labels · no stored ranking of areas · no audio, photos or video stored · gender never guessed.</div></div>'+
  '<div style="height:16px"></div></div>');

V.journey = () => {
  const a = Agent.state, t = S.travel, o = t.active;
  if(!a.trip && o && a.cards.length) return shell(bar("Trip finished",{noBack:true})+'<div class="pad">'+
    '<div class="status safe"><span class="pulse" style="background:var(--safe);color:var(--safe)"></span><div class="grow">'+
    '<h4 style="font-size:15px;color:var(--safe)">'+(a.cards.some(c=>c.id==="reached")?"You reached "+esc(t.toPlace.name):"Trip ended")+'</h4>'+
    '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">The agent has stopped watching this trip.</p></div></div>'+
    '<div class="sect"><h3>What the agent did</h3><div class="timeline">'+a.cards.map(agentCardItem).join('')+'</div></div>'+
    (Store.me().tier!=="none"?'<button class="btn" style="margin-top:14px" data-a="new">Audit this route</button>':'')+
    '<button class="btn ghost" style="margin-top:9px" data-a="tripdone">Done</button></div><div style="height:14px"></div>');
  if(!a.trip || !o) return shell(bar("Journey")+'<div class="hero"><p class="small sec">No journey running.</p>'+
    '<button class="btn" data-a="tmode">Plan a trip</button></div>');
  const u = userPos();
  const loc = Context.locateOnRoute(o.route.coords, u.lat, u.lng);
  const p = loc.totalM ? Math.min(100, Math.round(100*loc.alongM/loc.totalM)) : 0;
  const b = a.battery;
  const rem = b ? b.needMin : o.minutes;
  const askCard = a.cards.find(c=>c.kind==="ask");
  const promiseCard = a.cards.find(c=>c.kind==="ask-contact");
  const cards = a.cards.filter(c=>c.kind!=="ask" && c.kind!=="ask-contact");
  return '<div class="scroll fade">'+bar("Journey Active",{noBack:true,right:a.replaying?tag("Demo walk","soft"):""})+
  '<div class="mapbox" style="height:220px;margin:0 20px;border-radius:12px;border:1px solid var(--line)">'+
    mapSVG({h:220, fit:o.coords, routes:o.legs.map(l=>({coords:l.route?l.route.coords:[], color:LEG_COLORS[l.mode], dashed:l.mode==="metro", selected:true})), dest:t.toPlace, user:u})+
    '<div class="mchip"><span style="color:var(--safe)">●</span> '+(a.replaying?"Demo walk":"Tracking")+'</div>'+osmCredit()+'</div>'+
  '<div class="pad" style="margin-top:13px">'+
  (promiseCard?'<div class="promisebox">'+
    '<h3 style="font-size:16px">'+esc(promiseCard.title)+'</h3>'+
    '<p class="small" style="margin:5px 0 10px;color:var(--ink-2)">'+esc(promiseCard.body)+'</p>'+
    '<div class="row" style="flex-wrap:wrap;gap:7px">'+
      (promiseCard.actions||[]).map((x,i)=>'<a class="btn sm" href="'+esc(x.href)+'" data-a="told" data-v="'+i+'">'+esc(x.label)+'</a>').join('')+
      '<button class="btn sm line" data-a="told" data-v="none">Nobody this time</button></div></div>':'')+
  '<div class="card p14" style="margin-bottom:12px">'+
    tgl("watched","",(S.watch&&S.watch.on),"Watched mode",
      "Your phone leaves a short note on the server every couple of minutes — battery, signal, moving, roughly where. "+
      "Whoever holds the link can tell what a silence means, even if your phone is gone. Deleted when you arrive.")+
    (S.watch && S.watch.on && S.watch.link
      ? '<div class="row" style="gap:8px;margin-top:10px">'+
        '<a class="btn line sm grow" href="'+esc(Agent.smsHref((S.user.name||"I")+" is walking to "+esc(t.toPlace?t.toPlace.name:"my destination")+". Follow it here: "+S.watch.link, "primary"))+'">Send the link</a>'+
        '<button class="btn ghost sm" data-a="copywatch">Copy</button></div>'
      : '')+
  '</div>'+
  (askCard?'<div class="askbox"><h3>Are you okay?</h3><p class="small">'+esc(askCard.body)+'</p>'+
    '<p class="tiny">If you don\'t answer, I will alert your guardians.</p><div class="opts">'+
    askCard.options.map(x=>'<button data-a="answer" data-v="'+x.answer+'" class="'+(x.answer===3?'d':'')+'">'+x.label+'</button>').join('')+'</div></div>':'')+
  '<div class="card p14">'+
    '<div class="between" style="margin-bottom:10px"><div><p class="tiny sec" style="margin:0;font-weight:600">'+esc(o.title)+'</p>'+
    '<h4 style="font-size:15px">'+esc((placeOf("from")||{}).name || S.hereName || "Start")+' → '+esc(t.toPlace.name)+'</h4></div>'+
    '<div style="text-align:right"><h4 class="gradtext" style="font-size:21px">'+rem+' min</h4><p class="tiny sec" style="margin:0">left</p></div></div>'+
    '<div class="bar"><i style="width:'+p+'%;background:var(--grad)"></i></div>'+
    '<div class="between" style="margin-top:7px"><span class="tiny sec">'+p+'% complete</span><span class="tiny sec">'+(o.metres/1000).toFixed(1)+' km</span></div>'+
    (b?'<p class="tiny sec" style="margin:8px 0 0">Battery '+b.level+'% · lasts ~'+b.full+' min at full power, '+b.eco+' saving, '+b.critical+' critical'+(b.measured?'':' (typical rates)')+'</p>':'')+
  '</div>'+
  '<div class="rows" style="margin-top:11px">'+
    '<div class="rw"><span class="dot" style="background:var(--safe)"></span><div class="grow"><h4>SixthSense Agent active</h4><p>Watching battery, signal and movement · messages by '+(a.channel==="sms"?"SMS":"app or SMS")+'</p></div></div>'+
    (S.guardians.active
      ?'<button class="rw" data-a="go" data-v="guardians"><span class="dot" style="background:var(--safe)"></span><div class="grow"><h4>Guardians informed</h4><p>'+glist()+'</p></div>'+ic("chev",16)+'</button>'
      :'<button class="rw" data-a="go" data-v="guardians"><span class="dot" style="background:var(--ink-3)"></span><div class="grow"><h4>Guardians not informed</h4><p>Let your family follow this trip</p></div>'+ic("chev",16)+'</button>')+
    '<button class="rw" data-a="go" data-v="needangel"><span class="dot" style="background:var(--purple)"></span><div class="grow"><h4>Need an Angel?</h4><p>A verified woman nearby can stay with you</p></div>'+ic("chev",16)+'</button>'+
  '</div>'+
  '<div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost sm" style="flex:1" data-a="replay">'+(a.replaying?"Stop demo walk":"Play demo walk")+'</button>'+
    '<button class="btn ghost sm" style="flex:1" data-a="showqr">Help QR</button></div>'+
  '<div class="sect"><h3>What the agent did</h3>'+(cards.length?'<div class="timeline">'+cards.map(agentCardItem).join('')+'</div>':'<p class="small sec">Nothing yet.</p>')+'</div>'+
  '<button class="btn" style="margin-top:14px;background:var(--danger)" data-a="end">End Journey</button></div><div style="height:14px"></div></div>';
};
function agentCardItem(c){
  const tagTxt = {act:"Done for you", suggest:"Suggestion", alert:"Needs you now", info:""}[c.kind]||"";
  return '<div class="tl '+c.kind+'"><div class="between"><span class="tiny" style="font-weight:700;color:'+(c.kind==="alert"?"var(--danger)":"var(--ink-3)")+'">'+tagTxt+'</span>'+
    '<span class="tiny sec">'+hm(new Date(c.t))+'</span></div>'+
    '<h4 style="font-size:14px;margin:2px 0 3px">'+esc(c.title)+'</h4><p class="tiny" style="margin:0;color:var(--ink-2);line-height:1.45">'+esc(c.body||"")+'</p>'+
    (c.list&&c.list.length?'<ol class="tiny" style="margin:6px 0 0;padding-left:18px">'+c.list.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>':'')+
    (c.kind==="ask-contact"
      ? '<div class="row" style="flex-wrap:wrap;gap:7px;margin-top:9px">'+
        (c.actions||[]).map((x,i)=>'<a class="btn sm" style="flex:1 1 auto" href="'+esc(x.href)+'" data-a="told" data-v="'+i+'">'+esc(x.label)+'</a>').join('')+
        '<button class="btn sm line" data-a="told" data-v="none">Nobody this time</button></div>'
      : '')+
    (c.actions && c.kind!=="ask-contact" ?'<div class="row" style="flex-wrap:wrap;gap:7px;margin-top:8px">'+c.actions.map(x=>
      x.body ? smsBtn(x.label, x, c.kind==="alert"?"danger":"") :
      x.href ? '<a class="btn sm '+(c.kind==="alert"?"danger":"")+'" href="'+x.href+'">'+x.label+'</a>' :
      '<button class="btn sm line" data-a="'+(x.run==="showQr"?"showqr":x.run==="replan"?"tmode":"noop")+'">'+x.label+'</button>').join('')+'</div>':'')+
  '</div>';
}
const glist = () => { const on=[S.guardians.sms&&"SMS",S.guardians.voice&&"Voice call",S.guardians.camera&&"Camera"].filter(Boolean);
  return on.length?on.join(" · ")+" on":"No modes on"; };

/* ---------------- audit ---------------- */
V.agate = () => shell(bar("Audit")+'<div class="hero">'+
  '<span style="color:var(--purple)">'+ic("vf",50,1.3)+'</span>'+
  '<h2 style="font-size:21px">Audits need a verified account</h2>'+
  '<p class="small sec" style="max-width:32ch">Verification decides how much your audit counts for other women, never what you can use.</p>'+
  '<div style="width:100%;display:flex;flex-direction:column;gap:9px;margin-top:16px">'+
  '<button class="btn" data-a="go" data-v="verify">Verify Now</button>'+
  '<button class="btn ghost" data-a="back">Go Back</button></div></div>');

const QPTS = {light:25,crowd:20,gender:10,cctv:10,shops:10,path:20,dogs:5,gut:10};
const OPTS = {
  crowd:["Very crowded","Moderately crowded","Comfortable","Quiet","Very isolated"],
  gender:["Mostly men","Fairly diverse","Mostly women","Mostly children","Mostly elderly"],
  cctv:["Yes","No","Not sure"],
  shops:["Mostly Open","Some Open","Mostly Closed","No Shops Nearby"],
  path:["Very Safe","Safe","Moderate","Unsafe","Very Unsafe"],
  tags:["Too many obstacles","Poor pathway","Isolated path"],
  dogs:["None","Few","Several","Many"]
};
const fromPhoto = k => (S.audit.filled && S.audit.filled[k])
  ? '<span class="fromphoto">'+ic("cam",11,2.4)+'from your photo</span>' : '';
function qhead(label, key, q){
  return '<div class="between" style="margin-bottom:3px"><span class="lbl">'+label+fromPhoto(key)+'</span>'+
    '<span class="tiny" style="font-weight:700;color:var(--pink)">'+QPTS[key]+' pts</span></div>'+
    '<h4 style="font-size:15px;margin:0 0 10px">'+q+'</h4>';
}
const qBlock = (label,key,q,opts) => '<div class="sect">'+qhead(label,key,q)+'<div class="chips">'+
  opts.map(o=>'<button class="chip" data-a="opt" data-v="'+key+'|'+o+'" aria-pressed="'+(S.audit[key]===o)+'">'+o+'</button>').join('')+'</div></div>';

V.audit = () => shell(
  '<div style="min-height:100%;display:flex;flex-direction:column">'+
  '<div class="top plain" style="padding-bottom:4px"><h2 class="grow">Audit</h2>'+
  '<button class="btn line sm" data-a="drawer">History</button></div>'+
  '<div class="hero grow" style="justify-content:center">'+
    '<h2 style="font-size:20px">One tap, one safer street.</h2>'+
    '<p class="small sec">Be the street hero Delhi needs.</p>'+
    '<button class="bigact" data-a="new"><span>'+ic("plus",26,2)+'</span><b>Create<br>New Audit</b></button>'+
    '<button class="btn ghost" style="width:auto;margin-top:16px;padding:12px 20px" data-a="quick">'+ic("cam",18)+'Quick audit with a photo</button>'+
    '<p class="tiny sec" style="margin-top:6px">Take one now or pick one from your gallery — your phone will ask.</p>'+
  '</div>'+
  '<div class="pad" style="margin-top:6px"><div class="row" style="gap:10px">'+
    '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 2px;font-weight:600">Points</p>'+
    '<h3 class="gradtext" style="font-size:22px">'+S.points+'</h3></div>'+
    '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 2px;font-weight:600">Audits</p>'+
    '<h3 class="gradtext" style="font-size:22px">'+S.logged+'</h3></div></div></div>'+
  '<div style="height:18px"></div></div>', true)+
  (S.drawer?drawer():'');

function drawer(){
  return '<div class="scrim" data-a="drawer"></div><div class="drawer fade">'+
    '<div class="top plain"><h2 class="grow" style="font-size:17px">My Past Audits</h2>'+
    '<button class="icb" data-a="drawer" aria-label="Close">'+ic("chev",17)+'</button></div>'+
    '<div class="scroll"><div class="pad">'+(S.audits.length?'<div class="rows">'+S.audits.map((a,i)=>
      '<button class="rw" data-a="adet" data-v="'+i+'" style="align-items:flex-start">'+
      '<span class="av s" style="background:var(--wash);color:var(--purple)">'+ic("doc",16)+'</span>'+
      '<div class="grow"><div class="between"><h4>'+a.loc+'</h4>'+
      '<span class="tiny" style="font-weight:700;color:var(--pink)">+'+a.pts+'</span></div>'+
      '<p style="margin-top:2px">'+a.sum+'</p><p class="tiny sec" style="margin-top:3px">'+a.d+' '+statusTag(auditStatus(a))+'</p></div></button>').join('')+'</div>'
      :'<div class="card p14 center"><p class="small sec" style="margin:0 0 10px">No audits yet. Your first one appears here.</p>'+
       '<button class="btn sm" data-a="new">Create an audit</button></div>')+
    '</div></div></div>';
}
V.adet = () => { const a = S.audits[S.di], r = a.reportId ? Store.reports().find(x=>x.id===a.reportId) : null, st = auditStatus(a);
  return shell(bar("Audit details")+'<div class="pad"><div class="card p14">'+
  '<p class="tiny sec" style="margin:0 0 3px;font-weight:600">'+a.d+'</p>'+
  '<h3 style="font-size:17px">'+a.loc+'</h3>'+
  '<p class="small" style="margin:8px 0 0;color:var(--ink-2)">'+a.sum+'</p>'+
  '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><span class="chip" style="pointer-events:none">+'+a.pts+' safety points</span>'+statusTag(st)+'</div></div>'+
  (r?'<div class="rows" style="margin-top:12px">'+
    '<div class="rw"><div class="grow"><h4>Type of report</h4><p>'+
      (st==="confirmed" ? (r.polarity==="positive"?"Makes the place look better: confirmed, so it counts in full":"Warning: confirmed, so it counts in full")
       : st==="rejected" ? "Not confirmed by the local check, so it is not used"
       : r.polarity==="positive" ? "Makes the place look better: counts only after women-verified members or phone sensors confirm it"
       : "Warning: counts at reduced weight until confirmed")+'</p></div></div>'+
    '<div class="rw"><div class="grow"><h4>Your trust</h4><p>'+Store.TIERS[r.tier].label+' · counts '+Math.round(r.trust*100)+'%</p></div></div>'+
    (r.confirmations.length?'<div class="rw"><div class="grow"><h4>Confirmed by</h4><p>'+r.confirmations.map(c=>Store.TIERS[c.tier].label+(c.sim?' (simulated)':'')).join(', ')+'</p></div></div>':'')+
    (r.votes?'<div class="rw"><div class="grow"><h4>Local check</h4><p>'+r.votes.map(v=>Store.TIERS[v[0]].label+': '+v[1]).join(' · ')+'</p></div></div>':'')+
  '</div>'+(st==="confirmed"||st==="pending"?'<button class="btn ghost" style="margin-top:12px" data-a="dispute" data-v="'+r.id+'">Report this as wrong (demo)</button>':''):'')+
  '<p class="tiny sec" style="margin-top:14px;line-height:1.5">Audits count for route comparisons for two hours, so no lane carries a permanent rating. Photos stay on your phone.</p></div>'); };
const auditStatus = a => { if(!a.reportId) return a.status||"confirmed"; const r = Store.reports().find(x=>x.id===a.reportId); return r ? r.status : "confirmed"; };
const statusTag = st => tag({confirmed:"Confirmed",pending:"Pending",disputed:"Being checked",rejected:"Not confirmed"}[st]||st, st);

V.new = () => {
  const a = S.audit;
  const stars = (k,lbls) => '<div class="stars">'+[1,2,3,4,5].map(n=>
    '<button class="star '+(a[k]>=n?'on':'')+'" data-a="star" data-v="'+k+'|'+n+'" aria-label="'+n+' of 5">'+ic("star",18,1.6)+'</button>').join('')+'</div>'+
    (a[k]?'<p class="tiny" style="margin:7px 0 0;font-weight:600;color:var(--purple)">'+lbls[a[k]]+'</p>':'');
  return shell(bar("New Audit")+'<div class="pad">'+
  '<div class="card p14"><div class="row"><span style="color:var(--purple)">'+ic("pin",18)+'</span>'+
  '<div class="grow"><h4 style="font-size:14px">'+esc(auditPlace().name)+'</h4>'+
  '<p class="tiny sec" style="margin:2px 0 0">'+auditPlace().how+' · your trust: '+Store.me().tierLabel+'</p></div></div></div>'+
  (a.busy ? '<div class="card p14" style="margin-top:12px"><p class="small" style="margin:0">Reading your photo…</p></div>' : '')+
  (a.reading && !a.busy ? '<div class="card p14" style="margin-top:12px">'+
    '<span class="lbl">Read from your photo</span>'+
    '<p style="margin:0 0 6px;font-size:14px;font-weight:600">'+esc(a.reading.summary||"")+'</p>'+
    (a.reading.unusual ? '<p class="tiny" style="margin:0 0 6px;color:var(--mod);font-weight:700">Unusual: '+esc(a.reading.unusual.what)+'</p>' : '')+
    '<p class="tiny sec" style="margin:0">'+esc(a.reading.why||"")+'. Answers below are filled in for you — change any of them.'+
    (a.sensorAgrees ? ' <b style="color:var(--safe)">Your phone\'s own light reading agrees, so this audit confirms straight away.</b>'
      : (LIVE.cam.bright == null && LIVE.cam.lux == null && Store.me().tier !== "gold" && Store.me().tier !== "partner"
         ? ' <b>Your phone\'s light sensor is off, so this audit waits for another member to agree.</b>' : ''))+'</p>'+
  '</div>' : '')+
  '<div class="sect">'+qhead("Lighting","light","How well-lit was the area?")+stars("light",LIGHTS)+'</div>'+
  qBlock("Crowd","crowd","How was the crowd?",OPTS.crowd)+
  qBlock("Gender diversity","gender","Who was around you?",OPTS.gender)+
  qBlock("CCTV","cctv","Did you notice CCTV cameras?",OPTS.cctv)+
  qBlock("Shops &amp; activity","shops","Were nearby shops open?",OPTS.shops)+
  qBlock("Path safety","path","How safe did the path feel?",OPTS.path)+
  '<div style="margin-top:10px"><p class="tiny sec" style="margin:0 0 7px">Any of these? (optional)</p><div class="chips">'+
    OPTS.tags.map(t=>'<button class="chip" data-a="tag" data-v="'+t+'" aria-pressed="'+(a.tags.indexOf(t)>-1)+'">'+t+'</button>').join('')+'</div></div>'+
  qBlock("Dogs &amp; animals","dogs","Did you encounter dogs or animals?",OPTS.dogs)+
  '<div class="sect">'+qhead("Gut feeling","gut","What did your gut feeling say?")+
    '<p class="tiny sec" style="margin:-6px 0 10px">Your personal perception, kept separate from measured signals.</p>'+stars("gut",SCALE)+'</div>'+
  '<div class="sect"><span class="lbl">Remarks</span>'+
    '<div class="field" style="margin-top:7px"><textarea id="ar" rows="3" data-b="audit.remark" placeholder="Anything else you noticed?">'+a.remark+'</textarea></div></div>'+
  '<div class="sect"><span class="lbl">Photo</span>'+
    (a.photo?'<div class="card" style="overflow:hidden;margin-top:8px"><img src="'+a.photo+'" alt="Photo you added" style="width:100%;display:block;max-height:200px;object-fit:cover">'+
      '<button class="btn ghost sm" style="margin:10px;width:calc(100% - 20px)" data-a="rmph">Remove photo</button></div>'
     :'<label class="btn line" style="margin-top:8px">'+ic("cam",18)+'Add Photo<input id="aph" type="file" accept="image/*" hidden></label>'+
       '<p class="tiny sec center" style="margin:6px 0 0">Your phone will offer camera or gallery, and ask for permission if you choose the camera.</p>')+'</div>'+
  '<button class="btn" style="margin-top:20px" data-a="submit">Submit Audit</button>'+
  '<p class="tiny sec center" style="margin-top:9px">'+(["gold","partner"].includes(Store.me().tier)?'Your tier confirms this report straight away.':'Your report is checked by other verified women before it improves any route.')+' Photos stay on your phone.</p></div><div style="height:16px"></div>');
};
V.done = () => '<div class="scroll fade" style="display:flex;flex-direction:column;justify-content:center;padding:30px 26px">'+
  '<div class="center" style="display:flex;flex-direction:column;align-items:center;gap:14px">'+
  '<span style="width:70px;height:70px;border-radius:50%;display:grid;place-items:center;background:var(--grad);color:#fff">'+ic("check",32,2.6)+'</span>'+
  '<h2 style="font-size:23px">Audit logged</h2>'+
  '<p class="small sec" style="max-width:28ch">Thank you for helping make the city safer.</p>'+statusTag(S.lastReportStatus||"pending")+'</div>'+
  '<div class="row" style="gap:10px;margin-top:24px">'+
  '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 2px;font-weight:600">Safety Points</p><h3 class="gradtext" style="font-size:25px">'+S.points+'</h3></div>'+
  '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 2px;font-weight:600">Audits Logged</p><h3 class="gradtext" style="font-size:25px">'+S.logged+'</h3></div></div>'+
  '<button class="btn" style="margin-top:22px" data-a="tab" data-v="home">Back to Home</button></div>';

function auditPlace(){
  const t = S.travel;
  if(t.toPlace && t.lastTripAt && Date.now()-t.lastTripAt < 2*3600000) return {name:(placeOf("from")||{}).name+" → "+t.toPlace.name, how:"From your last journey", lat:t.toPlace.lat, lng:t.toPlace.lng};
  if(LIVE.geo.lat!=null) return {name:"Where you are now", how:"From your location (±"+Math.round(LIVE.geo.acc)+" m)", lat:LIVE.geo.lat, lng:LIVE.geo.lon};
  return {name:"Current location", how:"Waiting for a location fix", lat:HOME.lat, lng:HOME.lng};
}

/* ---------------- explore / share / guardians ---------------- */
const EXPLORE = {"Police & Hospitals":["police","hospital","clinic"],"Metro & Bus":["metro","bus stop","station"],"Shops & Pharmacies":["shop","pharmacy"],"Fuel stations":["fuel"]};
V.explore = () => {
  const u = userPos();
  if(S.cat){
    const l = helpList(u, 5000).filter(p=>EXPLORE[S.cat].includes(p.kind))
      .map(p=>({...p, d:SensorHub.distanceM(u.lat,u.lng,p.lat,p.lng)})).sort((a,b)=>a.d-b.d).slice(0,8);
    return shell(bar(S.cat)+'<div class="mapbox" style="height:200px;margin:0 20px;border-radius:12px;border:1px solid var(--line)">'+
      mapSVG({h:200, fit:l.map(p=>[p.lng,p.lat]).concat([[u.lng,u.lat]]), pins:l, user:u})+osmCredit()+'</div><div class="pad" style="margin-top:12px"><div class="rows">'+
      (S.areaLoading?'<div class="rw"><p>Looking for places near you…</p></div>':'')+
      (l.length?l.map(p=>'<div class="rw"><span class="dot" style="background:var(--purple)"></span><div class="grow"><h4>'+esc(p.name)+'</h4>'+
        '<p>'+Math.round(p.d)+' m · '+p.kind+(p.hours?' · '+esc(p.hours):'')+'</p></div>'+
        '<a class="btn line sm" href="'+navUrl(p)+'" target="_blank" rel="noopener">Navigate</a></div>').join('')
        :(S.areaLoading?'':'<div class="rw"><p>Nothing of this kind is mapped nearby. <button class="linkbtn" data-a="retryarea">Try again</button></p></div>'))+
      '</div><button class="btn ghost" style="margin-top:13px" data-a="allcat">All categories</button>'+
      '<p class="tiny sec center" style="margin-top:8px">Places from OpenStreetMap contributors. Opening hours only where tagged.</p></div>');
  }
  return shell(bar("Explore Nearby")+'<div class="pad">'+
    '<p class="small sec" style="margin:0 0 15px">Staffed and open places around you, for help or a safe wait.</p>'+
    '<div class="tiles">'+[["police","Police & Hospitals","t-sos"],["metro","Metro & Bus","t-audit"],["food","Shops & Pharmacies","t-help"],["car","Fuel stations","t-travel"]]
    .map(([i,t,c])=>'<button class="tile '+c+'" data-a="cat" data-v="'+t+'"><span class="ti">'+ic(i,19)+'</span><h4 style="font-size:14.5px">'+t+'</h4></button>').join('')+'</div></div>');
};
const navUrl = p => "https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lng+"&travelmode=walking";

V.share = () => {
  const cs = acts();
  if(S.share.active) return shell(bar("Live location")+'<div class="pad">'+
    '<div class="status safe"><span class="pulse" style="background:var(--safe);color:var(--safe)"></span>'+
    '<div class="grow"><h4 style="font-size:15px;color:var(--safe)">Live location shared</h4>'+
    '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">Sharing with '+S.share.with.length+' contact'+(S.share.with.length===1?'':'s')+'</p></div></div>'+
    '<div class="rows" style="margin-top:13px">'+S.share.with.map(n=>'<div class="rw"><span class="av s">'+ini(n)+'</span>'+
    '<div class="grow"><h4>'+n+'</h4><p>Can see your live location</p></div><span class="dot" style="background:var(--safe)"></span></div>').join('')+'</div>'+
    '<div class="notice" style="margin-top:13px"><span>'+ic("shield",15)+'</span><span>Your contacts get a map link by SMS now; live updates start when the backend is connected.</span></div>'+
    '<div style="margin-top:10px">'+smsBtn("Send my location now", shareSms(), "")+'</div>'+
    '<button class="btn" style="margin-top:13px;background:var(--danger)" data-a="stopshare">Stop Sharing</button></div>');
  return shell(bar("Share your location")+'<div class="pad">'+
    '<p class="small sec" style="margin:0 0 15px">Choose who should be able to see your live location.</p>'+
    (cs.length?'<div class="rows">'+cs.map(c=>{ const on=S.share.with.indexOf(c.n)>-1;
      return '<button class="rw" data-a="tsh" data-v="'+c.n+'"><span class="av s">'+ini(c.n)+'</span>'+
      '<div class="grow"><h4>'+c.n+'</h4><p>'+c.p+'</p></div>'+
      '<span style="width:22px;height:22px;border-radius:6px;display:grid;place-items:center;border:1.5px solid '+(on?'transparent':'var(--line-2)')+
      ';background:'+(on?'var(--grad)':'transparent')+';color:#fff">'+(on?ic("check",13,3):'')+'</span></button>'; }).join('')+'</div>'
     :'<div class="card p14 center"><p class="small sec" style="margin:0">Add a trusted contact first.</p>'+
      '<button class="btn line sm" style="margin:11px auto 0" data-a="go" data-v="contacts">Add contacts</button></div>')+
    (cs.length?'<button class="btn" style="margin-top:15px" data-a="dosh" '+(S.share.with.length?'':'style="opacity:.45;margin-top:15px"')+'>Share Live Location</button>':'')+'</div>');
};
const shareSms = () => { const u = userPos(); const body = "I'm sharing my location: https://maps.google.com/?q="+u.lat.toFixed(5)+","+u.lng.toFixed(5)+" (SixthSense)";
  const nums = acts().filter(c=>S.share.with.indexOf(c.n)>-1).map(c=>c.p.replace(/\s/g,""));
  return {body, numbers:nums, href:"sms:"+nums.join(",")+(Native.isApp?"?body=":"?body=")+encodeURIComponent(body)}; };

V.guardians = () => shell(bar("Guardians")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 12px">Guardians are the family members you choose. Choose how they are kept informed during your journeys. The SixthSense Agent does the watching; guardians are who it tells.</p>'+
  '<div class="rows">'+
  [["sms","sms","SMS Guardian","Updates by SMS: trip started, check-ins before low-signal stretches, \"feeling uneasy\", alerts if you don't respond, last message at 4% battery, reached. Works without internet."],
   ["voice","mic","Voice Guardian","If you are in danger or don't respond, your first guardian is called on speaker so they can hear and talk to you. Optional 30-second clip for guardians only. Never continuous listening."],
   ["camera","cam","Camera Guardian","On SOS only: a few photos with your location, for guardians only. Encrypted, deleted after 30 days unless you keep them."]].map(([k,i,t,d])=>{
    const on = S.guardians[k];
    return '<button class="rw" data-a="tgd" data-v="'+k+'" style="align-items:flex-start">'+
      '<span class="av s" style="background:'+(on?'var(--grad)':'var(--wash)')+';color:'+(on?'#fff':'var(--ink-3)')+'">'+ic(i,16)+'</span>'+
      '<div class="grow"><div class="between"><h4>'+t+'</h4>'+
      '<span class="tiny" style="font-weight:700;color:'+(on?'var(--safe)':'var(--ink-3)')+'">'+(on?'On':'Off')+'</span></div>'+
      '<p style="margin-top:2px">'+d+'</p></div></button>'; }).join('')+'</div>'+
  '<div class="sect"><div class="between" style="margin-bottom:10px"><h3>Your guardians</h3><button class="btn line sm" data-a="go" data-v="contacts">Edit</button></div>'+
  (acts().length?'<div class="rows">'+acts().map((c,i)=>'<div class="rw"><span class="av s">'+ini(c.n)+'</span><div class="grow"><h4>'+esc(c.n)+'</h4><p>'+esc(c.p)+(i===0?' · called first':'')+'</p></div></div>').join('')+'</div>'
   :'<div class="card p14 center"><p class="small sec" style="margin:0">Add a trusted contact first.</p></div>')+'</div>'+
  '<div style="margin-top:12px">'+tgl("sharetrips","",S.guardians.shareTrips,"Share my journeys with guardians","They get \"started\" and \"reached\" messages and your live location during the trip")+'</div>'+
  (S.guardians.active
    ?'<div class="status safe" style="margin-top:15px"><span class="pulse" style="background:var(--safe);color:var(--safe)"></span>'+
     '<div class="grow"><h4 style="font-size:15px;color:var(--safe)">Guardians active</h4>'+
     '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+glist()+'</p></div></div>'+
     '<button class="btn ghost" style="margin-top:11px" data-a="stopg">Pause</button>'
    :'<button class="btn" style="margin-top:15px" data-a="startg">Activate Guardians</button>')+
  '<div class="notice" style="margin-top:13px"><span>'+ic("shield",15)+'</span><span>'+
  (Native.canSendSmsDirectly?'Android app: SMS is sent directly.':'Web app: messages open ready to send; the Android app sends them directly.')+
  ' Nothing is recorded unless you turn on Voice or Camera, and only in an emergency.</span></div></div>');

/* ---------------- sos / help ---------------- */

V.sos = () => shell(bar("Emergency Mode")+'<div class="pad" style="padding-top:8px">'+
  '<div class="center" style="margin-bottom:18px"><h2 style="font-size:20px">Need help right now?</h2>'+
  '<p class="small sec" style="margin:6px 0 0">Hold the button for 2 seconds to call 112 straight away</p></div>'+
  '<div class="sosbtn" id="sosb" role="button" tabindex="0" aria-label="Hold two seconds for emergency">'+
    '<div class="sosring"></div><svg class="sosprog" viewBox="0 0 210 210" aria-hidden="true">'+
    '<circle cx="105" cy="105" r="103" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="647" stroke-dashoffset="647" id="sosa"/></svg>SOS</div>'+
  '<p class="center small sec" style="margin:18px 0 0">Holding calls <b>112</b> and alerts your guardians with your location. '+(S.guardians.voice?'Your first guardian will be called. ':'')+(S.guardians.camera?'A few photos will be saved for guardians.':'')+'</p>'+
  '<div class="row" style="gap:8px;margin-top:14px"><a class="btn line" style="flex:1" href="tel:112">Call 112</a>'+
  '<a class="btn line" style="flex:1" href="tel:1091">Women helpline 1091</a></div>'+
  '<button class="btn ghost" style="margin-top:9px" data-a="sosnow">Alert my guardians without calling</button>'+
  '<div class="sect"><div class="between" style="margin-bottom:10px"><h3>Emergency Contacts</h3>'+
  '<button class="btn line sm" data-a="go" data-v="contacts">Edit</button></div>'+
  (acts().length?'<div class="rows">'+acts().map(c=>'<div class="rw"><span class="av s">'+ini(c.n)+'</span>'+
   '<div class="grow"><h4>'+c.n+'</h4><p>'+c.p+'</p></div></div>').join('')+'</div>'
   :'<div class="card p14 center"><p class="small sec" style="margin:0">No trusted contacts added yet.</p></div>')+
  '</div><div style="height:16px"></div></div>');

V.sosactive = () => { const u = userPos(), sm = S.sos;
  const near = helpList().filter(p=>["police","hospital","clinic","metro"].includes(p.kind))
    .map(p=>({...p, d:SensorHub.distanceM(u.lat,u.lng,p.lat,p.lng)})).sort((a,b)=>a.d-b.d).slice(0,4);
  const alert = sosSms();
  return '<div class="scroll fade">'+
  '<div style="background:var(--danger);color:#fff;padding:20px"><div class="row">'+
  '<span class="pulse" style="background:#fff;color:#fff"></span><div class="grow">'+
  '<h2 style="font-size:20px;color:#fff">Emergency Mode Activated</h2>'+
  '<p style="margin:3px 0 0;font-size:13px;opacity:.94">'+
    (sm.sent ? 'Your guardians have been alerted.'
     : sm.opened ? 'Your message to '+esc(acts().map(c=>c.n).join(", "))+' is open — send it, then call.'
     : 'Send the alert to your guardians now.')+'</p></div>'+
  '<button class="endsos" data-a="endsos">End</button></div></div>'+
  '<div class="pad" style="margin-top:14px">'+
  '<a class="btn callbig" href="tel:112">'+ic("sos",22)+'Call 112</a>'+
  '<div class="row" style="gap:8px;margin-top:9px">'+
    '<a class="btn line" style="flex:1" href="tel:1091">Women helpline 1091</a>'+
    (acts()[0] ? '<a class="btn line" style="flex:1" href="tel:'+esc(acts()[0].p.replace(/\s/g,""))+'">Call '+esc(acts()[0].n)+'</a>' : '')+
  '</div>'+
  (!sm.sent && acts().length ? '<a class="btn ghost" style="margin-top:9px" href="'+esc(alert.href)+'">'+
    ic("sms",16)+(sm.opened?'Open the message again':'Send to '+esc(acts().map(c=>c.n).join(", ")))+'</a>' : '')+
  '<div class="rows" style="margin-top:12px">'+
    srow("sms","SMS to guardians", acts().length?(sm.sent?"Sent to "+acts().length+" guardian"+(acts().length===1?"":"s"):"Ready for "+acts().length+" guardian"+(acts().length===1?"":"s")):"No contacts added", sm.sent)+
    srow("share","Location in the message", LIVE.geo.lat!=null?"±"+Math.round(LIVE.geo.acc)+" m":"Last known area", true)+
    srow("mic","Voice Guardian", S.guardians.voice?(acts()[0]?"Call "+esc(acts()[0].n)+" on speaker":"No contact to call"):"Off", S.guardians.voice)+
    srow("cam","Camera Guardian", S.guardians.camera?(sm.photos?sm.photos+" photos saved for guardians":sm.photoErr||"Taking photos…"):"Off", S.guardians.camera&&sm.photos>0)+
  '</div>'+
  '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">'+
    (acts().length?smsBtn(sm.sent?"Send again":"Send alert with location", alert, "danger"):'')+
    (S.guardians.voice&&acts()[0]?'<a class="btn ghost" href="tel:'+acts()[0].p.replace(/\s/g,"")+'">Call '+esc(acts()[0].n)+'</a>':'')+
    '<button class="btn ghost" data-a="showqr">Show help QR for people nearby</button></div>'+
  '<div class="sect"><h3>Nearest help</h3><div class="rows">'+
  (near.length?near.map(e=>'<div class="rw"><span class="av s" style="background:var(--danger-bg);color:var(--danger)">'+ic(e.kind==="police"?"police":e.kind==="metro"?"metro":"hosp",16)+'</span>'+
  '<div class="grow"><h4>'+esc(e.name)+'</h4><p>'+e.kind+' · '+Math.round(e.d)+' m</p></div>'+
  '<a class="btn line sm" href="'+navUrl(e)+'" target="_blank" rel="noopener">Navigate</a></div>').join(''):'<div class="rw"><p>No help points loaded for this area.</p></div>')+'</div></div>'+
  '</div><div style="height:16px"></div></div>'; };
const sosSms = () => { const u = userPos();
  const body = "EMERGENCY from "+(S.user.name||"SixthSense user")+". I need help. Location: https://maps.google.com/?q="+u.lat.toFixed(5)+","+u.lng.toFixed(5)+
    (LIVE.batt.on?" Battery "+LIVE.batt.level+"%.":"")+" Call 112 if you can't reach me.";
  const nums = acts().map(c=>c.p.replace(/\s/g,""));
  return {body, numbers:nums, href:"sms:"+nums.join(",")+"?body="+encodeURIComponent(body)}; };
const srow = (i,t,s,ok) => '<div class="rw"><span class="av s" style="background:'+(ok?'var(--safe-bg)':'var(--wash)')+
  ';color:'+(ok?'var(--safe)':'var(--ink-3)')+'">'+ic(i,16)+'</span><div class="grow"><h4>'+t+'</h4><p>'+s+'</p></div>'+
  '<span class="dot" style="background:'+(ok?'var(--safe)':'var(--ink-3)')+'"></span></div>';

V.help = () => shell(bar("Help Center")+'<div class="pad">'+
  '<p class="small sec" style="margin:0 0 4px">Find help, resources and support around you.</p>'+
  Object.keys(DATA.help).map(sec=>'<div class="sect"><h3>'+sec+'</h3><div class="rows">'+
  DATA.help[sec].map(x=>'<button class="rw" data-a="'+(x.go?'go':'nav')+'" data-v="'+(x.go||'')+'"><span class="av s" style="background:var(--wash);color:var(--purple)">'+
  ic(sec.indexOf("Emergency")===0?"police":sec.indexOf("Women")===0?"shield":"pin",16)+'</span>'+
  '<div class="grow"><h4>'+x.n+'</h4><p>'+x.m+'</p></div>'+ic("chev",16)+'</button>').join('')+'</div></div>').join('')+
  '<div class="sect"><h3>Ask for help</h3><div class="card p14">'+
  '<h4 style="font-size:14.5px">Ask Angels</h4>'+
  '<p class="small" style="margin:5px 0 12px;color:var(--ink-2)">Verified women near a place tell you how it is right now.</p>'+
  '<button class="btn" data-a="go" data-v="askangels">Ask Angels</button></div></div><div style="height:16px"></div></div>');


/* ---------------- connect: Angels ---------------- */
V.connect = () => {
  const m = Store.me(), ang = Store.angel(), inbox = Store.inbox().length;
  return shell('<div class="top plain" style="padding-bottom:8px"><h2 class="grow">Community</h2>'+
    (m.tier!=="none"?tag("Halo: "+m.haloLevel,"soft"):'')+'</div>'+
    '<div class="pad"><div class="card p14 angelhead"><div class="row" style="align-items:flex-start">'+
      '<span class="halo">'+ic("users",22)+'</span><div class="grow"><h3 style="font-size:17px">Angels</h3>'+
      '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">Verified women helping each other: live information about places, company on the way, and walking together.</p></div></div></div></div>'+
    '<div class="pad" style="margin-top:12px"><div class="tiles">'+
      tile("t-help","eye","Ask Angels","How is a place right now?","go","askangels")+
      tile("t-sos","shield","Need an Angel","Someone nearby stays with you","go","needangel")+
      tile("t-travel","walk","Walk Together","Leave with women going your way","go","walk")+
      tile("t-audit","users","Angel Circles","Campus, hostel and PG groups","go","circles")+
    '</div></div>'+
    '<div class="pad" style="margin-top:12px"><div class="rows">'+
      '<button class="rw" data-a="go" data-v="beangel"><span class="dot" style="background:'+(ang.available?'var(--safe)':'var(--ink-3)')+'"></span>'+
      '<div class="grow"><h4>'+(ang.available?'You are an available Angel':'Be an Angel')+'</h4><p>'+(ang.available?ang.from+'–'+ang.to+' · within '+ang.radiusM+' m':'Answer questions and help women near you')+'</p></div>'+ic("chev",16)+'</button>'+
      (inbox?'<button class="rw" data-a="go" data-v="inbox"><span class="dot" style="background:var(--pink)"></span><div class="grow"><h4>'+inbox+' question near you</h4><p>Answer with a few taps</p></div>'+ic("chev",16)+'</button>':'')+
      '<button class="rw" data-a="go" data-v="rewards"><span class="dot" style="background:var(--purple)"></span><div class="grow"><h4>Your halo: '+m.haloLevel+'</h4><p>'+m.halo+' points · '+m.badges.length+' badges · helped '+m.helped+' · answered '+m.answered+'</p></div>'+ic("chev",16)+'</button>'+
    '</div></div>'+
    '<div class="pad sect"><div class="between" style="margin-bottom:11px"><h3>Community Forum</h3>'+
    '<button class="btn line sm" data-a="go" data-v="newpost">'+ic("plus",14)+'Post</button></div></div>'+
    '<div style="border-top:1px solid var(--rule)">'+DATA.posts.map((p,i)=>pcard(p,i)).join('')+'</div>'+
    '<div style="height:16px"></div>', true);
};
const angelGate = () => { const m = Store.me();
  return m.tier==="none" ? '<div class="notice" style="margin-bottom:12px"><span>'+ic("vf",15)+'</span><span>Angels features need a verified account. <button class="linkbtn" data-a="go" data-v="verify">Verify now</button></span></div>' : ''; };

V.askangels = () => { const a = S.ang;
  return shell(bar("Ask Angels")+'<div class="pad">'+angelGate()+
  '<p class="small sec" style="margin:0 0 14px">Angels within about 500 m of the place answer with a few taps. You see a summary, never their names or locations.</p>'+
  '<div class="field"><label for="aq">Place</label><div class="row" style="gap:8px"><input id="aq" data-b="ang.place" value="'+esc(a.place)+'" placeholder="e.g. Civil Lines Metro">'+
  '<button class="btn line sm" data-a="asearch">Search</button></div>'+
  (a.list?'<div class="rows" style="margin-top:6px">'+a.list.map((p,i)=>'<button class="rw" data-a="apick" data-v="'+i+'"><span style="color:var(--purple)">'+ic("pin",16)+'</span><div class="grow"><h4>'+esc(p.name)+'</h4><p>'+esc(p.area||"")+'</p></div></button>').join('')+'</div>':'')+'</div>'+
  (!a.list?'<div class="chips" style="margin:-4px 0 14px">'+PRESETS.slice(1).map((p,i)=>'<button class="chip" data-a="apreset" data-v="'+(i+1)+'" aria-pressed="'+(a.placeObj&&a.placeObj.name===p.name)+'">'+p.name+'</button>').join('')+'</div>':'')+
  '<div class="field"><label>When are you going?</label><div class="chips">'+["Now","In 30 min","In 1 hour","Tonight"].map(w=>
    '<button class="chip" data-a="awhen" data-v="'+w+'" aria-pressed="'+(a.when===w)+'">'+w+'</button>').join('')+'</div></div>'+
  '<button class="btn" data-a="doask" '+(a.placeObj&&Store.me().tier!=="none"?'':'style="opacity:.45"')+'>Ask Angels</button>'+
  '<p class="tiny sec center" style="margin-top:8px">Only the place is shared, never where you are.</p></div>'); };

V.pulse = () => {
  const q = Store.question(S.ang.qid);
  if(!q) return shell(bar("Angel Pulse")+'<div class="hero"><p class="small sec">Question not found.</p></div>');
  const P = Store.pulse(q);
  const line = (label, arr) => arr && arr.length ? '<div class="rw"><div class="grow"><h4>'+label+'</h4><p>'+arr.map(([k,n])=>esc(k)+' ('+n+')').join(' · ')+'</p></div></div>' : '';
  return shell(bar("Angel Pulse")+'<div class="pad">'+
  '<div class="card p14"><p class="tiny sec" style="margin:0;font-weight:600">'+esc(q.when)+'</p><h3 style="font-size:17px">'+esc(q.place)+'</h3>'+
  '<p class="small" style="margin:6px 0 0;color:var(--ink-2)">'+(P?P.n+' Angel'+(P.n>1?'s':'')+' answered · '+P.age:'Asking Angels near this place…')+'</p>'+
  (q.status!=="answered"?'<div class="bar" style="margin-top:10px"><i class="load"></i></div>':'')+'</div>'+
  (P?'<div class="rows" style="margin-top:12px">'+
    line("Lighting",P.lighting)+line("People around",P.people)+line("Shops open",P.shops)+
    (P.watch.length?line("Watch out",P.watch):'<div class="rw"><div class="grow"><h4>Watch out</h4><p>Nothing reported</p></div></div>')+
    P.notes.map(a=>'<div class="rw"><span class="dot" style="background:'+TIERCOL(a.tier)+'"></span><div class="grow"><h4>"'+esc(a.note)+'"</h4><p>'+Store.TIERS[a.tier].label+' · halo '+a.halo+' · '+ago(a.t)+'</p></div></div>').join('')+
    '<div class="rw"><div class="grow"><h4>'+confWord(P.confidence)+'</h4><p>Better-place answers count only when 2+ Angels agree or phone sensors match.</p></div></div>'+
  '</div>'+
  (q.status==="answered"?'<div class="row" style="gap:8px;margin-top:12px">'+
    (q.rated==null?'<button class="btn ghost sm" style="flex:1" data-a="arate" data-v="1">Helpful</button><button class="btn ghost sm" style="flex:1" data-a="arate" data-v="0">Not accurate</button>'
      :'<p class="small sec">Thanks for rating. It updates the Angels\' reputation.</p>')+'</div>':'')
   :'')+
  '<button class="btn ghost" style="margin-top:12px" data-a="go" data-v="needangel">Need an Angel with you?</button>'+
  '<p class="tiny sec center" style="margin-top:8px">Demo: answers come from simulated Angels until the backend is connected.</p></div>');
};

V.needangel = () => {
  if(Cloud.signedIn) return V.nearby();            // real Angels when she is signed in
  const s = S.ang.sid ? Store.session(S.ang.sid) : null;
  const head = bar("Need an Angel");
  if(!s || s.status==="ended" && S.ang.rated) return shell(head+'<div class="pad">'+angelGate()+
    '<p class="small sec" style="margin:0 0 12px">Available Angels near you get your <b>rough area only</b>. You see who offers help and decide. Exact locations are shared only after you both accept, and only until the session ends.</p>'+
    '<div class="rows">'+[["Consent both ways","You accept her before any location is shared"],["Public meeting point","Metro gate, police post or open shop"],["Ends by itself","On arrival, by either of you, or after 60 minutes"]]
      .map(([t,d])=>'<div class="rw"><span style="color:var(--purple)">'+ic("check",16,2.2)+'</span><div class="grow"><h4>'+t+'</h4><p>'+d+'</p></div></div>').join('')+'</div>'+
    '<button class="btn" style="margin-top:14px" data-a="reqangel" '+(Store.me().tier==="none"?'style="opacity:.45;margin-top:14px"':'')+'>Find an Angel near me</button>'+
    '<a class="btn ghost" style="margin-top:9px" href="tel:112">In immediate danger? Call 112</a></div>');
  if(s.status==="searching") return shell(head+'<div class="hero"><div class="pulse" style="background:var(--purple);color:var(--purple)"></div><h3>Looking for Angels near you…</h3>'+
    '<p class="small sec">Sharing your rough area only.</p><button class="btn ghost" data-a="endangel">Cancel</button></div>');
  const g = s.angel;
  if(s.status==="offered") return shell(head+'<div class="pad"><div class="card p14">'+
    '<p class="tiny sec" style="margin:0;font-weight:600">An Angel offered to help</p>'+
    '<div class="row" style="margin-top:8px"><span class="av">'+ini(g.name)+'</span><div class="grow"><h3 style="font-size:18px">'+esc(g.name)+'</h3>'+
    '<p class="small" style="margin:0;color:'+TIERCOL(g.tier)+'">'+Store.TIERS[g.tier].label+' · halo '+g.halo+'</p></div>'+
    '<div style="text-align:right"><b>'+g.distM+' m</b><p class="tiny sec" style="margin:0">~'+g.etaMin+' min</p></div></div>'+
    '<p class="small" style="margin:10px 0 0">Suggested meeting point: <b>'+esc(s.meet)+'</b></p></div>'+
    '<button class="btn" style="margin-top:12px" data-a="acceptangel">Accept and share locations</button>'+
    '<button class="btn ghost" style="margin-top:9px" data-a="endangel">Decline</button>'+
    '<p class="tiny sec center" style="margin-top:8px">Demo: simulated Angel.</p></div>');
  if(s.status==="active") return shell(head+'<div class="pad"><div class="status safe"><span class="pulse" style="background:var(--safe);color:var(--safe)"></span>'+
    '<div class="grow"><h4 style="color:var(--safe)">'+esc(g.name)+(s.arrived?' is with you':' is on her way')+'</h4><p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+(s.arrived?'At '+esc(s.meet):g.distM+' m away · ~'+g.etaMin+' min · meet at '+esc(s.meet))+'</p></div></div>'+
    '<div class="card p14" style="margin-top:12px;display:flex;flex-direction:column;gap:7px">'+s.messages.map(x=>'<div class="msg '+(x.from==="me"?"me":"them")+'">'+esc(x.b)+'</div>').join('')+'</div>'+
    '<div class="chips" style="margin-top:10px">'+["I'm at the gate","Coming now","Please call me","I'm okay now"].map(x=>'<button class="chip" data-a="amsg" data-v="'+esc(x)+'">'+x+'</button>').join('')+'</div>'+
    '<button class="btn" style="margin-top:14px;background:var(--danger)" data-a="endangel">End session</button>'+
    '<p class="tiny sec center" style="margin-top:8px">Both locations are deleted when the session ends.</p></div>');
  return shell(head+'<div class="pad"><div class="hero" style="padding-top:10px"><h3>How was '+esc(g?g.name:"the session")+'?</h3>'+
    '<div class="stars">'+[1,2,3,4,5].map(n=>'<button class="star '+((S.ang.stars||0)>=n?'on':'')+'" data-a="astar" data-v="'+n+'">'+ic("star",18)+'</button>').join('')+'</div>'+
    '<div class="chips" style="justify-content:center;margin-top:8px">'+["Arrived quickly","Respectful","Stayed until safe"].map(x=>'<button class="chip" data-a="atag" data-v="'+x+'" aria-pressed="'+((S.ang.tags||[]).includes(x))+'">'+x+'</button>').join('')+'</div>'+
    '<button class="btn" style="margin-top:14px" data-a="arate2">Send rating and a thank-you heart</button>'+
    '<button class="btn ghost" style="margin-top:9px" data-a="areport">Report a safety concern</button></div></div>');
};

V.walk = () => {
  const G = S.ang, live = G.session;
  const to = S.travel.toPlace ? S.travel.toPlace.name : "your destination";
  const backend = Cloud.signedIn;

  if(live) return sessionScreen("Walk Together", live);

  return shell(bar("Walk Together")+'<div class="pad">'+angelGate()+
  '<p class="small sec" style="margin:0 0 12px">Verified women near you who are also travelling now. You meet at a public point; nobody sees your location until you both agree.</p>'+
  '<div class="card p14"><p class="tiny sec" style="margin:0">Going towards</p><h4>'+esc(to)+'</h4>'+
    '<p class="tiny sec" style="margin:8px 0 0">Meeting point</p>'+
    '<input data-b="ang.meet" value="'+esc(G.meet||"")+'" placeholder="e.g. IGDTUW main gate" '+
    'style="width:100%;margin-top:5px;padding:11px 13px;border-radius:12px;background:var(--surface);border:1px solid var(--line-2);outline:none"></div>'+

  (backend ? (G.angels && G.angels.length
      ? '<div class="sect">'+angelSortHead()+'<div class="rows">'+
        angelList(G.angels.filter(a=>a.kind!=="nearby")).map(angelRow).join('')+
        '</div><p class="tiny sec" style="margin:6px 0 0">Asking sends the request to all of them and the first to accept walks with you. Tap one name to ask only her.</p></div>'
      : '<p class="small sec" style="margin:12px 0 0">Nobody is available near you right now. You can still ask — the request stays open for an hour and any Angel who comes online will see it.</p>')
    : '<div class="notice" style="margin-top:12px"><span>'+ic("wifi-off",15)+'</span><span>Sign in to reach real Angels. Offline, this stays a demo.</span></div>')+

  '<button class="btn" style="margin-top:12px" data-a="askwalk">'+(G.asking?"Asking…":"Ask someone to walk with me")+'</button>'+
  '<p class="tiny sec center" style="margin-top:8px">Your exact location is shared only after someone accepts, and only until the walk ends.</p></div>'); };

V.nearby = () => {
  const G = S.ang;
  if(G.session) return sessionScreen("Angel Nearby", G.session);
  return shell(bar("Angel Nearby")+'<div class="pad">'+angelGate()+
  '<p class="small sec" style="margin:0 0 12px">A verified woman nearby stays with you — on a call or beside you — until you are somewhere you are comfortable.</p>'+
  (Cloud.signedIn
    ? (G.angels && G.angels.length
        ? angelSortHead()+'<div class="rows">'+angelList(G.angels.filter(a=>a.kind!=="walk")).map(angelRow).join('')+'</div>'
        : '<p class="small sec">Nobody is available within 3 km right now. Your request stays open for an hour.</p>')
    : '<div class="notice"><span>'+ic("wifi-off",15)+'</span><span>Sign in to reach real Angels.</span></div>')+
  '<button class="btn" style="margin-top:12px" data-a="asknearby">'+(G.asking?"Asking…":"Ask an Angel to stay with me")+'</button>'+
  '<p class="tiny sec center" style="margin-top:8px">Only her first name, tier and distance are shown. No photos, no numbers.</p></div>'); };

function angelSortHead(){
  const by = S.ang.sortBy || "near";
  const chip = (k,l) => '<button class="chip" data-a="angelsort" data-v="'+k+'" aria-pressed="'+(by===k)+'">'+l+'</button>';
  return '<div class="between" style="margin-bottom:7px"><span class="lbl" style="margin:0">Available near you</span>'+
    '<div class="chips" style="margin:0">'+chip("near","Nearest")+chip("rep","Best record")+'</div></div>';
}
function angelList(list){
  const by = S.ang.sortBy || "near";
  return list.slice().sort((a,b) => by==="rep"
    ? (b.reputation||0) - (a.reputation||0) || a.distM - b.distM
    : a.distM - b.distM);
}
function angelRow(a){
  const r = a.reputation != null ? a.reputation : null;
  const chosen = S.ang.pick === a.by;
  return '<button class="rw'+(chosen?" on":"")+'" data-a="angelpick" data-v="'+esc(a.by)+'">'+
    '<span class="av s">'+ini(a.name)+'</span>'+
    '<div class="grow"><h4>'+esc(a.name)+(chosen?' <span class="tiny" style="color:var(--purple)">· asking her</span>':'')+'</h4>'+
    '<p>'+((Store.TIERS[a.tier]||{}).label||a.tier)+' · '+
      (a.distM<1000? a.distM+" m away" : (a.distM/1000).toFixed(1)+" km away")+
      (r!=null ? ' · record '+r.toFixed(2)+' ('+Store.reputationWord(r)+')' : ' · no record yet')+'</p>'+
      (r!=null ? '<div class="repbar sm"><i style="width:'+Math.round(r*100)+'%"></i></div>' : '')+
    '</div></button>';
}

/* One screen for a live session, whichever side you are on */
function sessionScreen(title, x){
  const mine = x.by === (Cloud.user && Cloud.user.uid);
  const other = mine ? x.angelName : x.byName;
  const waiting = x.status === "asked";
  const ended = x.status === "ended";
  return shell(bar(title)+'<div class="pad">'+
    (ended
      ? '<div class="status safe"><span>'+ic("check",18)+'</span><div class="grow"><h4 style="color:var(--safe)">Session ended</h4>'+
        '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+(x.endedBy===(Cloud.user&&Cloud.user.uid)?"You ended it.":"The other person ended it.")+'</p></div></div>'
      : waiting
      ? '<div class="status mod"><span class="pulse" style="background:var(--mod);color:var(--mod)"></span>'+
        '<div class="grow"><h4 style="color:var(--mod)">Waiting for an Angel</h4>'+
        '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">Sent to verified women within 3 km. This stays open for an hour.</p></div></div>'
      : '<div class="status safe"><span class="pulse" style="background:var(--safe);color:var(--safe)"></span>'+
        '<div class="grow"><h4 style="color:var(--safe)">With '+esc(other||"an Angel")+'</h4>'+
        '<p class="small" style="margin:2px 0 0;color:var(--ink-2)">'+
        (x.meet?'Meet at '+esc(x.meet)+' · ':'')+'Both of you can see each other while this runs.</p></div></div>')+

    (!ended && !waiting ? '<div class="card p14" style="margin-top:12px">'+
      '<span class="lbl">Live</span>'+
      '<p class="small" style="margin:0">'+
      (x.herePing && x.angelPing
        ? 'You are about '+Math.round(SensorHub.distanceM(x.herePing.lat,x.herePing.lng,x.angelPing.lat,x.angelPing.lng))+' m apart.'
        : 'Waiting for the first location from both sides.')+'</p>'+
      '<p class="tiny sec" style="margin:6px 0 0">Location is exchanged only inside this session and stops the moment it ends.</p></div>' : '')+

    (waiting ? '<button class="btn ghost" style="margin-top:12px" data-a="endsession">Cancel the request</button>'
     : ended ? '<button class="btn" style="margin-top:12px" data-a="closesession">Done</button>'
     : '<button class="btn" style="margin-top:12px" data-a="endsession">'+(mine?"I am safe — end":"End this session")+'</button>')+
    '<div style="height:16px"></div></div>'); }

V.circles = () => { const cs = Store.circles(), c = S.ang.circle ? cs.find(x=>x.id===S.ang.circle) : null;
  if(!c) return shell(bar("Angel Circles")+'<div class="pad">'+angelGate()+
    '<p class="small sec" style="margin:0 0 12px">Groups for places you use every day. Share quick updates and plan walks together. Never share anyone\'s location.</p>'+
    '<div class="rows">'+cs.map(x=>'<div class="rw"><span class="av s">'+ini(x.name)+'</span><button class="grow" style="text-align:left" data-a="opencircle" data-v="'+x.id+'"><h4>'+esc(x.name)+'</h4><p>'+x.members+' members · '+x.posts.length+' updates</p></button>'+
      '<button class="btn '+(x.joined?'ghost':'line')+' sm" data-a="joincircle" data-v="'+x.id+'">'+(x.joined?'Joined':'Join')+'</button></div>').join('')+'</div></div>');
  return shell(bar(c.name)+'<div class="pad">'+
    '<div class="row" style="gap:8px"><input id="cpost" data-b="ang.draft" value="'+esc(S.ang.draft||"")+'" placeholder="Share an update for this circle" style="flex:1;padding:12px 14px;border-radius:9px;background:var(--surface);border:1px solid var(--line-2);outline:none">'+
    '<button class="icb" style="background:var(--grad);color:#fff;border:0;width:44px;height:44px" data-a="postcircle" aria-label="Post">'+ic("send",18)+'</button></div>'+
    '<div class="rows" style="margin-top:12px">'+(c.posts.length?c.posts.map(p=>'<div class="rw" style="align-items:flex-start"><span class="av s">'+ini(p.a)+'</span><div class="grow"><h4>'+esc(p.a)+' <span class="tiny" style="color:'+TIERCOL(p.tier)+'">'+(Store.TIERS[p.tier]||{}).label+'</span></h4><p>'+esc(p.b)+'</p><p class="tiny sec">'+ago(p.t)+'</p></div></div>').join(''):'<div class="rw"><p>No updates yet. Share something and your circle sees it here.</p></div>')+'</div>'+
    '<p class="tiny sec center" style="margin-top:8px">Posts that name or target people or communities are removed.</p></div>');
};

V.beangel = () => { const m = Store.me(), a = Store.angel(), G = S.ang;
  return shell(bar("Be an Angel")+'<div class="pad">'+
  (Cloud.signedIn && m.canAngel ? '<div class="card p14" style="margin-bottom:12px">'+
    tgl("available","",G.available,"Available to help now",
      "Women within 3 km can ask you to walk with them or stay with them. Only your first name, tier and rough distance are shown.")+
    (G.available && G.requests && G.requests.length
      ? '<div class="sect" style="margin-top:12px"><span class="lbl">Someone needs help</span><div class="rows">'+
        G.requests.map(r=>'<div class="rw"><span class="av s">'+ini(r.byName||"M")+'</span>'+
        '<div class="grow"><h4>'+esc(r.byName||"A member")+' · '+(r.kind==="walk"?"walk together":"stay with me")+'</h4>'+
        '<p>'+(r.distM<1000? r.distM+" m away" : (r.distM/1000).toFixed(1)+" km away")+
        (r.meet?' · meet at '+esc(r.meet):'')+' · '+ago(r.t)+'</p></div>'+
        '<button class="btn sm" data-a="acceptsession" data-v="'+r.id+'">Accept</button></div>').join('')+'</div></div>'
      : (G.available ? '<p class="tiny sec" style="margin:10px 0 0">Nobody has asked in the last hour. You will see requests here the moment they come.</p>' : ''))+
  '</div>' : '')+
  (m.canAngel?'':'<div class="notice" style="margin-bottom:12px"><span>'+ic("vf",15)+'</span><span>Angels are Gold, Partner or Verified-women members with reputation 0.9 or more. You are <b>'+m.tierLabel+'</b>, reputation '+m.reputation+'. '+(m.tier==="none"?'<button class="linkbtn" data-a="go" data-v="verify">Verify now</button>':'')+'</span></div>')+
  (m.canAngel?tgl("angelon","",a.available,"Available as an Angel","You get questions and help requests near you"):'')+
  (m.canAngel&&a.available?'<div class="field" style="margin-top:12px"><label>Hours</label><div class="row" style="gap:8px"><input type="time" data-b="angel.from" value="'+a.from+'"><input type="time" data-b="angel.to" value="'+a.to+'"></div></div>'+
    '<div class="field"><label>Radius</label><div class="chips">'+[300,500,1000].map(r=>'<button class="chip" data-a="aradius" data-v="'+r+'" aria-pressed="'+(a.radiusM===r)+'">'+(r<1000?r+' m':'1 km')+'</button>').join('')+'</div></div>':'')+
  '<div class="sect"><h3>The Angel pledge</h3><div class="card p14 small" style="line-height:1.55">'+
    '• I answer only about what I can see right now.<br>• I meet only at public places.<br>• I never ask for or share anyone\'s home or exact location.<br>• I call 112 when someone is in danger.</div></div>'+
  '<div class="sect"><h3>Privacy</h3><p class="small sec">SixthSense knows only your rough area while you are available. You never see who is asking until you both agree to meet.</p></div></div>'); };

V.inbox = () => { const q = Store.inbox()[0], t = S.ang.taps||{};
  if(!q) return shell(bar("Questions near you")+'<div class="hero"><p class="small sec">No questions right now.</p><button class="btn ghost" data-a="back">Back</button></div>');
  return shell(bar("Question near you")+'<div class="pad">'+
  '<div class="card p14"><p class="tiny sec" style="margin:0">'+q.distM+' m from you · '+ago(q.t)+'</p><h3 style="font-size:17px">How is '+esc(q.place)+' right now?</h3></div>'+
  Object.entries(Store.TAPS).map(([k,opts])=>'<div class="sect" style="margin-top:14px"><span class="lbl">'+({lighting:"Lighting",people:"People around",shops:"Shops open",watch:"Anything to watch out for"}[k])+'</span>'+
    '<div class="chips" style="margin-top:7px">'+opts.map(o=>'<button class="chip" data-a="itap" data-v="'+k+'|'+o+'" aria-pressed="'+(t[k]===o)+'">'+o+'</button>').join('')+'</div></div>').join('')+
  '<div class="field" style="margin-top:14px"><label for="inote">Short note (optional)</label><input id="inote" data-b="ang.note" value="'+esc(S.ang.note||"")+'" placeholder="e.g. main gate side is busier"></div>'+
  '<button class="btn" data-a="ianswer" '+(t.lighting&&t.people?'':'style="opacity:.45"')+'>Send answer</button>'+
  '<p class="tiny sec center" style="margin-top:8px">Your phone\'s light and sound readings are attached automatically. Demo question.</p></div>');
};

V.rewards = () => { const m = Store.me();
  const all = [["Night Owl","Helped after 9 pm"],["First Responder","Answered within 1 minute"],["Lamp Lighter","Lighting reports confirmed"],["Walk Buddy","5 walks together"]];
  const lv = [["Spark",0],["Glow",50],["Shine",150],["Radiant",400]];
  const next = lv.find(([,p])=>p>m.halo);
  return shell(bar("Your badges and rewards")+'<div class="pad">'+
  '<div class="card p14 center"><span class="halo big">'+ic("star",26)+'</span><h2 class="gradtext" style="font-size:28px;margin-top:6px">'+m.haloLevel+'</h2>'+
  '<p class="small sec" style="margin:2px 0 8px">'+m.halo+' halo points'+(next?' · '+(next[1]-m.halo)+' to '+next[0]:'')+'</p>'+
  '<div class="bar"><i style="width:'+(next?Math.round(100*m.halo/next[1]):100)+'%;background:var(--grad)"></i></div></div>'+
  '<div class="row" style="gap:10px;margin-top:11px">'+
    '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 3px;font-weight:600">Safety Points</p><h2 class="gradtext" style="font-size:26px">'+S.points+'</h2></div>'+
    '<div class="card p14 grow center"><p class="tiny sec" style="margin:0 0 3px;font-weight:600">Audits</p><h2 class="gradtext" style="font-size:26px">'+S.logged+'</h2></div></div>'+
  '<div class="card p14" style="margin-top:11px;background:var(--wash)"><h4 style="font-size:14.5px">This month you helped '+m.helped+' women and answered '+m.answered+' questions.</h4>'+
  '<p class="small" style="margin:4px 0 0;color:var(--ink-2)">Points follow accuracy, not volume: answers found wrong earn nothing.</p></div>'+
  '<div class="sect"><h3>Badges</h3><div class="tiles">'+all.map(([b,d])=>{ const on=m.badges.includes(b);
    return '<div class="tile" style="min-height:84px;background:'+(on?'var(--tint)':'var(--surface)')+';border-color:'+(on?'var(--purple)':'var(--line)')+';opacity:'+(on?1:.55)+'">'+
    '<h4 style="font-size:14px">'+(on?'★ ':'')+b+'</h4><p>'+d+'</p></div>'; }).join('')+'</div></div>'+
  '<div class="sect"><h3>How points are earned</h3><div class="rows">'+
  [["Confirmed audit","+10"],["Accurate Angel answer","+3"],["Walk together","+5"],["Angel Nearby with good feedback","+15"]]
  .map(([a,b])=>'<div class="rw"><span style="color:var(--purple)">'+ic("star",18)+'</span><div class="grow"><h4>'+a+'</h4></div>'+
  '<span class="tiny" style="font-weight:700;color:var(--pink)">'+b+'</span></div>').join('')+'</div></div>'+
  '<div class="sect"><h3>Earn more</h3>'+
  '<div class="card p14"><h4 style="font-size:14.5px">Be an Angel</h4>'+
  '<p class="small sec" style="margin:5px 0 10px">Answer questions from women near you, walk with someone going your way, or stay with her until she is safe. Every accurate answer earns points.</p>'+
  '<button class="btn line sm" data-a="go" data-v="beangel">'+ic("users",15)+'Be an Angel</button></div></div>'+
  '<div style="height:16px"></div></div>'); };

function pcard(p,i){
  return '<div class="post"><div class="row"><span class="av s">'+ini(p.a)+'</span>'+
    '<div class="grow"><h4 style="font-size:13.5px">'+p.a+'</h4><p class="tiny sec" style="margin:0">'+p.t+'</p></div></div>'+
    '<p style="margin:9px 0 0;font-size:13.5px;line-height:1.48">'+p.b+'</p>'+
    '<div class="react"><button data-a="like" data-v="'+i+'" aria-pressed="'+(!!S.reacted[i])+'">♥ '+(p.l+(S.reacted[i]?1:0))+'</button>'+
    '<button data-a="rep" data-v="'+i+'">'+ic("chat",12)+' '+p.r.length+' '+(p.r.length===1?'reply':'replies')+'</button></div>'+
    (S.openReplies===i&&p.r.length?'<div style="margin-top:10px;padding-left:12px;border-left:2px solid var(--line)">'+
      p.r.map(r=>'<p style="margin:0 0 6px;font-size:12.5px"><b>'+r.a+'</b> <span class="sec">'+r.b+'</span></p>').join('')+'</div>':'')+'</div>';
}
V.newpost = () => shell(bar("New post")+'<div class="pad">'+
  '<div class="field"><label for="np">Share something useful</label>'+
  '<textarea id="np" rows="5" data-b="draftPost" placeholder="Route advice, a local warning, an area observation...">'+S.draftPost+'</textarea></div>'+
  '<button class="btn" data-a="post">Post to community</button>'+
  '<p class="tiny sec center" style="margin-top:10px">Keep it about safety — routes, lighting, timings, local conditions.</p></div>');
V.chat = () => { const w = S.chatWith, m = DATA.chats[w]||[];
  return '<div class="scroll fade" style="display:flex;flex-direction:column">'+
  bar(w,{right:'<span class="tiny sec" style="font-weight:600">Demo chat</span>'})+
  '<div class="pad" style="flex:1;display:flex;flex-direction:column;gap:8px;padding-bottom:12px">'+
  '<p class="tiny sec center" style="margin:0 0 6px">Community member · approximate distance only</p>'+
  m.map(x=>'<div class="msg '+(x.f==="me"?"me":"them")+'">'+x.b+'</div>').join('')+'</div>'+
  '<div class="pad" style="padding-bottom:16px"><div class="row" style="gap:8px">'+
  '<input id="ci" placeholder="Is this area safe right now?" style="flex:1;padding:12px 14px;border-radius:9px;background:var(--surface);border:1px solid var(--line-2);outline:none">'+
  '<button class="icb" style="background:var(--grad);color:#fff;border:0;width:44px;height:44px" data-a="send" aria-label="Send">'+ic("send",18)+'</button></div></div></div>'; };


/* SixthSense — render loop, event delegation, flows and boot */
"use strict";

/* ============================================================ RENDER */
function isDark(){ const t=document.documentElement.getAttribute("data-theme");
  return t ? t==="dark" : (matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches); }
let lastScreen = null, lastTab = null;
function render(){
  // Keep the page still: only animate and jump to the top when the screen really changes
  const old = document.querySelector(".scroll"), top = old ? old.scrollTop : 0;
  const changed = S.screen !== lastScreen || S.tab !== lastTab;
  $("app").innerHTML = localize((V[S.screen]||V.home)());
  const now = document.querySelector(".scroll");
  if(now && !changed){ now.classList.remove("fade"); now.scrollTop = top; }
  lastScreen = S.screen; lastTab = S.tab;
  if(typeof wireMaps === "function") requestAnimationFrame(wireMaps);
  if(S.screen==="sos") wireSOS();
  if(S.screen==="home") wireHomeSos();
  if(S.screen==="new") wirePhoto();
  if(S.screen==="instant") wireInstantPhoto();
  if(S.screen==="vouch"){ drawVouchQr(); loadVouchState(); }
  if(S.screen!=="vouch") stopVouchScan();
  watchAngelsIfNeeded();
  if(S.screen==="verify") wireVerify();
  if(S.screen!=="verify") stopSelfieCam();
  if(S.screen==="chat"){ const i=$("ci"); if(i) i.focus({preventScroll:true}); }
  patchLive();
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-a]"); if(!t) return;
  const a = t.dataset.a, v = t.dataset.v;
  const T = S.travel, G = S.ang;
  const A = {
    back, go:()=>go(v), tab:()=>tab(v), noop:()=>{},
    emaillogin:async()=>{ const e=(S.user.email||"").trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Enter a valid email address");
      S.v.err=null;
      // The prepared demo accounts sign in on the email alone, so a demo never
      // waits on an inbox. Every other address gets the usual sign-in link.
      if(DEMO_ACCOUNTS.includes(e.toLowerCase())){
        toast("Signing in…");
        try{ await Cloud.signInPassword(e, DEMO_KEY); return; }
        catch(err){ /* fall through to the link if that account is not set up */ }
      }
      toast("Sending sign-in link…");
      try{ await Cloud.sendSignInLink(e); go("linksent"); }
      catch(err){ toast(Cloud.explain(err)); } },
    linkopened:()=>{ if(Cloud.signedIn) return toast("You are already signed in."); const e=S.user.email||"";
      if(!S.user.name) S.user.name = e.split("@")[0].replace(/[^a-z]/gi," ").trim().replace(/\b\w/g,c=>c.toUpperCase()) || "there";
      Store.setVerified({method:/@igdtuw\.ac\.in$/i.test(e)?"igdtuw":"basic", email:e});
      S.user.verified = Store.me().tier!=="none"; Agent.setName(S.user.name);
      S.stack=[]; tab("home");
      toast(/@igdtuw\.ac\.in$/i.test(e)?"Signed in · Verified woman":"Signed in · New member. Verify an ID for higher trust.");
      },
    showpw:()=>{ S.showPw=true; render(); },
    gender:()=>{ S.user.gender = v; save(); render(); refreshFormState(); },
    pwlogin:async()=>{ const e=(S.user.email||"").trim(), p=(S.loginPw||"").trim();
      if(!e) return toast("Enter your email address first");
      if(p.length<6) return toast("Firebase needs a password of at least 6 characters");
      try{ await Cloud.signInPassword(e,p); S.loginPw=""; toast("Signed in"); }
      catch(err){ toast(Cloud.explain(err)); } },
    googlelogin:async()=>{ try{ await Cloud.signInGoogle(); }catch(err){ toast(Cloud.explain(err)); } },
    login:()=>{ if(!S.user.name) S.user.name="Akshi"; if(!S.user.phone) S.user.phone="+91 98110 42117";
      Store.demoSignIn(); S.user.verified=true; Agent.setName(S.user.name);
      // the demo account needs guardians even with no backend; a real sign-up
      // gets none. The same three are held in the backend under demo/contacts.
      if(!S.contacts.some(c=>c.n&&c.p))
        S.contacts=[{n:"Maa (demo)",p:"+91 98100 11223"},{n:"Papa (demo)",p:"+91 98111 44556"},
                    {n:"Rhea, roommate (demo)",p:"+91 99872 30011"}];
      syncContacts(); save(); tab("home");
      setTimeout(()=>{ if(!haveFix() && !locBlocked()) requestFix(true); }, 600);   // silent: the browser asks
      toast("Demo account — a sample profile for trying the app"); },
    staysignedin:()=>{ S.staySignedIn=!S.staySignedIn; render(); },
    avface:()=>{ S.user.avatar={...(S.user.avatar||{bg:AV_BGS[0]}), face:v}; save(); render(); },
    avbg:()=>{ S.user.avatar={...(S.user.avatar||{face:AV_FACES[0]}), bg:AV_BGS[+v]}; save(); render(); },
    theme:()=>{ document.documentElement.setAttribute("data-theme", isDark()?"light":"dark"); render(); },
    ec:()=>{ S.ei=+v; go("cedit"); }, rc:()=>{ S.contacts[+v]={n:"",p:""}; syncContacts(); render(); },
    finish, reset:resetDemo,
    /* verification */
    ob1next:()=>{ if(!(S.user.name||"").trim()) return toast("Enter your name");
      if(!phoneOk(S.user.phone)) return toast("Enter a valid 10-digit mobile number");
      S.user.phone = "+91 "+phoneDigits(S.user.phone); Agent.setName(S.user.name); go("ob2"); },
    savecontact:()=>{ const c=S.contacts[S.ei];
      if(!(c.n||"").trim()) return toast("Give this contact a name");
      if(!phoneOk(c.p)) return toast("Enter a valid 10-digit mobile number");
      c.p = "+91 "+phoneDigits(c.p); syncContacts(); back(); },
    vback:()=>{ S.v={step:0,method:null,email:S.v.email,code:"",linkSent:false,idImg:null,instr:"",checking:false,err:null}; stopSelfieCam(); render(); },
    vmethod:()=>{ if(v==="digilocker-woman") return toast("DigiLocker verification is planned."); Object.assign(S.v,{step:1,method:v,linkSent:false,err:null,idImg:null}); render(); },
    vsend:()=>{ if(!/@igdtuw\.ac\.in$/i.test(S.v.email)){ S.v.err="Use your @igdtuw.ac.in email."; return render(); } S.v.linkSent=true; S.v.err=null; render(); },
    vlinked:()=>{ S.v.step=2; render(); },
    vnext:()=>{ S.v.step = S.v.step===1 ? 2 : 3; if(S.v.step===3) S.v.instr = ["Blink twice","Turn your head to the left","Smile, then look straight"][Math.floor(Math.random()*3)]; render(); },
    vselfie:()=>{ S.v.checking=true; render(); stopSelfieCam();
      setTimeout(()=>{ Store.setVerified({method:S.v.method,email:S.v.email}); S.user.verified=true; S.v.idImg=null; S.v.checking=false; S.v.step=4; render(); },1600); },
    vdone:()=>{ S.v={step:0,method:null,email:"",code:"",linkSent:false,idImg:null,instr:"",checking:false,err:null};
      if(S.stack.indexOf("ob3")>-1){ finish(); } else back(); },
    /* profile */
    repeattrip:()=>{ const tr=(S.trips||[])[+v]; if(!tr||!tr.place) return toast("That trip has no saved places.");
      S.travel.toPlace=tr.place; S.travel.to=tr.place.name;
      if(tr.fromPlace){ S.travel.fromPlace=tr.fromPlace; S.travel.from=tr.fromPlace.name; }
      S.travel.mode="any"; go("tmode"); },
    mocktrips:async()=>{ const j = await (await fetch("data/trips.mock.json")).json(); Prefs.Trips.seedMock(j.trips); toast("Sample history loaded (30 trips)"); render(); },
    cleartrips:()=>{ Prefs.Trips.clear(); toast("Trip history deleted"); render(); },
    agopt:()=>{ const o = Agent.options; o[v] = !o[v]; Agent.setOptions(o); S.agentOpts = o; render(); },
    instant:()=>{ if(Store.me().tier==="none") return go("agate"); S.inst={remark:"",photo:null,mime:null,reading:null,busy:false}; go("instant"); },
    instclear:()=>{ S.inst.photo=null; S.inst.mime=null; render(); },
    instread:async()=>{
      const a=S.inst; if((!a.remark && !a.photo) || a.busy) return;
      a.busy=true; a.reading=null; render();
      const pos=userPos();
      let place = S.hereName;
      try{ if(!place) place = await Context.placeName(pos.lat,pos.lng); }catch(e){}
      try{
        a.reading = await Instant.read({ remark:a.remark, imageBase64:a.photo?a.photo.split(",")[1]:null,
          mime:a.mime||"image/jpeg", place, hour:new Date().getHours() });
      }catch(e){ toast("Could not read that: "+e.message); }
      a.busy=false; render();
    },
    instsave:()=>saveInstant(),
    told:()=>{ Agent.tellWho(v==="none" ? null : +v); render(); },
    tellpick:()=>{ S.travel.tell = v==="none" ? "none" : +v; save(); render(); },
    watched:()=>{ S.watch && S.watch.on ? (stopWatched(false), render(), toast("Watched mode off")) : startWatched(); },
    copywatch:()=>{ const l=(S.watch||{}).link; if(!l) return;
      navigator.clipboard && navigator.clipboard.writeText(l);
      toast("Link copied — send it to whoever should hold your deadline"); },
    tellwho:()=>{ Agent.tellWho(v==="none" ? null : +v); render(); },
    /* Vouching */
    vnew:async()=>{ const v=S.vouch; if(v.busy) return;
      v.busy=true; v.msg=null; render();
      try{ const r = await Cloud.makeVouchCode(); v.code=r.code; v.expires=r.expires;
           v.have = await Cloud.myVouches(); }
      catch(e){ v.msg = e.code==="permission-denied"
        ? "Vouching needs the updated rules published in Firebase." : e.message; v.ok=false; }
      v.busy=false; render(); drawVouchQr(); },
    vscan:()=>startVouchScan(),
    vstop:()=>stopVouchScan(),
    vcommit:()=>commitVouch(),
    stylepick:()=>{ const d = S.styleDraft || (S.styleDraft = (S.user.style||[]).slice());
      S.styleDraft = d.includes(v) ? d.filter(x=>x!==v) : d.concat([v]); render(); },
    styleinfo:()=>{ S.styleInfo = S.styleInfo===v ? null : v; render(); },
    stylesave:()=>{ S.user.style = (S.styleDraft||[]).slice(); S.styleDraft=null; save();
      toast(S.user.style.length ? "Saved. Routes are ranked your way now." : "Nothing saved; you can set this any time.");
      S.stack=[]; tab("home"); },
    styleskip:()=>{ S.styleDraft=null; S.stack=[]; tab("home"); },
    askopen:()=>{ S.chat.open=true; render(); setTimeout(()=>{ const i=$("askin"); if(i) i.focus(); },120); },
    askclose:()=>{ S.chat.open=false; render(); },
    askthis:()=>askSend(v),
    asksend:()=>{ const i=$("askin"); if(i) askSend(i.value); },
    skin:()=>{
      const order=["aurora","studio","classic"], next = v || order[(order.indexOf(localStorage.getItem("ss.skin")||"aurora")+1)%3];
      const files={aurora:"css/style-aurora.css",studio:"css/style-studio.css",classic:"css/style-classic.css"};
      const link=$("skin");
      if(link) link.setAttribute("href", files[next]);
      else ["aurora","studio","classic"].forEach(k=>{ const el=$("skin-"+k); if(el) el.media = (k===next?"all":"not all"); });
      try{ localStorage.setItem("ss.skin", next); }catch(e){}
      render(); toast({aurora:"Aurora look",studio:"Studio look",classic:"Classic look"}[next]);
    },
    offline:()=>setOffline(!S.offline, "you"),
    savearea:()=>saveArea(),
    lang:()=>{ S.lang = S.lang==="hi" ? "en" : "hi"; save(); render();
      toast(S.lang==="hi" ? "मुख्य स्क्रीन अब हिंदी में हैं" : "Switched to English"); },
    sharereadings:()=>{ S.shareReadings=!S.shareReadings; render(); },
    signout:async()=>{
      try{ await Cloud.signOut(); }catch(err){}
      Store.signOut();
      try{ localStorage.removeItem("ss.signin.email"); }catch(err){}
      S.user.verified=false; S.travel.result=null; S.travel.sel=null; S.ang={...S.ang, qid:null, sid:null, wid:null};
      if(Agent.state.trip) stopJourney();
      S.stack=[]; S.tab="home"; S.screen="welcome"; save(); render(); toTop(); toast("Signed out");
    },
    /* map and sensors */
    tap:()=>{ S.mapTapped=true; render(); },
    heat:()=>{ S.heat=!S.heat; render(); if(S.heat){ if(!haveFix() && !locBlocked()) requestFix(false); ensureArea(); } },
    lightlayer:async()=>{ S.lightLayer=!S.lightLayer; render();
      if(S.lightLayer){ const u=userPos(); try{ await Light.loadFor([u.lng-0.01,u.lat-0.01,u.lng+0.01,u.lat+0.01]); }catch(e){} render(); } },
    showlight:()=>{ S.travel.showLight=!S.travel.showLight; render(); },
    live:enableLive, sound:startMicOnly, stoplive:stopSensing,
    /* safe travel */
    tmode:()=>{ go("tmode"); useMyPlaceAsStart(); }, mode:()=>{ T.mode=v; render(); },
    preset:()=>{ T.toPlace = PRESETS[+v]; T.to = T.toPlace.name; render(); },
    pclear:()=>{ S.travel[v]=""; if(v==="to") S.travel.toPlace=null; else S.travel.fromPlace=null; S.travel.sugg[v]=null; render(); },
    getloc:(quiet)=>requestFix(quiet===true),
    usehere:async()=>{
      S.travel.from="Finding your location…"; S.travel.fromPlace=null; S.travel.sugg.from=null; render();
      try{
        const f = await freshFix();
        LIVE.geo.lat=f.lat; LIVE.geo.lon=f.lng; LIVE.geo.acc=f.acc; LIVE.geo.on=true;
        hereAt = null; await refreshHereName();
        const name = S.hereName || (f.lat.toFixed(4)+", "+f.lng.toFixed(4));
        S.travel.from = name; S.travel.fromPlace = {name, lat:f.lat, lng:f.lng};
        render();
        if(f.acc > 600) toast("Your location is only accurate to about "+Math.round(f.acc)+" m here. Move outdoors for a better fix.");
      }catch(e){ S.travel.from=""; render(); toast(e.message); }
    },
    swapends:()=>{ const t=S.travel; [t.from,t.to]=[t.to,t.from]; [t.fromPlace,t.toPlace]=[t.toPlace,t.fromPlace]; t.sugg={}; render(); },
    pickplace:()=>{ const [f,i]=v.split("|"); const g=T.sugg&&T.sugg[f]; const p=g&&g.list&&g.list[+i]; if(!p) return;
      if(f==="from"){ T.fromPlace=p; T.from=p.name; } else { T.toPlace=p; T.to=p.name; }
      if(T.sugg) T.sugg[f]=null; rememberPlace(p); render(); },
    pref:()=>{ const list = S.travel.prefs || [];
      if(v==="balanced"){ S.travel.prefs = ["balanced"]; }
      else {
        const next = list.filter(x=>x!=="balanced");
        S.travel.prefs = next.includes(v) ? next.filter(x=>x!==v) : next.concat([v]);
      }
      if(S.travel.result){ const r = rankByPreference(S.travel.result.options);
        S.travel.result.pick = r.pick; S.travel.result.why = r.why; S.travel.result.close = r.close; S.travel.sel = r.pick; }
      render(); },
    whenchip:()=>{ const t=S.travel; t.when=v; const d=new Date();
      if(v==="now"){ t.date=todayStr(); t.at=nowStr(); }
      else if(v==="30"){ const x=new Date(Date.now()+30*60000); t.date=todayStr(); t.at=hm(x); }
      else if(v==="tom"){ const x=new Date(Date.now()+86400000); t.date=x.toISOString().slice(0,10); t.at="09:00"; }
      else { t.date=todayStr(); t.at=v; }
      render(); },
    find:()=>{ if(T.toPlace) findRoutes(); },
    pick:()=>{ T.sel = T.sel===v ? null : v; render(); },
    senses:()=>{ T.open[v]=!T.open[v]; render(); },
    ctoggle:()=>{ T.compare=!T.compare; render(); },
    askdest:()=>{ G.placeObj=T.toPlace; G.place=T.toPlace.name; G.list=null; go("askangels"); },
    start:()=>{ if(!T.sel) return;
      if(!S.consentAt){ S.pendingStart = true; return go("permissions"); }
      startJourney(); },
    permsok:()=>{ S.consentAt = Date.now(); save();
      if(S.pendingStart){ S.pendingStart=false; back(); startJourney(); } else back(); },
    stopsensing:()=>{ try{ SensorHub.setSound(false); }catch(e){}
      try{ SensorHub.setMode("quiet"); }catch(e){}
      LIVE.mic.on=false; LIVE.cam.on=false; LIVE.sensing=[]; render();
      toast("Microphone and camera stopped. Light now comes from the map and satellite."); },
    preciseloc:()=>{ S.preciseLoc = S.preciseLoc===false; save(); render(); },
    delmine:()=>confirmDelete(),
    end:()=>{ stopJourney(Agent.state.cards.some(c=>c.id==="reached")); S.audit=freshAudit(); go(Store.me().tier==="none"?"home":"new",true); },
    answer:()=>{ Agent.answer(+v); render(); },
    tripdone:()=>{ stopJourney(true); S.travel.active=null; Agent._S.cards=[]; S.stack=[]; tab("home"); },
    replay:()=>{ Agent.state.replaying ? Agent.stopReplay() : Agent.startReplay({speed:20}); render(); },
    showqr:()=>showQr(),
    sendsms:async()=>{ const x = JSON.parse(decodeURIComponent(v)); const r = await Native.sendSms(x.n, x.b); toast(r.sent?"SMS sent":"Could not send SMS"); if(S.screen==="sosactive"&&r.sent){ S.sos.sent=true; render(); } },
    /* audit */
    agate:()=>go(Store.me().tier!=="none"?"audit":"agate"),
    drawer:()=>{ S.drawer=!S.drawer; render(); },
    new:()=>{ S.audit=freshAudit(); if(S.screen==="journey"){ S.travel.active=null; S.stack=["audit"]; S.tab="audit"; S.screen="new"; render(); toTop(); } else go("new"); },
    quick:()=>{ S.audit=freshAudit(); go("new"); setTimeout(()=>{ const i=$("aph"); if(i) i.click(); },120); },
    adet:()=>{ S.di=+v; go("adet"); },
    readphoto:()=>{ if(S.audit.photo){ S.audit.busy=true; render(); readPhotoIntoForm(); } },
    star:()=>{ const [k,n]=v.split("|"); if(S.audit.filled) delete S.audit.filled[k]; S.audit[k]=+n; render(); },
    opt:()=>{ const [k,x]=v.split("|"); S.audit[k] = S.audit[k]===x?"":x; render(); },
    tag:()=>{ const i=S.audit.tags.indexOf(v); i>-1?S.audit.tags.splice(i,1):S.audit.tags.push(v); render(); },
    rmph:()=>{ S.audit.photo=null; render(); },
    submit:submitAudit,
    dispute:()=>{ Store.dispute(v); toast("Sent to nearby verified women for a quick check"); render(); },
    /* explore, share, guardians */
    cat:()=>{ S.cat=v; render(); ensureArea(); },
    retryarea:()=>ensureArea(null, true), allcat:()=>{ S.cat=null; render(); },
    tsh:()=>{ const i=S.share.with.indexOf(v); i>-1?S.share.with.splice(i,1):S.share.with.push(v); render(); },
    dosh:()=>{ if(S.share.with.length){ S.share.active=true; render(); } },
    stopshare:()=>{ S.share.active=false; S.share.with=[]; render(); },
    tgd:()=>{ S.guardians[v]=!S.guardians[v]; render(); },
    sharetrips:()=>{ S.guardians.shareTrips=!S.guardians.shareTrips; render(); },
    told:()=>{ Agent.tellWho(v==="none" ? null : +v); render(); },
    tellpick:()=>{ S.travel.tell = v==="none" ? "none" : +v; save(); render(); },
    watched:()=>{ S.watch && S.watch.on ? (stopWatched(false), render(), toast("Watched mode off")) : startWatched(); },
    copywatch:()=>{ const l=(S.watch||{}).link; if(!l) return;
      navigator.clipboard && navigator.clipboard.writeText(l);
      toast("Link copied — send it to whoever should hold your deadline"); },
    startg:()=>{ if(!(S.guardians.voice||S.guardians.camera||S.guardians.sms)) S.guardians.sms=true; S.guardians.active=true; render(); },
    stopg:()=>{ S.guardians.active=false; render(); },
    sosnow:()=>{ if(!haveFix() && !locBlocked()) requestFix(true); activateSOS(); },
    endsos:()=>{ S.sos={sent:false,opened:false,photos:0,photoErr:null}; S.stack=[]; tab("home"); },
    /* Angels */
    asearch:async()=>{ G.list=[]; render(); try{ const u=userPos(); G.list=(await Context.searchPlaces(G.place,{lat:u.lat,lng:u.lng})).slice(0,5); }catch(err){ G.list=null; toast("Search needs internet"); } render(); },
    apick:()=>{ G.placeObj=G.list[+v]; G.place=G.placeObj.name; G.list=null; render(); },
    apreset:()=>{ G.placeObj=PRESETS[+v]; G.place=G.placeObj.name; render(); },
    awhen:()=>{ G.when=v; render(); },
    doask:()=>{ if(!G.placeObj || Store.me().tier==="none") return; const q=Store.askAngels({place:G.placeObj.name,lat:G.placeObj.lat,lng:G.placeObj.lng,when:G.when}); G.qid=q.id; go("pulse"); },
    arate:()=>{ Store.rateAnswer(G.qid, v==="1"); render(); },
    reqangel:()=>{ if(Store.me().tier==="none") return; G.rated=false; G.stars=0; G.tags=[]; const s=Store.requestAngel({area:"rough area"}); G.sid=s.id; render(); },
    acceptangel:()=>{ Store.acceptAngel(G.sid); render(); },
    endangel:()=>{ const s=Store.session(G.sid); if(s&&s.status==="active"){ Store.endSession(G.sid); } else { if(s) Store.endSession(G.sid); G.sid=null; } render(); },
    amsg:()=>{ Store.sessionMessage(G.sid, v); render(); },
    astar:()=>{ G.stars=+v; render(); },
    atag:()=>{ const i=G.tags.indexOf(v); i>-1?G.tags.splice(i,1):G.tags.push(v); render(); },
    arate2:()=>{ const s=Store.session(G.sid); Store.endSession(G.sid, {stars:G.stars,tags:G.tags}); Store.heart(s&&s.angel?s.angel.name:"", ""); G.rated=true; G.sid=null; toast("Thank-you heart sent"); render(); },
    areport:()=>{ toast("Safety report sent. The Angel is paused until it is reviewed."); G.rated=true; G.sid=null; render(); },
    available:()=>toggleAvailable(),
    angelsort:()=>{ S.ang.sortBy = v; render(); },
    angelpick:()=>{ S.ang.pick = S.ang.pick === v ? null : v; render(); },
    askwalk:()=>askForAngel("walk"),
    asknearby:()=>askForAngel("nearby"),
    acceptsession:()=>acceptRequest(v),
    endsession:()=>endLiveSession(),
    closesession:()=>{ stopSessionWatch(); S.ang.session=null; render(); },
    opencircle:()=>{ G.circle=v; go("circles"); }, joincircle:()=>{ Store.joinCircle(v); render(); },
    postcircle:()=>{ const i=$("cpost"); Store.postCircle(G.circle, i?i.value:"", S.user.name); G.draft=""; render(); },
    angelon:()=>{ Store.setAngel({available:!Store.angel().available}); render(); },
    aradius:()=>{ Store.setAngel({radiusM:+v}); render(); },
    itap:()=>{ const [k,x]=v.split("|"); G.taps[k] = G.taps[k]===x?undefined:x; render(); },
    ianswer:()=>{ const q=Store.inbox()[0]; if(!q||!G.taps.lighting||!G.taps.people) return; Store.answerInbox(q.id,{...G.taps,note:G.note}); G.taps={}; G.note=""; toast("Answer sent · +3 halo points"); back(); },
    /* community forum (unchanged) */
    chat:()=>{ S.chatWith=v; go("chat"); }, send:sendMsg,
    like:()=>{ S.reacted[v]=!S.reacted[v]; render(); },
    rep:()=>{ S.openReplies = S.openReplies===+v?null:+v; render(); },
    post:()=>{ if(S.draftPost.trim()){ DATA.posts.unshift({a:S.user.name||"You",t:"Just now",b:S.draftPost.trim(),l:0,r:[]}); S.draftPost=""; } S.stack=[]; tab("connect"); },
    ask:()=>go("askangels"),
    nav:()=>toast("Opens in your maps app.")
  };
  if(A[a]){ e.preventDefault(); A[a](); save(); }
});
function phoneFeedback(el, value){
  const box = el.closest(".field"); if(!box) return;
  const wrap = box.querySelector(".phwrap");
  let msg = box.querySelector(".phmsg");
  if(!msg){ msg = document.createElement("p"); msg.className = "tiny phmsg"; box.appendChild(msg); }
  const ok = phoneOk(value);
  msg.textContent = ok ? "" : phoneHint(value);
  msg.style.color = "var(--danger)";
  if(wrap){
    wrap.classList.toggle("ok", ok);
    let tick = wrap.querySelector(".phok");
    if(ok && !tick){ tick = document.createElement("span"); tick.className = "phok"; tick.innerHTML = ic("check",15,3); wrap.appendChild(tick); }
    if(!ok && tick) tick.remove();
  }
  refreshFormState();
}

/* keep Continue / Save in step with what is typed, without re-rendering the screen */
function refreshFormState(){
  const pairs = [["ob1go","ob1hint", () => (S.user.name||"").trim() && phoneOk(S.user.phone) && S.user.gender],
                 ["csave","chint",   () => { const c=S.contacts[S.ei]||{}; return (c.n||"").trim() && phoneOk(c.p); }]];
  for(const [btnId, hintId, test] of pairs){
    const btn = $(btnId); if(!btn) continue;
    const ok = !!test();
    btn.classList.toggle("dim", !ok);
    const hint = $(hintId); if(hint) hint.style.display = ok ? "none" : "";
  }
}
document.addEventListener("input", e => {
  if(e.target && e.target.dataset && /name|contact\.n/.test(e.target.dataset.b||"")) setTimeout(refreshFormState,0);
  const b = e.target.dataset.b; if(!b) return;
  const val = e.target.value;
  if(b==="draftPost") S.draftPost = val;
  else if(b.indexOf("angel.")===0) Store.setAngel({[b.split(".")[1]]: val});
  else if(!b.includes(".")){ S[b] = val; }        // a plain top-level field, such as the password
  else { const [o,k] = b.split("."); if(o==="contact"){ S.contacts[S.ei][k]=val; syncContacts(); } else S[o][k]=val;
    if(k==="phone" || (o==="contact" && k==="p")){
      const el = e.target, digits = val.replace(/\D/g,"").slice(0,10);
      if(digits !== val){ const at = el.selectionStart - (val.length - digits.length);
        el.value = digits; try{ el.setSelectionRange(Math.max(0,at), Math.max(0,at)); }catch(err){}
        if(o==="contact") S.contacts[S.ei][k] = digits; else S[o][k] = digits; }
      phoneFeedback(el, digits);
    }
    if(b==="travel.to"){ S.travel.toPlace=null; suggest("to", val); }
    if(b==="travel.from"){ S.travel.fromPlace=null; suggest("from", val); }
    if(b==="user.name") Agent.setName(val); }
});
function finish(){
  S.stack=[];
  if(!S.user.style){ S.styleDraft = []; S.user.style = S.user.style || null; return go("style"); }
  tab("home");
}
function syncContacts(){ Agent.setContacts(acts().map((c,i)=>({name:c.n, phone:c.p.replace(/\s/g,""), primary:i===0}))); }

let tT;
function toast(m){
  let el = $("toast");
  if(!el){ el=document.createElement("div"); el.id="toast";
    el.style.cssText="position:absolute;left:50%;transform:translateX(-50%);bottom:88px;background:var(--ink);color:var(--bg);padding:9px 15px;border-radius:8px;font-size:12.5px;font-weight:600;z-index:40;max-width:82%;text-align:center;transition:opacity .2s";
    $("device").appendChild(el); }
  el.textContent=m; el.style.opacity="1"; clearTimeout(tT);
  tT=setTimeout(()=>{ el.style.opacity="0"; },2400);
}

async function askSend(text){
  const q = (text||"").trim(); if(!q) return;
  S.chat.msgs.push({me:true, text:q}); S.chat.busy=true; render();
  const body = $("askbody"); if(body) body.scrollTop = body.scrollHeight;
  let a;
  try{ a = await Ask.ask(q); }
  catch(e){ a = {text:"Something went wrong answering that.", source:"error"}; }
  S.chat.busy=false;
  S.chat.msgs.push({me:false, text:a.text, source:a.source});
  render();
  const b2 = $("askbody"); if(b2) b2.scrollTop = b2.scrollHeight;
}

/* Delete everything this person has: backend first, then this phone */
async function confirmDelete(){
  if(!confirm("Delete your audits, Angel answers and profile from the backend, and everything saved on this phone? This cannot be undone.")) return;
  S.delBusy = true; render();
  let msg = "Deleted from this phone.";
  try{
    if(Cloud.signedIn){ const r = await Cloud.deleteMyData();
      msg = "Deleted "+r.reports+" audit"+(r.reports===1?"":"s")+" and "+r.answers+" answer"+(r.answers===1?"":"s")+" from the backend, and everything on this phone."; }
  }catch(e){ msg = "Backend: "+e.message+" Everything on this phone was still deleted."; }
  try{ await Cloud.signOut(); }catch(e){}
  Store.reset();
  try{ localStorage.clear(); sessionStorage.clear(); if("caches" in window){ for(const k of await caches.keys()) await caches.delete(k); } }catch(e){}
  S.delBusy = false;
  alert(msg);
  location.reload();
}

/* Save an instant audit: as a reading for route scoring, and, when something
   unusual was found, as an alert other women near here see. */
async function saveInstant(){
  const a = S.inst, r = a.reading; if(!r) return;
  const pos = userPos();
  const reading = Instant.toReading(r, pos);
  const place = S.hereName || "Current location";

  // her own audit list
  S.audits = [{ d:"Today", loc:place, sum:r.summary, pts:10,
    status: Store.me().tier==="gold"||Store.me().tier==="partner" ? "confirmed" : "pending",
    tags:r.tags, unusual:r.unusual||null, note:a.remark }].concat(S.audits||[]);
  S.points = (S.points||0) + 10; S.logged = (S.logged||0) + 1;

  // shared record: conditions only, never the words about a person
  try{
    Store.addReport({
      lat: pos.lat, lng: pos.lng, place,
      claims: { light: r.light, crowd: r.people, shops: r.shops, path: r.path, dogs: r.dogs ? "yes" : null },
      readingsAgree: r.confidence >= 0.7,
      note: r.targets_person ? r.summary : (a.remark || r.summary),
      tags: r.tags, unusual: r.unusual || null,
      light: reading.light, liveliness: reading.liveliness, dogPack: reading.dogPack, source: r.source });
  }catch(e){}

  if(r.unusual){
    S.alerts = [{ t:"Unusual: "+r.unusual.what, b:r.summary+" Reported just now near "+place+".",
      tag:"Alert nearby", tone:"mod", unread:true, at:Date.now() }].concat(S.alerts||[]);
    toast("Saved. Women near here will see this.");
  } else toast("Saved. Thank you — this counts for other women.");

  S.inst = {remark:"", photo:null, mime:null, reading:null, busy:false};
  save(); S.stack=[]; tab("audit");
}

/* ---------------- Watched mode ----------------
   Her phone leaves a short note on the server every couple of minutes, and
   sends the reason for any silence it can see coming. One record, overwritten,
   deleted when she arrives. */
let watchTimer = null, watchToken = null, coverageTimer = null;

async function startWatched(){
  const t = Agent.state.trip;
  if(!t) return toast("Start a trip first.");
  if(!Cloud.signedIn) return toast("Sign in to use watched mode.");
  try{
    watchToken = Cloud.newWatchToken();
    await Cloud.startWatch({ token:watchToken, name:S.user.name||"She",
      destName:t.destName, dueAt:t.dueAt, callByAt:t.callByAt });
    S.watch = { on:true, token:watchToken, link:watchLink(watchToken) };
    sendWatchNote();
    watchTimer = setInterval(sendWatchNote, noteEvery());
    coverageTimer = setInterval(sendCoverage, 120000);
    sendCoverage();
    save(); render();
    toast("Watched mode on. Send the link to whoever should hold it.");
  }catch(e){
    S.watch = {on:false};
    toast(e.code==="permission-denied" ? "Watched mode needs the updated rules published in Firebase." : e.message);
    render();
  }
}

const watchLink = tok => location.origin + location.pathname + "#w/" + tok;

/* Faster after dark, and in the last ten minutes before she is due */
function noteEvery(){
  const t = Agent.state.trip; if(!t) return 120000;
  const close = t.dueAt - Date.now() < 10*60000;
  const dark = Light.isDark(userPos().lat, userPos().lng, Date.now());
  return close ? 45000 : dark ? 90000 : 150000;
}

async function sendWatchNote(){
  if(!watchToken || !Agent.state.trip) return;
  const st = SensorHub.state, u = userPos();
  const rem = (()=>{ try{ const l = Context.locateOnRoute(S.travel.result
      ? (S.travel.result.options.find(o=>o.id===S.travel.sel)||{}).coords||[] : [], u.lat, u.lng);
      return l.totalM ? Math.round(l.totalM - l.alongM) : null; }catch(e){ return null; } })();
  try{
    await Cloud.watchPing(watchToken, {
      battery: st.battery.level, signal: st.signal.dbm != null ? st.signal.dbm : (LIVE.net.online?-85:null),
      moving: st.motion.activity !== "still", onRoute: Agent._S ? !Agent._S.offRouteSince : true,
      lat: u.lat, lng: u.lng, metresLeft: rem,
    });
  }catch(e){}
  clearInterval(watchTimer); watchTimer = setInterval(sendWatchNote, noteEvery());
}

/* Anonymous: does this street have coverage right now? */
async function sendCoverage(){
  if(!Cloud.signedIn || !haveFix()) return;
  try{ await Cloud.reportCoverage(LIVE.geo.lat, LIVE.geo.lon, !!LIVE.net.online); }catch(e){}
}

/* The reason, sent to the server as well as to her contact */
function watchExpect(kind, fromMs, toMs, detail){
  if(!watchToken) return;
  Cloud.watchExpect(watchToken, { kind, from: fromMs, to: toMs, detail, at: Date.now() }).catch(()=>{});
}

function stopWatched(arrived){
  clearInterval(watchTimer); watchTimer = null;
  clearInterval(coverageTimer); coverageTimer = null;
  if(watchToken) Cloud.endWatch(watchToken, arrived).catch(()=>{});
  watchToken = null; S.watch = {on:false};
  save();
}

/* ---------------- Vouching: the code, and reading one ---------------- */
function drawVouchQr(){
  const box = $("vqr"); if(!box || !S.vouch.code) return;
  box.innerHTML = "";
  if(window.QRCode) new QRCode(box, {text:"sixthsense:vouch:"+S.vouch.code, width:174, height:174,
    correctLevel: QRCode.CorrectLevel.M});
  else box.innerHTML = '<p class="small" style="padding:10px;color:var(--ink-2)">Read her the six letters below.</p>';
}
let vouchLoaded = false;
async function loadVouchState(){
  if(vouchLoaded || !Cloud.signedIn) return;
  vouchLoaded = true;
  try{ S.vouch.have = await Cloud.myVouches(); }catch(e){}
  try{ S.vouch.given = await Cloud.vouchesGiven(); }catch(e){}
  softRender();
}

async function commitVouch(){
  const v = S.vouch, code = (v.typed||"").trim().toUpperCase();
  if(code.length !== 6) return;
  v.msg = null; render();
  try{
    const r = await Cloud.vouchFor(code);
    v.ok = true; v.msg = "Vouched for "+r.name+". "+r.left+" left this month.";
    v.typed = ""; v.given = await Cloud.vouchesGiven(); stopVouchScan();
  }catch(e){
    v.ok = false;
    v.msg = e.code === "permission-denied"
      ? "Vouching needs the updated rules published in Firebase." : e.message;
  }
  render();
}

let vStream = null, vTimer = null;
async function startVouchScan(){
  if(!("BarcodeDetector" in window)){
    S.vouch.msg = "This browser cannot scan. Type the six letters she is showing you.";
    S.vouch.ok = false; return render();
  }
  S.vouch.scanning = true; S.vouch.msg = null; render();
  try{
    vStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
    const v = $("vcam"); v.srcObject = vStream; await v.play();
    const det = new BarcodeDetector({ formats:["qr_code"] });
    vTimer = setInterval(async ()=>{
      try{
        const codes = await det.detect(v);
        const hit = codes.map(c=>c.rawValue).find(t => /^sixthsense:vouch:[A-Z0-9]{6}$/.test(t||""));
        if(hit){ S.vouch.typed = hit.split(":")[2]; stopVouchScan(); commitVouch(); }
      }catch(e){}
    }, 400);
  }catch(e){
    S.vouch.scanning = false;
    S.vouch.msg = "The camera is not available. Type the six letters instead."; S.vouch.ok = false; render();
  }
}
function stopVouchScan(){
  clearInterval(vTimer); vTimer = null;
  if(vStream){ vStream.getTracks().forEach(t=>t.stop()); vStream = null; }
  if(S.vouch && S.vouch.scanning){ S.vouch.scanning = false; render(); }
}

/* ---------------- Angels: presence, requests, live sessions ---------------- */
let unwatchAngels=null, unwatchRequests=null, unwatchSession=null, pingTimer=null, presenceTimer=null;

async function toggleAvailable(){
  const G = S.ang;
  if(!Cloud.signedIn) return toast("Sign in to be available to other women.");
  G.available = !G.available;
  try{
    await Cloud.setAvailable(G.available, userPos(), "both");
    if(G.available){
      presenceTimer = setInterval(()=>Cloud.setAvailable(true, userPos(), "both").catch(()=>{}), 4*60000);
      unwatchRequests = Cloud.watchRequests(userPos(), list => { S.ang.requests = list; softRender(); });
      toast("You are available. Requests within 3 km will appear here.");
    } else {
      clearInterval(presenceTimer); if(unwatchRequests) unwatchRequests(); unwatchRequests=null;
      S.ang.requests = []; toast("You are no longer listed.");
    }
  }catch(e){ G.available = !G.available;
    toast(e.code==="permission-denied"
      ? "Angel matching needs the updated rules published in Firebase (firestore.rules in the project)."
      : Cloud.explain(e)); }
  save(); render();
}

/* Watch who is available, whenever a Connect screen is open */
function watchAngelsIfNeeded(){
  const wants = ["walk","nearby"].includes(S.screen);
  if(wants && !unwatchAngels && Cloud.signedIn){
    unwatchAngels = Cloud.watchAngels(userPos(), list => { S.ang.angels = list; softRender(); });
  } else if(!wants && unwatchAngels){ unwatchAngels(); unwatchAngels=null; }
}

async function askForAngel(kind){
  const G = S.ang;
  if(!Cloud.signedIn) return toast("Sign in to reach real Angels.");
  if(G.asking) return;
  G.asking = true; render();
  try{
    const id = await Cloud.askAngel({ kind, pos:userPos(),
      to: S.travel.toPlace ? S.travel.toPlace.name : null, meet: G.meet || null,
      only: G.pick || null });          // asking one person, or everyone nearby
    startSessionWatch(id);
    toast("Asked. Verified women within 3 km can see it now.");
  }catch(e){ toast(e.code==="permission-denied"
      ? "Angel matching needs the updated rules published in Firebase (firestore.rules in the project)."
      : Cloud.explain(e)); }
  G.asking = false; render();
}

async function acceptRequest(id){
  const req = (S.ang.requests||[]).find(r => r.id === id);
  try{
    await Cloud.acceptSession(id);
    startSessionWatch(id);
    go(req && req.kind === "walk" ? "walk" : "nearby");     // she now sees the live session
    toast("You accepted. She can see you now.");
  }catch(e){ toast(e.message); }
}

function startSessionWatch(id){
  stopSessionWatch();
  S.ang.sessionId = id;
  unwatchSession = Cloud.watchSession(id, x => {
    S.ang.session = x;
    if(x && x.status === "joined" && !pingTimer){
      const asAngel = x.angel === (Cloud.user && Cloud.user.uid);
      const ping = () => Cloud.pingSession(id, userPos(), asAngel).catch(()=>{});
      ping(); pingTimer = setInterval(ping, 20000);      // location only while it runs
    }
    if(x && x.status === "ended"){ clearInterval(pingTimer); pingTimer=null; }
    softRender();
  });
  render();
}
function stopSessionWatch(){
  if(unwatchSession) unwatchSession(); unwatchSession=null;
  clearInterval(pingTimer); pingTimer=null;
  S.ang.sessionId = null;
}
async function endLiveSession(){
  const x = S.ang.session; if(!x) return;
  try{ await Cloud.endSessionCloud(x.id); }catch(e){}
  clearInterval(pingTimer); pingTimer=null;
  toast("Session ended. Location sharing has stopped.");
}

/* ---------------- offline mode ---------------- */
function setOffline(on, by){
  S.offline = !!on; S.offlineBy = on ? (by||"you") : null;
  if(on){ SensorHub.setPower && SensorHub.setPower("saving"); }
  save(); render();
  toast(on ? "Offline mode on — data off, protection on" : "Offline mode off");
}

/* Save everything needed for this area: streets, help points, lighting and map tiles */
async function saveArea(){
  if(S.offline) return toast("Turn offline mode off to save a new area.");
  const u = userPos();
  S.packBusy = true; S.packMsg = "Saving streets, help points and lighting…"; render();
  try{
    const box = [u.lng-0.018, u.lat-0.018, u.lng+0.018, u.lat+0.018];   // about 2 km each way
    await Light.loadFor(box);
    S.packMsg = "Saving the streets, so routes work with no signal…"; softRender();
    let streets = null;
    try{ streets = await Reroute.save(u); }catch(e){ toast("Streets: "+e.message); }
    S.packMsg = "Saving the map for this area…"; softRender();
    const tiles = await cacheTiles(u, 15, 16);
    const help = Light.helpPoints().length;
    S.pack = { at: Date.now(), name: S.hereName || "this area", help, tiles,
               streets: streets ? streets.nodes : 0,
               routes: S.travel.active ? 1 : 0, lat:u.lat, lng:u.lng };
    save(); toast("Saved for "+S.pack.name+": "+help+" places, "+tiles+" map tiles"+(S.pack.streets?", "+S.pack.streets+" street points":""));
  }catch(e){ toast("Could not save this area: "+e.message); }
  S.packBusy = false; S.packMsg = null; render();
}

/* Put the map tiles for this area into the browser cache, so the real map works offline */
async function cacheTiles(p, zFrom, zTo){
  if(!("caches" in window)) return 0;
  const cache = await caches.open("ss-tiles-v1");
  let n = 0;
  for(let z = zFrom; z <= zTo; z++){
    const n0 = Math.pow(2, z);
    const cx = Math.floor((p.lng + 180) / 360 * n0);
    const cy = Math.floor((1 - Math.log(Math.tan(p.lat*Math.PI/180) + 1/Math.cos(p.lat*Math.PI/180))/Math.PI) / 2 * n0);
    const span = z === zFrom ? 2 : 3;
    for(let x = cx-span; x <= cx+span; x++) for(let y = cy-span; y <= cy+span; y++){
      const url = `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
      try{ const r = await fetch(url, {mode:"cors"}); if(r.ok){ await cache.put(url, r.clone()); n++; } }catch(e){}
    }
    S.packMsg = "Saving the map… "+n+" tiles"; softRender();
  }
  return n;
}

/* Make sure we have map data (help points, lit tags, satellite) for where she is */
let areaBusy = false, areaAt = null;
async function ensureArea(p, force){
  p = p || userPos();
  if(areaBusy) return;
  if(!force && areaAt && SensorHub.distanceM(areaAt.lat, areaAt.lng, p.lat, p.lng) < 800) return;
  areaBusy = true; areaAt = p; S.areaLoading = true; S.areaErr = null; softRender();
  try{ await Light.loadFor([p.lng-0.008, p.lat-0.008, p.lng+0.008, p.lat+0.008]); }
  catch(e){ S.areaErr = "Could not load places for this area."; }
  areaBusy = false; S.areaLoading = false; softRender();
}

/* ---------------- places and routes ---------------- */
/* ---------------- type-ahead place search ---------------- */
let suggestT = {};
function paintSuggest(field){
  const box = $("sg-"+field);
  if(box) box.innerHTML = suggestList(field);
}
function localMatches(q){
  const out = [];
  const t = q.toLowerCase();
  (S.recent||[]).filter(p=>p.name.toLowerCase().includes(t)).slice(0,3).forEach(p=>out.push({...p, kind:"recent"}));
  if(window.Metro && Metro.network){
    for(const [id,st] of Object.entries(Metro.network.stations)){
      if(st.n.toLowerCase().includes(t)){ out.push({name:st.n+" Metro", area:(st.lines||[]).join(", ")+" line", lat:st.lat, lng:st.lng, kind:"metro"}); }
      if(out.length>=7) break;
    }
  }
  return out;
}
function suggest(field, text){
  const q = (text||"").trim();
  clearTimeout(suggestT[field]);
  if(q.length < 2){ S.travel.sugg[field] = null; paintSuggest(field); return; }
  S.travel.sugg[field] = { loading:true, list: localMatches(q) };
  paintSuggest(field);
  suggestT[field] = setTimeout(async () => {
    const local = localMatches(q);
    try{
      const u = userPos();
      const found = await Context.searchPlaces(q, {lat:u.lat, lng:u.lng});
      // drop places that repeat a name we already have, or sit within 150 m of one
      const kept = local.slice();
      for(const p of found){
        const dup = kept.some(q => q.name.toLowerCase()===p.name.toLowerCase() ||
          (q.lat!=null && SensorHub.distanceM(q.lat,q.lng,p.lat,p.lng) < 150));
        if(!dup) kept.push(p);
        if(kept.length >= 7) break;
      }
      const list = kept;
      S.travel.sugg[field] = { list, msg: list.length ? null : "No place found with that name." };
    }catch(err){
      S.travel.sugg[field] = { list: local, msg: local.length ? null : "Search needs internet. Saved places still work." };
    }
    paintSuggest(field);
  }, 350);
}
function rememberPlace(p){
  if(!p || p.lat==null) return;
  S.recent = [{name:p.name, area:p.area||"", lat:p.lat, lng:p.lng}]
    .concat((S.recent||[]).filter(x=>x.name!==p.name)).slice(0,6);
  save();
}
/* On Safe Travel the starting point fills itself in, without anything on Home */
async function useMyPlaceAsStart(){
  const t = S.travel;
  if(t.fromPlace || (t.from && !/current location|finding/i.test(t.from))) return;   // she typed her own
  if(!haveFix()){
    if(locBlocked()) return;
    await requestFix(true);
    if(!haveFix()) return;
  }
  if(!S.hereName){ hereAt = null; await refreshHereName(); }
  if(S.hereName){
    t.from = S.hereName;
    t.fromPlace = { name:S.hereName, lat:LIVE.geo.lat, lng:LIVE.geo.lon };
    softRender();
  }
}

/* Ask the browser for location. No button and no message of ours: the browser's
   own permission prompt is the only thing she sees. */
async function requestFix(quiet){

      if(S.locBusy) return;
      S.locBusy = true; S.locErr = null; render();
      try{
        const f = await freshFix();
        LIVE.geo.lat=f.lat; LIVE.geo.lon=f.lng; LIVE.geo.acc=f.acc; LIVE.geo.on=true;
        hereAt = null; await refreshHereName();
        try{ SensorHub.start(); }catch(e){}
        ensureArea(null, true);
        if(quiet !== true) toast(S.hereName ? "Found you near "+S.hereName : "Location found");
        if(S.screen==="tmode" && /current|finding/i.test(S.travel.from||"") && S.hereName){
          S.travel.from = S.hereName; S.travel.fromPlace = {name:S.hereName, lat:f.lat, lng:f.lng};
        }
      }catch(e){ S.locErr = e.message; if(quiet !== true && S.screen !== "home") toast(e.message); }
      S.locBusy = false; render();
    }
function askLocationQuietly(){ if(!haveFix() && !locBlocked()) requestFix(true); }

/* Why location might not work here, in plain words */
function locBlocked(){
  if(!navigator.geolocation) return "This browser cannot find your location.";
  if(!window.isSecureContext) return "Location needs https. Open the deployed link, or run the app from localhost.";
  try{ if(window.self !== window.top) return "This preview window blocks location. Open the app in its own tab.";}catch(e){
    return "This preview window blocks location. Open the app in its own tab."; }
  return null;
}

/* Ask for a fresh, accurate fix, rather than whatever the browser cached */
function freshFix(){
  return new Promise((res, rej) => {
    const why = locBlocked(); if(why) return rej(new Error(why));
    navigator.geolocation.getCurrentPosition(
      p => res({lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy}),
      e => rej(new Error(
        e.code===1 ? "Location is blocked for this site. Tap the lock icon in the address bar and allow Location, then try again."
        : e.code===2 ? "Your phone could not get a fix. Move near a window or outdoors and try again."
        : "Finding your location took too long. Try again.")),
      { enableHighAccuracy:true, maximumAge:0, timeout:15000 });
  });
}

async function locateName(){
  const u = userPos();
  try{
    const name = await Context.placeName(u.lat, u.lng);
    if(name){ S.travel.from = name; S.travel.fromPlace = {name, lat:u.lat, lng:u.lng}; S.hereName = name; softRender(); }
  }catch(e){ toast("Could not read the place name; using coordinates."); }
}

/* Name of where she is now, refreshed when she moves more than 300 m */
let hereAt = null;
async function refreshHereName(){
  const sg = SensorHub.state.gps;
  const g = sg.lat != null ? sg : (LIVE.geo.lat != null ? {lat:LIVE.geo.lat, lng:LIVE.geo.lon, acc:LIVE.geo.acc} : {lat:null});
  if(g.lat == null) return;
  if(g.acc != null && g.acc > 3000){ S.hereName = null; S.hereRough = true; softRender(); return; }
  S.hereRough = g.acc != null && g.acc > 600;
  if(hereAt && SensorHub.distanceM(hereAt.lat, hereAt.lng, g.lat, g.lng) < 300) return;
  hereAt = {lat:g.lat, lng:g.lng};
  try{ const n = await Context.placeName(g.lat, g.lng);
    S.hereName = S.hereRough ? n + " (approximate)" : n; softRender(); }catch(e){}
}
SensorHub.on("gps", () => { clearTimeout(refreshHereName.t); refreshHereName.t = setTimeout(refreshHereName, 1500); });

async function placeSearch(field){
  const T = S.travel, q = (T[field]||"").trim();
  if(/^current/i.test(q) && field==="from"){ T.fromPlace=null; T.search=null; return render(); }
  if(q.length<2) return toast("Type a place name first");
  T.search={field, loading:true, list:[]}; render();
  try{ const u=userPos(); T.search={field, list:(await Context.searchPlaces(q,{lat:u.lat,lng:u.lng})).slice(0,5)}; if(!T.search.list.length) T.search.err="No places found."; }
  catch(err){ const hits=PRESETS.filter(p=>p.name.toLowerCase().indexOf(q.toLowerCase())>-1); T.search={field, list:hits, err:hits.length?null:"Search needs internet. Try a saved place."}; }
  render();
}
async function findRoutes(){
  const T = S.travel, from = placeOf("from"), to = T.toPlace;
  if(!from){ T.err = "Set a starting point, or tap ◎ to use your location."; T.loading=false; render(); return; }
  T.loading=true; T.result=null; T.err=null; T.sel=null; T.open={}; T.compare=false; go("routes");
  try{
    const when = departAt(T);
    let opts;
    if(S.offline){
      const r = Reroute.route(from, to);                    // from the streets saved earlier
      opts = [{ id:"offline-walk", kind:"walk", title:"Walk · saved streets", offline:true,
        legs:[{mode:"walk", route:r, from, to, minutes:r.durationMin, metres:r.distanceM}],
        minutes:r.durationMin, metres:r.distanceM, fare:0, coords:r.coords, route:r,
        walkMinutes:r.durationMin, leaveBy:new Date(when) }];
    } else {
      opts = await Journeys.build({from, to, when, battery:LIVE.batt.level});
    }
    if(T.mode==="walk") opts = opts.filter(o=>o.kind==="walk");
    if(T.mode==="auto") opts = opts.filter(o=>["auto","cab","own"].includes(o.kind));
    if(T.mode==="metro") opts = opts.filter(o=>o.kind==="mixed");
    if(!opts.length) throw new Error(T.mode==="metro"?"No metro option nearby for this trip.":"No routes found. Check your internet connection.");
    const coords = opts.flatMap(o=>o.coords);

    // Compare on what we already have, show it, then improve it once the
    // lighting and help-point data arrives. Waiting for Overpass first was
    // what made this take twenty seconds.
    const finish = (lightReady) => {
      try{
        // history comes from the backend; the local generator is only a fallback
        // for a signed-out demo, and it is labelled as simulated either way
        if(Normals.stats().usable < 40 && !Cloud.signedIn)
          Normals.learn(MockSensing.history(opts.map(o=>o.route), 3, when));
        Normals.learn(Agent.readings());
      }catch(e){}
      const readings = MockSensing.generate(opts.map(o=>o.route), when)
        .concat(Agent.readings(), Store.reportReadings());
      const inPilot = MockSensing.inPilot(to.lat,to.lng) || MockSensing.inPilot(from.lat,from.lng);
      const cmp = Journeys.compare(opts, {readings, now:when, help:helpList(), zones:ZONES});

      for(const o of opts){
        o.unusual = null;
        const pts = (o.coords||[]).filter((_,i)=>i%6===0);
        for(const [lng,lat] of pts){
          const near = readings.filter(r => SensorHub.distanceM(lat,lng,r.lat,r.lng) < 60);
          if(near.length < 2) continue;
          const nowVals = { light: near.reduce((a,r)=>a+(r.light||0),0)/near.length,
                            liveliness: near.reduce((a,r)=>a+(r.liveliness||0),0)/near.length,
                            signalDbm: near.reduce((a,r)=>a+(r.signalDbm||0),0)/near.length };
          const list = Normals.anomaly(lat, lng, nowVals, when);
          if(list.length && (!o.unusual || list[0].z > o.unusual.z))
            o.unusual = {...list[0], lat, lng, text: Normals.sentence(list, when)};
        }
        // a stretch behaving unlike itself lowers the senses it belongs to, so it
        // can change the recommendation rather than only be mentioned
        if(o.unusual){
          o.cons = [o.unusual.text].concat(o.cons||[]).slice(0,3);
          const hit = Math.min(22, Math.round((o.unusual.z - 1.5) * 8));   // 1.5 spreads = nothing, 4+ = 20 points
          if(o.unusual.dir === "low" && hit > 0 && o.bars){
            const drop = (k) => { if(o.bars[k] && o.bars[k].pct != null)
              o.bars[k] = {...o.bars[k], pct: Math.max(0, o.bars[k].pct - hit), unusual: true}; };
            if(o.unusual.signal === "activity"){ drop("HEAR"); drop("TRIBE"); }
            if(o.unusual.signal === "light"){ drop("SEE"); }
          }
        }
      }

      const ranked = rankByPreference(opts);
      T.result = {options:opts, lead:cmp.lead, warnings:[], sim:inPilot,
                  pick:ranked.pick, why:ranked.why, close:ranked.close, refining:!lightReady};
      T.sel = T.sel && opts.some(o=>o.id===T.sel) ? T.sel : ranked.pick;
      T.loading = false;
      if(S.screen==="routes") render();
    };

    finish(Light.hasArea && Light.hasArea(Light.boundsOf(coords)));

    // and again, quietly, once the street data is in
    Light.loadFor(Light.boundsOf(coords))
      .then(() => { if(S.screen==="routes" && T.result) finish(true); })
      .catch(() => { if(T.result) { T.result.refining = false; if(S.screen==="routes") render(); } });
    return;
  }catch(err){ T.err = err.message; }
  T.loading=false; if(S.screen==="routes") render();
}
/* What she says matters right now, and what that does to the weighting.
   sense weights multiply the six senses; time and fare weights change the penalty
   for being slower or dearer than the best option. */
/* Accounts prepared for demonstrations: they sign in on the email alone.
   Any other address goes through the normal emailed sign-in link. */
const DEMO_ACCOUNTS = ["arshpreet@igdtuw.ac.in","aashi@igdtuw.ac.in","kiran@igdtuw.ac.in",
                       "vanya@igdtuw.ac.in","kashvi@igdtuw.ac.in","judge@example.com"];
const DEMO_KEY = "sixth123";

const PREF_SETS = {
  faster:   { label:"Faster route",           senses:{},                    time:2.4, fare:0.4, walk:1,
              note:"Ranks quicker options higher, even if conditions are a little weaker." },
  cheaper:  { label:"Cheaper route",          senses:{},                    time:0.6, fare:2.4, walk:1,
              note:"Ranks cheaper options higher; walking and metro come first." },
  transfers:{ label:"Few transfer stations",  senses:{},                    time:1,   fare:0.4, walk:1, legs:2.2,
              note:"Prefers one vehicle over metro-plus-auto with a change." },
  lighting: { label:"Good lighting",          senses:{SEE:2.4},             time:0.6, fare:0.3, walk:1,
              note:"Prefers routes lit the whole way, with no dark gaps." },
  weather:  { label:"Weather sensitive",      senses:{},                    time:0.9, fare:0.4, walk:1.8,
              note:"In rain or heat, prefers less time outdoors." },
  signal:   { label:"Internet connection",    senses:{CALL:2.2},            time:0.7, fare:0.3, walk:1,
              note:"Prefers routes where your phone keeps signal." },
  help:     { label:"Help stations nearby",   senses:{CALL:1.8, RUN:1.8},   time:0.7, fare:0.3, walk:1,
              note:"Prefers routes passing police posts, hospitals, pharmacies and staffed places." },
  activity: { label:"Crowded area",           senses:{TRIBE:2.2, HEAR:1.8}, time:0.7, fare:0.3, walk:1,
              note:"Prefers streets where people are about and shops are open." },
  lesswalk: { label:"Less walking",           senses:{},                    time:1,   fare:0.4, walk:2.4,
              note:"Prefers options with less walking, such as a door-to-door auto." },
  balanced: { label:"Balanced",               senses:{},                    time:1,   fare:0.5, walk:1,
              note:"No single thing weighted above the others." },
};
const STYLE_ORDER = ["faster","cheaper","transfers","lighting","weather","signal","help","activity","lesswalk"];

/* Rank the options by what she asked for, and say why the winner won */
function rankByPreference(opts){
  const usual = (S.user.style && S.user.style.length ? S.user.style : []);
  const extra = (S.travel.prefs || []).filter(k => k !== "balanced");
  // what she added for this trip is named first, because it is the reason things moved
  const keys = (extra.concat(usual).length ? [...new Set(extra.concat(usual))] : ["balanced"]);
  // anything she added for this trip counts double against her usual style
  const chosen = keys.map(k => {
    const p = PREF_SETS[k]; if(!p) return null;
    if(!extra.includes(k)) return p;
    const senses = {}; for(const [s2,v] of Object.entries(p.senses)) senses[s2] = 1 + (v-1)*1.6;
    return {...p, senses, time:1+(p.time-1)*1.6, fare:p.fare*1.6, walk:1+((p.walk||1)-1)*1.6};
  }).filter(Boolean);
  const w = { senses:{}, time:0, fare:0, walk:0 };
  w.legs = 0; w.known = 0;
  for(const p of chosen){
    for(const [k,v] of Object.entries(p.senses)) w.senses[k] = Math.max(w.senses[k]||1, v);
    w.time += p.time; w.fare += p.fare; w.walk += (p.walk||1);
    w.legs = Math.max(w.legs, p.legs||1); w.known = Math.max(w.known, p.known||1);
  }
  const n = chosen.length || 1;
  w.time /= n; w.fare /= n; w.walk /= n;

  const fastest = Math.min(...opts.map(o=>o.minutes));
  const cheapest = Math.min(...opts.map(o=>o.fare||0));
  const leastWalk = Math.min(...opts.map(o=>o.walkMinutes||0));

  for(const o of opts){
    // conditions: the six senses, weighted by what she asked for
    let sum=0, tot=0, best=null;
    for(const [sense,b] of Object.entries(o.bars||{})){
      if(!b || b.pct==null) continue;
      const weight = w.senses[sense] || 1;
      sum += b.pct * weight; tot += weight;
      if(!best || b.pct*weight > best.v) best = {sense, pct:b.pct, v:b.pct*weight};
    }
    const conditions = tot ? sum/tot : null;               // 0-100, or unknown
    // costs are scaled against the spread of the options, so one preference
    // cannot be drowned out just because the numbers happen to be small
    const slowest = Math.max(...opts.map(x=>x.minutes));
    const dearest = Math.max(...opts.map(x=>x.fare||0));
    const mostWalk = Math.max(...opts.map(x=>x.walkMinutes||0));
    // how much worse than the best option, in proportion — 20 min against 10 is
    // twice as long, and Rs. 120 against Rs. 50 is more than twice the money
    const over = (v, best, floor) => Math.min(1, Math.max(0, (v - best) / Math.max(best, floor)));
    const timeCost = over(o.minutes, fastest, 8) * 34 * w.time;
    const fareCost = over(o.fare||0, cheapest, 25) * 34 * w.fare;
    const walkCost = over(o.walkMinutes||0, leastWalk, 8) * 30 * Math.max(0, w.walk - 1);
    const legCost = Math.max(0, (o.legs||[]).length - 1) * 6 * Math.max(0, w.legs - 1);
    const seenBefore = (S.trips||[]).some(t => t.title === o.title);
    const knownBonus = seenBefore ? 8 * Math.max(0, w.known - 1) : 0;
    o.prefScore = (conditions==null ? 50 : conditions) - timeCost - fareCost - walkCost - legCost + knownBonus;
    o.conditions = conditions==null ? null : Math.round(conditions);
    o.bestSense = best ? best.sense : null;
  }
  const sorted = opts.slice().sort((a,b)=>b.prefScore-a.prefScore);
  const win = sorted[0], runner = sorted[1];
  const close = runner && (win.prefScore - runner.prefScore) < 1.5;
  return { pick: win.id, close, why: whyLine(win, opts, chosen, close) };
}

const SENSE_WORDS = {
  SEE:"better lit", HEAR:"more street activity", RUN:"easier to get out of",
  CALL:"better signal and help nearby", TRIBE:"more people around", GUT:"no dog packs reported"
};

function whyLine(o, opts, chosen, close){
  const fastest = opts.reduce((a,b)=>a.minutes<b.minutes?a:b);
  const cheapest = opts.reduce((a,b)=>(a.fare||0)<(b.fare||0)?a:b);
  const names = chosen.map(c=>c.label.toLowerCase());
  const asked = names.slice(0,2).join(" and ") + (names.length>2 ? ", plus "+(names.length-2)+" more" : "");
  if(close) return "Close between the top two. This one fits \""+asked+"\" slightly better.";
  const strength = o.bestSense ? SENSE_WORDS[o.bestSense] : "better conditions overall";
  const bits = [];
  const gap = o.minutes - fastest.minutes;
  if(gap <= 0) bits.push("it is the quickest");
  else if(gap <= 2) bits.push("about the same time as the quickest");
  else bits.push(gap + " min more than the "+fastest.title.toLowerCase());
  if((o.fare||0) < (cheapest.fare||0) + 1 && opts.length>1) bits.push("and the cheapest");
  else if(o.fare) bits.push("Rs. "+o.fare);
  return "Chosen for \""+asked+"\": "+strength+", "+bits.join(", ")+".";
}

// One line saying why this option is recommended, and what it costs against the fastest
function recommendWhy(opts, pickId){
  const o = opts.find(x=>x.id===pickId); if(!o) return "";
  const fastest = opts.reduce((a,b)=>a.minutes<b.minutes?a:b);
  const good = o.bars ? Object.entries(o.bars).filter(([,b])=>b.pct!=null&&b.pct>=70)
    .map(([k])=>({SEE:"better lit",HEAR:"busier",TRIBE:"more people about",CALL:"better signal",RUN:"easier to exit",GUT:"no dog packs"}[k])).filter(Boolean) : [];
  const why = good.length ? good.slice(0,2).join(" and ") : "better conditions right now";
  if(o.id === fastest.id) return "Fastest, and "+why+".";
  const extra = o.minutes - fastest.minutes;
  return why.charAt(0).toUpperCase()+why.slice(1)+" — "+extra+" min more than "+fastest.title.toLowerCase()+
         (o.fare && fastest.fare ? (o.fare<fastest.fare ? ", and cheaper by Rs. "+(fastest.fare-o.fare) : "") : "")+".";
}

const atTime = hhmm => { const [h,m]=hhmm.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); if(d.getTime()<Date.now()-3600000) d.setDate(d.getDate()+1); return d.getTime(); };

async function startJourney(){
  const T = S.travel, o = T.result.options.find(x=>x.id===T.sel);
  T.active = o; T.lastTripAt = Date.now(); T.journey = true;
  syncContacts(); Agent.setName(S.user.name);
  SensorHub.start().catch(()=>{});
  const tellIdx = T.tell;
  Agent.startTrip({destName:T.toPlace.name, from:placeOf("from")||userPos(), dest:T.toPlace, route:o.route,
                   mode: o.kind==="mixed" ? "metro" : o.kind});
  // she chose while planning, so the promise goes now rather than being asked again
  if(tellIdx != null){
    Agent.tellWho(tellIdx === "none" ? null : tellIdx);
    if(tellIdx !== "none"){
      const t2 = Agent.state.trip, c = acts()[tellIdx];
      if(t2 && c){
        const body = Agent.buildSms("promise", { due: hm(new Date(t2.dueAt)), callBy: hm(new Date(t2.callByAt)) });
        setTimeout(()=>{ try{ window.location.href = "sms:"+c.p.replace(/\s/g,"")+"?body="+encodeURIComponent(body); }catch(e){} }, 700);
      }
    }
  }
  Context.savePack({dest:T.toPlace, route:o.route, help:helpList().slice(0,30), savedAt:Date.now()});
  if(S.guardians.active && S.guardians.shareTrips && S.guardians.sms && acts().length){
    const eta = new Date(Date.now()+o.minutes*60000);
    const body = (S.user.name||"I")+" started a trip to "+T.toPlace.name+" ("+o.title+"), expected by "+hm(eta)+". SixthSense will message you if anything changes.";
    const nums = acts().map(c=>c.p.replace(/\s/g,""));
    if(Native.canSendSmsDirectly){ const r = await Native.sendSms(nums, body); Agent.note({kind:"act", title:r.sent?"Guardians told you started":"Could not message guardians", body}); }
    else Agent.note({kind:"suggest", title:"Tell your guardians you started", body, actions:[{label:"Send to guardians", href:"sms:"+nums.join(",")+"?body="+encodeURIComponent(body)}]});
  }
  go("journey");
}
function stopJourney(reached){
  const o = S.travel.active, a = Agent.state;
  if(o){
    S.trips = [{
      t: Date.now(), from: (placeOf("from")||{}).name || S.hereName || "Start",
      to: (S.travel.toPlace||{}).name || "Destination",
      title: o.title, minutes: o.minutes, fare: o.fare, metres: o.metres,
      reached: !!reached,
      did: (a.cards||[]).filter(c=>c.kind!=="ask").slice(0,6).map(c=>c.title),
      place: S.travel.toPlace || null, fromPlace: placeOf("from") || null,
    }].concat(S.trips||[]).slice(0,25);
    save();
  }
  if(a.replaying) Agent.stopReplay();
  Agent.endTrip(false); S.travel.journey=false;
}

function showQr(){
  const u = userPos();
  const text = "SixthSense help: "+(S.user.name||"This person")+" needs help. Please call "+(acts()[0]?acts()[0].p:"112")+". Location https://maps.google.com/?q="+u.lat.toFixed(5)+","+u.lng.toFixed(5);
  let el = $("qrov"); if(el) el.remove();
  el = document.createElement("div"); el.id="qrov";
  el.style.cssText="position:absolute;inset:0;background:rgba(15,5,20,.6);z-index:50;display:grid;place-items:center;padding:24px";
  el.innerHTML='<div class="card p14 center" style="max-width:320px"><h3 style="font-size:17px">Show this to someone nearby</h3>'+
    '<p class="small sec">They scan it with any camera to call or message for you.</p>'+
    '<div id="qrbox" style="width:208px;height:208px;margin:10px auto;background:#fff;padding:6px;'+
      'border-radius:10px;display:grid;place-items:center;overflow:hidden"></div>'+
    '<p class="tiny sec" style="word-break:break-word;margin:6px 0 10px">'+esc(text)+'</p>'+
    '<button class="btn" id="qrclose">Close</button></div>';
  $("device").appendChild(el);
  $("qrclose").onclick = () => el.remove();
  el.addEventListener("click", e => { if(e.target === el) el.remove(); });
  if(window.QRCode){
    $("qrbox").innerHTML = "";                     // drawn once, not twice
    new QRCode($("qrbox"), {text, width:196, height:196, correctLevel:QRCode.CorrectLevel.M});
  } else {
    $("qrbox").innerHTML = '<p class="small" style="padding:14px;color:var(--ink-2)">The QR needs one connection to load. '+
      'The message below works on its own — show it or read it out.</p>';
  }
}

/* ---------------- audit ---------------- */
function submitAudit(){
  const a=S.audit, b=[];
  if(a.light) b.push(LIGHTS[a.light]);
  if(a.crowd) b.push(a.crowd.toLowerCase());
  if(a.cctv==="Yes") b.push("CCTV seen");
  if(a.dogs&&a.dogs!=="None") b.push(a.dogs.toLowerCase()+" dogs");
  if(a.gut) b.push("felt "+SCALE[a.gut].toLowerCase());
  const p = auditPlace();
  // Phone sensors agree with a light claim? (then it counts as confirmed)
  const phoneLight = LIVE.cam.on && LIVE.cam.bright!=null ? LIVE.cam.bright : null;
  const claimLight = a.light ? a.light*45 : null;
  const agree = phoneLight!=null && claimLight!=null && Math.abs(phoneLight-claimLight) < 60;
  const read = a.reading || null;
  const r = Store.addReport({lat:p.lat, lng:p.lng, place:p.name,
    claims:{light:a.light?LIGHTS[a.light]:"", crowd:a.crowd, shops:a.shops, path:a.path, dogs:a.dogs},
    readingsAgree: agree || a.sensorAgrees,
    note: a.remarks || (read && read.summary) || null,
    tags: read ? read.tags : undefined,
    unusual: read ? read.unusual : null,
    light: a.light ? a.light*45 : (read && {dark:22,some:80,lit:195}[read.light]),
    liveliness: {"Very isolated":0.05,"Quiet":0.18,"Comfortable":0.45,"Moderately crowded":0.7,"Very crowded":0.85}[a.crowd],
    dogPack: !!(a.dogs && a.dogs!=="None"),
    source: read ? read.source : "form"});
  S.lastReportStatus = r.status;
  S.audits.unshift({d:"Today", loc:p.name, sum:b.length?b.join(" · "):"Quick audit logged", pts:10, reportId:r.id,
    unusual: read ? read.unusual : null});
  S.points+=10; S.logged+=1;
  S.alerts.unshift({t:"Audit",m:r.status==="confirmed"?"Your audit is confirmed and now counts for route comparisons.":"Your audit is pending confirmation by other verified women.",w:"Just now",unread:true});
  if(read && read.unusual){
    S.alerts.unshift({t:"Unusual: "+read.unusual.what,
      m:"Reported by you near "+p.name+". Women near here will see this for the next "+
        Math.round(Instant.unusualLife(read.unusual)/3600000)+" hours.", w:"Just now", unread:true});
  }
  S.stack=["audit"]; S.screen="done"; save(); render(); toTop();
}
function wireInstantPhoto(){
  const f = $("instf"); if(!f) return;
  f.addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0]; if(!file) return;
    try{
      const small = await shrink(file, 1024);
      S.inst.photo = small; S.inst.mime = "image/jpeg"; render();
    }catch(err){ toast("Could not read that photo."); }
  });
}
/* shrink before sending: faster, cheaper, and less of the picture leaves the phone */
function shrink(file, max){
  return new Promise((res,rej)=>{
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
    img.src = url;
  });
}

function wirePhoto(){ const i=$("aph"); if(!i) return;
  i.addEventListener("change", async ()=>{
    const f = i.files && i.files[0]; if(!f) return;
    try{ S.audit.photo = await shrink(f, 1024); }catch(e){ return toast("Could not read that photo."); }
    S.audit.reading = null; S.audit.reading = null; S.audit.busy = true; render();
    await readPhotoIntoForm();
  });
}

/* Send the photo (and her remark, if any) to be read, then fill the answers
   she has not already given. Every filled answer is marked and editable. */
async function readPhotoIntoForm(){
  const a = S.audit, pos = auditPos();
  let place = S.hereName;
  try{ if(!place) place = await Context.placeName(pos.lat, pos.lng); }catch(e){}
  let r = null;
  try{
    r = await Instant.read({ remark: a.remarks || "", imageBase64: a.photo ? a.photo.split(",")[1] : null,
      mime: "image/jpeg", place, hour: new Date().getHours() });
  }catch(e){ toast("Could not read the photo."); }
  a.busy = false;
  if(!r){ render(); return; }
  a.reading = r; a.filled = {};

  const set = (key, val) => { if(val == null || a[key]) return; a[key] = val; a.filled[key] = true; };
  set("light", { dark:1, some:3, lit:5 }[r.light]);
  set("crowd", { empty:"Very isolated", few:"Quiet", some:"Comfortable", busy:"Moderately crowded" }[r.people]);
  set("shops", { shut:"Mostly Closed", some:"Some Open", open:"Mostly Open" }[r.shops]);
  set("path",  { broken:"Unsafe", uneven:"Moderate", even:"Safe" }[r.path]);
  if(r.dogs === true) set("dogs", "Several");

  // does her own phone agree with the photo? that is what confirms an audit
  const lit = LIVE.cam.bright != null ? LIVE.cam.bright : (LIVE.cam.lux != null ? Math.min(255, LIVE.cam.lux/4) : null);
  a.sensorAgrees = (lit != null && r.light)
    ? ((r.light === "dark" && lit < 70) || (r.light === "some" && lit >= 50 && lit < 150) || (r.light === "lit" && lit >= 130))
    : false;
  render();
  toast(Object.keys(a.filled).length
    ? "Filled "+Object.keys(a.filled).length+" answer"+(Object.keys(a.filled).length>1?"s":"")+" from your photo — check and change anything"
    : "Nothing could be read from that photo; please answer below");
}

const auditPos = () => (typeof auditPlace === "function" && auditPlace().lat != null ? auditPlace() : userPos());

/* ---------------- verification ---------------- */
let selfieStream = null;
function wireVerify(){
  const i=$("vid");
  if(i) i.addEventListener("change",()=>{ const f=i.files&&i.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ S.v.idImg=r.result; render(); }; r.readAsDataURL(f); });
  const vid=$("vsv");
  if(vid && !S.v.checking){
    if(selfieStream){ vid.srcObject=selfieStream; return; }
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})
      .then(st=>{ selfieStream=st; const el=$("vsv"); if(el) el.srcObject=st; })
      .catch(()=>toast("Camera not available. Demo continues."));
  }
}
function stopSelfieCam(){ if(selfieStream){ selfieStream.getTracks().forEach(t=>t.stop()); selfieStream=null; } }

/* ---------------- SOS ---------------- */
// The emergency button lives on Home: hold it there, no need to open a screen
function dial(n){ try{ window.location.href = "tel:"+n; }catch(e){} }
/* Hold two seconds — on the Home circle or the big one in Emergency Mode.
   On completion: vibrate, open one message to every guardian with her location,
   then leave her on the red screen with Call 112 as the single large action. */
function holdToSos(btnId, arcId, len){
  const b=$(btnId), arc=$(arcId);
  if(!b || b.dataset.wired) return;
  b.dataset.wired = "1";
  let raf, tick, t0=0, held=false, timer=null;
  const DUR=2000;

  // the ring is driven by both a frame loop and a plain interval: frames are
  // throttled on some phones, and she must see it filling
  const paint=()=>{ const p=Math.min(1,(performance.now()-t0)/DUR);
    if(arc) arc.setAttribute("stroke-dashoffset", String(len*(1-p)));
    return p; };
  const step=()=>{ if(paint() >= 1 || !held) return; raf=requestAnimationFrame(step); };

  const start=e=>{
    if(held) return;
    held=true; b.classList.add("holding");
    if(e && e.cancelable) e.preventDefault();
    if(e && e.stopPropagation) e.stopPropagation();          // a hold is not a tap
    try{ if(e && e.pointerId != null && b.setPointerCapture) b.setPointerCapture(e.pointerId); }catch(err){}
    try{ navigator.vibrate && navigator.vibrate(30); }catch(err){}
    t0=performance.now(); paint(); raf=requestAnimationFrame(step);
    tick=setInterval(paint, 60);
    timer=setTimeout(fire, DUR);      // a timer, not frames: frames stop when the screen dims
  };

  const fire=()=>{
    if(!held) return;
    held=false; b.classList.remove("holding"); b.dataset.fired="1";
    clearTimeout(timer); clearInterval(tick); cancelAnimationFrame(raf);
    if(arc) arc.setAttribute("stroke-dashoffset","0");
    try{ navigator.vibrate && navigator.vibrate([400,120,400]); }catch(err){}
    activateSOS({ openSms:true });
    setTimeout(()=>{ delete b.dataset.fired; }, 800);
  };

  const cancel=()=>{
    if(!held) return;
    held=false; b.classList.remove("holding");
    clearTimeout(timer); clearInterval(tick); cancelAnimationFrame(raf);
    if(arc) arc.setAttribute("stroke-dashoffset", String(len));
  };

  b.addEventListener("pointerdown", start, {passive:false});
  b.addEventListener("touchstart",  start, {passive:false});
  ["pointerup","pointercancel","touchend","touchcancel"].forEach(ev =>
    b.addEventListener(ev, cancel, {passive:true}));
  b.addEventListener("contextmenu", e=>e.preventDefault());
  // a hold that completed must not also count as a tap on the bar behind it
  b.addEventListener("click", e=>{ if(b.dataset.fired){ e.preventDefault(); e.stopPropagation(); } });
  b.addEventListener("keydown", e=>{ if(e.key===" "||e.key==="Enter") start(e); });
  b.addEventListener("keyup", cancel);
}
const wireSOS     = () => holdToSos("sosb","sosa",647);     // Emergency Mode screen
const wireHomeSos = () => holdToSos("hsosb","hsosa",170);   // the circle on Home

async function activateSOS(opts){
  opts = opts || {};
  S.sos={sent:false,opened:false,photos:0,photoErr:null};
  S.stack=["home"]; S.screen="sosactive"; render(); toTop();
  if(Agent.state.trip) Agent.sos();

  if(!acts().length){
    toast("No emergency contacts yet — add them so the alert can go somewhere.");
    setTimeout(()=>go("contacts"), 900);
  }

  // One message, all three guardians, her location already in it.
  if(S.guardians.sms && acts().length){
    if(Native.canSendSmsDirectly){
      const x = sosSms(); const r = await Native.sendSms(x.numbers, x.body); S.sos.sent = r.sent; render();
    } else if(opts.openSms){
      // The browser cannot send for her: open the messaging app with every
      // guardian in the To field and the text written, so it is one tap.
      const x = sosSms();
      setTimeout(() => { try{ window.location.href = x.href; }catch(e){} }, 450);
      S.sos.opened = true;
    }
  }
  if(S.guardians.voice && Native.isApp && acts()[0]) location.href = "tel:"+acts()[0].p.replace(/\s/g,"");
  if(S.guardians.camera) captureSosPhotos();
}
async function captureSosPhotos(){
  const shots = [];
  for(const facing of ["user","environment"]){
    try{
      const st = await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:640}}});
      const v = document.createElement("video"); v.muted=true; v.playsInline=true; v.srcObject=st; await v.play();
      await new Promise(r=>setTimeout(r,600));
      const c = document.createElement("canvas"); c.width=v.videoWidth||640; c.height=v.videoHeight||480;
      c.getContext("2d").drawImage(v,0,0,c.width,c.height);
      shots.push(c.toDataURL("image/jpeg",.7)); st.getTracks().forEach(t=>t.stop());
    }catch(err){ /* camera not available */ }
  }
  if(!shots.length){ S.sos.photoErr="Camera not available"; if(S.screen==="sosactive") render(); return; }
  await SosMedia.save(shots);
  S.sos.photos = shots.length; if(S.screen==="sosactive") render();
}
// Encrypted local store for SOS photos, deleted after 30 days
const SosMedia = {
  async key(){
    let raw = localStorage.getItem("ss.media.key");
    if(!raw){ const k = crypto.getRandomValues(new Uint8Array(32)); raw = btoa(String.fromCharCode(...k)); localStorage.setItem("ss.media.key", raw); }
    return crypto.subtle.importKey("raw", Uint8Array.from(atob(raw), c=>c.charCodeAt(0)), "AES-GCM", false, ["encrypt","decrypt"]);
  },
  db(){ return new Promise((res,rej)=>{ const r=indexedDB.open("ss-media",1); r.onupgradeneeded=()=>r.result.createObjectStore("m",{keyPath:"t"}); r.onsuccess=()=>res(r.result); r.onerror=rej; }); },
  async save(shots){
    try{
      const k = await this.key(), iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({name:"AES-GCM",iv}, k, new TextEncoder().encode(JSON.stringify(shots)));
      const db = await this.db();
      db.transaction("m","readwrite").objectStore("m").put({t:Date.now(), iv:Array.from(iv), data});
    }catch(err){ /* storage unavailable */ }
  },
  async cleanup(){
    try{ const db = await this.db(); const os = db.transaction("m","readwrite").objectStore("m");
      os.openCursor().onsuccess = e => { const c=e.target.result; if(!c) return; if(Date.now()-c.value.t > 30*86400000) c.delete(); c.continue(); };
    }catch(err){}
  }
};
function sendMsg(){ const i=$("ci"); if(!i||!i.value.trim()) return;
  const w=S.chatWith; DATA.chats[w]=DATA.chats[w]||[];
  DATA.chats[w].push({f:"me",b:i.value.trim()}); i.value=""; render();
  setTimeout(()=>{ if(S.screen==="chat"&&S.chatWith===w){
    DATA.chats[w].push({f:"them",b:"Thanks for checking — it's been quiet but well lit on my side."}); render(); } },1400); }

/* ---------------- boot ---------------- */
const had = load();
if(!S.travel.sugg) S.travel.sugg = {};
if(location.hash === "#pw") S.showPw = true;         // demo accounts sign in with a password

/* Someone opened a watch link: this phone becomes the guardian's page */
async function openWatchLink(){
  if(!/^#w\//.test(location.hash)) return;
  const token = location.hash.slice(3);
  S.watching = { token, data:null, error:null, coverage:null };
  S.screen = "watching";
  Cloud.readWatch(token, async d => {
    if(!d){ S.watching.error = "This trip is no longer being watched."; return render(); }
    S.watching.data = d; S.watching.error = null;
    // when the notes stop, ask the street what happened
    if(d.lat != null && Date.now() - d.lastSeen > 150000 && !d.arrived){
      try{ S.watching.coverage = await Cloud.coverageAround(d.lat, d.lng, d.lastSeen); }catch(e){}
    }
    render();
  });
  setInterval(() => { if(S.screen === "watching") render(); }, 15000);   // the countdown runs here
}
openWatchLink();
if(!S.inst) S.inst = {remark:"", photo:null, mime:null, reading:null, busy:false};
if(!S.vouch) S.vouch = {code:null,expires:0,typed:"",busy:false,scanning:false,msg:null,ok:false,have:null,given:null};
if(!Array.isArray(S.recent)) S.recent = [];
initNet(); updateSun();
setInterval(updateSun, 600000);
Light.load().catch(()=>{});
Metro.load().catch(()=>{});          // station names become searchable straight away
Agent.init({name:S.user.name, contacts:[]});
syncContacts();
if(S.agentOpts) Agent.setOptions(S.agentOpts);
SosMedia.cleanup();
let agentT;
Agent.onChange(() => {
  clearTimeout(agentT);
  agentT = setTimeout(() => { if(["journey","home"].includes(S.screen)) softRender(); }, 700);
  // a silence the agent can see coming is told to the server too, while there
  // is still signal to tell it
  if(!watchToken) return;
  const seen = S.watchSeen || (S.watchSeen = {});
  for(const c of Agent.state.cards || []){
    if(seen[c.id]) continue;
    if(c.id === "quietsoon"){ seen[c.id]=1; watchExpect("dead-zone", Date.now(), Date.now()+6*60000, c.body); }
    if(c.id === "dyingsoon" || c.id === "charge"){ seen[c.id]=1; watchExpect("battery", Date.now(), Date.now()+20*60000, c.body); }
    if(c.id === "last"){ seen[c.id]=1; watchExpect("battery", Date.now(), Date.now()+5*60000, "phone about to switch off"); }
  }
});
Store.on("answer", () => { if(S.screen==="pulse") softRender(); });
Store.on("session", () => { if(S.screen==="needangel") softRender(); });
Cloud.init();
Cloud.on("user", u => {
  if(!S.user.name && Cloud.user){ S.user.name = (Cloud.user.name || (Cloud.user.email||"").split("@")[0]).replace(/[^a-z ]/gi," ").trim().replace(/\b\w/g,c=>c.toUpperCase()); Agent.setName(S.user.name); }
  if(Cloud.user && !S.user.email) S.user.email = Cloud.user.email || "";
  S.user.verified = u.tier !== "none";
  if(["welcome","linksent"].includes(S.screen)){ S.stack=[]; tab("home"); toast("Signed in · "+u.tierLabel); }
  else softRender();
  save();
});
Cloud.on("status", st => { if(S.screen==="settings") softRender(); });
Cloud.on("user", async () => {
  if(!Cloud.signedIn) return;
  // a demo account starts with its guardians; a real account never does
  try{
    if(!S.contacts.some(c=>c.n&&c.p)){
      const email = (Cloud.user && Cloud.user.email) || "";
      const fx = await Cloud.loadDemoFixture("contacts");
      if(fx && Array.isArray(fx.contacts) && fx.accounts && fx.accounts.includes(email)){
        S.contacts = fx.contacts.slice(0,3).concat([{n:"",p:""}]).slice(0,3);
        syncContacts(); save(); softRender();
      }
    }
  }catch(e){}
  try{ const n = await Cloud.loadNormals(); if(n) console.info("normals from backend:", n); }catch(e){}
  try{ const a = await Cloud.loadAlerts(); if(a.length){ DATA.news = a.map(x=>({tag:x.tag, tone:x.tone, t:x.title, b:x.body, where:x.where})); softRender(); } }catch(e){}
});
Cloud.on("answer", () => { if(S.screen==="pulse") softRender(); });
Cloud.on("inbox", () => { if(["connect","home","inbox"].includes(S.screen)) softRender(); });
Cloud.on("reports", () => { if(S.screen==="routes") softRender(); });
Store.on("answer", x => { if(x && x.swap && S.screen==="pulse"){ S.ang.qid = x.swap; softRender(); } });
Store.on("report", r => { S.alerts.unshift({t:"Audit", m:r.text, w:"Just now", unread:true}); save(); if(["adet","done","home"].includes(S.screen)) softRender(); });
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(()=>{});
// Open on Home only when a real session is still there; otherwise the sign-in screen
const signedIn = !!(Store.me().tier !== "none" || Cloud.signedIn);
const sessionKept = S.staySignedIn !== false || sessionStorage.getItem("ss.session") === "open";
if(had && S.user.name && signedIn && sessionKept) S.screen = "home"; else if(!signedIn) S.screen = "welcome";
// a watch link overrides everything: the guardian has no account and needs no screen but this one
if(/^#w\//.test(location.hash)) S.screen = "watching";
try{ sessionStorage.setItem("ss.session","open"); }catch(e){}
render();

/* One-tap demo: open the app with #journey to start a trip and play the demo walk */
async function demoJourney(){
  if(!S.user.name){ S.user.name="Akshi"; S.user.phone="+91 98110 42117"; }
  Store.demoSignIn(); S.user.verified=true; Agent.setName(S.user.name);
  S.guardians={voice:true,camera:false,sms:true,active:true,shareTrips:true};
  try{ const j = await (await fetch("data/trips.mock.json")).json(); Prefs.Trips.seedMock(j.trips); }catch(e){}
  S.travel.toPlace = PRESETS[2]; S.travel.to = PRESETS[2].name; S.travel.mode = "walk";
  S.stack=["home"]; await findRoutes();
  if(!S.travel.result) return;
  S.travel.sel = S.travel.result.options[0].id;
  await startJourney();
  Agent.startReplay({speed:20}); render();
}
const HASHES = {"#journey":demoJourney, "#verify":()=>demoStart("verify"), "#audit":()=>demoStart("audit"),
                "#angels":()=>demoStart("connect"), "#routes":()=>demoStart("tmode")};
function demoStart(screen){
  if(!S.user.name){ S.user.name="Akshi"; S.user.phone="+91 98110 42117"; }
  if(screen!=="verify"){ Store.demoSignIn(); S.user.verified=true; }
  else Store.signOut();
  Agent.setName(S.user.name);
  fetch("data/trips.mock.json").then(r=>r.json()).then(j=>Prefs.Trips.seedMock(j.trips)).catch(()=>{});
  if(screen==="tmode"){ S.travel.toPlace=PRESETS[2]; S.travel.to=PRESETS[2].name; }
  S.stack=["home"]; S.tab = screen==="connect"?"connect":screen==="audit"?"audit":"home"; S.screen=screen; render(); toTop();
}
function runHash(){ const f = HASHES[location.hash]; if(f) f(); }
addEventListener("hashchange", runHash);
if(HASHES[location.hash]) setTimeout(runHash, 400);

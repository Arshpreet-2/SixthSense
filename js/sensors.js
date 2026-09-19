/* SixthSense — live device sensors (now powered by js/engine), sunrise/sunset, persistence.
   The LIVE object keeps the same shape as before so every screen still works;
   the readings now come from SensorHub (battery, network, GPS, motion, light, signal)
   and SoundSense (YamNet: sound level, street activity, dog packs). */
"use strict";

const LIVE = {
  mic:{on:false, db:null, onsets:[], packAt:null, conf:null, err:null, live:null},
  batt:{on:false, level:null},
  net:{on:false, online:true, diag:null},
  cam:{on:false, bright:null, err:null, real:false, lux:null},
  sun:{on:false, dark:null, rise:null, set:null, approx:true},
  geo:{on:false, acc:null, lat:null, lon:null, err:null, speed:null},
  run:{on:false, activity:null, std:null},
  sig:{on:false, dbm:null, level:null, weak:null, source:null, type:null},
  sensing:[]            // which of microphone / camera are live right now
};
function noteSensing(){
  LIVE.sensing = [LIVE.mic.on?"Microphone":null, LIVE.cam.on&&LIVE.cam.real?"Camera":null].filter(Boolean);
}

/* --- engine events -> LIVE --- */
SensorHub.on("sound", () => { noteSensing(); });
SensorHub.on("light", () => { noteSensing(); });
SensorHub.on("battery", b => { LIVE.batt.on = b.level != null; LIVE.batt.level = b.level; S.batt = b.level; patchLive(); patchHome(); });
let lastDiag = null;
SensorHub.on("net", n => { LIVE.net.on = true; LIVE.net.online = n.diagnosis === "ok" || n.diagnosis === "weak"; LIVE.net.diag = n;
  if (n.diagnosis !== lastDiag) { lastDiag = n.diagnosis; softRender(); } else patchLive(); });
SensorHub.on("gps", g => { LIVE.geo.on = true; LIVE.geo.err = null; LIVE.geo.acc = g.acc; LIVE.geo.lat = g.lat; LIVE.geo.lon = g.lng;
  LIVE.geo.speed = g.speedKmh; updateSun(); patchLive(); patchHome(); });
SensorHub.on("gps-error", () => { LIVE.geo.err = "denied"; patchLive(); });
SensorHub.on("light", l => { if (l.level != null) { LIVE.cam.on = true; LIVE.cam.bright = l.level; LIVE.cam.real = l.source === "sensor"; } patchLive(); });
SensorHub.on("motion", m => { LIVE.run = { on: true, activity: m.activity, std: m.std }; patchLive(); });
SensorHub.on("signal", s => { LIVE.sig = { on: true, ...s }; patchLive(); });
SensorHub.on("sound", s => {
  LIVE.mic.on = ["live", "sparse", "replay"].includes(s.status);
  LIVE.mic.err = s.status === "sim" ? "unavailable" : null;
  LIVE.mic.db = s.dbfs != null ? Math.max(25, Math.min(100, Math.round(86 + s.dbfs))) : LIVE.mic.db;
  LIVE.mic.live = s.liveliness; LIVE.mic.conf = s.dogConf;
  if (s.isPack && !packActive()) {
    LIVE.mic.packAt = Date.now();
    S.alerts.unshift({t:"Dog pack heard", m:"Repeated barking picked up nearby. Route comparisons now include it.", w:"Just now", unread:true});
    save(); softRender(true);
  }
  patchLive();
});

function tryLightSensor(){ return "AmbientLightSensor" in window; }

/* --- 2. no permission at all: is it dark outside right now?
   Sunrise/sunset from the date and (if allowed) the GPS fix. This says
   nothing about this particular lane — only whether the sun is down. --- */
function sunTimes(lat, lon, date){
  const rad = Math.PI/180, deg = 180/Math.PI;
  const d = Math.floor((date - Date.UTC(2000,0,1,12))/86400000) + 0.0009 - lon/360;
  const M = (357.5291 + 0.98560028*d) % 360;
  const C = 1.9148*Math.sin(M*rad) + 0.02*Math.sin(2*M*rad) + 0.0003*Math.sin(3*M*rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545.0009 + d + 0.0053*Math.sin(M*rad) - 0.0069*Math.sin(2*L*rad);
  const dec = Math.asin(Math.sin(L*rad) * Math.sin(23.44*rad)) * deg;
  const cosW = (Math.sin(-0.833*rad) - Math.sin(lat*rad)*Math.sin(dec*rad)) /
               (Math.cos(lat*rad)*Math.cos(dec*rad));
  if(cosW > 1 || cosW < -1) return null;
  const w = Math.acos(cosW) * deg;
  const toDate = j => new Date((j - 2440587.5) * 86400000);
  return {rise: toDate(Jt - w/360), set: toDate(Jt + w/360)};
}
function updateSun(){
  const lat = LIVE.geo.lat != null ? LIVE.geo.lat : 28.6328;   // default: Kashmere Gate
  const lon = LIVE.geo.lon != null ? LIVE.geo.lon : 77.2197;
  LIVE.sun.approx = LIVE.geo.lat == null;
  const t = sunTimes(lat, lon, new Date());
  if(!t) return;
  const now = new Date();
  LIVE.sun.on = true; LIVE.sun.rise = t.rise; LIVE.sun.set = t.set;
  LIVE.sun.dark = now < t.rise || now > t.set;
  patchLive();
}
const hhmm = d => d ? String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") : "—";
function sunLabel(){
  if(!LIVE.sun.on) return "—";
  return LIVE.sun.dark ? "After dark · sunset "+hhmm(LIVE.sun.set)
                       : "Daylight · sunset "+hhmm(LIVE.sun.set);
}

/* relative brightness 0-255 from the camera -> a 0-100 index + plain label.
   NOT lux: the camera auto-exposes, so this is uncalibrated and comparative only. */
const brightIdx = () => LIVE.cam.bright == null ? null : Math.round(Math.min(100, LIVE.cam.bright/1.8));
function brightLabel(){
  const b = LIVE.cam.bright; if(b == null) return "—";
  const band = b < 25 ? "Very dark" : b < 60 ? "Dim" : b < 120 ? "Lit" : "Bright";
  return band+" · "+(LIVE.cam.real ? LIVE.cam.lux+" lux" : brightIdx()+"/100");
}
const liveCount = () => [LIVE.mic.on, LIVE.cam.on, LIVE.batt.on, LIVE.net.on, LIVE.geo.on, LIVE.run.on].filter(Boolean).length;
function packActive(){ return LIVE.mic.packAt !== null && (Date.now() - LIVE.mic.packAt) < 2*3600*1000; }
function packMins(){ return LIVE.mic.packAt ? Math.floor((Date.now()-LIVE.mic.packAt)/60000) : 0; }


/* --- start / stop (same names as before) --- */
async function startMic(){ await SensorHub.start(); await SoundSense.setMode("model"); softRender(true); }
async function startMicOnly(){ await SensorHub.start({ camera: false }); await SoundSense.setMode("model"); LIVE.cam.err = "skipped"; softRender(true); }
function stopSensing(){
  SoundSense.setMode("off"); SensorHub.stop();
  LIVE.mic.on = false; LIVE.cam.on = false; LIVE.mic.db = null; LIVE.cam.bright = null; LIVE.mic.packAt = null;
  softRender(true);
}
function initBattery(){ /* SensorHub handles battery */ }
function initNet(){ LIVE.net.on = true; LIVE.net.online = navigator.onLine; SensorHub.startPassive(); }
function startGeo(){ /* SensorHub handles GPS */ }
function enableLive(){ startMic(); }

/* --- patch live numbers in place (no re-render, so inputs keep focus) --- */
/* Home shows a few live values; the render guard in softRender keeps the page
   still unless those values actually change what would be drawn. */
function patchHome(){}

function patchLive(){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set("lv-db", LIVE.mic.on && LIVE.mic.db != null ? "~"+LIVE.mic.db+" dB" : "—");
  set("lv-act", LIVE.mic.live != null ? (LIVE.mic.live >= .5 ? "People and traffic" : LIVE.mic.live >= .2 ? "Some activity" : "Quiet")+" · "+Math.round(LIVE.mic.live*100)+"%" : "—");
  set("lv-light", LIVE.cam.on ? brightLabel() : (LIVE.cam.err === "skipped" ? "not used" : "—"));
  set("lv-sun", sunLabel());
  set("lv-batt", LIVE.batt.on ? LIVE.batt.level+"%" : "—");
  set("lv-net", LIVE.net.diag ? LIVE.net.diag.text : (LIVE.net.online ? "Connected" : "No data"));
  set("lv-sig", LIVE.sig.on ? (LIVE.sig.dbm != null ? LIVE.sig.dbm+" dBm" : "Level "+(LIVE.sig.level ?? "—")+"/4")+(LIVE.sig.weak ? " · weak" : "") : "—");
  set("lv-geo", LIVE.geo.on && LIVE.geo.acc != null ? "±"+Math.round(LIVE.geo.acc)+" m"+(LIVE.geo.acc <= 10 ? " · open" : LIVE.geo.acc <= 30 ? "" : " · enclosed") : (LIVE.geo.err ? "Not allowed" : "—"));
  set("lv-run", LIVE.run.on ? ({still:"Standing still",walk:"Walking",run:"Running",jolt:"Sudden jolt"}[LIVE.run.activity]||"—")+(LIVE.run.activity==="walk"?" · steadiness "+LIVE.run.std:"") : "—");
  set("lv-gut", packActive() ? "Pack heard "+packMins()+" min ago" : (LIVE.mic.on ? "Listening · bark "+Math.round((LIVE.mic.conf||0)*100)+"%" : "—"));
  set("lv-ble", Native.isApp ? "Android app: planned" : "Needs the Android app");
}
/* full re-render only when nothing is being typed into, and never more than twice a second */
let _srT = 0, _srQ = null, _srLast = "";
function softRender(force){
  const a = document.activeElement;
  if(!force && a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "VIDEO")) return;
  const wait = 1200 - (Date.now() - _srT);
  if(wait > 0){ clearTimeout(_srQ); _srQ = setTimeout(() => softRender(force), wait); return; }
  _srT = Date.now();
  // only redraw when the screen would actually look different
  try{
    const next = (V[S.screen]||V.home)();
    if(!force && next === _srLast) return;
    _srLast = next;
  }catch(e){}
  render();
}

/* ============================================================ PERSISTENCE */
const KEY = "sixthsense.v2";
function save(){ try{ localStorage.setItem(KEY, JSON.stringify({
  user:S.user, contacts:S.contacts, perms:S.perms, guardians:S.guardians, audits:S.audits,
  points:S.points, logged:S.logged, alerts:S.alerts, heat:S.heat, mapTapped:S.mapTapped,
  connectShare:S.connectShare, reacted:S.reacted, travel:{mode:S.travel.mode, from:S.travel.from, to:S.travel.to, fromPlace:S.travel.fromPlace,
  toPlace:S.travel.toPlace, at:S.travel.at, lastTripAt:S.travel.lastTripAt}, shareReadings:S.shareReadings, agentOpts:S.agentOpts, staySignedIn:S.staySignedIn, recent:S.recent, trips:S.trips, lang:S.lang, consentAt:S.consentAt, preciseLoc:S.preciseLoc })); }catch(e){} }
function load(){ try{ const r = localStorage.getItem(KEY); if(!r) return false;
  const d = JSON.parse(r); Object.keys(d).forEach(k=>{ if(d[k]===undefined) return; if(k==="travel") Object.assign(S.travel, d[k]); else S[k]=d[k]; }); return true;
}catch(e){ return false; } }
function resetDemo(){ try{ localStorage.removeItem(KEY); Store.reset(); }catch(e){} location.reload(); }

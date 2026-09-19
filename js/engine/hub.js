/* ============================================================================
 * sensors.js — SensorHub
 * Live phone sensors, power modes, network diagnosis and a data logger.
 * Everything here works offline. Only numbers are kept; no audio or images.
 * Exposes: window.SensorHub
 * ========================================================================== */
(function (root) {
  'use strict';

  const listeners = {};
  const on = (evt, fn) => ((listeners[evt] = listeners[evt] || []).push(fn));
  const emit = (evt, data) => (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  // Power modes decide how hard each sensor works
  const MODES = {
    full:     { gpsHigh: true,  gpsEveryMs: 0,      probeEveryMs: 30000,  light: true,  sound: 'model' },
    eco:      { gpsHigh: false, gpsEveryMs: 0,      probeEveryMs: 60000,  light: false, sound: 'sparse' },
    critical: { gpsHigh: false, gpsEveryMs: 60000,  probeEveryMs: 120000, light: false, sound: 'off' },
  };

  const state = {
    mode: 'full',
    battery: { supported: false, level: null, charging: null, history: [] }, // level 0–100
    net: { online: true, type: null, effectiveType: null, rtt: null, downlink: null,
           probe: 'unknown', diagnosis: 'ok', since: Date.now() },
    gps: { lat: null, lng: null, acc: null, speedKmh: null, ts: null },
    motion: { activity: 'unknown', std: 0, peak: 0, stillSince: null, runSince: null, lastJolt: null },
    light: { level: null, source: null },   // relative 0–255, not lux
    signal: { dbm: null, level: null, type: null, weak: null, source: null },  // dBm only in the Android app
    sound: { liveliness: null, dogConf: null, isPack: false, dbfs: null, status: 'off' },
    injected: false,                        // true while replay mode drives the values
  };

  const cfg = {
    probeUrl: 'ping.json',   // tiny file on your own site: {"ok":true}
    probeTimeoutMs: 3000,
    logEveryMs: 5000,
  };

  /* ---------------------------------------------------------------- battery */
  let batteryObj = null;
  async function startBattery() {
    if (!navigator.getBattery) return;           // iPhone / Firefox: not available
    try {
      batteryObj = await navigator.getBattery();
      state.battery.supported = true;
      const read = () => {
        if (state.injected) return;
        setBattery(Math.round(batteryObj.level * 100), batteryObj.charging);
      };
      batteryObj.addEventListener('levelchange', read);
      batteryObj.addEventListener('chargingchange', read);
      read();
    } catch (e) { /* ignore */ }
  }
  function setBattery(level, charging) {
    state.battery.level = level;
    state.battery.charging = !!charging;
    const h = state.battery.history;
    h.push({ t: Date.now(), level });
    const cutoff = Date.now() - 30 * 60000;
    while (h.length && h[0].t < cutoff) h.shift();
    emit('battery', { ...state.battery });
  }

  /* ------------------------------------------------------------ connectivity */
  const DIAGNOSES = {
    ok:               { text: 'Internet working', fix: null },
    weak:             { text: 'Signal is weak', fix: 'Messages will go by SMS if the app cannot connect.' },
    offline:          { text: 'No network', fix: 'Check airplane mode and mobile data. If they are on, you may be in a low-signal spot.' },
    wifi_no_internet: { text: 'Wi-Fi connected but no internet', fix: 'Turn off Wi-Fi to use mobile data.' },
    login_page:       { text: 'Wi-Fi needs a login', fix: 'Open the browser to log in, or turn Wi-Fi off.' },
    operator_page:    { text: 'Mobile data may be finished', fix: 'Calls and SMS still work. Ask a friend to recharge your number.' },
    cellular_no_data: { text: 'Mobile data is not working', fix: 'Data may be finished, the network may be busy, or the signal is weak. SMS still works.' },
    unknown:          { text: 'Internet working', fix: null },   // the check itself could not run
  };

  let probeTimer = null;
  async function probe() {
    if (state.injected) return;
    // Single-file build: the check file is inlined in the page, so a missing
    // ping.json must never be read as "her data has finished"
    const inlinePing = typeof document !== 'undefined' && document.getElementById('ss-ping');
    const c = navigator.connection || {};
    state.net.online = navigator.onLine;
    state.net.type = c.type || null;               // Android Chrome only
    state.net.effectiveType = c.effectiveType || null;
    state.net.rtt = c.rtt ?? null;
    state.net.downlink = c.downlink ?? null;

    if (!navigator.onLine) { setDiagnosis('offline', 'fail'); readSignal(); return; }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.probeTimeoutMs);
    try {
      const res = await fetch(`${cfg.probeUrl}?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      const type = res.headers.get('content-type') || '';
      let ok = false;
      if (res.ok && type.includes('json')) { try { ok = (await res.json()).ok === true; } catch (e) {} }
      const slow = (c.effectiveType && /2g/.test(c.effectiveType)) || (c.rtt && c.rtt > 1500);

      if (ok) { setDiagnosis(slow ? 'weak' : 'ok', 'ok'); readSignal(); return; }

      // The check file is simply missing or forbidden (single-file build, wrong path,
      // a host that rewrites 404s). That says nothing about her connection.
      if (inlinePing || res.status === 404 || res.status === 403 || res.status === 405) {
        setDiagnosis(slow ? 'weak' : 'unknown', 'unavailable'); readSignal(); return;
      }
      // A captive portal answers 200 with a page of its own, or redirects elsewhere
      const hijacked = (res.ok && !type.includes('json')) ||
        (res.redirected && new URL(res.url, location.href).origin !== location.origin);
      if (hijacked) {
        setDiagnosis(c.type === 'wifi' ? 'login_page' : 'operator_page', 'unexpected'); readSignal(); return;
      }
      setDiagnosis(slow ? 'weak' : 'unknown', 'unavailable'); readSignal();
    } catch (e) {
      clearTimeout(timer);
      // Could not reach our own file. Only call it a dead connection when the
      // browser agrees it is offline; otherwise the check itself is blocked.
      if (!navigator.onLine) setDiagnosis('offline', 'fail');
      else setDiagnosis(c.type === 'wifi' ? 'unknown' : 'unknown', 'unavailable');
      readSignal();
    }
  }
  async function readSignal() {
    if (state.injected || !root.Native) return;
    const sig = await root.Native.signal();
    setSignal(sig);
    // Real weak signal (app) with a working connection is still worth flagging
    if (sig.source === 'android' && sig.weak && state.net.diagnosis === 'ok') setDiagnosis('weak', 'ok');
  }
  function setSignal(sig) {
    state.signal = { dbm: sig.dbm ?? null, level: sig.level ?? null, type: sig.type || null,
                     operator: sig.operator || null, weak: !!sig.weak, source: sig.source || null };
    emit('signal', { ...state.signal });
  }

  function setDiagnosis(code, probeResult) {
    const changed = state.net.diagnosis !== code;
    state.net.diagnosis = code;
    state.net.probe = probeResult;
    if (changed) state.net.since = Date.now();
    emit('net', { ...state.net, ...DIAGNOSES[code], changed });
  }
  function startNet() {
    window.addEventListener('online', probe);
    window.addEventListener('offline', probe);
    if (navigator.connection) navigator.connection.addEventListener('change', probe);
    probe();
    scheduleProbe();
  }
  function scheduleProbe() {
    clearInterval(probeTimer);
    probeTimer = setInterval(probe, MODES[state.mode].probeEveryMs);
  }

  /* -------------------------------------------------------------------- GPS */
  let watchId = null, gpsTimer = null, lastFix = null;
  function startGps() {
    stopGps();
    if (!navigator.geolocation) return;
    const m = MODES[state.mode];
    const opts = { enableHighAccuracy: m.gpsHigh, maximumAge: m.gpsHigh ? 0 : 10000, timeout: 20000 };
    const onFix = p => {
      if (state.injected) return;
      setGps(p.coords.latitude, p.coords.longitude, p.coords.accuracy,
             p.coords.speed != null ? p.coords.speed * 3.6 : null);
    };
    const onErr = e => emit('gps-error', e.message);
    if (m.gpsEveryMs) {
      navigator.geolocation.getCurrentPosition(onFix, onErr, opts);
      gpsTimer = setInterval(() => navigator.geolocation.getCurrentPosition(onFix, onErr, opts), m.gpsEveryMs);
    } else {
      watchId = navigator.geolocation.watchPosition(onFix, onErr, opts);
    }
  }
  function stopGps() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    clearInterval(gpsTimer);
    watchId = null; gpsTimer = null;
  }
  function setGps(lat, lng, acc, speedKmh) {
    const now = Date.now();
    if (speedKmh == null && lastFix) {
      const dt = (now - lastFix.t) / 3600000;
      if (dt > 0) speedKmh = distanceM(lastFix.lat, lastFix.lng, lat, lng) / 1000 / dt;
      if (speedKmh > 200 || dt < 1 / 3600) speedKmh = null;   // jumps and near-duplicate fixes are not real speed
    }
    lastFix = { lat, lng, t: now };
    Object.assign(state.gps, { lat, lng, acc: acc ?? null, speedKmh: speedKmh ?? null, ts: now });
    emit('gps', { ...state.gps });
  }

  /* ----------------------------------------------------------------- motion */
  const motionBuf = [];
  async function startMotion() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {   // iPhone
      try { if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return; } catch (e) { return; }
    }
    window.addEventListener('devicemotion', onMotion);
  }
  function onMotion(e) {
    if (state.injected) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    const mag = Math.abs(Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) - 9.81);
    const now = Date.now();
    motionBuf.push({ t: now, mag });
    while (motionBuf.length && motionBuf[0].t < now - 2000) motionBuf.shift();
    if (motionBuf.length < 10 || now - (onMotion.last || 0) < 500) return;
    onMotion.last = now;
    const vals = motionBuf.map(m => m.mag);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    setMotion(std, Math.max(...vals));
  }
  // Thresholds are starting points; calibrate from your own walks
  function setMotion(std, peak) {
    const now = Date.now();
    const m = state.motion;
    let activity = std < 0.35 ? 'still' : std < 3 ? 'walk' : 'run';
    if (peak > 18) { activity = 'jolt'; m.lastJolt = now; }
    if (activity === 'still') m.stillSince = m.stillSince || now; else m.stillSince = null;
    if (activity === 'run') m.runSince = m.runSince || now; else if (activity !== 'jolt') m.runSince = null;
    Object.assign(m, { activity, std: +std.toFixed(2), peak: +peak.toFixed(1) });
    emit('motion', { ...m });
  }

  /* ------------------------------------------------------------------ light */
  let camStream = null, camTimer = null;
  async function startLight() {
    stopLight();
    if (!MODES[state.mode].light || !cameraAllowed) return;
    if ('AmbientLightSensor' in window) {           // rare, but best when present
      try {
        const s = new AmbientLightSensor({ frequency: 0.2 });
        s.addEventListener('reading', () => setLight(Math.min(255, s.illuminance), 'sensor'));
        s.start(); return;
      } catch (e) { /* fall through to camera */ }
    }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 64, height: 48 } });
      const video = document.createElement('video');
      video.srcObject = camStream; video.muted = true; video.playsInline = true;
      await video.play();
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      camTimer = setInterval(() => {
        if (state.injected) return;
        ctx.drawImage(video, 0, 0, 32, 24);
        const px = ctx.getImageData(0, 0, 32, 24).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px.fill && px.fill(0);                       // frame discarded immediately
        setLight(sum / (px.length / 4), 'camera');
      }, 5000);
    } catch (e) { state.light.source = 'unavailable'; }
  }
  function stopLight() {
    clearInterval(camTimer); camTimer = null;
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  function setLight(level, source) {
    state.light = { level: Math.round(level), source };
    emit('light', { ...state.light });
  }

  /* ------------------------------------------------------------ sound feed */
  function setSound(s) {
    Object.assign(state.sound, s);
    emit('sound', { ...state.sound });
  }

  /* ------------------------------------------------------------- power mode */
  function setMode(mode) {
    if (!MODES[mode] || mode === state.mode) return;
    state.mode = mode;
    startGps(); scheduleProbe(); startLight();
    emit('mode', { mode, policy: MODES[mode] });
  }

  /* ----------------------------------------------------------------- logger */
  const DB_NAME = 'sixthsense', STORE = 'readings';
  let db = null, logTimer = null;
  function openDb() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => res(db = req.result);
      req.onerror = () => rej(req.error);
    });
  }
  function snapshot(label) {
    return {
      t: new Date().toISOString(), label: label || '',
      lat: state.gps.lat, lng: state.gps.lng, acc: state.gps.acc, speedKmh: state.gps.speedKmh,
      battery: state.battery.level, charging: state.battery.charging, mode: state.mode,
      online: state.net.online, netType: state.net.type, effType: state.net.effectiveType,
      rtt: state.net.rtt, diagnosis: state.net.diagnosis,
      signalDbm: state.signal.dbm, signalLevel: state.signal.level, signalSource: state.signal.source,
      activity: state.motion.activity, motionStd: state.motion.std,
      light: state.light.level, liveliness: state.sound.liveliness,
      dogConf: state.sound.dogConf, dogPack: state.sound.isPack, dbfs: state.sound.dbfs,
    };
  }
  async function startLogging(label) {
    await openDb();
    stopLogging();
    logTimer = setInterval(() => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(snapshot(label));
    }, cfg.logEveryMs);
    emit('logging', true);
  }
  function stopLogging() { clearInterval(logTimer); logTimer = null; emit('logging', false); }
  async function allReadings() {
    await openDb();
    return new Promise(res => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
    });
  }
  async function exportCsv() {
    const rows = await allReadings();
    if (!rows.length) return null;
    const cols = Object.keys(rows[0]);
    const esc = v => (v == null ? '' : String(v).includes(',') ? `"${v}"` : v);
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  }
  async function clearLog() {
    await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  }

  /* ------------------------------------------------------------ replay feed */
  // Replay mode pushes recorded or scripted values instead of live sensors
  function inject(patch) {
    state.injected = true;
    if (patch.battery != null) setBattery(patch.battery, patch.charging);
    if (patch.net) setDiagnosis(patch.net, patch.net === 'ok' ? 'ok' : 'fail');
    if (patch.signal) setSignal({ ...patch.signal, source: 'replay' });
    if (patch.gps) setGps(patch.gps.lat, patch.gps.lng, 10, patch.gps.speedKmh);
    if (patch.motion) setMotion(patch.motion.std, patch.motion.peak || patch.motion.std * 2);
    if (patch.light != null) setLight(patch.light, 'replay');
    if (patch.sound) setSound({ ...patch.sound, status: 'replay' });
  }
  // Back to live sensors after a demo: forget demo positions and re-read the battery
  function endInject() {
    state.injected = false;
    lastFix = null;
    if (batteryObj) setBattery(Math.round(batteryObj.level * 100), batteryObj.charging);
  }

  /* ------------------------------------------------------------------ utils */
  function distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  let cameraAllowed = true, started = false, passive = false;
  // Battery and network need no permission, so they can run from app start
  async function startPassive() {
    if (passive) return; passive = true;
    await startBattery(); startNet();
  }
  async function start(opts = {}) {
    if (opts.camera === false) cameraAllowed = false;
    if (!started) { await startPassive(); await startMotion(); started = true; }   // from a tap so iPhone can ask
    startGps();
    if (cameraAllowed) startLight();
    emit('mode', { mode: state.mode, policy: MODES[state.mode] });
  }
  function stop() { stopGps(); stopLight(); clearInterval(probeTimer); window.removeEventListener('devicemotion', onMotion); started = false; }

  root.SensorHub = {
    start, startPassive, stop, on, setMode, setSound, probe,
    startLogging, stopLogging, exportCsv, clearLog, allReadings, snapshot,
    inject, endInject,
    get state() { return state; },
    config: cfg, MODES, DIAGNOSES, distanceM,
  };
})(typeof window !== 'undefined' ? window : globalThis);

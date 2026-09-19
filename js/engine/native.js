/* ============================================================================
 * native.js — Native
 * One place that decides: Android app (Capacitor) or browser?
 *   Android app : real signal strength (dBm), trip service that keeps running
 *                 with the screen off, SMS sent without a tap
 *   Browser     : estimated signal quality, normal page, SMS opened for her
 * Every call falls back to the browser behaviour if the native call fails.
 * Load after capacitor.js (app only) and before sensors.js.
 * Exposes: window.Native
 * ========================================================================== */
(function (root) {
  'use strict';

  const cap = root.Capacitor;
  const isApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.registerPlugin);
  const plugin = name => (isApp ? cap.registerPlugin(name) : null);
  const P = { signal: plugin('SignalStrength'), trip: plugin('TripService'), sms: plugin('SafetySms') };
  const WEAK_DBM = -105;   // 4G reference point from the pitch; phones and networks vary

  /* --------------------------------------------------------------- signal */
  // Returns { dbm, level(0–4), type, operator, weak, source: 'android'|'estimate' }
  async function signal() {
    if (P.signal) {
      try {
        const r = await P.signal.get();
        if (r && r.dbm != null) return { ...r, weak: r.dbm <= WEAK_DBM, source: 'android' };
      } catch (e) { /* fall through to estimate */ }
    }
    return estimate();
  }

  // Browser: no dBm available, so estimate from what Chrome exposes
  function estimate() {
    const c = navigator.connection || {};
    if (!navigator.onLine) return { dbm: null, level: 0, type: c.type || 'unknown', weak: true, source: 'estimate' };
    let level = 3;
    if (c.effectiveType === 'slow-2g') level = 0;
    else if (c.effectiveType === '2g') level = 1;
    else if (c.effectiveType === '3g') level = 2;
    if (c.rtt != null) level = Math.min(level, c.rtt > 1500 ? 0 : c.rtt > 800 ? 1 : c.rtt > 400 ? 2 : 4);
    if (c.downlink != null && c.downlink < 0.3) level = Math.min(level, 1);
    return { dbm: null, level, type: c.type || c.effectiveType || 'unknown', weak: level <= 1, source: 'estimate' };
  }

  /* ----------------------------------------------------------------- trip */
  // Keeps the app alive during a trip (notification "SixthSense is watching your trip")
  async function tripStarted(destName) {
    if (!P.trip) return false;
    try { await P.trip.start({ title: 'SixthSense is with you', text: destName ? `Trip to ${destName}` : 'Trip in progress' }); return true; }
    catch (e) { return false; }
  }
  async function tripUpdate(text) {
    if (!P.trip) return;
    try { await P.trip.update({ text }); } catch (e) { /* ignore */ }
  }
  async function tripEnded() {
    if (!P.trip) return;
    try { await P.trip.stop(); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ SMS */
  // App: sends directly and resolves { sent: true }. Browser: opens the SMS app.
  async function sendSms(numbers, body) {
    const list = [].concat(numbers).filter(Boolean);
    if (P.sms && list.length) {
      try {
        const r = await P.sms.send({ numbers: list, message: body });
        if (r && r.sent) return { sent: true, via: 'android' };
      } catch (e) { /* fall back */ }
    }
    const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
    root.location.href = `sms:${list.join(',')}${sep}body=${encodeURIComponent(body)}`;
    return { sent: false, via: 'sms-app' };
  }

  root.Native = {
    isApp,
    platform: isApp ? 'Android app' : 'Browser',
    signal, estimate, tripStarted, tripUpdate, tripEnded, sendSms,
    canSendSmsDirectly: !!P.sms,
    WEAK_DBM,
  };
})(typeof window !== 'undefined' ? window : globalThis);

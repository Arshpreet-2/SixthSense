/* ============================================================================
 * mockdata.js — MockSensing
 * SIMULATED readings from other members, until real users exist. They work
 * anywhere, not only in the pilot area, and are anchored to what we really
 * know about that place:
 *   • satellite night light and OpenStreetMap "lit" tags and lamps (Light)
 *   • how close help points, shops and transport are
 *   • the time of day
 * Same result inside a 10-minute window, so a demo is repeatable and two
 * phones agree. Every reading carries sim:true and the app labels it.
 * Exposes: window.MockSensing
 * ========================================================================== */
(function (root) {
  'use strict';

  // How busy streets are by hour (0–23), relative
  const HOUR_ACTIVITY = [0.1, 0.05, 0.05, 0.05, 0.1, 0.2, 0.35, 0.55, 0.8, 0.85, 0.8, 0.75,
                         0.8, 0.8, 0.75, 0.8, 0.9, 1.0, 1.0, 0.95, 0.8, 0.6, 0.4, 0.2];

  const CONTRIBUTORS = [
    ['sim-g1', 'gold'], ['sim-g2', 'gold'], ['sim-g3', 'gold'], ['sim-w1', 'woman'],
    ['sim-w2', 'woman'], ['sim-o1', 'other'], ['sim-b1', 'basic'], ['sim-p1', 'partner'],
  ];
  const TRUST = { gold: 1, partner: 1, woman: 0.8, other: 0.4, basic: 0.2 };

  // The pilot area is kept only so the app can say the readings are densest here
  const PILOT = { lat: 28.6645, lng: 77.2326, radiusM: 3000 };
  const inPilot = (lat, lng) => root.SensorHub.distanceM(lat, lng, PILOT.lat, PILOT.lng) <= PILOT.radiusM;

  // Same place, same 10 minutes -> same numbers, on every phone
  function seeded(lat, lng, window10, salt) {
    let h = 2166136261 ^ window10 ^ (salt || 0);
    const s = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let x = h >>> 0;
    return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // What we genuinely know about this spot, used to anchor the simulation
  function anchor(lat, lng, t) {
    const help = (root.Light && root.Light.helpPoints()) || [];
    let nearestHelp = Infinity, shops = 0, transport = Infinity;
    for (const p of help) {
      const d = root.SensorHub.distanceM(lat, lng, p.lat, p.lng);
      if (d < 400) {
        if (['police', 'hospital', 'clinic', 'pharmacy', 'fuel'].includes(p.kind)) nearestHelp = Math.min(nearestHelp, d);
        if (p.kind === 'shop' || p.kind === 'pharmacy' || p.kind === 'fuel') shops++;
        if (['metro', 'station', 'bus stop'].includes(p.kind)) transport = Math.min(transport, d);
      }
    }
    const l = root.Light ? root.Light.estimate(lat, lng, [], t) : { level: null, source: 'none' };
    // Light we actually know: map tag, lamp or satellite. Null means unknown.
    const known = l.source === 'daylight' ? 240 : (l.level != null ? l.level : null);
    // Busier where there are shops and transport nearby
    const busy = Math.min(1, 0.18 + shops * 0.12 + (transport < 250 ? 0.35 : transport < 600 ? 0.15 : 0));
    return { known, busy, nearestHelp, transport };
  }

  /* Readings for the last 2 hours along the given routes, anywhere in the world */
  function generate(routes, now = Date.now()) {
    const window10 = Math.floor(now / 600000);
    const out = [];
    const seen = new Set();
    for (const route of routes) {
      for (let i = 0; i < route.coords.length; i += 3) {
        const [lng, lat] = route.coords[i];
        const cell = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (seen.has(cell)) continue;
        seen.add(cell);

        const rand = seeded(lat, lng, window10, 0);
        const a = anchor(lat, lng, now);
        const dense = inPilot(lat, lng);                     // more members near the pilot campus
        const n = dense ? 2 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);

        for (let k = 0; k < n; k++) {
          const t = now - Math.floor(rand() * 110 * 60000);
          const hour = new Date(t).getHours();
          const dark = root.Light ? root.Light.isDark(lat, lng, t) : (hour >= 19 || hour < 6);

          // Light: follow what the map or satellite says; vary a little around it
          const base = a.known != null ? a.known : (dark ? 70 : 220);
          const light = dark ? Math.max(4, Math.min(255, base + (rand() - 0.5) * 45))
                             : 200 + rand() * 50;

          // Activity: time of day, shaped by shops and transport nearby
          const activity = Math.min(1, Math.max(0.02, a.busy * HOUR_ACTIVITY[hour] * (0.75 + rand() * 0.5)));

          // Dogs: more likely on dark, quiet stretches
          const dogPack = dark && activity < 0.25 && rand() < 0.18;

          // GPS accuracy: better on open, lit, busy roads than in tight lanes
          const gpsAcc = Math.round(8 + (1 - Math.min(1, activity + (light / 255) * 0.5)) * 26 + rand() * 6);

          // Footpath steadiness and signal: better where the place is busier
          const motionStd = +(1.0 + (1 - activity) * 1.7 + rand() * 0.4).toFixed(2);
          const dbm = Math.round(-82 - (1 - activity) * 22 - (a.transport > 600 ? 6 : 0) + (rand() - 0.5) * 8);
          const dbfs = Math.round(-62 + activity * 38 + (rand() - 0.5) * 6);

          const [contributor, tier] = CONTRIBUTORS[Math.floor(rand() * CONTRIBUTORS.length)];
          out.push({
            lat: +lat.toFixed(5), lng: +lng.toFixed(5), t, light: Math.round(light),
            liveliness: +activity.toFixed(2), dogPack, gpsAcc, dbfs,
            motionStd, walking: true, signalDbm: dbm, signalWeak: dbm <= -105,
            contributor, tier, trust: TRUST[tier], kind: 'sensor', status: 'confirmed', sim: true,
          });
        }
      }
    }
    return out;
  }

  /* A few weeks of history for these routes, so Normals has something to
     compare tonight against. Same generator, same labelling: simulated. */
  function history(routes, weeks = 3, now = Date.now()) {
    const out = [];
    const DAY = 86400000;
    for (let d = 1; d <= weeks * 7; d++) {
      for (const hour of [18, 19, 20, 21, 22, 23]) {
        const t = new Date(now - d * DAY);
        t.setHours(hour, 20 + Math.floor(Math.random() * 30), 0, 0);
        out.push(...generate(routes, t.getTime()));
      }
    }
    return out;
  }

  root.MockSensing = { generate, history, PILOT, inPilot, TRUST };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================================
 * context.js — Context
 * Real walking/driving routes (OpenStreetMap), help points, the offline pack,
 * and the route comparison with an honest confidence level.
 * Exposes: window.Context
 * ========================================================================== */
(function (root) {
  'use strict';

  // Offline mode: every outside call is refused in one place, so nothing leaks
  const offline = () => typeof S !== 'undefined' && S.offline;
  const guard = () => { if (offline()) throw new Error('Offline mode is on. Saved data only.'); };

  const ROUTER = {
    walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
    scooty: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    auto: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    cab: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  };
  const FALLBACK_HELP = 'data/helppoints.igdtuw.json';
  const PACK_KEY = 'ss.offlinePack';

  const dist = (a, b) => root.SensorHub.distanceM(a[1], a[0], b[1], b[0]); // [lng,lat]

  /* --------------------------------------------------------------- routes */
  async function fetchRoutes(from, to, mode = 'walk') {
    guard();
    const base = ROUTER[mode] || ROUTER.walk;
    const url = `${base}/${from.lng},${from.lat};${to.lng},${to.lat}` +
                `?alternatives=true&steps=true&overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Route service returned ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error(data.message || 'No route found');
    // Road routes: free-flow times are far too optimistic for Old Delhi traffic
    const traffic = mode === 'walk' ? 1 : 2.2;
    return data.routes.slice(0, 3).map((r, i) => ({
      id: `R${i + 1}`, label: String.fromCharCode(65 + i),   // A, B, C
      mode, distanceM: Math.round(r.distance), durationMin: Math.max(1, Math.round(r.duration * traffic / 60)),
      coords: r.geometry.coordinates,
      steps: r.legs[0].steps.map(s => ({
        type: s.maneuver.type, modifier: s.maneuver.modifier || '',
        name: s.name || '', distanceM: Math.round(s.distance),
        at: s.maneuver.location,
      })),
    }));
  }

  // Short list she can remember if the phone dies
  function landmarkCard(route, max = 5) {
    // Walk distance before each turn = sum of step distances since the last turn
    const out = [];
    let walked = 0;
    for (const s of route.steps) {
      if (['turn', 'end of road', 'fork', 'roundabout', 'arrive'].includes(s.type)) {
        const after = walked >= 20 ? `after ${Math.round(walked / 10) * 10} m` : 'straight away';
        if (s.type === 'arrive') out.push(`Arrive ${after}`);
        else {
          const dir = (s.modifier || 'ahead').replace('slight ', 'slightly ').replace('sharp ', '');
          out.push(`${dir[0].toUpperCase() + dir.slice(1)} ${after}${s.name ? ` onto ${s.name}` : ''}`);
        }
        walked = 0;
      }
      walked += s.distanceM;
    }
    // Keep the first turns and always the arrival
    return out.length <= max ? out : [...out.slice(0, max - 1), out[out.length - 1]];
  }

  /* --------------------------------------------------------- help points */
  // Help points for any place: live OpenStreetMap via the light layer's area fetch;
  // bundled list only for the IGDTUW pilot when live lookup fails
  async function fetchHelpPoints(coords) {
    guard();
    const box = root.Light.boundsOf(coords);
    await root.Light.loadFor(box);
    const live = root.Light.helpPoints();
    const [lng, lat] = coords[0];
    if (live.length || !(root.MockSensing && root.MockSensing.inPilot(lat, lng))) return live;
    try { const res = await fetch(FALLBACK_HELP); return (await res.json()).points; } catch (e) { return []; }
  }

  function nearest(points, lat, lng, n = 3, kinds) {
    return points
      .filter(p => !kinds || kinds.includes(p.kind))
      .map(p => ({ ...p, distM: Math.round(root.SensorHub.distanceM(lat, lng, p.lat, p.lng)) }))
      .sort((a, b) => a.distM - b.distM).slice(0, n);
  }

  /* ------------------------------------------- route comparison + confidence */
  // readings: [{lat,lng,t,liveliness,light,dogPack,report}] from the backend or the phone.
  // Each reading counts less as it ages (half-life 45 min) and stops counting after 2 h.
  function scoreRoute(route, readings, now = Date.now()) {
    const HALF_LIFE = 45 * 60000, MAX_AGE = 2 * 3600000, NEAR_M = 60;
    const samples = sampleLine(route.coords, 50);
    let wSum = 0, live = 0, light = 0, lightW = 0, dogs = 0, newest = null;
    const used = new Set();
    for (const [i, r] of readings.entries()) {
      const age = now - r.t;
      if (age > MAX_AGE || age < 0) continue;
      const near = samples.some(p => root.SensorHub.distanceM(p[1], p[0], r.lat, r.lng) <= NEAR_M);
      if (!near || used.has(i)) continue;
      used.add(i);
      const w = Math.pow(0.5, age / HALF_LIFE);
      wSum += w;
      if (r.liveliness != null) live += w * r.liveliness;
      if (r.light != null) { light += w * r.light; lightW += w; }
      if (r.dogPack) dogs += w;
      newest = newest == null ? age : Math.min(newest, age);
    }
    const confidence = 1 - Math.exp(-wSum / 3);   // 3 fresh readings ≈ 63%
    return {
      routeId: route.id,
      activity: wSum ? +(live / wSum).toFixed(2) : null,
      light: lightW ? Math.round(light / lightW) : null,
      dogReports: +dogs.toFixed(1),
      readings: used.size,
      newestMin: newest == null ? null : Math.round(newest / 60000),
      confidence: +confidence.toFixed(2),
      confidenceLabel: confidence >= 0.7 ? 'high' : confidence >= 0.35 ? 'medium' : 'low',
    };
  }

  // Plain-language comparison. Never says "safe" or "unsafe".
  function compare(routes, readings, { offline = false, now = Date.now() } = {}) {
    const scored = routes.map(r => ({
      route: r, s: scoreRoute(r, readings, now),
      light: root.Light ? root.Light.routeLight(r, readings, now) : null,
    }));
    const fastest = Math.min(...routes.map(r => r.durationMin));
    const lines = scored.map(({ route: r, s, light }) => {
      const extra = r.durationMin - fastest;
      const parts = [`Route ${r.label}: ${r.durationMin} min${extra ? ` (+${extra})` : ''}`];
      if (s.activity == null) parts.push('no recent activity readings');
      else parts.push(s.activity >= 0.5 ? 'people and traffic heard' : s.activity >= 0.2 ? 'some activity' : 'quiet');
      if (!light && s.light != null) parts.push(s.light >= 90 ? 'well lit' : s.light >= 40 ? 'some light' : 'dark');
      if (s.dogReports >= 0.5) parts.push('dog pack reported');
      const age = s.newestMin == null ? '' : `, newest ${s.newestMin} min old`;
      const sim = readings.some(x => x.sim) ? ', simulated' : '';
      parts.push(`activity confidence ${s.confidenceLabel} (${s.readings} readings${age}${sim})`);
      return { routeId: r.id, text: parts.join('; '), score: s, light };
    });
    const value = x => (x.s.activity ?? 0) - x.s.dogReports * 0.3 +
      (x.light && x.light.level != null && x.light.label !== 'daylight' ? (x.light.level / 255) * 0.5 : 0);
    const known = scored.filter(x => x.s.activity != null);
    let lead = null;
    if (known.length >= 2) {
      const pick = known.reduce((a, b) => value(b) * b.s.confidence > value(a) * a.s.confidence ? b : a);
      if (pick.s.confidenceLabel !== 'low') {
        const lit = pick.light && pick.light.label !== 'daylight' ? ` and was ${pick.light.label}` : '';
        lead = `Route ${pick.route.label} had more activity${lit} recently.`;
      }
    }
    if (!lead) lead = 'Not enough recent information to compare these routes. Your own judgement comes first.';
    if (offline) lead = `Offline: based on saved readings. ${lead}`;
    return { lead, lines };
  }

  function sampleLine(coords, stepM) {
    const out = [coords[0]];
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      acc += dist(coords[i - 1], coords[i]);
      if (acc >= stepM) { out.push(coords[i]); acc = 0; }
    }
    out.push(coords[coords.length - 1]);
    return out;
  }

  // Distance from a point to the route, and how far along the route it is
  function locateOnRoute(coords, lat, lng) {
    let best = { offM: Infinity, alongM: 0 }, along = 0;
    for (let i = 0; i < coords.length; i++) {
      const d = root.SensorHub.distanceM(lat, lng, coords[i][1], coords[i][0]);
      if (d < best.offM) best = { offM: Math.round(d), alongM: Math.round(along), index: i };
      if (i < coords.length - 1) along += dist(coords[i], coords[i + 1]);
    }
    return { ...best, totalM: Math.round(along) };
  }

  /* --------------------------------------------------------- offline pack */
  // Everything the trip needs, saved before the signal goes
  function savePack(pack) {
    const data = { ...pack, savedAt: Date.now() };
    try { localStorage.setItem(PACK_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  const loadPack = () => { try { return JSON.parse(localStorage.getItem(PACK_KEY)); } catch (e) { return null; } };

  async function buildPack({ from, to, mode, destName, contacts, readings }) {
    const profile = { walk: 'walk', metro: 'walk', bus: 'walk', auto: 'auto', cab: 'auto', scooty: 'scooty' }[mode] || 'walk';
    const routes = await fetchRoutes(from, to, profile);
    let help = [];
    try { help = await fetchHelpPoints(routes.flatMap(r => r.coords)); } catch (e) { /* keep going */ }
    const pack = {
      from, to, destName, mode, routes, help, contacts,
      readings: (readings || []).slice(-300),
      landmarks: Object.fromEntries(routes.map(r => [r.id, landmarkCard(r)])),
      fares: root.Prefs ? Object.fromEntries(['walk', 'metro', 'bus', 'auto', 'cab'].map(m => [m, root.Prefs.fare(m, routes[0].distanceM / 1000)])) : {},
    };
    savePack(pack);
    return pack;
  }

  /* ------------------------------------------------------- place search */
  // Photon (OpenStreetMap data); results biased towards where she is
  async function searchPlaces(text, near) {
    guard();
    if (!text || text.trim().length < 3) return [];
    const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6${bias}`);
    if (!res.ok) throw new Error(`Place search returned ${res.status}`);
    const data = await res.json();
    return data.features.map(f => {
      const p = f.properties;
      const area = [p.street, p.district || p.locality, p.city, p.state].filter(Boolean).join(', ');
      return { name: p.name || p.street || 'Unnamed place', area, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    });
  }

  // Metro and railway stations near a point (OpenStreetMap via Nominatim, any city).
  // A bounded box is used so only stations actually near the point come back.
  const stationCache = new Map();
  let lastStationCall = 0;   // Nominatim asks for at most one request per second
  async function stationsNear(p, radiusM = 2000) {
    guard();
    const key = p.lat.toFixed(3) + ',' + p.lng.toFixed(3) + ':' + radiusM;
    if (stationCache.has(key)) return stationCache.get(key);
    const wait = 1100 - (Date.now() - lastStationCall);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastStationCall = Date.now();
    const dLat = radiusM / 111000, dLng = radiusM / (111000 * Math.cos(p.lat * Math.PI / 180));
    const box = [p.lng - dLng, p.lat + dLat, p.lng + dLng, p.lat - dLat].map(v => v.toFixed(5)).join(',');
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=metro%20station&limit=10&bounded=1&viewbox=${box}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Station search returned ${res.status}`);
    const raw = await res.json();
    const seen = new Set();
    const out = raw
      // keep only real stations and their entrances, not cafes that mention "metro"
      .filter(r => (r.category === 'railway' && ['station', 'halt', 'subway_entrance', 'stop'].includes(r.type))
                   || /metro\s*station/i.test(r.name || r.display_name || ''))
      .map(r => {
        const name = (r.name || r.display_name.split(',')[0])
          .replace(/\s*(gate|lift|entry|entrance|exit)\s*(number|no\.?)?\s*\d+.*$/i, '')
          .replace(/\s*metro\s*station.*$/i, '').trim();
        return { name, lat: +r.lat, lng: +r.lon };
      })
      .filter(st => st.name && !seen.has(st.name) && seen.add(st.name))
      .filter(st => root.SensorHub.distanceM(p.lat, p.lng, st.lat, st.lng) <= radiusM)
      .sort((a, b) => root.SensorHub.distanceM(p.lat, p.lng, a.lat, a.lng) - root.SensorHub.distanceM(p.lat, p.lng, b.lat, b.lng));
    stationCache.set(key, out);
    return out;
  }

  // Place name for a position (reverse geocoding, OpenStreetMap)
  const nameCache = new Map();
  let lastReverse = 0;
  async function placeName(lat, lng, detail = 'short') {
    guard();
    const key = lat.toFixed(4) + ',' + lng.toFixed(4) + detail;
    if (nameCache.has(key)) return nameCache.get(key);
    const wait = 1100 - (Date.now() - lastReverse);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastReverse = Date.now();
    const zoom = detail === 'full' ? 18 : 16;
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`);
    if (!res.ok) throw new Error('Could not read the place name');
    const j = await res.json();
    const a = j.address || {};
    const near = j.name || a.building || a.amenity || a.road || a.neighbourhood || a.suburb;
    const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.state_district;
    const name = detail === 'full'
      ? [near, area, a.city || a.town].filter(Boolean).slice(0, 3).join(', ')
      : [near, area].filter((x, i, arr) => x && arr.indexOf(x) === i).slice(0, 2).join(', ');
    const out = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    nameCache.set(key, out);
    return out;
  }

  root.Context = {
    searchPlaces, stationsNear, placeName,
    fetchRoutes, fetchHelpPoints, nearest, landmarkCard,
    scoreRoute, compare, locateOnRoute, buildPack, savePack, loadPack,
  };
})(typeof window !== 'undefined' ? window : globalThis);

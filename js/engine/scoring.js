/* ============================================================================
 * scoring.js — Scoring
 * Six-sense route comparison (Project Report v1.5, Section 7).
 *   • 50 m segments, 12 parameters, 100 points per segment
 *   • readings within 60 m and 2 h, weight = 0.5^(age/45 min) × trust
 *   • positive typed claims only when confirmed; pending negatives at half weight
 *   • missing data is left out and lowers confidence, never treated as safe
 *   • output: comparison text, "why" list, six-sense bars, weakest stretch
 * Numbers are internal; the interface never shows a score out of 100.
 * Needs: SensorHub (distance), Light. Exposes: window.Scoring
 * ========================================================================== */
(function (root) {
  'use strict';

  const SENSES = {
    SEE:   { points: 25, params: { light: 15, openness: 5, visibility: 5 } },
    HEAR:  { points: 20, params: { sound: 10, activity: 5, shops: 5 } },
    RUN:   { points: 20, params: { steadiness: 10, exit: 10 } },
    CALL:  { points: 15, params: { signal: 10, help: 5 } },
    TRIBE: { points: 10, params: { people: 10 } },
    GUT:   { points: 10, params: { dogs: 10 } },
  };
  const PARAM_SENSE = {};
  for (const [s, d] of Object.entries(SENSES)) for (const p of Object.keys(d.params)) PARAM_SENSE[p] = s;
  const POINTS = Object.fromEntries(Object.values(SENSES).flatMap(d => Object.entries(d.params)));

  const CFG = {
    segmentM: 50, nearM: 60, maxAgeMs: 2 * 3600000, halfLifeMs: 45 * 60000, tribeWindowMs: 15 * 60000,
    demoMaxAgeMs: 7 * 24 * 3600000, demoHalfLifeMs: 36 * 3600000,   // demo mode: keep the seeded data usable
    minutePenalty: 1, leadPoints: 5, weakBelow: 50, alwaysMentionBelow: 30, alwaysMentionM: 100,
    staffed: ['police', 'hospital', 'metro', 'clinic', 'fuel', 'pharmacy'],
  };

  const dist = (a, b, c, d) => root.SensorHub.distanceM(a, b, c, d);
  const band = (v, full, half, higherIsBetter = true) =>
    v == null ? null : higherIsBetter ? (v >= full ? 1 : v >= half ? 0.5 : 0) : (v <= full ? 1 : v <= half ? 0.5 : 0);

  /* --------------------------------------------------------- reading weights */
  // Sensor readings count with trust. Typed reports: confirmed = full,
  // pending negative = half, pending positive / disputed / rejected = not used.
  function weightOf(r, now) {
    const age = now - r.t;
    if (age < 0 || age > CFG.maxAgeMs) return 0;
    let w = Math.pow(0.5, age / CFG.halfLifeMs) * (r.trust ?? 1);
    if (r.kind === 'report') {
      if (r.status === 'confirmed') { /* full */ }
      else if (r.status === 'pending' && r.polarity === 'negative') w *= 0.5;
      else return 0;
    }
    return w;
  }

  function weightedMean(items, key) {
    let w = 0, s = 0;
    for (const { r, w: k } of items) if (r[key] != null) { w += k; s += k * r[key]; }
    return w ? s / w : null;
  }
  function weightedMedian(items, key, filter) {
    const xs = items.filter(x => x.r[key] != null && (!filter || filter(x.r))).map(x => x.r[key]).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : null;
  }

  /* -------------------------------------------------------- one segment */
  function scoreSegment(lat, lng, ctx) {
    const { readings, now, help, zones } = ctx;
    const near = [];
    for (const r of readings) {
      const w = weightOf(r, now);
      if (w <= 0) continue;
      if (dist(lat, lng, r.lat, r.lng) <= CFG.nearM) near.push({ r, w });
    }
    const W = near.reduce((a, x) => a + x.w, 0);
    const dark = root.Light ? root.Light.isDark(lat, lng, now) : false;
    const sub = {}, why = {};

    // SEE
    const L = root.Light ? root.Light.estimate(lat, lng, near.map(x => x.r), now) : { level: null, source: 'none' };
    if (L.source === 'daylight') { sub.light = 1; why.light = 'daylight'; }
    else if (L.level != null) { sub.light = band(L.level, 90, 40); why.light = `${L.label} (${L.source === 'phones' ? 'phones' : L.source === 'map' ? 'map tag' : 'satellite'})`; }
    const acc = weightedMedian(near, 'gpsAcc');
    if (acc != null) { sub.openness = band(acc, 10, 30, false); why.openness = acc <= 10 ? 'open surroundings' : acc <= 30 ? 'partly enclosed' : 'enclosed lane'; }
    if (!dark) { sub.visibility = 1; }
    else {
      const lights = near.filter(x => x.r.light != null).map(x => x.r.light);
      if (lights.length >= 2) {
        const m = lights.reduce((a, b) => a + b, 0) / lights.length;
        const sd = Math.sqrt(lights.reduce((a, b) => a + (b - m) ** 2, 0) / lights.length);
        sub.visibility = band(sd, 20, 50, false); why.visibility = sd < 20 ? 'even lighting' : 'patchy lighting';
      }
    }

    // HEAR
    const db = weightedMean(near, 'dbfs');
    if (db != null) { sub.sound = band(db, -30, -50); why.sound = db > -30 ? 'lively sound level' : db > -50 ? 'quiet in places' : 'very quiet'; }
    const act = weightedMean(near, 'liveliness');
    if (act != null) { sub.activity = band(act, 0.5, 0.2); why.activity = act >= 0.5 ? 'people and traffic heard' : act >= 0.2 ? 'some activity' : 'few people heard'; }
    const shopsNear = help.filter(p => ['shop', 'pharmacy', 'fuel'].includes(p.kind) && dist(lat, lng, p.lat, p.lng) <= 50);
    if (shopsNear.some(p => /24\/7/.test(p.hours || ''))) { sub.shops = 1; why.shops = 'shop open 24/7 nearby'; }
    else if (dark && L.level != null && L.level >= 40 && act != null && act >= 0.5) { sub.shops = 1; why.shops = 'lit and busy (likely open shops)'; }
    else if (shopsNear.length) { sub.shops = 0.5; why.shops = 'shop nearby (hours unknown)'; }
    else if (help.length && W > 0) { sub.shops = 0; why.shops = 'no shops nearby'; }

    // RUN
    const steady = weightedMedian(near, 'motionStd', r => r.walking);
    if (steady != null) { sub.steadiness = band(steady, 1.5, 2.5, false); why.steadiness = steady <= 1.5 ? 'even footpath' : steady <= 2.5 ? 'uneven in places' : 'rough footpath'; }
    if (help.length) {
      const exitD = Math.min(...help.filter(p => [...CFG.staffed, 'bus stop', 'station'].includes(p.kind)).map(p => dist(lat, lng, p.lat, p.lng)), Infinity);
      sub.exit = band(exitD, 100, 250, false); why.exit = exitD <= 100 ? 'help or transport within 100 m' : exitD <= 250 ? 'help or transport within 250 m' : 'far from help or transport';
    }

    // CALL
    const inZone = zones.some(z => dist(lat, lng, z.lat, z.lng) <= (z.radiusM || 80));
    const dbm = weightedMean(near, 'signalDbm');
    if (inZone) { sub.signal = 0; why.signal = `usually no signal${zones.some(z => z.source === 'SIM') ? ' (simulated)' : ''}`; }
    else if (dbm != null) { sub.signal = band(dbm, -95, -105); why.signal = dbm >= -95 ? 'good signal' : dbm >= -105 ? 'weak signal' : 'no usable signal'; }
    if (help.length) {
      const staffed = help.some(p => CFG.staffed.includes(p.kind) && dist(lat, lng, p.lat, p.lng) <= 200);
      const shop = help.some(p => p.kind === 'shop' && dist(lat, lng, p.lat, p.lng) <= 200);
      sub.help = staffed ? 1 : shop ? 0.5 : 0; why.help = staffed ? 'staffed help point within 200 m' : shop ? 'shop within 200 m' : 'no help point within 200 m';
    }

    // TRIBE
    const recent = near.filter(x => now - x.r.t <= CFG.tribeWindowMs && x.r.contributor && x.r.contributor !== 'me');
    const people = {};
    for (const x of recent) people[x.r.contributor] = Math.max(people[x.r.contributor] || 0, x.r.trust ?? 1);
    const tribe = Object.values(people).reduce((a, b) => a + b, 0);
    if (tribe > 0) { sub.people = tribe >= 3 ? 1 : 0.5; why.people = `${Object.keys(people).length} verified people here recently`; }

    // GUT
    if (W > 0) {
      const pack = near.filter(x => x.r.dogPack).reduce((a, x) => a + x.w, 0);
      sub.dogs = pack >= 0.5 ? 0 : pack >= 0.2 ? 0.5 : 1; why.dogs = pack >= 0.2 ? 'dog pack reported' : 'no dog pack reported';
    }

    // Total
    let got = 0, avail = 0;
    for (const [p, v] of Object.entries(sub)) if (v != null) { got += POINTS[p] * v; avail += POINTS[p]; }
    const coverage = avail / 100;
    const onlyMapSat = W === 0;
    let conf = coverage * (1 - Math.exp(-W / 3));
    if (onlyMapSat) conf = Math.min(0.34, coverage * 0.3);
    return {
      lat, lng, sub, why, weight: W, readings: near.length, dark,
      score: avail ? 100 * got / avail : null, coverage, confidence: conf,
      newest: near.length ? Math.min(...near.map(x => now - x.r.t)) : null,
      sim: near.some(x => x.r.sim),
    };
  }

  /* ------------------------------------------------------------ one route */
  function scoreRoute(route, ctx) {
    const pts = sample(route.coords, CFG.segmentM);
    const segs = pts.map(([lng, lat]) => scoreSegment(lat, lng, ctx));
    const withData = segs.filter(s => s.score != null);
    const value = withData.length ? withData.reduce((a, s) => a + s.score, 0) / withData.length : null;
    const coverage = segs.length ? withData.length / segs.length : 0;
    const confidence = segs.length ? segs.reduce((a, s) => a + s.confidence, 0) / segs.length * coverage : 0;

    // Weakest stretch: longest run below 50
    let best = null, run = [];
    for (const s of segs.concat([{ score: 100 }])) {
      if (s.score != null && s.score < CFG.weakBelow) run.push(s);
      else { if (run.length && (!best || run.length > best.length)) best = run; run = []; }
    }
    let weakest = null;
    if (best) {
      const causes = {};
      for (const s of best) for (const [p, v] of Object.entries(s.sub)) if (v != null && v < 1) causes[p] = (causes[p] || 0) + POINTS[p] * (1 - v);
      const top = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => best.find(s => s.sub[p] != null && s.sub[p] < 1).why[p]).filter(Boolean);
      weakest = { metres: best.length * CFG.segmentM, min: Math.min(...best.map(s => s.score)), causes: top };
    }

    const bars = barsOf(withData);

    // Why list: parameters with the biggest average effect
    const effect = {};
    for (const s of withData) for (const [p, v] of Object.entries(s.sub)) if (v != null) {
      effect[p] = effect[p] || { sum: 0, n: 0, whys: {} };
      effect[p].sum += (v - 0.5) * POINTS[p]; effect[p].n++;
      const w = s.why[p]; if (w) effect[p].whys[w] = (effect[p].whys[w] || 0) + 1;
    }
    const lines = Object.entries(effect).map(([p, e]) => ({
      p, impact: e.sum / Math.max(1, segs.length),
      text: Object.entries(e.whys).sort((a, b) => b[1] - a[1])[0]?.[0] || p,
    }));
    const pros = lines.filter(l => l.impact > 0.4).sort((a, b) => b.impact - a.impact).slice(0, 3).map(l => cap(l.text));
    const cons = lines.filter(l => l.impact < -0.4).sort((a, b) => a.impact - b.impact).slice(0, 3).map(l => cap(l.text));
    if (weakest) cons.unshift(`About ${weakest.metres} m weaker stretch: ${weakest.causes.join(', ') || 'mixed factors'}`);

    const readings = withData.reduce((a, s) => a + s.readings, 0);
    const newest = Math.min(...withData.map(s => s.newest ?? Infinity));
    return {
      id: route.id, label: route.label, value, coverage, confidence, weakest, bars, segs,
      pros, cons: cons.slice(0, 3),
      confidenceLabel: confidence >= 0.7 ? 'high' : confidence >= 0.35 ? 'medium' : 'low',
      freshness: readings ? `${readings} readings, newest ${Math.round(newest / 60000)} min old${withData.some(s => s.sim) ? ' (simulated)' : ''}` : 'no recent phone readings',
      daylight: withData.length > 0 && withData.every(s => !s.dark),
    };
  }

  function barsOf(segs) {
    const withData = segs.filter(s => s.score != null);
    const bars = {};
    for (const [sense, d] of Object.entries(SENSES)) {
      let got = 0, avail = 0;
      for (const s of withData) for (const p of Object.keys(d.params)) if (s.sub[p] != null) { got += POINTS[p] * s.sub[p]; avail += POINTS[p]; }
      bars[sense] = avail ? { pct: Math.round(100 * got / avail), word: senseWord(sense, got / avail, withData) } : { pct: null, word: 'no data' };
    }
    return bars;
  }

  function senseWord(sense, f, segs) {
    const good = f >= 0.75, mid = f >= 0.45;
    switch (sense) {
      case 'SEE': return segs.every(s => !s.dark) ? 'daylight' : good ? 'well lit' : mid ? 'some dark parts' : 'dark';
      case 'HEAR': return good ? 'lively' : mid ? 'some activity' : 'quiet';
      case 'RUN': return good ? 'easy to exit' : mid ? 'some hard parts' : 'hard to exit';
      case 'CALL': return good ? 'signal, help near' : mid ? 'patchy' : 'weak signal';
      case 'TRIBE': return good ? 'people around' : mid ? 'a few people' : 'few people';
      case 'GUT': return good ? 'no dog packs' : mid ? 'dogs reported' : 'dog pack';
      default: return '';
    }
  }

  /* ------------------------------------------------------------- compare */
  function compare(routes, ctx) {
    const results = routes.map(r => ({ route: r, res: scoreRoute(r, ctx) }));
    const fastest = Math.min(...routes.map(r => r.durationMin));
    for (const x of results) {
      x.extraMin = x.route.durationMin - fastest;
      x.adjusted = x.res.value == null ? null : x.res.value - CFG.minutePenalty * x.extraMin;
    }
    const usable = results.filter(x => x.adjusted != null && x.res.confidence >= 0.35).sort((a, b) => b.adjusted - a.adjusted);
    let lead, pick = null;
    if (!usable.length) lead = 'Not enough recent information to compare these routes. Your own judgement comes first.';
    else if (usable.length === 1 || usable[0].adjusted - usable[1].adjusted >= CFG.leadPoints) {
      pick = usable[0];
      const b = pick.res.bars;
      const good = ['SEE', 'HEAR', 'TRIBE', 'CALL'].filter(k => b[k].pct != null && b[k].pct >= 70).map(k => ({ SEE: 'more light', HEAR: 'more activity', TRIBE: 'more people', CALL: 'better signal' }[k]));
      lead = `Route ${pick.route.label} had ${good.length ? good.join(' and ') : 'better conditions'} recently${pick.extraMin ? ` (+${pick.extraMin} min)` : ''}.`;
    } else lead = 'Routes are similar right now; choose by time or preference.';
    const warnings = results.filter(x => x.res.weakest && x.res.weakest.min < CFG.alwaysMentionBelow && x.res.weakest.metres >= CFG.alwaysMentionM)
      .map(x => `Route ${x.route.label} has about ${x.res.weakest.metres} m with ${x.res.weakest.causes.join(', ')}.`);
    return { lead, warnings, pick: pick && pick.route.id, results };
  }

  /* ---------------------------------------------------------------- utils */
  function sample(coords, stepM) {
    const out = [coords[0]];
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
      const seg = dist(y1, x1, y2, x2);
      let pos = stepM - acc;
      while (pos <= seg) { const f = pos / seg; out.push([x1 + f * (x2 - x1), y1 + f * (y2 - y1)]); pos += stepM; }
      acc = (acc + seg) % stepM;
    }
    return out;
  }
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;

  root.Scoring = { SENSES, POINTS, PARAM_SENSE, CFG, scoreSegment, scoreRoute, compare, weightOf, sample, barsOf };
})(typeof window !== 'undefined' ? window : globalThis);

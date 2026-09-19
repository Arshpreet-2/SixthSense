/* ============================================================================
 * journeys.js — Journeys
 * Builds journey options for a trip and compares them leg by leg
 * (Project Report v1.5, Section 7.8):
 *   walk only · auto only · walk/auto → metro → walk/auto
 * Walk legs use full six-sense scoring; auto legs are judged at pickup and
 * drop points; metro legs use the pilot station set (timings estimated
 * until DMRC timetable data is added).
 * Needs: Context, Scoring, Prefs, Light, SensorHub. Exposes: window.Journeys
 * ========================================================================== */
(function (root) {
  'use strict';

  const METRO_KMH = 33, METRO_WAIT_MIN = 5, WALK_MPM = 80, AUTO_WAIT_MIN = 3, CAB_WAIT_MIN = 5;
  const dist = (a, b, c, d) => root.SensorHub.distanceM(a, b, c, d);

  async function loadMetro() { return root.Metro.load(); }
  // Nearest station from the DMRC network
  function nearestStation(p, maxM = 2000) {
    const near = root.Metro.stationsNear(p, maxM);
    return near.length ? near[0] : null;
  }

  // Which mode for a short first/last leg: her learned preference, else walk ≤ 800 m (400 m after dark)
  function shortLegMode(p, lengthM, ctx) {
    const hour = new Date(ctx.when || Date.now()).getHours();
    const pred = root.Prefs ? root.Prefs.Model.predict({ distKm: lengthM / 1000, hour, familiar: 1, battery: ctx.battery ?? 60, rain: ctx.rain ? 1 : 0 }) : {};
    if (pred.mode === 'walk' || pred.mode === 'auto') return pred.mode;
    const dark = root.Light ? root.Light.isDark(p.lat, p.lng) : (hour >= 19 || hour < 6);
    return lengthM <= (dark ? 400 : 800) ? 'walk' : 'auto';
  }

  async function legRoute(from, to, mode) {
    const routes = await root.Context.fetchRoutes(from, to, mode === 'walk' ? 'walk' : 'auto');
    return routes[0];
  }

  async function build({ from, to, when, battery, rain, ownVehicle }) {
    await loadMetro();
    const ctx = { when, battery, rain, ownVehicle };
    const options = [];

    // 1. Walk only (up to 2 alternatives)
    try {
      const walks = await root.Context.fetchRoutes(from, to, 'walk');
      if (walks[0].distanceM <= 4000) walks.slice(0, 2).forEach((r, i) => options.push({
        id: `walk-${i}`, kind: 'walk', title: `Walk${walks.length > 1 ? ` · Route ${r.label}` : ''}`,
        legs: [{ mode: 'walk', route: r, from, to, minutes: r.durationMin, metres: r.distanceM }],
      }));
    } catch (e) { /* offline or no route */ }

    // 2. Auto only
    try {
      const a = await legRoute(from, to, 'auto');
      options.push({ id: 'auto', kind: 'auto', title: 'Auto rickshaw',
        legs: [{ mode: 'auto', route: a, from, to, minutes: a.durationMin + AUTO_WAIT_MIN, metres: a.distanceM }] });
    } catch (e) { /* ignore */ }

    // 2b. Cab, and her own vehicle: same road route, different waiting and cost
    try {
      const a = await legRoute(from, to, 'auto');
      options.push({ id: 'cab', kind: 'cab', title: 'Cab', estimateNote: 'Fare is an estimate; cab apps change with demand',
        legs: [{ mode: 'cab', route: a, from, to, minutes: a.durationMin + CAB_WAIT_MIN, metres: a.distanceM }] });
    } catch (e) { /* ignore */ }

    // 3. Metro combination, planned from the real DMRC timetable
    const s1 = nearestStation(from), s2 = nearestStation(to);
    if (s1 && s2 && s1.id !== s2.id) {
      try {
        const rail = root.Metro.plan(s1.id, s2.id, when);
        if (rail) {
          const m1 = shortLegMode(from, s1.d, ctx), m2 = shortLegMode(to, s2.d, ctx);
          const st1 = { name: `${s1.name} Metro`, lat: s1.lat, lng: s1.lng };
          const st2 = { name: `${s2.name} Metro`, lat: s2.lat, lng: s2.lng };
          let [l1, l3] = await Promise.all([legRoute(from, st1, m1), legRoute(st2, to, m2)]);
          let mode1 = m1, mode3 = m2;
          // A short straight distance can still be a long walk; take an auto for those
          if (mode1 === 'walk' && l1.durationMin > 12) { mode1 = 'auto'; l1 = await legRoute(from, st1, 'auto'); }
          if (mode3 === 'walk' && l3.durationMin > 12) { mode3 = 'auto'; l3 = await legRoute(st2, to, 'auto'); }
          options.push({
            id: 'metro', kind: 'mixed', title: 'Metro + ' + (mode1 === mode3 ? mode1 : `${mode1}/${mode3}`),
            rail,
            legs: [
              { mode: mode1, route: l1, from, to: st1, minutes: l1.durationMin + (mode1 === 'auto' ? AUTO_WAIT_MIN : 0), metres: l1.distanceM },
              { mode: 'metro', from: st1, to: st2, minutes: rail.minutes, metres: Math.round(dist(s1.lat, s1.lng, s2.lat, s2.lng) * 1.3),
                lines: rail.legs.map(l => l.line), change: rail.changes ? rail.legs[1].from : null,
                stops: rail.stations, waitMin: rail.waitMin, lastTrain: rail.lastTrain, fare: rail.fare,
                route: { coords: [[s1.lng, s1.lat], [s2.lng, s2.lat]], distanceM: Math.round(dist(s1.lat, s1.lng, s2.lat, s2.lng) * 1.3),
                         durationMin: rail.minutes, id: 'M', label: 'M', steps: [] } },
              { mode: mode3, route: l3, from: st2, to, minutes: l3.durationMin + (mode3 === 'auto' ? AUTO_WAIT_MIN : 0), metres: l3.distanceM },
            ],
          });
        }
      } catch (e) { /* no metro option for this trip */ }
    }

    for (const o of options) {
      o.minutes = o.legs.reduce((a, l) => a + l.minutes, 0);
      o.walkMinutes = o.legs.filter(l => l.mode === 'walk').reduce((a, l) => a + l.minutes, 0);
      o.metres = o.legs.reduce((a, l) => a + l.metres, 0);
      o.fare = o.legs.reduce((a, l) => a + (fareOf(l) || 0), 0);
      o.leaveBy = new Date(when || Date.now());
      o.coords = o.legs.flatMap(l => (l.route ? l.route.coords : []));
      o.route = { id: o.id, label: o.title, coords: o.coords, durationMin: o.minutes, distanceM: o.metres,
                  steps: o.legs.flatMap(l => (l.route && l.route.steps) || []) };
    }
    // Every option is kept and sorted by time; each card shows its own time and fare.
    return options.sort((a, b) => a.minutes - b.minutes);
  }

  function fareOf(leg) {
    if (leg.mode === 'walk') return 0;
    if (leg.mode === 'metro') return leg.fare || 0;
    return root.Prefs ? root.Prefs.fare(leg.mode, leg.metres / 1000).amount : 0;
  }

  /* ------------------------------------------------------------- compare */
  function compare(options, ctx) {
    const S = root.Scoring;
    for (const o of options) {
      o.legResults = o.legs.map(l => {
        if (l.mode === 'walk') return { ...S.scoreRoute(l.route, ctx), mode: 'walk' };
        if (l.mode === 'auto' || l.mode === 'cab' || l.mode === 'scooty') {
          // Pickup and drop points only
          const a = S.scoreSegment(l.route.coords[0][1], l.route.coords[0][0], ctx);
          const b = S.scoreSegment(l.route.coords.at(-1)[1], l.route.coords.at(-1)[0], ctx);
          const v = [a.score, b.score].filter(x => x != null);
          const conf = (a.confidence + b.confidence) / 2;
          const why = seg => Object.entries(seg.sub).filter(([, x]) => x != null && x < 1).map(([p]) => seg.why[p]).slice(0, 2);
          return { mode: 'auto', value: v.length ? v.reduce((x, y) => x + y, 0) / v.length : null,
                   confidence: conf, pickup: a, drop: b, bars: S.barsOf([a, b]),
                   pros: [], cons: [...why(a).map(t => `Pickup: ${t}`), ...why(b).map(t => `Drop: ${t}`)].slice(0, 3),
                   confidenceLabel: conf >= 0.7 ? 'high' : conf >= 0.35 ? 'medium' : 'low',
                   freshness: `${a.readings + b.readings} readings at pickup and drop${a.sim || b.sim ? ' (simulated)' : ''}` };
        }
        return { mode: 'metro', value: null, confidence: null };
      });
      // Combine by time spent in legs that have a value
      let w = 0, s = 0, c = 0, cw = 0;
      o.legs.forEach((l, i) => {
        const r = o.legResults[i];
        if (r.value != null) { w += l.minutes; s += l.minutes * r.value; }
        if (r.confidence != null) { cw += l.minutes; c += l.minutes * r.confidence; }
      });
      o.value = w ? s / w : null;
      o.confidence = cw ? c / cw : 0;
      o.confidenceLabel = o.confidence >= 0.7 ? 'high' : o.confidence >= 0.35 ? 'medium' : 'low';
      // Weakest leg
      const scored = o.legResults.map((r, i) => ({ r, i })).filter(x => x.r.value != null);
      const weak = scored.sort((a, b) => a.r.value - b.r.value)[0];
      o.weakLeg = weak && weak.r.value < S.CFG.weakBelow ? weak.i : null;
      o.fix = fixFor(o);
      const main = o.legResults.filter(r => r.bars).sort((a, b) => (b.segs ? b.segs.length : 2) - (a.segs ? a.segs.length : 2))[0];
      o.bars = main ? main.bars : null;
      o.pros = o.legResults.flatMap(r => r.pros || []).slice(0, 3);
      o.cons = o.legResults.flatMap((r, i) => (r.cons || []).map(c => o.legs.length > 1 ? `${legName(o.legs[i], i, o.legs.length)}: ${c}` : c)).slice(0, 3);
      const fr = o.legResults.find(r => r.freshness);
      o.freshness = fr ? fr.freshness : 'no recent phone readings';
    }
    const fastest = Math.min(...options.map(o => o.minutes));
    const usable = options.filter(o => o.value != null && o.confidence >= 0.35)
      .map(o => ({ o, adj: o.value - S.CFG.minutePenalty * (o.minutes - fastest) }))
      .sort((a, b) => b.adj - a.adj);
    let lead;
    if (!usable.length) lead = 'Not enough recent information to compare these options. Your own judgement comes first.';
    else if (usable.length === 1 || usable[0].adj - usable[1].adj >= S.CFG.leadPoints) lead = `${usable[0].o.title} had better conditions recently${usable[0].o.minutes > fastest ? ` (+${usable[0].o.minutes - fastest} min)` : ''}.`;
    else lead = 'Options are similar right now; choose by time, fare or preference.';
    return { lead, pick: usable.length ? usable[0].o.id : null };
  }

  function legName(l, i, n) {
    const m = { walk: 'Walk', auto: 'Auto', metro: 'Metro' }[l.mode] || l.mode;
    return n > 1 ? (i === 0 ? `${m} to station` : i === n - 1 ? `${m} from station` : m) : m;
  }

  function fixFor(o) {
    if (o.weakLeg == null) return null;
    const l = o.legs[o.weakLeg];
    if (l.mode === 'walk' && l.metres > 300) {
      const extra = root.Prefs ? root.Prefs.fare('auto', l.metres / 1000).amount : null;
      return `Take an auto for the ${o.weakLeg === 0 ? 'first' : 'last'} leg${extra ? ` (about Rs. ${extra})` : ''}.`;
    }
    if (l.mode === 'auto') return 'Wait for the auto at a busier, lit spot (nearest staffed place).';
    return 'Leave a little earlier while it is busier.';
  }

  root.Journeys = { build, compare, loadMetro, nearestStation };
})(typeof window !== 'undefined' ? window : globalThis);

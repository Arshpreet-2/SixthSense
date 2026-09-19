/* ============================================================================
 * preference.js — Prefs
 * Learns how she likes to travel from her own trips (on the phone only),
 * predicts the mode for a new trip and explains why. Also: fares and a
 * context-based packing list. Exposes: window.Prefs
 * ========================================================================== */
(function (root) {
  'use strict';

  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const K = { trips: 'ss.trips', form: 'ss.prefForm', forgot: 'ss.forgot', profile: 'ss.profile' };

  const MODES = ['walk', 'metro', 'bus', 'auto', 'cab', 'scooty'];
  const MODE_LABEL = { walk: 'Walk', metro: 'Metro', bus: 'Bus', auto: 'Auto', cab: 'Cab', scooty: 'Scooty' };

  /* ------------------------------------------------------------ trip log */
  // A trip is one summary line, never a location trail.
  // { ts, distKm, hour, familiar, battery, rain, mode, source: 'real'|'mock'|'form' }
  const Trips = {
    list: () => store.get(K.trips, []),
    add(trip) {
      const all = Trips.list();
      all.push({ ts: Date.now(), source: 'real', ...trip });
      store.set(K.trips, all.slice(-300));
      Model.train();
    },
    clear() { store.set(K.trips, []); Model.train(); },
    seedMock(rows) {
      const real = Trips.list().filter(t => t.source === 'real');
      store.set(K.trips, [...rows.map(r => ({ ...r, source: 'mock' })), ...real]);
      Model.train();
    },
  };

  // Guess the mode from speed when she did not pick one (she confirms after)
  function guessMode(avgSpeedKmh, undergroundMinutes = 0) {
    if (undergroundMinutes >= 3) return 'metro';
    if (avgSpeedKmh < 7) return 'walk';
    if (avgSpeedKmh < 28) return 'auto';
    return 'cab';
  }

  /* ------------------------------------------------ cold start from a form */
  // Form: { walkMaxKm, darkWalkMaxKm, shortMode, longMode, rainAvoidWalk }
  function setForm(form) { store.set(K.form, form); Model.train(); }
  function formTrips(form) {
    if (!form) return [];
    const rows = [];
    const dists = [0.3, 0.6, 0.9, 1.2, 1.6, 2.2, 3, 4.5, 7, 12];
    for (const d of dists) {
      for (const hour of [10, 16, 20, 22]) {
        for (const rain of [0, 1]) {
          const dark = hour >= 19;
          const limit = dark ? form.darkWalkMaxKm : form.walkMaxKm;
          let mode;
          if (d <= limit && !(rain && form.rainAvoidWalk)) mode = 'walk';
          else if (d <= 3) mode = form.shortMode || 'auto';
          else mode = form.longMode || 'metro';
          rows.push({ distKm: d, hour, familiar: 1, battery: 60, rain, mode, source: 'form' });
        }
      }
    }
    return rows;
  }

  /* ----------------------------------------------- decision tree (CART) */
  const FEATURES = [
    { key: 'distKm',   label: 'distance',     fmt: v => `${v.toFixed(1)} km` },
    { key: 'hour',     label: 'hour',         fmt: v => `${Math.round(v)}:00` },
    { key: 'dark',     label: 'after dark',   binary: true },
    { key: 'familiar', label: 'familiar route', binary: true },
    { key: 'battery',  label: 'battery',      fmt: v => `${Math.round(v)}%` },
    { key: 'rain',     label: 'rain',         binary: true },
  ];
  const featurize = t => ({
    distKm: +t.distKm, hour: +t.hour, dark: (t.hour >= 19 || t.hour < 6) ? 1 : 0,
    familiar: t.familiar ? 1 : 0, battery: t.battery ?? 60, rain: t.rain ? 1 : 0,
  });

  function counts(rows) {
    const c = {};
    for (const r of rows) c[r.y] = (c[r.y] || 0) + r.w;
    return c;
  }
  function weightedGini(rows) {
    const total = rows.reduce((s, r) => s + r.w, 0); if (!total) return 0;
    const c = counts(rows);
    return 1 - Object.values(c).reduce((s, v) => s + (v / total) ** 2, 0);
  }

  function build(rows, depth, opts) {
    const dist = counts(rows);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const leaf = { leaf: true, dist, n: rows.length, total };
    if (depth >= opts.maxDepth || rows.length < opts.minSplit || Object.keys(dist).length === 1) return leaf;

    let best = null;
    const parent = weightedGini(rows);
    for (const f of FEATURES) {
      const vals = [...new Set(rows.map(r => r.x[f.key]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const thr = (vals[i] + vals[i + 1]) / 2;
        const L = rows.filter(r => r.x[f.key] <= thr), R = rows.filter(r => r.x[f.key] > thr);
        if (L.length < opts.minLeaf || R.length < opts.minLeaf) continue;
        const wl = L.reduce((s, r) => s + r.w, 0), wr = R.reduce((s, r) => s + r.w, 0);
        const score = (wl * weightedGini(L) + wr * weightedGini(R)) / (wl + wr);
        if (!best || score < best.score) best = { f, thr, L, R, score };
      }
    }
    if (!best || parent - best.score < 1e-4) return leaf;
    return {
      leaf: false, feature: best.f.key, thr: best.thr,
      left: build(best.L, depth + 1, opts), right: build(best.R, depth + 1, opts),
    };
  }

  function describe(feature, thr, goLeft) {
    const f = FEATURES.find(x => x.key === feature);
    if (f.binary) return goLeft ? `not ${f.label}` : f.label;
    return `${f.label} ${goLeft ? '≤' : '>'} ${f.fmt(thr)}`;
  }

  const Model = {
    tree: null, trainedOn: 0, sources: {},
    train() {
      const trips = Trips.list();
      const form = formTrips(store.get(K.form, null));
      // Real trips count 3× the form's guesses, so her behaviour wins over time
      const w = { real: 3, mock: 1, form: 0.5 };
      const all = [...trips, ...form];
      const rows = all.map(t => ({ x: featurize(t), y: t.mode, w: w[t.source] ?? 1 }));
      Model.sources = all.reduce((s, t) => { s[t.source] = (s[t.source] || 0) + 1; return s; }, {});
      Model.trainedOn = rows.length;
      Model.tree = rows.length >= 5 ? build(rows, 0, { maxDepth: 4, minSplit: 6, minLeaf: 2 }) : null;
      return Model.tree;
    },
    predict(trip) {
      if (!Model.tree) Model.train();
      if (!Model.tree) return { mode: null, confidence: 0, why: 'No trips yet. Suggestions become personal after a few trips.' };
      const x = featurize(trip);
      let node = Model.tree;
      const bounds = {};   // keep only the tightest condition per feature
      while (!node.leaf) {
        const left = x[node.feature] <= node.thr;
        const b = bounds[node.feature] = bounds[node.feature] || {};
        if (left) b.max = Math.min(b.max ?? Infinity, node.thr); else b.min = Math.max(b.min ?? -Infinity, node.thr);
        node = left ? node.left : node.right;
      }
      const path = [];
      for (const [f, b] of Object.entries(bounds)) {
        const bin = FEATURES.find(x => x.key === f).binary;
        if (bin) path.push(describe(f, 0.5, b.max != null));
        else {
          if (b.min != null) path.push(describe(f, b.min, false));
          if (b.max != null) path.push(describe(f, b.max, true));
        }
      }
      const ranked = Object.entries(node.dist).sort((a, b) => b[1] - a[1]);
      const [mode, weight] = ranked[0];
      // Shrink confidence when the leaf is backed by few trips
      const raw = weight / node.total;
      const confidence = +(raw * (node.n / (node.n + 2))).toFixed(2);
      return {
        mode, label: MODE_LABEL[mode], confidence,
        alternatives: ranked.slice(1, 3).map(([m, v]) => ({ mode: m, share: +(v / node.total).toFixed(2) })),
        why: `You usually choose ${MODE_LABEL[mode].toLowerCase()} when ${path.join(', ')}.`,
        basedOn: node.n,
      };
    },
  };

  /* ---------------------------------------------------------------- fares */
  // Approximate. Metro slabs after the Aug 2025 DMRC revision (check the DMRC
  // site before the demo); auto meter rate per Delhi Transport notification.
  const FARES = {
    metro: [[2, 11], [5, 21], [12, 32], [21, 43], [32, 54], [Infinity, 64]],
    auto: { base: 30, baseKm: 1.5, perKm: 11, nightFrom: 23, nightTo: 5, nightExtra: 0.25 },
    cab: { base: 50, perKm: 14, perMin: 1, nightExtra: 0.15, nightFrom: 23, nightTo: 5 },
    bus: { min: 10, max: 25 },
  };
  function fare(mode, distKm, hour = new Date().getHours()) {
    switch (mode) {
      case 'walk': return { amount: 0, text: 'Free' };
      case 'metro': {
        const slab = FARES.metro.find(([km]) => distKm <= km);
        return { amount: slab[1], text: `About Rs. ${slab[1]} (token)` };
      }
      case 'auto': {
        const a = FARES.auto;
        let amt = a.base + Math.max(0, Math.ceil(distKm - a.baseKm)) * a.perKm;
        const night = hour >= a.nightFrom || hour < a.nightTo;
        if (night) amt *= 1 + a.nightExtra;
        amt = Math.round(amt);
        return { amount: amt, text: `Fair meter fare about Rs. ${amt}${night ? ' (night rate)' : ''}` };
      }
      case 'bus': return { amount: null, text: `About Rs. ${FARES.bus.min}–${FARES.bus.max}` };
      case 'cab': {
        // Typical Delhi app-cab pricing; an estimate, since cab apps have no open fares
        const c = FARES.cab || { base: 50, perKm: 14, perMin: 1, nightExtra: 0.15, nightFrom: 23, nightTo: 5 };
        let amt = c.base + distKm * c.perKm + (distKm / 20) * 60 * c.perMin;
        if (hour >= c.nightFrom || hour < c.nightTo) amt *= 1 + c.nightExtra;
        amt = Math.round(amt / 5) * 5;
        return { amount: amt, text: `Estimate about Rs. ${amt}; cab apps change with demand` };
      }
      case 'scooty': {
        const amt = Math.max(5, Math.round(distKm / 40 * 105));   // about 40 km per litre
        return { amount: amt, text: `Fuel about Rs. ${amt}` };
      }
      default: return { amount: null, text: '' };
    }
  }

  /* -------------------------------------------------------- packing list */
  // ctx: { mode, battery, hour, rain, hot, newArea, planMetro }
  function packingList(ctx) {
    const profile = store.get(K.profile, {});
    const forgot = store.get(K.forgot, {});
    const items = [];
    const add = (id, text, reason, base = 1) => items.push({ id, text, reason, score: base + (forgot[id] || 0) });

    add('id', 'College ID card', 'Needed at gates and for help');
    add('cash', 'Some cash', 'Works when UPI or internet does not', 1.2);
    add('safetycard', 'SixthSense QR safety card', 'Works even if your phone dies');
    if (ctx.battery != null && ctx.battery < 60) add('powerbank', 'Power bank and cable', `Battery is ${ctx.battery}%`, 3);
    if (ctx.mode === 'scooty') {
      add('licence', 'Driving licence', 'Required while riding', 3);
      add('rc', 'RC and insurance (or DigiLocker copy saved offline)', 'Required while riding', 2.5);
      add('puc', 'PUC certificate', 'Required while riding', 2);
      add('helmet', 'Helmet', 'Required while riding', 3);
    }
    if (ctx.mode === 'metro' || ctx.planMetro) add('metrocard', 'Metro card or saved QR ticket', 'Metro trip planned', 2);
    if (ctx.hour >= 19 || ctx.hour < 6) add('torch', 'Torch, or phone torch with charge left', 'Travelling after dark', 1.5);
    if (ctx.rain) add('umbrella', 'Umbrella', 'Rain expected', 2);
    if (ctx.hot) { add('water', 'Water bottle', 'Hot afternoon', 1.5); add('sunglasses', 'Sunglasses', 'Bright sun', 1); }
    if (profile.usesGlasses) add('glasses', 'Glasses or lenses', 'From your profile', 2);
    if (ctx.newArea) add('offline', 'Offline pack downloaded', 'New area; signal may drop', 2.5);
    add('contacts', 'Two numbers written on paper', 'Useful if the phone dies', 1);

    return items.sort((a, b) => b.score - a.score);
  }
  // She marks an item she forgot; it rises next time
  function markForgotten(id) {
    const f = store.get(K.forgot, {}); f[id] = (f[id] || 0) + 1; store.set(K.forgot, f);
  }
  const setProfile = p => store.set(K.profile, { ...store.get(K.profile, {}), ...p });

  root.Prefs = {
    Trips, Model, MODES, MODE_LABEL, guessMode, setForm,
    getForm: () => store.get(K.form, null),
    fare, FARES, packingList, markForgotten, setProfile,
    getProfile: () => store.get(K.profile, {}),
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================================
 * normals.js — Normals
 * What a place is usually like at this hour, and whether tonight is different.
 *
 *   • Readings are folded into buckets of 50 m cell x hour of week.
 *   • Each bucket keeps a median and a median absolute deviation (robust: one
 *     odd night does not move it), never the readings themselves and never who
 *     reported them.
 *   • A bucket is only used once it holds MIN_OBS observations from at least
 *     MIN_PEOPLE different contributors.
 *   • anomaly() returns, per signal, how far tonight sits from that place's own
 *     normal, in spreads. Below QUIET it says nothing at all.
 *
 * This is the one thing a survey cannot do: a camera car passing once cannot
 * tell you that tonight is not like last Tuesday.
 * Exposes: window.Normals
 * ========================================================================== */
(function (root) {
  'use strict';

  const KEY = 'ss.normals';
  const CELL_M = 50;
  const KEEP = 40;                 // samples kept per bucket, then reservoir-sampled
  const MIN_OBS = 20;              // below this we make no claim
  const MIN_PEOPLE = 5;            // k-anonymity: no single person's routine
  const QUIET = 1.5;               // spreads away before we say anything
  const STRONG = 2.5;

  let table = null;                // { "cell|hourOfWeek": { light:[..], act:[..], ppl:[..], dbm:[..], who:[ids] } }

  const cellOf = (lat, lng) => {
    const dLat = CELL_M / 111320, dLng = CELL_M / (111320 * Math.cos(lat * Math.PI / 180));
    return Math.round(lat / dLat) + '_' + Math.round(lng / dLng);
  };
  const hourOfWeek = t => { const d = new Date(t); return d.getDay() * 24 + d.getHours(); };
  const keyFor = (lat, lng, t) => cellOf(lat, lng) + '|' + hourOfWeek(t);

  function load() {
    if (table) return table;
    try { table = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { table = {}; }
    return table;
  }
  let saveFailed = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(table)); saveFailed = false; }
    catch (e) { saveFailed = true; }        // too big for storage: still usable in memory
  }

  const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mad = xs => { const m = median(xs); if (m == null) return null;
    return median(xs.map(x => Math.abs(x - m))); };

  /* Fold readings into the buckets. Call with whatever the app already has. */
  function learn(readings) {
    load();
    let added = 0;
    for (const r of readings || []) {
      if (r.lat == null || !r.t) continue;
      const k = keyFor(r.lat, r.lng, r.t);
      const b = table[k] || (table[k] = { light: [], act: [], ppl: [], dbm: [], who: [] });
      const push = (arr, v) => {
        if (v == null) return;
        if (arr.length < KEEP) arr.push(v);
        else { const i = Math.floor(Math.random() * arr.length); arr[i] = v; }   // reservoir
      };
      push(b.light, r.light);
      push(b.act, r.liveliness != null ? Math.round(r.liveliness * 100) : null);
      push(b.dbm, r.signalDbm);
      if (r.people != null) push(b.ppl, r.people);
      const who = r.contributor || 'anon';
      if (!b.who.includes(who) && b.who.length < 12) b.who.push(who);
      added++;
    }
    save();
    return added;
  }

  /* Every bucket for this cell at this hour of the day, whichever weekday.
     Used when the exact weekday-and-hour has too little history: "what this
     place is like around 9 pm" is still a fair comparison, and we say which
     of the two we used. */
  function bucketsFor(lat, lng, t) {
    const cell = cellOf(lat, lng), how = hourOfWeek(t), hour = how % 24;
    const enough = b => b && (b.stat
      ? ((b.stat.act && b.stat.act.n >= MIN_OBS) || (b.stat.light && b.stat.light.n >= MIN_OBS))
      : (Math.max(b.light.length, b.act.length) >= MIN_OBS && b.who.length >= MIN_PEOPLE));
    const exact = table[cell + '|' + how];
    if (enough(exact)) return { b: exact, scope: 'this day and hour' };
    const merged = { light: [], act: [], ppl: [], dbm: [], who: [], stat: null };
    const accum = { act: [], light: [], n: 0, people: 0 };
    for (let d = 0; d < 7; d++) {
      const b = table[cell + '|' + (d * 24 + hour)];
      if (!b) continue;
      if (b.stat) {
        if (b.stat.act) accum.act.push(b.stat.act);
        if (b.stat.light) accum.light.push(b.stat.light);
        accum.n += (b.stat.act || b.stat.light || { n: 0 }).n;
        accum.people = Math.max(accum.people, b.people || 0);
        merged.sim = merged.sim || b.sim;
      } else {
        merged.light.push(...b.light); merged.act.push(...b.act); merged.dbm.push(...b.dbm);
        for (const w of b.who) if (!merged.who.includes(w)) merged.who.push(w);
      }
    }
    const pool = list => list.length
      ? { med: median(list.map(x => x.med)), spread: median(list.map(x => x.spread)), n: accum.n }
      : null;
    if (accum.act.length || accum.light.length) merged.stat = { act: pool(accum.act), light: pool(accum.light) };
    merged.people = accum.people;
    return { b: merged, scope: 'this hour, any day' };
  }

  /* What this place is usually like at this hour, or null when we cannot say */
  function normal(lat, lng, t = Date.now()) {
    load();
    const found = bucketsFor(lat, lng, t);
    const b = found.b;
    if (!b) return null;
    if (b.stat) {
      const o = { scope: found.scope, people: b.people || MIN_PEOPLE,
                  n: Math.max(b.stat.act ? b.stat.act.n : 0, b.stat.light ? b.stat.light.n : 0) };
      if (o.n < MIN_OBS) return null;
      if (b.stat.act) o.activity = { med: b.stat.act.med, spread: Math.max(3, b.stat.act.spread), n: b.stat.act.n };
      if (b.stat.light) o.light = { med: b.stat.light.med, spread: Math.max(10, b.stat.light.spread), n: b.stat.light.n };
      return o;
    }
    const out = { n: Math.max(b.light.length, b.act.length), people: b.who.length, scope: found.scope };
    if (out.n < MIN_OBS || out.people < MIN_PEOPLE) return null;
    for (const [name, arr] of [['light', b.light], ['activity', b.act], ['signal', b.dbm]]) {
      if (arr.length < MIN_OBS) continue;
      const m = median(arr);
      // a floor under the spread: without it, data that barely varies makes
      // every small difference look like a big one
      // the floor scales with the place: a lane that is normally quiet has a
      // small spread, and a fixed floor would hide a real drop there
      const floor = name === 'activity' ? Math.max(3, Math.abs(m) * 0.2)
                  : name === 'light'    ? Math.max(10, Math.abs(m) * 0.15)
                  :                       Math.max(4, Math.abs(m) * 0.05);
      out[name] = { med: m, spread: Math.max(floor, mad(arr)), n: arr.length };
    }
    return out;
  }

  const WORDS = {
    activity: { low: 'quieter than usual', high: 'busier than usual' },
    light:    { low: 'darker than usual',  high: 'brighter than usual' },
    signal:   { low: 'weaker signal than usual', high: null },
  };

  /* How far tonight sits from this place's own normal.
     current: { light, liveliness, signalDbm }  ->  [{signal, z, dir, text, share}] */
  function anomaly(lat, lng, current, t = Date.now()) {
    const norm = normal(lat, lng, t);
    if (!norm || !current) return [];
    const now = { light: current.light, activity: current.liveliness != null ? current.liveliness * 100 : null,
                  signal: current.signalDbm };
    const out = [];
    for (const name of ['activity', 'light', 'signal']) {
      const n = norm[name], v = now[name];
      if (!n || v == null) continue;
      if (name === 'light' && root.Light && !root.Light.isDark(lat, lng, t)) continue;   // daylight: no claim
      const z = (n.med - v) / n.spread;
      const dir = z > 0 ? 'low' : 'high';
      const text = WORDS[name][dir];
      // it must be far from normal AND different by an amount a person would notice
      const ratio = n.med ? v / n.med : 1;
      const noticeable = name === 'activity' ? (ratio < 0.65 || ratio > 1.6)
                       : name === 'light'    ? (ratio < 0.7  || ratio > 1.5)
                       :                       Math.abs(v - n.med) >= 8;
      if (Math.abs(z) < QUIET || !text || !noticeable) continue;
      out.push({
        signal: name, z: +Math.abs(z).toFixed(1), dir, text, scope: norm.scope,
        strong: Math.abs(z) >= STRONG,
        share: n.med ? Math.round(100 * v / n.med) : null,
        usual: Math.round(n.med), now: Math.round(v), n: n.n,
      });
    }
    return out.sort((a, b) => b.z - a.z);
  }

  /* One sentence for a card, or "" when there is nothing worth saying */
  function sentence(list, when = Date.now()) {
    if (!list || !list.length) return '';
    const a = list[0];
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(when).getDay()];
    const hour = new Date(when).getHours();
    const clock = (hour % 12 || 12) + (hour < 12 ? ' am' : ' pm');
    const amount = a.share != null && a.dir === 'low' && a.signal === 'activity'
      ? ` — about ${a.share}% of the usual activity` : '';
    const forWhen = a.scope === 'this hour, any day' ? `for ${clock}` : `for ${clock} on a ${day}`;
    return `${a.strong ? 'Much ' : ''}${a.text} ${forWhen}${amount}.`;
  }

  /* When does this stretch usually empty out? Reads the same table forward. */
  function quietHour(lat, lng, fromHour = 19) {
    load();
    let busiest = 0, drop = null;
    for (let h = fromHour; h <= 26; h++) {
      const hour = h % 24;
      const at = new Date(); at.setHours(hour, 0, 0, 0);
      const found = bucketsFor(lat, lng, at.getTime());
      const st = found.b && found.b.stat && found.b.stat.act;
      if (!st && (!found.b || found.b.act.length < MIN_OBS)) continue;
      const m = st ? st.med : median(found.b.act);
      busiest = Math.max(busiest, m);
      if (drop == null && busiest > 0 && m < busiest * 0.55) drop = hour;   // about half as lively as its own peak
    }
    return drop;
  }

  /* The earliest hour anywhere along a route at which it usually empties */
  function quietHourAlong(coords, fromHour = 19) {
    if (!coords || !coords.length) return null;
    const step = Math.max(1, Math.floor(coords.length / 8));
    let earliest = null;
    for (let i = 0; i < coords.length; i += step) {
      const [lng, lat] = coords[i];
      const h = quietHour(lat, lng, fromHour);
      if (h != null && (earliest == null || h < earliest)) earliest = h;
    }
    return earliest;
  }

  /* Take aggregate rows straight from the backend (medians and spreads, no
     readings and no identities) and use them as this place's history. */
  function ingest(rows) {
    load();
    let n = 0;
    for (const r of rows || []) {
      if (!r.cell || r.how == null) continue;
      const key = r.cell + '|' + r.how;
      // stored as statistics, not as rebuilt samples: thousands of buckets of
      // samples do not fit in localStorage, and the medians are all we need
      const b = table[key] || (table[key] = { light: [], act: [], ppl: [], dbm: [], who: [] });
      b.stat = {
        act: r.actMed != null ? { med: r.actMed, spread: r.actSpread || 6, n: r.n || MIN_OBS } : null,
        light: r.lightMed != null ? { med: r.lightMed, spread: r.lightSpread || 12, n: r.n || MIN_OBS } : null,
      };
      b.people = Math.max(MIN_PEOPLE, r.people || MIN_PEOPLE);
      b.sim = !!r.sim;
      n++;
    }
    save();
    return n;
  }

  /* What we can honestly say about where this history came from */
  const provenance = () => {
    load();
    const keys = Object.keys(table);
    const sim = keys.filter(k => table[k].sim).length;
    return { buckets: keys.length, seeded: sim, real: keys.length - sim };
  };

  const stats = () => { load(); const keys = Object.keys(table);
    const usable = keys.filter(k => { const b = table[k];
      if (b.stat) return (b.stat.act && b.stat.act.n >= MIN_OBS) || (b.stat.light && b.stat.light.n >= MIN_OBS);
      return Math.max(b.light.length, b.act.length) >= MIN_OBS && b.who.length >= MIN_PEOPLE; });
    return { buckets: keys.length, usable: usable.length }; };

  const clear = () => { table = {}; try { localStorage.removeItem(KEY); } catch (e) {} };

  root.Normals = { learn, ingest, provenance, normal, anomaly, sentence, quietHour, quietHourAlong, stats, clear,
                   MIN_OBS, MIN_PEOPLE, QUIET };
})(typeof window !== 'undefined' ? window : globalThis);

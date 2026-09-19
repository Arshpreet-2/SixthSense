/* ============================================================================
 * metro.js — Metro
 * Plans a metro journey from the real DMRC timetable (Delhi Open Transit Data,
 * static GTFS). Gives the line to take, where to change, the journey time, the
 * typical wait at that hour, the fare and the last train of the night.
 * Data: data/dmrc.json (built from the GTFS feed; 262 stations, 35 line
 * directions). The feed's calendar runs to 31 Dec 2025, so times are treated as
 * typical weekday times rather than a live timetable.
 * Needs: SensorHub (distance), Prefs (fare). Exposes: window.Metro
 * ========================================================================== */
(function (root) {
  'use strict';

  const CHANGE_MIN = 4;            // walking inside a station to another platform
  const DEFAULT_HEADWAY = 420;     // 7 min when the feed has no trips in that hour
  let net = null, loading = null;

  async function load() {
    if (net) return net;
    if (!loading) loading = fetch('data/dmrc.json').then(r => r.json()).then(j => {
      net = j;
      net.byStation = {};                       // station -> [{route, index}]
      net.routes.forEach((r, ri) => r.stops.forEach((sid, i) => {
        (net.byStation[sid] = net.byStation[sid] || []).push({ ri, i });
      }));
      return net;
    }).catch(() => (net = { stations: {}, routes: [], byStation: {} }));
    return loading;
  }

  const dist = (a, b, c, d) => root.SensorHub.distanceM(a, b, c, d);

  /* Stations within a radius, nearest first */
  function stationsNear(p, radiusM = 1500) {
    if (!net) return [];
    const out = [];
    for (const [id, s] of Object.entries(net.stations)) {
      const d = dist(p.lat, p.lng, s.lat, s.lng);
      if (d <= radiusM) out.push({ id, name: s.n, lat: s.lat, lng: s.lng, lines: s.lines, d: Math.round(d) });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  const headwayAt = (route, hour) => +(route.headway[String(hour)] || route.headway[String(hour - 1)] || DEFAULT_HEADWAY);

  /* Cheapest-time path over the network: ride segments plus changes */
  function plan(fromId, toId, when) {
    if (!net || !net.byStation[fromId] || !net.byStation[toId]) return null;
    const hour = new Date(when || Date.now()).getHours();
    const start = net.byStation[fromId].map(({ ri, i }) => ({
      ri, i, cost: headwayAt(net.routes[ri], hour) / 2, path: [{ ri, from: i, to: i }],
    }));
    const seen = new Map();
    const queue = start.slice();
    let best = null;

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const cur = queue.shift();
      const key = cur.ri + ':' + cur.i;
      if (seen.has(key) && seen.get(key) <= cur.cost) continue;
      seen.set(key, cur.cost);
      if (best && cur.cost >= best.cost) continue;

      const route = net.routes[cur.ri];
      const here = route.stops[cur.i];
      if (here === toId) { best = cur; continue; }

      // ride one station forward on this line
      if (cur.i + 1 < route.stops.length) {
        const ride = route.times[cur.i] || 120;
        const path = cur.path.slice();
        path[path.length - 1] = { ...path[path.length - 1], to: cur.i + 1 };
        queue.push({ ri: cur.ri, i: cur.i + 1, cost: cur.cost + ride, path });
      }
      // change to another line at this station
      if (cur.path.length < 3) {
        for (const opt of net.byStation[here] || []) {
          if (opt.ri === cur.ri) continue;
          const wait = headwayAt(net.routes[opt.ri], hour) / 2 + CHANGE_MIN * 60;
          queue.push({ ri: opt.ri, i: opt.i, cost: cur.cost + wait,
                       path: cur.path.concat([{ ri: opt.ri, from: opt.i, to: opt.i }]) });
        }
      }
    }
    if (!best) return null;

    const legs = best.path.filter(p => p.to !== p.from || best.path.length === 1).map(p => {
      const r = net.routes[p.ri];
      const stops = Math.abs(p.to - p.from);
      const ride = r.times.slice(Math.min(p.from, p.to), Math.max(p.from, p.to)).reduce((a, b) => a + b, 0);
      return {
        line: r.line, towards: r.head, stops,
        from: net.stations[r.stops[p.from]].n, to: net.stations[r.stops[p.to]].n,
        minutes: Math.round(ride / 60),
        lastTrain: r.last[r.stops[p.from]] ? clock(r.last[r.stops[p.from]]) : null,
      };
    });
    const waitMin = Math.round(headwayAt(net.routes[best.path[0].ri], hour) / 120);
    // has the last train from the first station already gone at this time?
    const d = new Date(when || Date.now());
    const depSecs = d.getHours() * 3600 + d.getMinutes() * 60;
    const firstRoute = net.routes[best.path[0].ri];
    const lastSecs = firstRoute.last[firstRoute.stops[best.path[0].from]] || 0;
    const afterLast = lastSecs > 0 && depSecs > lastSecs && depSecs < 26 * 3600;
    const km = dist(net.stations[fromId].lat, net.stations[fromId].lng, net.stations[toId].lat, net.stations[toId].lng) / 1000 * 1.3;
    return {
      legs, changes: legs.length - 1, waitMin, afterLast,
      minutes: Math.round(best.cost / 60),
      fare: root.Prefs ? root.Prefs.fare('metro', km).amount : null,
      lastTrain: legs[0].lastTrain,
      stations: legs.reduce((a, l) => a + l.stops, 0),
    };
  }

  const clock = s => `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;

  root.Metro = { load, stationsNear, plan, get network() { return net; },
                 source: 'DMRC static GTFS (Delhi Open Transit Data)' };
})(typeof window !== 'undefined' ? window : globalThis);

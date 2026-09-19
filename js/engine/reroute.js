/* ============================================================================
 * reroute.js — Reroute
 * Walking routes computed on the phone, from a street graph saved while online.
 * Used when offline mode is on, or the network is gone mid-trip: she can still
 * plan a way to the destination, or back to the route she left.
 * Saved as a compact graph in localStorage: nodes as rounded coordinates,
 * edges as index pairs. A* with a straight-line heuristic.
 * Exposes: window.Reroute
 * ========================================================================== */
(function (root) {
  'use strict';

  const KEY = 'ss.graph';
  const WALKABLE = /^(footway|path|pedestrian|living_street|residential|service|unclassified|tertiary|secondary|primary|trunk|steps|track|cycleway|road|(tertiary|secondary|primary|trunk)_link)$/;
  const OSM_API = 'https://api.openstreetmap.org/api/0.6/map.json';
  const WALK_MPM = 80;                 // metres a minute until her own speed is learned

  let graph = null;
  const dist = (a, b, c, d) => root.SensorHub.distanceM(a, b, c, d);

  /* ------------------------------------------------------------ saving */
  async function save(centre, halfSideDeg = 0.02) {       // about 2.2 km each way
    const w = centre.lng - halfSideDeg, e = centre.lng + halfSideDeg;
    const s = centre.lat - halfSideDeg, n = centre.lat + halfSideDeg;
    const res = await fetch(`${OSM_API}?bbox=${w},${s},${e},${n}`);
    if (!res.ok) throw new Error('Could not download the streets for this area');
    const data = await res.json();

    const nodes = new Map();                               // osm id -> [lat, lng]
    for (const el of data.elements) if (el.type === 'node') nodes.set(el.id, [el.lat, el.lon]);

    const used = new Map();                                // osm id -> our index
    const pts = [], edges = [];
    const idx = id => {
      if (used.has(id)) return used.get(id);
      const p = nodes.get(id); if (!p) return -1;
      used.set(id, pts.length);
      pts.push([+p[0].toFixed(5), +p[1].toFixed(5)]);
      return pts.length - 1;
    };

    for (const el of data.elements) {
      if (el.type !== 'way' || !el.tags || !el.nodes) continue;
      const hw = el.tags.highway;
      if (!hw || !WALKABLE.test(hw)) continue;
      if (el.tags.foot === 'no' || el.tags.access === 'private') continue;
      for (let i = 1; i < el.nodes.length; i++) {
        const a = idx(el.nodes[i - 1]), b = idx(el.nodes[i]);
        if (a < 0 || b < 0 || a === b) continue;
        edges.push([a, b]);
      }
    }
    if (pts.length < 20) throw new Error('Too few streets mapped here to route offline');

    const saved = { at: Date.now(), bbox: [w, s, e, n], pts, edges,
                    centre: [+centre.lat.toFixed(5), +centre.lng.toFixed(5)] };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); }
    catch (err) { throw new Error('Not enough room on the phone to save this area'); }
    graph = build(saved);
    return { nodes: pts.length, edges: edges.length, km: Math.round(halfSideDeg * 222) / 2 };
  }

  function load() {
    if (graph) return graph;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.pts) graph = build(raw);
    } catch (err) { graph = null; }
    return graph;
  }

  function build(raw) {
    const adj = Array.from({ length: raw.pts.length }, () => []);
    for (const [a, b] of raw.edges) {
      const d = dist(raw.pts[a][0], raw.pts[a][1], raw.pts[b][0], raw.pts[b][1]);
      adj[a].push([b, d]); adj[b].push([a, d]);
    }
    // Which connected piece each point belongs to, and which piece is the main one.
    // Snapping to a stub that touches nothing else is what breaks offline routing.
    const comp = new Int32Array(raw.pts.length).fill(-1);
    const size = [];
    for (let i = 0; i < raw.pts.length; i++) {
      if (comp[i] !== -1) continue;
      const id = size.length; let n = 0;
      const stack = [i]; comp[i] = id;
      while (stack.length) { const x = stack.pop(); n++;
        for (const [nb] of adj[x]) if (comp[nb] === -1) { comp[nb] = id; stack.push(nb); } }
      size.push(n);
    }
    const main = size.indexOf(Math.max(...size));
    return { ...raw, adj, comp, main };
  }

  const info = () => { const g = load(); return g ? { at: g.at, nodes: g.pts.length, centre: g.centre } : null; };

  /* --------------------------------------------------------- routing */
  // Nearest point on the main street network, so both ends are always connected
  function nearestNode(g, lat, lng, onlyMain = true) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < g.pts.length; i++) {
      if (onlyMain && g.comp[i] !== g.main) continue;
      const d = dist(lat, lng, g.pts[i][0], g.pts[i][1]);
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: bd };
  }

  /* A* over the saved graph. Returns a route shaped like the online ones. */
  function route(from, to) {
    const g = load();
    if (!g) throw new Error('No area saved for offline routing yet.');
    const a = nearestNode(g, from.lat, from.lng), b = nearestNode(g, to.lat, to.lng);
    if (a.i < 0 || b.i < 0) throw new Error('Nothing saved near this place.');
    if (a.d > 400 || b.d > 400) throw new Error('That point is outside the area you saved.');

    const n = g.pts.length;
    const gScore = new Float64Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const h = i => dist(g.pts[i][0], g.pts[i][1], g.pts[b.i][0], g.pts[b.i][1]);
    gScore[a.i] = 0;
    const open = [[h(a.i), a.i]];
    const seen = new Uint8Array(n);

    while (open.length) {
      open.sort((x, y) => x[0] - y[0]);
      const [, cur] = open.shift();
      if (cur === b.i) break;
      if (seen[cur]) continue;
      seen[cur] = 1;
      for (const [nb, d] of g.adj[cur]) {
        const t = gScore[cur] + d;
        if (t < gScore[nb]) { gScore[nb] = t; came[nb] = cur; open.push([t + h(nb), nb]); }
      }
    }
    let end = b.i, partial = false;
    if (gScore[end] === Infinity) {
      // the destination is not connected in what we saved: get as close as we can
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (gScore[i] === Infinity) continue;
        const d = dist(g.pts[i][0], g.pts[i][1], to.lat, to.lng);
        if (d < bd) { bd = d; end = i; }
      }
      if (bd === Infinity) throw new Error('No walking path found in the saved streets.');
      partial = true;
    }

    const path = [];
    for (let i = end; i !== -1; i = came[i]) path.push(i);
    path.reverse();

    const tail = dist(g.pts[end][0], g.pts[end][1], to.lat, to.lng);
    const coords = [[from.lng, from.lat]]
      .concat(path.map(i => [g.pts[i][1], g.pts[i][0]]))
      .concat([[to.lng, to.lat]]);
    const metres = Math.round(gScore[end] + a.d + tail);
    return {
      id: 'offline', label: partial ? 'Offline route (as close as saved streets go)' : 'Offline route',
      coords, partial, lastGapM: Math.round(tail),
      distanceM: metres, durationMin: Math.max(1, Math.round(metres / WALK_MPM)),
      steps: [], offline: true,
    };
  }

  root.Reroute = { save, route, info, load };
})(typeof window !== 'undefined' ? window : globalThis);

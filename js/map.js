/* SixthSense — real map drawing (OpenStreetMap data), no map tiles needed.
   Streets for the IGDTUW pilot are bundled; elsewhere routes are drawn on a plain grid.
   The light layer draws: NASA VIIRS night lights, OSM roads tagged lit, mapped street
   lamps, and the route coloured per 50 m by what the light layer knows there. */
"use strict";

let BASEMAP = null;
fetch("data/basemap.igdtuw.json").then(r => r.json()).then(j => { BASEMAP = j; if (typeof softRender === "function") softRender(); }).catch(() => {});

const HOME = { lat: 28.6644969, lng: 77.2325612, name: "IGDTUW, Kashmere Gate" };
const ROUTE_COLORS = ["var(--pink)", "var(--purple)", "#9A6A05"];
const LEG_COLORS = { walk: "var(--pink)", auto: "#9A6A05", metro: "var(--purple)", cab: "#9A6A05", scooty: "#9A6A05" };
const LIGHT_COLORS = { lit: "#E9A825", some: "#C98A2E", dark: "#6E5A46", none: "#9A9A9A" };

function projector(bbox, W, H) {
  const [w, s, e, n] = bbox;
  const k = Math.cos(((s + n) / 2) * Math.PI / 180);
  const bw = (e - w) * k, bh = (n - s);
  const scale = Math.max(W / bw, H / bh);
  const ox = (W - bw * scale) / 2, oy = (H - bh * scale) / 2;
  return (lng, lat) => [ox + (lng - w) * k * scale, oy + (n - lat) * scale];
}
function boundsOf(points, padM) {
  const lats = points.map(p => p[1]), lngs = points.map(p => p[0]);
  const pad = (padM || 250) / 111000;
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
}
const pathD = (pts, P) => pts.map((c, i) => { const [x, y] = P(c[0], c[1]); return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }).join(" ");

/* o: { h, fit, routes, pins, user, dest, sky, litWays, lamps, lightSegs } */
function drawnMap(o) {
  o = o || {};
  const W = 390, H = o.h || 300;
  const fit = (o.fit && o.fit.length) ? o.fit : [[HOME.lng - 0.006, HOME.lat - 0.006], [HOME.lng + 0.006, HOME.lat + 0.006]];
  const P = projector(boundsOf(fit, o.padM), W, H);
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Street map">';
  g += '<rect width="' + W + '" height="' + H + '" fill="var(--m-land)"/>';

  if (BASEMAP) {
    BASEMAP.areas.forEach(a => { g += '<path d="' + pathD(a.p, P) + 'Z" fill="' + (a.k === "water" ? "#CFE3EE" : "var(--m-park)") + '"/>'; });
    BASEMAP.rail.forEach(r => { g += '<path d="' + pathD(r, P) + '" fill="none" stroke="var(--m-rail)" stroke-width="1.6" stroke-dasharray="6 4" opacity=".7"/>'; });
    [3, 2, 1].forEach(c => BASEMAP.roads.filter(r => r.c === c).forEach(r => {
      const d = pathD(r.p, P);
      const wdt = c === 1 ? 7 : c === 2 ? 5 : 3;
      g += '<path d="' + d + '" fill="none" stroke="' + (c === 3 ? "var(--m-case)" : "var(--m-art-case)") + '" stroke-width="' + (wdt + 1.4) + '" stroke-linecap="round"/>';
      g += '<path d="' + d + '" fill="none" stroke="' + (c === 3 ? "var(--m-road)" : "var(--m-art)") + '" stroke-width="' + wdt + '" stroke-linecap="round"/>';
    }));
  } else {
    for (let x = 0; x < W; x += 30) g += '<path d="M' + x + ' 0V' + H + '" stroke="var(--m-case)" stroke-width=".5"/>';
    for (let y = 0; y < H; y += 30) g += '<path d="M0 ' + y + 'H' + W + '" stroke="var(--m-case)" stroke-width=".5"/>';
  }

  // Night lights from satellite, drawn under everything else in the light layer
  (o.sky || []).forEach(grid => {
    const [w0, s0, e0, n0] = grid.bbox;
    const cw = (e0 - w0) / grid.cols, ch = (n0 - s0) / grid.rows;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const v = grid.values[row * grid.cols + col];
        if (v == null) continue;
        const top = grid.rowOrder === "north-first" ? n0 - row * ch : s0 + (grid.rows - row) * ch;
        const a = P(w0 + col * cw, top), b = P(w0 + (col + 1) * cw, top - ch);
        const alpha = Math.max(0.04, Math.min(0.5, v / 140));
        g += '<rect x="' + a[0].toFixed(1) + '" y="' + a[1].toFixed(1) + '" width="' + Math.abs(b[0] - a[0]).toFixed(1) +
             '" height="' + Math.abs(b[1] - a[1]).toFixed(1) + '" fill="#E9A825" opacity="' + alpha.toFixed(2) + '"/>';
      }
    }
  });

  // Roads tagged lit / unlit in OpenStreetMap
  (o.litWays || []).forEach(way => {
    if (!way.coords || way.coords.length < 2) return;
    const on = way.lit && way.lit !== "no" && way.lit !== "disused";
    g += '<path d="' + pathD(way.coords, P) + '" fill="none" stroke="' + (on ? "#E9A825" : "#6E5A46") +
         '" stroke-width="4" stroke-linecap="round" opacity="' + (on ? .85 : .7) + '"' + (on ? '' : ' stroke-dasharray="5 4"') + '/>';
  });

  // Mapped street lamps
  (o.lamps || []).forEach(l => {
    const [x, y] = P(l.lng, l.lat);
    g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="#E9A825" stroke="#fff" stroke-width="1.1"/>';
  });

  // The route, coloured per 50 m by the light layer
  (o.lightSegs || []).forEach(seg => {
    g += '<path d="' + pathD([seg.a, seg.b], P) + '" fill="none" stroke="' + (LIGHT_COLORS[seg.level] || LIGHT_COLORS.none) +
         '" stroke-width="6" stroke-linecap="round"/>';
  });

  (o.routes || []).forEach(r => {
    if (!r.coords || r.coords.length < 2) return;
    const d = pathD(r.coords, P);
    g += '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="' + (r.selected ? 8 : 6) + '" stroke-linecap="round" opacity=".6"/>';
    g += '<path d="' + d + '" fill="none" stroke="' + (r.color || "var(--pink)") + '" stroke-width="' + (r.selected ? 5 : 3.2) + '" stroke-linecap="round"' +
         (r.dashed ? ' stroke-dasharray="2 7"' : '') + ' opacity="' + (r.selected === false ? .5 : 1) + '"/>';
  });

  if (BASEMAP) BASEMAP.names.slice(0, 14).forEach(nm => {
    const [x, y] = P(nm.p[0], nm.p[1]);
    if (x > 10 && x < W - 60 && y > 12 && y < H - 8) g += '<text x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" fill="var(--m-text)" font-size="7" font-weight="600" font-family="Hanken Grotesk,sans-serif">' + nm.n.toUpperCase().slice(0, 22) + '</text>';
  });

  (o.pins || []).forEach(p => {
    const [x, y] = P(p.lng, p.lat);
    const c = p.kind === "police" ? "#23508F" : (p.kind === "hospital" || p.kind === "clinic") ? "#C22334" : p.kind === "metro" ? "var(--purple)" : "#127A4E";
    g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="' + c + '" stroke="#fff" stroke-width="1.6"/>';
  });
  if (o.dest) { const [x, y] = P(o.dest.lng, o.dest.lat); g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="var(--purple)" stroke="#fff" stroke-width="2.4"/>'; }
  const u = o.user || null;
  if (u && u.lat != null) {
    const [x, y] = P(u.lng, u.lat);
    g += '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')"><circle r="17" fill="var(--pink)" opacity=".15"/><circle r="7.4" fill="#fff"/><circle r="5.2" fill="var(--pink)"/></g>';
  }
  return g + '</svg>';
}

const legend = () => '<div class="legend"><i><b style="background:#23508F"></b>Police</i><i><b style="background:#C22334"></b>Hospital</i>' +
  '<i><b style="background:var(--purple)"></b>Metro</i><i><b style="background:#127A4E"></b>Other help</i></div>';
const lightLegend = () => '<div class="legend"><i><b style="background:#E9A825"></b>Lit (map tag or lamp)</i>' +
  '<i><b style="background:#6E5A46"></b>Tagged unlit</i><i><b style="background:#E9A825;opacity:.35"></b>Satellite night light</i></div>';
const osmCredit = () => '<span style="position:absolute;right:6px;top:4px;color:var(--m-text);font-size:8.5px">© OpenStreetMap</span>';

/* Route coloured per 50 m by the light layer */
function lightSegments(coords, now) {
  if (!coords || coords.length < 2 || !window.Scoring || !window.Light) return [];
  const pts = Scoring.sample(coords, 50);
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const mid = [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2];
    const e = Light.estimate(mid[1], mid[0], (window.Agent ? Agent.readings() : []), now || Date.now());
    const level = e.source === "daylight" ? "lit"
      : e.level == null ? "none" : e.level >= 90 ? "lit" : e.level >= 40 ? "some" : "dark";
    out.push({ a: pts[i - 1], b: pts[i], level, source: e.source });
  }
  return out;
}


/* ---------------------------------------------------------------------------
   Real map (Leaflet + OpenStreetMap tiles).
   mapSVG() returns a container that already holds the drawn map, so something
   is visible instantly and offline; wireMaps() then upgrades it to a live map
   when Leaflet and the tiles are available.
--------------------------------------------------------------------------- */
const MAPS = {};            // id -> options for this render
let mapSeq = 0, liveMaps = [];

function mapSVG(o) {
  o = o || {};
  const id = "m" + (++mapSeq);
  MAPS[id] = o;
  return '<div class="leafwrap" data-map="' + id + '" style="position:absolute;inset:0">' + drawnMap(o) + '</div>';
}

const ll = c => [c[1], c[0]];                       // [lng,lat] -> [lat,lng]
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#C2185B";
const solid = c => (c || "").startsWith("var(") ? cssVar(c.slice(4, -1)) : (c || "#C2185B");

function wireMaps() {
  // drop maps whose container has gone
  liveMaps = liveMaps.filter(m => { if (!document.body.contains(m.getContainer())) { m.remove(); return false; } return true; });
  if (typeof L === "undefined") return;             // Leaflet not loaded: keep the drawn map

  document.querySelectorAll(".leafwrap[data-map]").forEach(box => {
    const o = MAPS[box.dataset.map];
    if (!o || box.dataset.live) return;
    box.dataset.live = "1";

    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;inset:0;opacity:0;transition:opacity .25s";
    box.appendChild(holder);

    let map;
    try { map = L.map(holder, { zoomControl: false, attributionControl: true, tap: true }); }
    catch (e) { holder.remove(); return; }

    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap", crossOrigin: true,
    });
    let ok = false, failed = 0;
    tiles.on("tileload", () => { if (!ok) { ok = true; holder.style.opacity = "1"; box.querySelector("svg") && (box.querySelector("svg").style.display = "none"); } });
    tiles.on("tileerror", () => { if (!ok && ++failed > 4) { map.remove(); holder.remove(); box.dataset.live = ""; } });
    tiles.addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    drawLayers(map, o);
    fitTo(map, o);
    if (o.user && o.user.lat != null) addRecentre(map, o.user);
    liveMaps.push(map);
  });
}

function drawLayers(map, o) {
  // Night light from satellite. Central Delhi saturates at the top of the scale, so
  // glowing every cell says nothing; we shade the cells that are darker than their
  // neighbours instead, which is the useful signal.
  (o.sky || []).forEach(g => {
    const rows = Array.isArray(g.values[0]) ? g.values : null;
    const val = (r, c) => rows ? rows[r][c] : g.values[r * g.cols + c];
    const all = [];
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) { const v = val(r, c); if (v != null) all.push(v); }
    if (!all.length) return;
    const hi = Math.max(...all), lo = Math.min(...all);
    if (hi - lo < 12) return;                       // uniformly lit: nothing to show
    const [w0, s0, e0, n0] = g.bbox, cw = (e0 - w0) / g.cols, ch = (n0 - s0) / g.rows;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const v = val(r, c);
      if (v == null) continue;
      const darkness = 1 - (v - lo) / (hi - lo);     // 1 = darkest cell in this area
      if (darkness < 0.35) continue;
      const north = /north/i.test(g.rowOrder || "") ? n0 - r * ch : s0 + (g.rows - r) * ch;
      L.rectangle([[north - ch, w0 + c * cw], [north, w0 + (c + 1) * cw]], {
        stroke: false, fillColor: "#3A2E26", fillOpacity: 0.06 + 0.16 * darkness,
      }).addTo(map).bindPopup("Darker from satellite than the surrounding area (NASA VIIRS, about 500 m)");
    }
  });
  (o.litWays || []).forEach(w => {
    if (!w.coords || w.coords.length < 2) return;
    const on = w.lit && w.lit !== "no" && w.lit !== "disused";
    L.polyline(w.coords.map(ll), { color: on ? "#E9A825" : "#6E5A46", weight: 5, opacity: on ? .85 : .7, dashArray: on ? null : "6 5" }).addTo(map);
  });
  (o.lamps || []).forEach(l => L.circleMarker([l.lat, l.lng], { radius: 3.5, color: "#fff", weight: 1, fillColor: "#E9A825", fillOpacity: 1 }).addTo(map));

  // the route, either coloured by light or by mode
  (o.lightSegs || []).forEach(sg => L.polyline([ll(sg.a), ll(sg.b)],
    { color: LIGHT_COLORS[sg.level] || LIGHT_COLORS.none, weight: 7, lineCap: "round" }).addTo(map));
  (o.routes || []).forEach(r => {
    if (!r.coords || r.coords.length < 2) return;
    const pts = r.coords.map(ll);
    L.polyline(pts, { color: "#fff", weight: r.selected ? 10 : 8, opacity: .7 }).addTo(map);
    L.polyline(pts, { color: solid(r.color), weight: r.selected ? 6 : 4, opacity: r.selected === false ? .55 : 1,
                      dashArray: r.dashed ? "2 9" : null, lineCap: "round" }).addTo(map);
  });

  // help points, destination, her position
  (o.pins || []).forEach(p => {
    const c = p.kind === "police" ? "#23508F" : (p.kind === "hospital" || p.kind === "clinic") ? "#C22334" : p.kind === "metro" ? solid("var(--purple)") : "#127A4E";
    L.circleMarker([p.lat, p.lng], { radius: 6, color: "#fff", weight: 2, fillColor: c, fillOpacity: 1 })
      .addTo(map).bindPopup('<b>' + (p.name || p.kind) + '</b><br>' + (p.kind || "") + (p.hours ? '<br>' + p.hours : ''));
  });
  if (o.dest) L.circleMarker([o.dest.lat, o.dest.lng], { radius: 7, color: "#fff", weight: 2.5, fillColor: solid("var(--purple)"), fillOpacity: 1 })
    .addTo(map).bindPopup("<b>" + (o.dest.name || "Destination") + "</b>");
  if (o.user && o.user.lat != null) {
    L.circleMarker([o.user.lat, o.user.lng], { radius: 18, stroke: false, fillColor: solid("var(--pink)"), fillOpacity: .15 }).addTo(map);
    L.circleMarker([o.user.lat, o.user.lng], { radius: 7, color: "#fff", weight: 3, fillColor: solid("var(--pink)"), fillOpacity: 1 })
      .addTo(map).bindPopup("<b>" + (o.user.name || "You are here") + "</b>");
  }
}

function fitTo(map, o) {
  const pts = [];
  (o.fit || []).forEach(c => pts.push(ll(c)));
  (o.routes || []).forEach(r => (r.coords || []).forEach(c => pts.push(ll(c))));
  (o.pins || []).forEach(p => pts.push([p.lat, p.lng]));
  if (o.user && o.user.lat != null) pts.push([o.user.lat, o.user.lng]);
  if (o.dest) pts.push([o.dest.lat, o.dest.lng]);
  if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [26, 26], maxZoom: 17 });
  else map.setView(pts[0] || [HOME.lat, HOME.lng], 15);
}

function addRecentre(map, user) {
  const c = L.control({ position: "bottomright" });
  c.onAdd = () => {
    const b = L.DomUtil.create("button", "recentre");
    b.type = "button"; b.title = "Recentre"; b.innerHTML = "◎";
    L.DomEvent.on(b, "click", e => { L.DomEvent.stop(e); map.setView([user.lat, user.lng], 16); });
    return b;
  };
  c.addTo(map);
}

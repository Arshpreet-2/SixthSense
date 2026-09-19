/* ============================================================================
 * light.js — Light
 * How lit is each part of a route? Three sources, best first:
 *   1. phones     recent camera/light readings from people who walked there
 *   2. map        OpenStreetMap: roads tagged lit=yes/no, mapped street lamps
 *   3. satellite  NASA VIIRS night lights, area level (~500 m)
 * Works for any place: map tags and satellite light are fetched for the area
 * around each route and cached on the phone (IGDTUW data is bundled).
 * Every estimate carries its source and a confidence. In daylight it says so.
 * Needs: SensorHub (distance helper). Exposes: window.Light
 * ========================================================================== */
(function (root) {
  'use strict';

  const FILES = { osm: 'data/osm-lit.igdtuw.json', sky: 'data/nightlight.igdtuw.json' };
  const OVERPASS = ['https://overpass-api.de/api/interpreter',
                    'https://overpass.kumi.systems/api/interpreter',
                    'https://overpass.osm.ch/api/interpreter'];
  const OVERPASS_MS = 7000;          // a mirror that has not answered by now is not worth waiting for
  const OSM_API = 'https://api.openstreetmap.org/api/0.6/map.json';
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  const CONF = { map: 0.5, satellite: 0.2 };                 // phones: from reading count and age
  const LEVEL = { litTag: 150, unlitTag: 20, lamp: 140 };   // 0–255, same scale as the camera reading
  const NEAR = { reading: 60, way: 25, lamp: 30 };           // metres
  const CELL = 0.005;                                         // satellite cell, degrees (~500 m)
  const CACHE_DAYS = { osm: 30, sky: 180 };
  const HELP_KINDS = /^(police|hospital|clinic|pharmacy|fuel|taxi)$/;

  // Each area: { key, bbox:[w,s,e,n], osm:{source,ways,lamps,pois,...}, sky:{bbox,cols,rows,values,source} }
  const areas = [];
  let bundledLoaded = false;
  const dist = (a, b, c, d) => root.SensorHub.distanceM(a, b, c, d);
  const inBox = ([w, s, e, n], lat, lng) => lng >= w && lng <= e && lat >= s && lat <= n;

  async function getJson(url, opts) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    try { const r = await fetch(url, { ...opts, signal: ctrl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  const cacheGet = (k, days) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v && Date.now() - v.at < days * 864e5 ? v.data : null; } catch (e) { return null; }
  };
  const cacheSet = (k, data) => { try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* storage full */ } };

  // Bundled IGDTUW data: works offline from the first launch
  async function load() {
    if (bundledLoaded) return;
    bundledLoaded = true;
    try {
      const osm = await getJson(FILES.osm);
      const sky = await getJson(FILES.sky).catch(() => null);
      areas.push({ key: 'bundled', bbox: osm.bbox, osm: { ...osm, pois: [] }, sky, bundled: true });
    } catch (e) { /* no bundled data */ }
  }

  /* ------------------------------------ any place: fetch and cache an area */
  // bbox = [west, south, east, north]; call with a route's bounds before the trip
  async function loadFor(bbox) {
    if (typeof S !== 'undefined' && S.offline) {
      const box = snap(bbox), key = box.map(v => v.toFixed(3)).join(',');
      const cached = areas.find(a => a.key === key) ||
        (cacheGet(`ss.osm.${key}`, CACHE_DAYS.osm) ? { key, bbox: box, osm: cacheGet(`ss.osm.${key}`, CACHE_DAYS.osm), sky: cacheGet(`ss.sky.${key}`, CACHE_DAYS.sky) } : null);
      if (cached) { if (!areas.includes(cached)) areas.push(cached); return cached; }
      throw new Error('Offline mode is on; this area is not saved.');
    }
    const box = snap(bbox);
    const key = box.map(v => v.toFixed(3)).join(',');
    const known = areas.find(a => a.key === key);
    if (known) return known;
    const area = { key, bbox: box, osm: cacheGet(`ss.osm.${key}`, CACHE_DAYS.osm), sky: cacheGet(`ss.sky.${key}`, CACHE_DAYS.sky) };
    if (!area.osm) {
      area.osm = await fetchOsm(box).catch(() => null);
      if (area.osm) cacheSet(`ss.osm.${key}`, area.osm);
    }
    if (!area.sky && typeof document !== 'undefined') {
      area.sky = await fetchSky(box).catch(() => null);
      if (area.sky) cacheSet(`ss.sky.${key}`, area.sky);
    }
    if (area.osm || area.sky) areas.unshift(area);
    return area;
  }
  function snap([w, s, e, n]) {
    const pad = 0.003;   // ~300 m around the route
    return [Math.floor((w - pad) / CELL) * CELL, Math.floor((s - pad) / CELL) * CELL,
            Math.ceil((e + pad) / CELL) * CELL, Math.ceil((n + pad) / CELL) * CELL].map(v => +v.toFixed(3));
  }
  const boundsOf = coords => [
    Math.min(...coords.map(c => c[0])), Math.min(...coords.map(c => c[1])),
    Math.max(...coords.map(c => c[0])), Math.max(...coords.map(c => c[1])),
  ];

  // Lit roads, street lamps and help points in one request
  async function fetchOsm([w, s, e, n]) {
    const b = `(${s},${w},${n},${e})`;
    const q = `[out:json][timeout:8];(
      way["highway"]["lit"]${b};
      node["highway"="street_lamp"]${b};
      node["amenity"~"police|hospital|clinic|pharmacy|fuel|taxi"]${b};
      node["station"="subway"]${b};
      node["railway"="station"]${b};
      node["highway"="bus_stop"]${b};
      node["shop"~"convenience|supermarket"]${b};
    );out geom;`;
    // ask every mirror at once and take the first that answers
    const withTimeout = url => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('slow')), OVERPASS_MS);
      getJson(`${url}?data=${encodeURIComponent(q)}`)
        .then(j => { clearTimeout(t); res(j); })
        .catch(e => { clearTimeout(t); rej(e); });
    });
    try {
      const first = await Promise.any(OVERPASS.map(withTimeout));
      return fromElements(first, 'OpenStreetMap contributors (live)');
    } catch (err) { /* all mirrors slow or down: fall through */ }
    // Fallback: the main OSM API (small areas only)
    if ((e - w) * (n - s) > 0.01) throw new Error('Area too large for the OSM API fallback');
    return fromElements(await getJson(`${OSM_API}?bbox=${w},${s},${e},${n}`), 'OpenStreetMap contributors (live)');
  }
  function fromElements(data, source) {
    const els = data.elements || [];
    const full = els.some(x => x.type === 'way' && x.nodes && !x.geometry);   // OSM API returns every road
    const nodes = new Map(els.filter(x => x.type === 'node').map(x => [x.id, x]));
    const ways = [], lamps = [], pois = [];
    let roads = 0;
    for (const x of els) {
      const t = x.tags || {};
      if (x.type === 'way' && t.highway) {
        roads++;
        if (!t.lit) continue;
        const coords = x.geometry ? x.geometry.map(g => [g.lon, g.lat])
          : (x.nodes || []).map(id => nodes.get(id)).filter(Boolean).map(nd => [nd.lon, nd.lat]);
        ways.push({ id: x.id, lit: t.lit, name: t.name || '', coords });
      } else if (x.type === 'node' && t.highway === 'street_lamp') {
        lamps.push({ id: x.id, lat: x.lat, lng: x.lon });
      } else if (x.type === 'node' && (HELP_KINDS.test(t.amenity || '') || t.station === 'subway' || t.railway === 'station' ||
                                        t.highway === 'bus_stop' || /^(convenience|supermarket)$/.test(t.shop || ''))) {
        const kind = t.station === 'subway' ? 'metro' : t.railway === 'station' ? 'station' : t.highway === 'bus_stop' ? 'bus stop'
          : t.amenity === 'taxi' ? 'auto/taxi stand' : t.shop ? 'shop' : t.amenity;
        pois.push({ id: x.id, kind, name: t.name || t['name:en'] || '', phone: t.phone || t['contact:phone'] || '',
                    hours: t.opening_hours || '', lat: x.lat, lng: x.lon });
      }
    }
    return { source, ways, lamps, pois, roadsWithLitTag: ways.length, roadsInArea: full ? roads : null };
  }

  // NASA VIIRS night lights: median of several recent nights, read from images
  async function fetchSky([w, s, e, n]) {
    const cols = Math.max(1, Math.round((e - w) / CELL)), rows = Math.max(1, Math.round((n - s) / CELL));
    const px = 8;
    const dates = recentNights(6);
    const grids = [];
    for (const d of dates) {
      try {
        const url = `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_SNPP_DayNightBand_At_Sensor_Radiance` +
          `&STYLES=&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${cols * px}&HEIGHT=${rows * px}&FORMAT=image/png&TIME=${d}`;
        grids.push(await readGrid(url, cols, rows, px));
      } catch (err) { /* skip that night */ }
    }
    if (!grids.length) throw new Error('No satellite images');
    const values = [];
    for (let r = 0; r < rows; r++) {
      values.push([]);
      for (let c = 0; c < cols; c++) {
        const v = grids.map(g => g[r][c]).sort((a, b) => a - b);
        values[r].push(v[Math.floor(v.length / 2)]);
      }
    }
    return { bbox: [w, s, e, n], cols, rows, values, rowOrder: 'north-to-south',
             source: `NASA VIIRS night lights via NASA GIBS, median of ${grids.length} nights (${dates[dates.length - 1]} to ${dates[0]})` };
  }
  function recentNights(k) {
    // 15 days apart, starting a week ago; skips June–September, when monsoon cloud hides city lights
    const out = [];
    for (let i = 0; out.length < k && i < 40; i++) {
      const d = new Date(Date.now() - (7 + i * 15) * 864e5);
      if (d.getUTCMonth() >= 5 && d.getUTCMonth() <= 8) continue;
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
  function readGrid(url, cols, rows, px) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = cols * px; cv.height = rows * px;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, cv.width, cv.height).data;
        let painted = 0;
        const grid = [];
        for (let r = 0; r < rows; r++) {
          grid.push([]);
          for (let c = 0; c < cols; c++) {
            let sum = 0;
            for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
              const o = ((r * px + j) * cv.width + (c * px + i)) * 4;
              if (data[o + 3] > 0) painted++;
              sum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
            }
            grid[r].push(Math.round(sum / (px * px)));
          }
        }
        painted < data.length / 8 ? rej(new Error('mostly blank image')) : res(grid);
      };
      img.onerror = () => rej(new Error('image failed'));
      img.src = url;
    });
  }

  // Help points from every loaded area (used by Context)
  // Lit roads, street lamps and the night-light grid, for drawing on the map
  function layers(bbox) {
    const ways = [], lamps = [], sky = [];
    for (const a of areas) {
      if (bbox && !overlaps(a.bbox, bbox)) continue;
      if (a.osm) { ways.push(...(a.osm.ways || [])); lamps.push(...(a.osm.lamps || [])); }
      if (a.sky) sky.push(a.sky);
    }
    return { ways, lamps, sky };
  }
  const overlaps = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

  function helpPoints(bbox) {
    const out = new Map();
    for (const a of areas) for (const p of (a.osm && a.osm.pois) || []) if (!bbox || inBox(bbox, p.lat, p.lng)) out.set(p.id, p);
    return [...out.values()];
  }

  /* ------------------------------------------------------------ daylight */
  // NOAA-style approximation; good to a few minutes, enough for "is it dark?"
  function sunTimes(lat, lng, date = new Date()) {
    const rad = Math.PI / 180;
    const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (day - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
    const midnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return { rise: new Date(midnight + (720 - 4 * (lng + ha) - eq) * 60000),
             set: new Date(midnight + (720 - 4 * (lng - ha) - eq) * 60000) };
  }
  function isDark(lat, lng, t = Date.now()) {
    const { rise, set } = sunTimes(lat, lng, new Date(t));
    return t < rise.getTime() - 20 * 60000 || t > set.getTime() + 20 * 60000;   // 20 min of dusk
  }

  /* ------------------------------------------------------ per-point estimate */
  function fromPhones(lat, lng, readings, now) {
    let w = 0, sum = 0, n = 0, sim = false;
    for (const r of readings) {
      if (r.light == null) continue;
      const age = now - r.t;
      if (age < 0 || age > 2 * 3600000) continue;
      if (dist(lat, lng, r.lat, r.lng) > NEAR.reading) continue;
      const k = Math.pow(0.5, age / (45 * 60000));
      w += k; sum += k * r.light; n++; sim = sim || !!r.sim;
    }
    return n ? { level: sum / w, conf: 1 - Math.exp(-w / 2), n, sim } : null;
  }

  function fromMap(lat, lng) {
    for (const a of areas) {
      if (!a.osm || !inBox(a.bbox, lat, lng)) continue;
      for (const l of a.osm.lamps || []) if (dist(lat, lng, l.lat, l.lng) <= NEAR.lamp) return { level: LEVEL.lamp, detail: 'street lamp mapped' };
      for (const way of a.osm.ways || []) {
        if (!nearLine(lat, lng, way.coords, NEAR.way)) continue;
        if (way.lit === 'no') return { level: LEVEL.unlitTag, detail: 'road tagged unlit' };
        if (way.lit && way.lit !== 'disused') return { level: LEVEL.litTag, detail: 'road tagged lit' };
      }
    }
    return null;
  }

  function fromSatellite(lat, lng) {
    const area = areas.find(a => a.sky && inBox(a.sky.bbox, lat, lng));
    if (!area) return null;
    const sky = area.sky;
    const [w, s, e, n] = sky.bbox;
    const c = Math.min(sky.cols - 1, Math.floor((lng - w) / (e - w) * sky.cols));
    const r = Math.min(sky.rows - 1, Math.floor((n - lat) / (n - s) * sky.rows));
    const v = sky.values[r][c];
    // Satellite sees the whole area, not the lane: translate cautiously
    return { level: v >= 250 ? 100 : v >= 215 ? 70 : 40, raw: v };
  }

  function estimate(lat, lng, readings = [], now = Date.now()) {
    if (!isDark(lat, lng, now)) return { level: 255, source: 'daylight', conf: 1, label: 'daylight' };
    const p = fromPhones(lat, lng, readings, now);
    if (p && p.conf >= 0.3) return { level: p.level, source: 'phones', conf: p.conf, n: p.n, sim: p.sim, label: label(p.level) };
    const m = fromMap(lat, lng);
    if (m) return { level: m.level, source: 'map', conf: CONF.map, detail: m.detail, label: label(m.level) };
    const s = fromSatellite(lat, lng);
    if (s) return { level: s.level, source: 'satellite', conf: CONF.satellite, raw: s.raw, label: label(s.level) };
    if (p) return { level: p.level, source: 'phones', conf: p.conf, n: p.n, sim: p.sim, label: label(p.level) };
    return { level: null, source: 'none', conf: 0, label: 'no information' };
  }
  const label = v => v == null ? 'no information' : v >= 90 ? 'well lit' : v >= 40 ? 'some light' : 'dark';

  /* ------------------------------------------------------------ per route */
  function routeLight(route, readings = [], now = Date.now()) {
    const pts = sample(route.coords, 50);
    const cells = pts.map(([lng, lat]) => estimate(lat, lng, readings, now));
    const count = src => cells.filter(c => c.source === src).length;
    const share = src => Math.round(100 * count(src) / cells.length);

    if (count('daylight') === cells.length) {
      return { label: 'daylight', text: 'Daylight', cells, sources: { daylight: 100 }, confidence: 1 };
    }
    const known = cells.filter(c => c.level != null && c.source !== 'daylight');
    const avg = known.length ? known.reduce((a, c) => a + c.level, 0) / known.length : null;
    const dark = cells.filter(c => c.label === 'dark').length;
    const conf = known.length ? known.reduce((a, c) => a + c.conf, 0) / cells.length : 0;
    const sources = { phones: share('phones'), map: share('map'), satellite: share('satellite'), none: share('none') };
    const parts = [];
    if (sources.phones) parts.push(`phones ${sources.phones}%${cells.some(c => c.sim) ? ' (simulated)' : ''}`);
    if (sources.map) parts.push(`map tags ${sources.map}%`);
    if (sources.satellite) parts.push(`satellite ${sources.satellite}%`);
    if (sources.none) parts.push(`no data ${sources.none}%`);
    const lbl = label(avg);
    const head = dark && lbl !== 'dark' ? `Mostly ${lbl}, about ${dark * 50} m dark` : lbl[0].toUpperCase() + lbl.slice(1);
    return {
      label: lbl, level: avg == null ? null : Math.round(avg), darkMetres: dark * 50,
      confidence: +conf.toFixed(2), sources, cells,
      text: `${head}. Light from ${parts.join(', ')}`,
    };
  }

  // Sources that cover a route, for the label under the comparison
  function sourcesFor(coords) {
    const [lng, lat] = coords[Math.floor(coords.length / 2)];
    const osmArea = areas.find(x => x.osm && inBox(x.bbox, lat, lng));
    const skyArea = areas.find(x => x.sky && inBox(x.sky.bbox, lat, lng));
    const osm = osmArea ? osmArea.osm : null;
    return {
      map: osm ? osm.source : null,
      mapCoverage: !osm ? '' : osm.roadsInArea ? `${osm.roadsWithLitTag} of ${osm.roadsInArea} roads tagged`
        : `${osm.roadsWithLitTag || 0} lit-tagged roads, ${(osm.lamps || []).length} lamps`,
      satellite: skyArea ? skyArea.sky.source : null,
    };
  }

  /* ---------------------------------------------------------------- utils */
  function sample(coords, stepM) {
    const out = [coords[0]];
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
      const seg = dist(y1, x1, y2, x2);
      let pos = stepM - acc;
      while (pos <= seg) {
        const f = pos / seg;
        out.push([x1 + f * (x2 - x1), y1 + f * (y2 - y1)]);
        pos += stepM;
      }
      acc = (acc + seg) % stepM;
    }
    return out;
  }
  function nearLine(lat, lng, coords, maxM) {
    for (let i = 1; i < coords.length; i++) if (pointToSegment(lat, lng, coords[i - 1], coords[i]) <= maxM) return true;
    return false;
  }
  function pointToSegment(lat, lng, [x1, y1], [x2, y2]) {
    const k = Math.cos(lat * Math.PI / 180) * 111320, m = 110540;   // flat projection at street scale
    const px = lng * k, py = lat * m, ax = x1 * k, ay = y1 * m, bx = x2 * k, by = y2 * m;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // is this area already loaded or cached? then the first comparison is final
  function hasArea(bbox) {
    const box = snap(bbox), key = box.map(v => v.toFixed(3)).join(',');
    return areas.some(a => a.key === key) || !!cacheGet(`ss.osm.${key}`, CACHE_DAYS.osm);
  }

  root.Light = {
    hasArea,
    layers,
    load, loadFor, boundsOf, estimate, routeLight, isDark, sunTimes, helpPoints, sourcesFor,
    config: { CONF, LEVEL, NEAR, CELL },
  };
})(typeof window !== 'undefined' ? window : globalThis);

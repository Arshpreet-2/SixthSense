#!/usr/bin/env python3
"""
SixthSense — feature pipeline.

Builds the training table for the street-conditions model.

Two sources, kept apart on purpose:

  1. STATIC FEATURES, from open data (OpenStreetMap, NASA VIIRS). Present for
     every 50 m cell in the country whether or not anyone has walked there.
     These are the only columns used at prediction time, which is what lets the
     model speak about streets nobody has ever reported.

  2. LABELS, from readings collected by phones. Never used raw: rolled into a
     median per cell x hour-of-week, contributor identity dropped, and nothing
     kept until at least MIN_CONTRIBUTORS different accounts have contributed.
     The raw reading still expires in 2 hours; only the statistic survives.

Usage
    python3 features.py fetch   --bbox 77.20,28.64,77.27,28.69 --out data/
    python3 features.py labels  --readings readings.json        --out data/
    python3 features.py build   --out data/                     # joins the two
"""

import argparse, json, math, os, sys, time, urllib.parse, urllib.request
from collections import defaultdict

CELL_M = 50                    # the same 50 m segment the scoring uses
MIN_CONTRIBUTORS = 5           # k-anonymity: no cell-hour below this is stored
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.osm.ch/api/interpreter"]
OSM_API = "https://api.openstreetmap.org/api/0.6/map.json"

# ---------------------------------------------------------------- geometry

def cell_id(lat, lng):
    """A 50 m cell, as integer grid coordinates."""
    return (int(lat / (CELL_M / 111_320)), int(lng / (CELL_M / (111_320 * math.cos(math.radians(lat))))))

def cell_centre(cid, lat_hint):
    y, x = cid
    dlat = CELL_M / 111_320
    dlng = CELL_M / (111_320 * math.cos(math.radians(lat_hint)))
    return (y + 0.5) * dlat, (x + 0.5) * dlng

def metres(a_lat, a_lng, b_lat, b_lng):
    k = math.cos(math.radians((a_lat + b_lat) / 2)) * 111_320
    return math.hypot((b_lng - a_lng) * k, (b_lat - a_lat) * 110_540)

# ---------------------------------------------------------------- 1. static

ROAD_RANK = {"motorway": 6, "trunk": 6, "primary": 5, "secondary": 4, "tertiary": 3,
             "residential": 2, "living_street": 2, "unclassified": 2, "service": 1,
             "pedestrian": 2, "footway": 1, "path": 1, "steps": 1, "track": 1, "cycleway": 1}

def fetch_osm(bbox):
    """Roads, lamps, shops, transport and buildings for the box."""
    w, s, e, n = bbox
    q = f"""[out:json][timeout:120];(
      way["highway"]({s},{w},{n},{e});
      node["highway"="street_lamp"]({s},{w},{n},{e});
      node["shop"]({s},{w},{n},{e});
      node["amenity"~"police|hospital|clinic|pharmacy|fuel|restaurant|cafe|bar|marketplace"]({s},{w},{n},{e});
      node["railway"="station"]({s},{w},{n},{e});
      node["highway"="bus_stop"]({s},{w},{n},{e});
      way["building"]({s},{w},{n},{e});
    );out geom;"""
    last = None
    for url in OVERPASS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(),
                                         headers={"User-Agent": "SixthSense/1.0 (research)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as err:
            print(f"  {url.split('/')[2]} unavailable ({err}), trying the next one")
            last = err
    # last resort: the main OSM API, which returns everything in a small box
    w, s_, e, n = bbox
    if (e - w) * (n - s_) > 0.02:
        raise SystemExit(f"Overpass is down and the box is too large for the OSM API fallback ({last})")
    print("  falling back to the OSM API")
    with urllib.request.urlopen(f"{OSM_API}?bbox={w},{s_},{e},{n}", timeout=180) as r:
        return json.load(r)

def static_features(osm, bbox):
    """One row per 50 m cell that has a road in it."""
    lamps, shops, transport, buildings = [], [], [], 0
    roads = []
    for el in osm.get("elements", []):
        t, tags = el.get("type"), el.get("tags", {}) or {}
        if t == "node" and tags.get("highway") == "street_lamp":
            lamps.append((el["lat"], el["lon"]))
        elif t == "node" and ("shop" in tags or tags.get("amenity") in
                              {"restaurant", "cafe", "bar", "marketplace", "pharmacy", "fuel"}):
            shops.append((el["lat"], el["lon"], tags.get("opening_hours", "")))
        elif t == "node" and (tags.get("railway") == "station" or tags.get("highway") == "bus_stop"):
            transport.append((el["lat"], el["lon"]))
        elif t == "way" and "building" in tags:
            buildings += 1
        elif t == "way" and "highway" in tags and el.get("geometry"):
            roads.append((tags, el["geometry"]))

    cells = {}
    for tags, geom in roads:
        hw = tags.get("highway")
        lit = tags.get("lit")
        for p in geom:
            cid = cell_id(p["lat"], p["lon"])
            c = cells.setdefault(cid, {
                "lat": p["lat"], "lng": p["lon"], "road_rank": 0, "is_foot": 0,
                "lit_tag": None, "lamps_30m": 0, "shops_100m": 0, "transport_200m": 9999,
                "junctions": 0, "night_light": None,
            })
            c["road_rank"] = max(c["road_rank"], ROAD_RANK.get(hw, 2))
            c["is_foot"] = max(c["is_foot"], 1 if hw in {"footway", "path", "steps", "pedestrian"} else 0)
            if lit in {"yes", "24/7"}: c["lit_tag"] = 1
            elif lit in {"no", "disused"}: c["lit_tag"] = 0
            c["junctions"] += 1

    for cid, c in cells.items():
        c["lamps_30m"] = sum(1 for la, lo in lamps if metres(c["lat"], c["lng"], la, lo) <= 30)
        c["shops_100m"] = sum(1 for la, lo, _ in shops if metres(c["lat"], c["lng"], la, lo) <= 100)
        near = [metres(c["lat"], c["lng"], la, lo) for la, lo in transport]
        c["transport_200m"] = int(min(near)) if near else 9999
        c["buildings_area"] = buildings          # coarse density for the box
        c["cell"] = f"{cid[0]}_{cid[1]}"
    return list(cells.values())

def attach_night_light(cells, viirs_path):
    """Satellite night light for each cell, from a bundled VIIRS grid."""
    if not viirs_path or not os.path.exists(viirs_path):
        print("  no VIIRS grid given; night_light left empty")
        return cells
    g = json.load(open(viirs_path))
    w, s, e, n = g["bbox"]; rows, cols = g["rows"], g["cols"]
    vals = g["values"]
    two_d = isinstance(vals[0], list)
    for c in cells:
        col = int((c["lng"] - w) / (e - w) * cols)
        row = int((n - c["lat"]) / (n - s) * rows)
        if 0 <= row < rows and 0 <= col < cols:
            c["night_light"] = vals[row][col] if two_d else vals[row * cols + col]
    return cells

# ---------------------------------------------------------------- 2. labels

def aggregate(readings):
    """Readings -> median per cell x hour-of-week, with k-anonymity."""
    buckets = defaultdict(lambda: {"light": [], "activity": [], "dbm": [], "gps_acc": [],
                                   "motion": [], "dog": 0, "who": set()})
    for r in readings:
        if r.get("lat") is None: continue
        cid = cell_id(r["lat"], r["lng"])
        t = time.localtime(r.get("t", time.time() * 1000) / 1000)
        how = t.tm_wday * 24 + t.tm_hour                 # hour of week, 0-167
        b = buckets[(f"{cid[0]}_{cid[1]}", how)]
        for key, field in (("light", "light"), ("activity", "liveliness"),
                           ("dbm", "signalDbm"), ("gps_acc", "gpsAcc"), ("motion", "motionStd")):
            if r.get(field) is not None: b[key].append(r[field])
        if r.get("dogPack"): b["dog"] += 1
        b["who"].add(r.get("contributor", "anon"))

    def med(xs): 
        if not xs: return None
        xs = sorted(xs); m = len(xs) // 2
        return xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2

    out = []
    dropped = 0
    for (cell, how), b in buckets.items():
        if len(b["who"]) < MIN_CONTRIBUTORS:            # never store a single person's routine
            dropped += 1
            continue
        out.append({
            "cell": cell, "hour_of_week": how, "hour": how % 24, "weekday": how // 24,
            "light_med": med(b["light"]), "activity_med": med(b["activity"]),
            "dbm_med": med(b["dbm"]), "gps_acc_med": med(b["gps_acc"]),
            "motion_med": med(b["motion"]),
            "dog_rate": round(b["dog"] / max(1, len(b["light"]) or 1), 3),
            "n": len(b["who"]),
        })
    print(f"  kept {len(out)} cell-hours, dropped {dropped} below {MIN_CONTRIBUTORS} contributors")
    return out

# ---------------------------------------------------------------- 3. join

def build(out_dir):
    static = json.load(open(f"{out_dir}/static.json"))
    labels = json.load(open(f"{out_dir}/labels.json"))
    by_cell = {c["cell"]: c for c in static}
    rows, unlabelled = [], 0

    # rows that have both features and labels: these train the model
    for l in labels:
        f = by_cell.get(l["cell"])
        if not f:
            unlabelled += 1
            continue
        rows.append({**{k: v for k, v in f.items() if k not in ("lat", "lng")}, **l})

    # cells with a lit tag but no readings still train the lighting output
    for c in static:
        if c.get("lit_tag") is not None and c["cell"] not in {l["cell"] for l in labels}:
            rows.append({**{k: v for k, v in c.items() if k not in ("lat", "lng")},
                         "hour": 21, "weekday": 1, "n": 0})

    json.dump(rows, open(f"{out_dir}/train.json", "w"))
    print(f"  {len(rows)} training rows written to {out_dir}/train.json")
    print(f"  {sum(1 for r in rows if r.get('lit_tag') is not None)} rows have a lighting label")
    print(f"  {sum(1 for r in rows if r.get('light_med') is not None)} rows have measured light")
    print(f"  {sum(1 for r in rows if r.get('activity_med') is not None)} rows have measured activity")
    if unlabelled: print(f"  {unlabelled} label rows had no matching cell (outside the box)")
    return rows

# ---------------------------------------------------------------- cli

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["fetch", "labels", "build"])
    ap.add_argument("--bbox", help="w,s,e,n")
    ap.add_argument("--viirs", help="path to a nightlight json")
    ap.add_argument("--readings", help="path to a readings json")
    ap.add_argument("--out", default="data")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    if a.step == "fetch":
        bbox = [float(x) for x in a.bbox.split(",")]
        print("fetching OpenStreetMap…")
        osm = fetch_osm(bbox)
        cells = attach_night_light(static_features(osm, bbox), a.viirs)
        json.dump(cells, open(f"{a.out}/static.json", "w"))
        print(f"  {len(cells)} cells written to {a.out}/static.json")

    elif a.step == "labels":
        readings = json.load(open(a.readings))
        readings = readings.get("readings", readings)
        print(f"aggregating {len(readings)} readings…")
        json.dump(aggregate(readings), open(f"{a.out}/labels.json", "w"))

    else:
        build(a.out)

if __name__ == "__main__":
    main()

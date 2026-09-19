import json, sys, time
from features import fetch_osm, static_features, attach_night_light
w0,s0,e0,n0 = [float(x) for x in sys.argv[1].split(",")]
step = 0.008
cells = {}
y = s0
while y < n0:
    x = w0
    while x < e0:
        box = [x, y, min(x+step,e0), min(y+step,n0)]
        try:
            c = static_features(fetch_osm(box), box)
            for it in c: cells[it["cell"]] = it
            print(f"  {box} -> {len(c)} cells (total {len(cells)})", flush=True)
        except Exception as e:
            print(f"  {box} failed: {e}", flush=True)
        time.sleep(1)
        x += step
    y += step
cells = attach_night_light(list(cells.values()), "../data/nightlight.igdtuw.json")
json.dump(cells, open("data/static.json","w"))
lit = sum(1 for c in cells if c["lit_tag"] is not None)
print(f"TOTAL {len(cells)} cells, {lit} with a lighting tag, {sum(1 for c in cells if c['lamps_30m'])} with lamps nearby")

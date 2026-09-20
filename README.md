# SixthSense — Your Silent Protector

A mobile-first safety companion for women travelling alone. It compares the routes
available for one specific trip using what the phone can sense right now, keeps working
when the battery is nearly dead and the data has dropped, and lets the community log what
they actually saw on the street.

**Live demo:** https://sixth-sense-75t17g5vi-arshpreet-2s-projects.vercel.app/

---

## The idea in one line

Most navigation optimises time, distance and cost. None of those change at 9pm — but the
street does. SixthSense compares *journeys*, not places.

## The six senses

Each 10 m segment of a candidate route is scored for comparison only — never shown to the
user as a verdict, and never stored as a rating attached to an area.

| Sense | Points | What it reads |
|---|---|---|
| SEE | 25 | Light level, plus GPS accuracy as an openness proxy |
| HEAR | 20 | Ambient decibel level only — no audio is recorded |
| RUN | 20 | Accelerometer variance and GPS exit time |
| CALL | 15 | Signal strength, battery, connectivity |
| TRIBE | 10 | Bluetooth device counts, no identifiers, no gender inferred |
| GUT | 10 | Stray-dog pack detection — the one sense that needs a model |

## What is genuinely live in this build

Open the deployed site, go to **Map → View Live Signals → Enable live sensing**.

| Signal | In this web build | In the Android build |
|---|---|---|
| Sound level | Live, Web Audio API | Live — the number is kept, audio discarded |
| Dog-pack detection | Real broadband-transient detector (stand-in) | YamNet TFLite, AudioSet class `/m/05tny_` |
| Light level | Camera frame averaged to one brightness number | Real ambient light sensor, in lux |
| Daylight / after dark | Computed from sunrise & sunset — no permission needed | Same |
| Battery, connectivity | Live | Live |
| GPS accuracy | Live on permission | Live |
| Footpath steadiness | Simulated | Accelerometer |
| Devices nearby | Simulated — no browser API | BLE scan, counts only |

Anything the browser blocks falls back to the simulator and is labelled **SIM** in the UI.
Nothing is ever presented as live unless it actually is.

**Try it:** cover the camera with your thumb and watch the light reading and the route
scores drop. Clap three times near the phone to trigger a pack detection.

## Privacy

- No audio or image ever leaves the device. The camera frame is shrunk to 48×36, averaged
  into a single brightness number, and discarded.
- No area, lane or neighbourhood is ever scored, labelled or made browsable on its own.
- No persistent or queryable ranking of any segment is built or stored — only rolling,
  time-decayed values, discarded after two hours.
- Other members appear as anonymous counts and approximate areas, never exact positions.
- No gender is inferred from any sensor.

## Demo honesty

Guardians, SOS activation, location sharing and identity verification are **interface
states only** in this build. No SMS is sent, no emergency service is contacted, and
nothing is recorded. Every one of those screens says so on screen.

## Project structure

```
index.html          markup shell — loads the stylesheet and the six scripts in order
css/style.css       design tokens (light + dark), layout, components
js/icons.js         inline SVG icon set and small DOM helpers
js/data.js          mock data, application state, constants
js/sensors.js       live device sensors, sunrise/sunset maths, localStorage persistence
js/map.js           the hand-drawn street map (Connaught Place geometry)
js/ui.js            navigation shell and every screen
js/app.js           render loop, event delegation, journey/audit flows, boot
```

Scripts are plain classic scripts, not ES modules, so **load order matters** — each file
uses globals declared by the ones above it.

## Tech

Vanilla HTML, CSS and JavaScript. No framework, no build step, no dependencies.
Web Audio API, Battery Status API, Geolocation, `getUserMedia`, Canvas, `localStorage`.
The street map is hand-drawn SVG — Connaught Place's real radial geometry, no tile provider
and no API key.

## Run locally

Media capture needs a secure context, so **opening `index.html` directly from disk will not
work** — the camera and microphone will silently stay simulated. Serve it instead:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

`localhost` counts as a secure context, so everything works.

## Deploy

**Vercel** — drag this folder onto [vercel.com/drop](https://vercel.com/drop), or:

```bash
npm i -g vercel
vercel --prod
```

**GitHub Pages** — push this repo with `index.html` at the root, then in
**Settings → Pages** set the source to your default branch and `/ (root)`. Pages serves
over HTTPS, so the sensors work there too.

## Status

Frontend MVP. State persists in `localStorage`; there is no backend, no real routing engine
and no live safety dataset yet. The data layer is structured so those can be swapped in
without touching the UI.

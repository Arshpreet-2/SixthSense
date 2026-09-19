# SixthSense — web app (Round 3 build)

Your existing app with the new features built into the same screens.
Same structure as the repo: `index.html`, `css/`, `js/`, plus a new `data/` folder and `sw.js`.

## Run it locally

```bash
cd sixthsense-web
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works. Opening `index.html` with `file://` will not work, because the app loads JSON files.

## Put it in the repo

| Path | Change |
|---|---|
| `index.html` | replaced (adds the engine script tags) |
| `css/style.css` | replaced (new styles appended at the end) |
| `js/data.js` | replaced (state and sample data) |
| `js/sensors.js` | replaced (bridge to the engine, same `LIVE` object) |
| `js/map.js` | replaced (real map instead of the drawn Connaught Place map) |
| `js/ui.js` | replaced (screens) |
| `js/app.js` | replaced (actions and flows) |
| `js/icons.js` | unchanged |
| `js/engine/` | **new** — the engine |
| `data/` | **new** — map, light, help points, sample data |
| `sw.js` | **new** — offline caching |

Push to a branch first: Vercel gives a preview URL and the current demo on `main` stays as it is.

## Screens

1. **Log in** — email sign-in link (an `@igdtuw.ac.in` address also verifies as Gold), Google, demo account, or create an account.
2. **Home** — agent card, Safe Travel, Audit, SOS, Help Center, Ask Angels / My Guardians / My Halo.
3. **Safe Travel** — place search, learned travel-mode suggestion, "Compare routes".
4. **Choose your route** — walk / auto / metro combinations as legs, reasons, six-sense bars, compare view, "How we compare routes".
5. **Journey** — battery plan, low-signal warnings, "Are you okay?", escalation, guardian messages, demo walk, trip summary.
6. **SOS** — 112 and 1091, SMS with location, Voice and Camera Guardian, help QR, nearest real help points.
7. **Audit** — your form with the place, your tier, Confirmed / Pending status and a dispute check.
8. **Connect (Angels)** — Ask Angels, Need an Angel, Walk Together, Angel Circles, Be an Angel, Halo and badges.
9. **Profile** — verification and tier, Guardians, Halo, What SixthSense learned, Settings.

Demo shortcuts: add `#journey`, `#routes`, `#audit`, `#verify` or `#angels` to the URL to open that part directly.

## Real vs simulated

**Real:** OpenStreetMap routes, streets and help points; OSM `lit` tags and NASA VIIRS night lights; DMRC and Delhi auto fares; phone battery, network, GPS, motion, camera light and the YamNet sound model; agent decisions, scoring, preference model, audit rules, halo and reputation maths.

**Simulated and labelled in the app:** street readings by other members in the IGDTUW pilot (3 km); Angel answers and matches; low-signal stretches; the face match in verification; the demo walk's movement.

**Live on Firebase** (project `sixthsense-b8fcd`, free Spark plan, Mumbai region): email sign-in link and Google sign-in; accounts, tier, reputation and halo in Firestore; **audits and Ask Angels shared between phones in real time**; security rules enforce the trust design (nobody can raise her own tier or points; only Gold/Partner/Verified-women accounts can answer Ask Angels).

**Still waiting on the paid plan:** phone OTP sign-in and push notifications to Angels whose app is closed.

## Browser notes

- The web app can only **open** the SMS app and the dialler; the Android app sends directly.
- Signal strength in the browser is an estimate from the connection type; the Android app reads real dBm.
- Microphone, camera and location are asked for only when a feature needs them.
- Nothing is uploaded: audio becomes one number per second, camera frames one brightness number, and both are discarded.

## Known limits

- Metro times are estimated until DMRC timetable data (Delhi Open Transit Data) is added.
- The bundled street map covers the IGDTUW pilot area; elsewhere routes are drawn on a plain background.
- Public routing and search servers have rate limits; the app falls back to saved data.


## Testing the backend with the team

Firebase allows `localhost` and the domains listed under Authentication → Settings →
Authorized domains. Add any new preview domain there before testing on it.

Two-phone test (the one worth showing judges):

1. Phone A signs in with an `@igdtuw.ac.in` address (becomes Gold),
   Connect → Be an Angel → Available.
2. Phone B signs in with any email, Connect → Ask Angels → pick a place → Ask.
3. Phone A sees "1 question near you" → answers with taps.
4. Phone B sees the Angel Pulse appear, with the tier and halo of the answer.
5. Phone A submits an audit; Phone B's route comparison now uses it.

Sign-in link note: open the emailed link on the same phone and in the same browser that
requested it.

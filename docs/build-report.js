// SixthSense Project Design Report generator.
// Update the content below when the design changes, bump VERSION, add a CHANGELOG row, then run:
//   node docs/build-report.js
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, Footer, Header, PageNumber, PageBreak,
} = require('docx');

const VERSION = '1.6';
const DATE = '17 September 2026';
const OUT = process.argv[2] || `SixthSense_Project_Report_v${VERSION}.docx`;

const CHANGELOG = [
  ['1.0', DATE, 'First full design report: agent, six-sense scoring rules (v1.1 spec), explainable AI, Round 2 offline design, preference learning, light layer, Android wrapper, backend plan, PPT alignment.'],
  ['1.1', DATE, 'Added Section 14: authentication, contributor tiers, photo ID + live selfie match, asymmetric confirmation (positive claims need women-verified or sensor proof), disputes, reputation and rewards, anti-abuse. Updated scoring trust weights (7.2, 7.3), backend, privacy, limitations and build plan.'],
  ['1.2', DATE, 'Combined confirmation rule: unconfirmed negative claims used at reduced weight (as in the original report), positive claims must be confirmed. Section 14 linked to the original report (Sections 5 and 7). Web3 layer (soulbound credential, Merkle anchoring on Polygon Amoy) moved to a future version; new Section 22 on future versions.'],
  ['1.3', DATE, 'Added Section 15: Guardians community (verified women helpers) with Ask Guardians (live information about a place) and Guardian Angel (a nearby guardian stays with her). Clarified names: SixthSense Agent = on-phone AI; Guardians = people. Agent settings moved to Profile. Reputation now includes guardian feedback and accuracy checks. Later sections renumbered.'],
  ['1.4', DATE, 'Renamed the community feature to Angels (Connect tab): Ask Angels, Angel Nearby, new Walk Together, Angel Circles, halo levels, badges and thank-you hearts (Section 15). Added Section 16: Guardians = family journey sharing with SMS, Voice and Camera modes linked to agent events. Later sections renumbered.'],
  ['1.5', DATE, 'Added multi-mode journeys (7.8): legs such as auto → metro → walk, per-leg safety comparison, weakest-leg fixes, fares and departures, using Delhi Open Transit Data (DMRC and DTC GTFS). Backend (17): sign-in methods and plan limits (phone OTP and Cloud Functions need the paid Blaze plan), free-plan approach for the finale.'],
  ['1.6', DATE, 'Backend live on Firebase (project sixthsense-b8fcd, free plan, Mumbai): email-link and Google sign-in, accounts and tiers, audits and Ask Angels shared between phones, security rules enforcing the trust design. Section 9.2 rewritten as a trigger table with what she sees. Section 17 and 24.1 state what data lives where (Firebase, on-chain, phone). Section 23 adds the finale-day freeze plan. Features merged into the team interface: login screen, real map, street-light layer, six-sense bars, multi-mode journeys, Guardians and Angels.'],
];

/* ------------------------------------------------------------------ style */
const C = { ink: '2A1F1A', accent: 'B8741A', soft: 'F6EBDD', line: 'D9C7B3', mute: '6B5B50' };
const W = 9026; // A4 content width in DXA (1-inch margins)
const FONT = 'Calibri';

function runs(text) {
  // **bold** inline markup
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t =>
    t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun(t));
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 120, line: 300 }, ...opts });
const TITLES = [];
const H1 = t => (TITLES.push(t), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true }));
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (text, level = 0) => new Paragraph({ children: runs(text), numbering: { reference: 'bullets', level }, spacing: { after: 60, line: 280 } });
const N = (text, ref = 'steps') => new Paragraph({ children: runs(text), numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 280 } });
const Note = text => new Paragraph({
  children: runs(text), spacing: { before: 60, after: 160, line: 280 },
  shading: { type: ShadingType.CLEAR, fill: C.soft, color: 'auto' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 6 } },
  indent: { left: 120, right: 120 },
});

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = W / total;
  const w = widths.map(x => Math.round(x * scale));
  w[w.length - 1] += W - w.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, head) => new TableCell({
    width: { size: w[i], type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, fill: C.soft, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: String(text).split('\n').map(line => new Paragraph({
      children: head ? [new TextRun({ text: line, bold: true })] : runs(line), spacing: { after: 20, line: 260 } })),
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 80 } });

/* ---------------------------------------------------------------- content */
const S = []; // body
const add = (...x) => S.push(...x);

// 1 Summary
add(H1('1. Summary'),
  P('**SixthSense** is a women-safety travel companion for the SheVibes hackathon (AssetMerkle, IGDTUW), **Track 2: AI/ML for Context-Aware Women\'s Travel Recommendations**. It compares walking and travel routes using live phone sensing and on-device machine learning, and it keeps helping when battery and signal fail.'),
  P('**USP in one line:** an AI agent on the phone sees trouble coming (low battery, lost signal, unusual situations) and prepares or acts before it happens, even with no internet.'),
  P('This report is the single reference for the design: what the system does, every scoring and decision rule, the data sources, privacy rules, and the status of each feature. It is updated whenever the design changes (see Document control).'),
  table(['Area', 'Summary'], [
    ['Pilot area', 'IGDTUW, Kashmere Gate, Delhi (routes, place search, map and satellite light work for any city)'],
    ['Platform', 'Web app (PWA) plus Android app built from the same code with Capacitor'],
    ['On-device ML', 'YamNet sound model (street activity, dog packs), battery forecast, movement detection, preference decision tree, route confidence'],
    ['Core rule', 'Routes are compared, never labelled safe or unsafe; every result states its confidence and data age'],
    ['Data', 'Real maps, routes, light tags, satellite light and help points; other users\' readings simulated for the pilot and labelled'],
  ], [2, 6]),
);

// 2 Problem and brief
add(H1('2. Problem and brief'),
  P('Navigation apps optimise time, distance and cost. For a woman travelling after dark, the right route also depends on lighting, people around, transport, open places and recent conditions, which change hour to hour. Street-level data of this kind barely exists, and collecting it manually puts women in the very lanes they want to leave.'),
  H2('2.1 Hackathon requirements (Track 2)'),
  table(['Round', 'Requirement (organiser wording, summarised)', 'How SixthSense meets it'], [
    ['Round 1: Beyond the Fastest Route', 'Compare routes with context (lighting, transport, accessibility, open spaces, recent reports) and uncertainty; no promise of complete safety, no live-location exposure, no surveillance, no unfair judging of areas', 'Six-sense route comparison with confidence; explainable "why"; no area labels or stored rankings; audio and images never leave the phone'],
    ['Round 2: 5% Battery. No Internet.', 'Low-connectivity mode: offline directions, essential help points, low-power design, one compact check-in', 'Offline pack, battery forecast with early power saving, network diagnosis, SMS check-in with deadline, last message, landmark directions, help QR'],
    ['Round 3: Offline finale', '8-hour build/refine round; organiser asked for real backend, database and auth, real AI/ML (not only prompts), a USP, and a less generic UI', 'Firebase backend (planned), on-device ML, agent USP, warm UI palette'],
  ], [2, 3.2, 3.6]),
  Note('Confirm with the organisers whether coding is allowed during the finale; one FAQ on the event site says no coding on finale day.'),
);

// 3 USP
add(H1('3. USP and positioning'),
  P('**Pitch line:** "Other apps wait for her to ask for help. SixthSense sees it coming, prepares before the battery or signal dies, and gives just the right help, even offline."'),
  H2('3.1 The three parts of the USP'),
  N('**It predicts, not just reacts:** battery shortfall, signal loss ahead, and unusual movement.', 'usp'),
  N('**It gives the right level of help ("Uncomfortable ≠ Emergency"):** check-ins and "Stay with me" before alerts and 112.', 'usp'),
  N('**It keeps working offline:** the brain is on the phone; SMS, saved routes, help points and landmark directions replace online services.', 'usp'),
  H2('3.2 How it differs'),
  table(['Other safety apps', 'SixthSense'], [
    ['She must press SOS', 'The agent notices and asks first'],
    ['One level: emergency', 'Graded help, from "Stay with me" to 112'],
    ['Need internet', 'Work offline, switching to SMS and saved data'],
    ['Die with the phone', 'Prepare before the battery dies'],
    ['Same for everyone', 'Learn her habits from past trips'],
    ['Chatbot-style AI', 'Small on-device ML: sound, battery, movement, preferences'],
  ], [1, 1]),
  H2('3.3 Compared with Safetipin'),
  P('Safetipin (Delhi) collects lighting and safety audits through its apps and has helped the Delhi government fix dark spots. SixthSense differs in being live and per-trip (sensed while walking, 2-hour expiry), comparing routes instead of scoring places, and adding an on-device agent that works offline.'),
);

// 4 Architecture
add(H1('4. System architecture'),
  table(['Layer', 'What it does', 'Where it runs'], [
    ['Phone sensors', 'Battery, network, GPS, motion, light, microphone; signal dBm in the Android app', 'Phone'],
    ['On-device ML', 'YamNet (sound), battery forecast, movement, preference tree', 'Phone'],
    ['Context and scoring', 'Routes, help points, light layer, six-sense scoring, confidence', 'Phone (data fetched online, cached)'],
    ['AI agent', 'Predict, ask, suggest or act, escalate; offline fallbacks', 'Phone'],
    ['Backend (planned)', 'Login, anonymous shared readings (2-hour expiry), dead-zone summaries, audits, "Stay with me" sessions, QR relay', 'Firebase'],
    ['App shell', 'Web app (PWA) and Android app (Capacitor) from one codebase', 'Browser / Android'],
    ['Web3 trust layer (future)', 'Soulbound verified-contributor credential; batched Merkle-root anchoring of confirmed contributions', 'Polygon (Amoy testnet first)'],
  ], [1.6, 4.4, 2]),
  H2('4.1 Code modules'),
  table(['File', 'Global', 'Role'], [
    ['js/native.js', 'Native', 'Detects Android app vs browser; real dBm, trip service, direct SMS in the app; fallbacks on the web'],
    ['js/sensors.js', 'SensorHub', 'Sensors, power modes, network diagnosis, logger, replay injection'],
    ['js/sound.js', 'SoundSense', 'YamNet: street activity and dog packs; clip evaluation'],
    ['js/light.js', 'Light', 'Light per route from phones, OSM tags, NASA night lights; daylight'],
    ['js/mockdata.js', 'MockSensing', 'Simulated readings for the IGDTUW pilot (labelled)'],
    ['js/preference.js', 'Prefs', 'Trip log, decision tree, fares, packing list'],
    ['js/context.js', 'Context', 'Routes, place search, help points, comparison, offline pack'],
    ['js/scoring.js (planned)', 'Scoring', 'Six-sense segment scoring and explanations (Section 7)'],
    ['js/agent.js', 'Agent', 'On-device agent, check-ins, escalation, SMS, demo replay'],
    ['android-native/', '-', 'Android plugins: SignalStrength, TripService, SafetySms'],
  ], [2, 1.4, 4.6]),
);

// 5 Sensing
add(H1('5. Sensing: the six senses'),
  P('Every signal comes from sensors a mid-range Android phone already has. Only numbers are kept; audio and camera frames are discarded immediately after processing.'),
  table(['Sense', 'Parameter', 'Sensor / source', 'Web app', 'Android app', 'Status'], [
    ['SEE', 'Light level', 'Camera brightness (0–255) or light sensor', 'Yes', 'Yes', 'Built'],
    ['SEE', 'Light from map and satellite', 'OSM lit tags and lamps; NASA VIIRS', 'Yes', 'Yes', 'Built'],
    ['SEE', 'Openness', 'GPS accuracy (m)', 'Yes', 'Yes', 'Planned (scoring)'],
    ['SEE', 'Visibility', 'Variation between light readings', 'Yes', 'Yes', 'Planned (scoring)'],
    ['HEAR', 'Sound level', 'Microphone level (dBFS, uncalibrated)', 'Yes', 'Yes', 'Built'],
    ['HEAR', 'Street activity', 'YamNet people and traffic classes', 'Yes', 'Yes', 'Built'],
    ['HEAR', 'Open shops', 'Light + activity at night; OSM shops', 'Yes', 'Yes', 'Planned (scoring)'],
    ['RUN', 'Movement', 'Accelerometer: still, walk, run, jolt', 'Yes', 'Yes', 'Built'],
    ['RUN', 'Footpath steadiness', 'Accelerometer variation while walking', 'Yes', 'Yes', 'Planned (scoring)'],
    ['RUN', 'Exit ease', 'Distance to help point / transport stop', 'Yes', 'Yes', 'Planned (scoring)'],
    ['CALL', 'Signal strength', 'dBm (RSRP) via Android; estimate on web', 'Estimate', 'Real', 'Built (app to test on phone)'],
    ['CALL', 'Network reason', 'Online checks and connection info', 'Yes', 'Yes', 'Built'],
    ['CALL', 'Help point nearby', 'OpenStreetMap', 'Yes', 'Yes', 'Built (used in scoring: planned)'],
    ['TRIBE', 'People around', 'Recent readings from other users', 'Yes', 'Yes', 'Planned (backend)'],
    ['TRIBE', 'Bluetooth device count', 'Bluetooth scan (no IDs)', 'No', 'Possible', 'Future'],
    ['GUT', 'Dog pack by sound', 'YamNet bark classes', 'Yes', 'Yes', 'Built'],
    ['GUT', 'Dog count by camera (day)', 'YOLOv8n', 'No', 'Possible', 'Future'],
    ['-', 'Battery level and drain', 'Battery API (Android Chrome) / Android', 'Android only', 'Yes', 'Built'],
  ], [0.8, 1.6, 2.4, 0.9, 0.9, 1.6]),
  H2('5.1 Power modes'),
  table(['Mode', 'GPS', 'Network check', 'Camera light', 'Sound model', 'Agent tick'], [
    ['Full', 'High accuracy, continuous', 'Every 30 s', 'On (every 5 s)', 'Every 0.5 s', '5 s'],
    ['Saving', 'Normal accuracy, continuous', 'Every 60 s', 'Off', '1 s sample per minute', '15 s'],
    ['Critical', 'Once a minute', 'Every 120 s', 'Off', 'Off', '30 s'],
  ], [1, 1.8, 1.3, 1.3, 1.6, 1]),
  H2('5.2 Movement rules'),
  B('Motion variation over 2 s (acceleration minus gravity): below 0.35 = still; below 3 = walking; otherwise running. A peak above 18 m/s² = sudden jolt.'),
  B('Thresholds are starting points and should be calibrated on real walks.'),
);

// 6 ML models
add(H1('6. On-device machine learning'),
  H2('6.1 Sound model (YamNet)'),
  table(['Item', 'Value'], [
    ['Model', 'Google YamNet (AudioSet, 521 classes), float32 TFLite, about 4 MB, via MediaPipe Tasks Audio'],
    ['Input', '1-second window, classified every 0.5 s in full mode'],
    ['People classes', 'Speech (0), child speech (1), footsteps (48), chatter (63), crowd (64), babble (65), children playing (66)'],
    ['Traffic classes', 'Vehicle (294), motor vehicle (300), car (301), horn (302), truck (310), bus (315), motorcycle (320), traffic noise (321)'],
    ['Dog classes', 'Dog (69), bark (70), yip (71), howl (72), bow-wow (73), growling (74), whimper (75); bark score uses 70, 71, 73'],
    ['Playback guard', 'If music (132), TV (518) or radio (519) > 0.6, bark and activity scores are halved'],
    ['Street activity', '0.65 × people score + 0.35 × traffic score, smoothed (newest frame weight 0.3)'],
    ['Dog pack rule', 'Bark ≥ 0.5 (to calibrate). Pack = 3 or more separate bark bursts within 10 s, or 4 consecutive positive frames. Held for 2 hours'],
    ['Privacy', 'Audio exists only in a 1-second rolling buffer, cleared after each check; nothing recorded or uploaded'],
    ['Evaluation', 'Built-in clip test gives precision and recall; planned run on public ESC-50 clips for the slides'],
  ], [2, 6]),
  H2('6.2 Battery forecast'),
  B('Least-squares slope of battery level over the last 15 minutes, using only samples from the current power mode, converted to a full-mode equivalent rate.'),
  B('Default drain until measured: full 0.45 %/min, saving 0.18 %/min, critical 0.07 %/min. Other modes are scaled by these ratios.'),
  B('Minutes left in a mode = (battery − 1) ÷ drain rate in that mode.'),
  H2('6.3 Movement model'),
  P('Rule-based classifier on accelerometer variation (Section 5.2), with the agent tracking how long she has been still or running.'),
  H2('6.4 Preference model'),
  P('A decision tree (CART, Gini) trained on the phone from her own trip summaries. Details in Section 11.'),
  H2('6.5 Route confidence'),
  P('Confidence grows with the number and freshness of readings: 1 − e^(−W/3), where W is the sum of reading weights (Section 7).'),
);

// 7 Scoring
add(H1('7. Route comparison and six-sense scoring'),
  Note('Status: **specification approved, being built (v1.1)**. The current build (v1.0) compares routes on activity, light and dog reports only. The existing app\'s "92/84/71" scores are fixed demo values and will be removed.'),
  H2('7.1 Principles'),
  B('Routes are **compared**, never labelled safe or unsafe. Internal scores are never shown as numbers.'),
  B('Scores are calculated only when she compares routes; **no ranking of streets or areas is stored**, even on the server.'),
  B('**Missing data is never treated as safe:** it is left out, the score is rescaled, and confidence drops.'),
  B('Every result shows **why**, **how sure**, and **how old** the data is.'),
  H2('7.2 Segments and readings'),
  B('Each route is split into **50 m segments** (the original report proposed 10 m; phone GPS error of 5–15 m makes 10 m unreliable).'),
  B('A reading belongs to a segment if it is within **60 m** of it and **less than 2 hours old**.'),
  B('Reading weight = **0.5^(age ÷ 45 min)** × **effective trust** (Section 14): tier weight × reputation. Her own phone counts 1.0; simulated pilot data 1.0 (labelled).'),
  B('**Positive** readings (more light, more activity, open shops) count only when confirmed by women-verified contributors or sensor data; **negative** readings count while pending at reduced weight (Section 14.4).'),
  H2('7.3 Points and rules (100 points per segment)'),
  table(['Sense (points)', 'Parameter (points)', 'Full', 'Half', 'Zero', 'Source'], [
    ['SEE (25)', 'Light (15)', 'Level ≥ 90 (well lit), or daylight', '40–89 (some light)', '< 40 (dark)', 'Phones, else OSM tags/lamps, else satellite'],
    ['SEE', 'Openness (5)', 'Median GPS accuracy ≤ 10 m', '10–30 m', '> 30 m', 'Phones'],
    ['SEE', 'Visibility (5)', 'Light variation < 20, or daylight', '20–50', '> 50 (patchy)', 'Phones'],
    ['HEAR (20)', 'Sound level (10)', '> −30 dBFS', '−50 to −30 dBFS', '< −50 dBFS', 'Phones (calibrate per device)'],
    ['HEAR', 'Activity (5)', 'YamNet activity ≥ 0.5', '0.2–0.5', '< 0.2', 'Phones'],
    ['HEAR', 'Open shops (5)', 'OSM shop/help point open now within 50 m, or night light ≥ 40 with activity ≥ 0.5', 'Shop within 50 m, hours unknown', 'None', 'OSM + phones'],
    ['RUN (20)', 'Footpath steadiness (10)', 'Median walking variation ≤ 1.5', '1.5–2.5', '> 2.5 (uneven)', 'Phones (walking readings only)'],
    ['RUN', 'Exit ease (10)', 'Help point, metro or bus stop ≤ 100 m', '100–250 m', '> 250 m', 'OSM'],
    ['CALL (15)', 'Signal (10)', '≥ −95 dBm, or estimated level 3–4', '−95 to −105 dBm, or level 2', '< −105 dBm, level 0–1, or known dead zone', 'Android dBm, web estimate, dead-zone data'],
    ['CALL', 'Help point (5)', 'Police, hospital, metro, fuel or pharmacy ≤ 200 m', 'Other shop ≤ 200 m', 'None', 'OSM'],
    ['TRIBE (10)', 'People around (10)', '≥ 3 confirmed contributors (effective trust) in last 15 min, or Bluetooth > 8', '1–2 contributors, or Bluetooth 3–8', 'Bluetooth < 3', 'Backend readings; Bluetooth (future). No contributors = no data'],
    ['GUT (10)', 'Dog pack (10)', 'Readings present, no pack reported', 'Pack weight 0.2–0.5', 'Pack weight ≥ 0.5', 'YamNet (YOLOv8n by day: future)'],
  ], [1.1, 1.4, 1.8, 1.4, 1.4, 1.9]),
  P('Full = 100% of the parameter\'s points, half = 50%, zero = 0%. Values between thresholds use the band they fall in.'),
  H2('7.4 Segment score and confidence'),
  B('**Segment score** = 100 × Σ(points × sub-score) ÷ Σ(points of parameters that have data).'),
  B('**Coverage** = Σ(points with data) ÷ 100.'),
  B('**Segment confidence** = coverage × (1 − e^(−W/3)), where W is the total reading weight. Map and satellite data alone give at most "low".'),
  H2('7.5 Route result'),
  B('**Route value** = length-weighted average of segment scores (segments with no data excluded).'),
  B('**Route coverage** = share of the route with any data.'),
  B('**Weakest stretch** = longest run of consecutive segments scoring below 50; reported with length and main causes (e.g. "200 m dark, weak signal").'),
  B('**Route confidence** = average segment confidence × route coverage. High ≥ 0.7, medium ≥ 0.35, otherwise low.'),
  B('**Time:** 1 point is subtracted per extra minute compared with the fastest route (default; later tuned by her preferences).'),
  H2('7.6 Choosing what to say'),
  N('Compare adjusted values (value − time penalty) of routes with at least medium confidence.', 'choose'),
  N('If the best route leads by 5 points or more, name it: "Route B had more light and people recently…".', 'choose'),
  N('If the lead is under 5 points: "Routes are similar; choose by time or preference."', 'choose'),
  N('If no route has medium confidence: "Not enough recent information to compare these routes. Your own judgement comes first."', 'choose'),
  N('Any weakest stretch of 100 m or more scoring below 30 is always mentioned, even on the leading route.', 'choose'),
  H2('7.7 Special cases'),
  B('**Daylight:** light and visibility score full; the card says "Daylight".'),
  B('**Offline:** the comparison uses saved readings and says "Offline: based on saved readings from X min ago".'),
  B('**Outside the pilot area:** no simulated readings; the comparison relies on map and satellite data and says there are no phone readings yet.'),
  H2('7.8 Multi-mode journeys'),
  P('A journey is split into **legs** (for example auto → metro → walk), shown like a public-transport planner, and **each leg is compared** so the weakest part is visible.'),
  P('Example: "🛺 4 min > Metro (Violet Line) > 🚶 7 min · 41 min · Rs. 73 · Leave by 6:46 pm, next trains 6:53, 6:56 · Auto leg busy; last 7-minute walk has a 200 m dark stretch · Suggestion: take an auto for the last leg (+Rs. 40, same time)."'),
  table(['Item', 'Design'], [
    ['Options generated', 'Walk only; auto only; walk/auto → metro → walk/auto; bus combinations (later)'],
    ['First and last legs', 'Mode chosen from her learned preferences (e.g. walk if short and in daylight, auto after dark), with alternatives shown'],
    ['Walk legs', 'Full six-sense scoring (Sections 7.2–7.5)'],
    ['Auto legs', 'Scored mainly on pickup and drop points and expected waiting time (light, people, nearby auto stand), since most of the leg is inside the vehicle'],
    ['Metro leg', 'Station context: exit used, walk from exit, last-train time, service alerts; exits compared where a station has several'],
    ['Weakest leg', 'Flagged with a fix: swap mode for that leg, use a different exit, or leave earlier'],
    ['Journey result', 'Legs combined by time spent in each; the weakest leg is always named; confidence as in 7.5'],
    ['Also shown', 'Fare per leg and total (Section 11.2), "Leave by", next departures, alerts (e.g. strike)'],
    ['Alerts', 'No open feed for strikes or closures; confirmed reports from Angels and Circles are used'],
  ], [2, 6]),
  B('Data: Delhi Open Transit Data portal (otd.delhi.gov.in) publishes DMRC metro static data (stations, routes, timetables; last updated August 2023, to be checked against the current network) and DTC bus data including real-time positions (API key on request); walk and auto legs use OpenStreetMap routing.'),
  B('Status: Planned.'),
);

// 8 Explainable AI
add(H1('8. Explainable AI'),
  P('Explainable AI means the app shows **why** it reached a result. Two parts deliver this: the route cards (the rules applied to her trip) and the "How we compare routes" panel (the rules themselves).'),
  H2('8.1 Route card'),
  table(['Element', 'Content'], [
    ['Summary line', 'Plain comparison, e.g. "Route B had more light and people recently and signal throughout. Route A is 4 min faster but has a 200 m dark stretch with no signal. Confidence: medium."'],
    ['"Why" list', 'Up to three positives (✔) and three negatives (✖) with the largest effect, plus data freshness and time difference'],
    ['Six-sense bars', 'SEE, HEAR, RUN, CALL, TRIBE, GUT as bars with word labels; grey striped = no data; collapsed by default ("See the six senses")'],
    ['Segment strip', 'The route as 50 m cells coloured by segment result; tapping a cell shows what affected it'],
    ['Light line', 'Light summary with sources (phones, map tags, satellite, no data)'],
  ], [1.6, 6.4]),
  H2('8.2 Compare toggle'),
  P('A switch on the Routes screen. Off: one card per route, stacked. On: both routes\' bars on the same rows for each sense, with time underneath, so differences are visible at a glance.'),
  H2('8.3 "How we compare routes" panel'),
  P('One screen, opened from a link under the routes, that explains the method: the six senses and points, data sources (and which are simulated), the 2-hour and missing-data rules, what confidence means, and what the app never does (no safe/unsafe labels, no area rankings, no audio or photos stored). It is the one-screen proof of explainability for users and judges.'),
  H2('8.4 Wording rules'),
  B('Never use "safe", "unsafe", "dangerous" or scores out of 100 in the interface.'),
  B('Colour is never the only signal: every bar and cell has a word label.'),
  B('Simulated data is always marked "simulated" or "SIM".'),
);

// 9 Agent
add(H1('9. The AI agent'),
  P('**Name:** SixthSense Agent (software). **Guardians** are her family (Section 16); **Angels** are the community (Section 15).'),
  P('**Definition:** one assistant on the phone that runs throughout a trip, watches the sensors, predicts problems, and either **suggests** (she decides) or **acts** (only when safe to). Loop: observe → predict → ask → decide → act → monitor. No cloud AI; it works the same online and offline.'),
  H2('9.1 When it suggests and when it acts'),
  table(['Suggests (she decides)', 'Acts by itself'], [
    ['Which route; where to go; whom to tell; charging spot; sending a check-in', 'When nothing is lost (power saving, saving the offline pack, preparing a message); when time is running out (last message at 4%); when she does not answer two check-ins'],
  ], [1, 1]),
  H2('9.2 Triggers: what starts the agent, what it does, what she sees'),
  P('Every action below is started by a measured value, not by a guess. Nothing needs her to open the app.'),
  table(['Trigger (measured)', 'Rule', 'What the agent does', 'What she sees'], [
    ['Battery vs trip', 'Forecast battery < 1.3 x remaining trip minutes; or level <= 15% (saving), <= 8% (critical)', 'Switches power mode by itself; camera off, sound checked once a minute', '"Power saving on" card with the numbers behind it'],
    ['Battery almost gone', 'Level <= 4%', 'Prepares (web) or sends (app) a last message with location, destination and ETA to all guardians', '"Phone is about to switch off" with the message ready and landmark directions'],
    ['Network', 'Diagnosis is not ok or weak (6 causes checked)', 'Switches messages to SMS; queues anything waiting; sends them on recovery', '"Mobile data is not working" with the cause and what still works'],
    ['Low-signal stretch ahead', 'Known low-signal area within 350 m on the route', 'Refreshes the offline pack; prepares a check-in message with a deadline', '"Signal usually drops 339 m ahead" with a Send check-in button'],
    ['Long stop', 'Still for more than 150 s on foot (480 s in a vehicle); cool-down 5 min', 'Asks her', '"Are you okay?" with four answers'],
    ['Sudden run', 'Running for more than 6 s on foot', 'Asks her', 'Same check-in, reason: "You started running"'],
    ['Jolt', 'Sharp movement within the last 8 s', 'Asks her', 'Same check-in, reason: "That felt like a jolt"'],
    ['No answer to a check-in', '30 s, then 20 s more', 'Raises to level 2 and prepares the alert; in the Android app sends it', '"Tell your contact now" with the alert and a help QR'],
    ['She answers Uneasy / Worried / Danger', 'Her own answer', 'Level 1, 2 or 3: more frequent checks, help points, alert, or call 112', 'Graded help card (Section 9.3)'],
    ['Off route', 'More than 60 m off the route for 30 s', 'Offers to replan from where she is', '"Off the planned route" with a Replan button'],
    ['Arrival', 'Within 60 m of the destination', 'Ends the trip and learns from it', '"Reached ..." with a Send "reached" button and Audit this route'],
    ['Trip running (Android app)', 'Every 60 s while a trip is on', 'Keeps a foreground service alive so tracking survives the screen going off', 'Notification with minutes left and battery'],
    ['Dog pack heard', 'YamNet dog score above the threshold, repeated', 'Adds it to route comparisons for 2 hours', 'Alert on Home; the GUT bar drops on affected routes'],
  ], [1.9, 2.4, 2.1, 1.6]),
  P('**Her settings decide what runs by itself** (Profile → Settings): automatic power saving, check-ins, low-signal preparation, and alerts when she cannot respond.'),
  H2('9.3 Graded help ("Uncomfortable ≠ Emergency")'),
  table(['Level', 'Her state', 'Agent response'], [
    ['0', 'Fine', 'Keeps watching quietly'],
    ['1', 'Uneasy', 'Checks every 2 min; shows nearest staffed help point; offers "tell my contact", "Stay with me" (a friend) or Angel Nearby (planned)'],
    ['2', 'Worried, or no answer to two check-ins (30 s then 20 s)', 'Alert with location ready (sent automatically in the app if unanswered); guides to help point; help QR; "Stay with me" or Angel Nearby if no friend responds (planned); Voice Guardian call (Section 16)'],
    ['3', 'Danger, or level 2 unacknowledged for 60 s', 'Call 112 / 1091 buttons; alert all contacts (automatic in the app if unanswered); help QR'],
  ], [0.6, 2.4, 5]),
  P('Help points prefer staffed places (police, hospital, metro, clinic) within 400 m; otherwise pharmacies, shops and fuel stations.'),
  H2('9.4 SMS templates (fit in 160 characters where possible)'),
  table(['Type', 'Text'], [
    ['Check-in', '"[Name] OK HH:MM. Low-signal stretch ahead, out by HH:MM. Call if no msg by HH:MM." + map link'],
    ['Uneasy', '"[Name]: feeling uneasy, HH:MM. Please stay reachable." + map link'],
    ['Alert', '"[Name] NEEDS HELP HH:MM. Please call now." + map link'],
    ['Last message', '"[Name]: phone dying HH:MM. Going to [destination], ETA HH:MM. Call at HH:MM if no msg." + map link'],
    ['Back / reached', '"[Name]: back in network HH:MM, all fine." / "[Name]: reached [destination] HH:MM."'],
  ], [1.4, 6.6]),
  H2('9.5 "Stay with me" (planned)'),
  B('Triggered from level 1 (offered) or level 2 (started); she picks a friend who has the app.'),
  B('Backend session expires after 60 minutes; the friend must accept; both see each other\'s location, distance and ETA, plus quick messages ("I\'m here", "Call me", "Coming", "Reached").'),
  B('Ends automatically on arrival or by either person; location points are deleted when it ends.'),
  B('If her signal drops, the friend sees "last seen X min ago" and the agent\'s dead-zone note; the agent falls back to SMS.'),
  H2('9.6 Demo walk (replay mode)'),
  P('Plays a scripted walk along the real planned route at 20× speed: leaves college (battery 24%), dog pack heard, battery falling, low-signal stretch (−114 dBm), a stop of over 3 minutes, signal back, battery 4%, arrival. All values are marked SIM.'),
);

// 10 Round 2
add(H1('10. Round 2: low battery and no internet'),
  H2('10.1 Offline pack (saved when a trip starts or before a dead zone)'),
  B('2–3 routes with turn-by-turn steps; help points with hours and phone numbers; contacts; recent readings; landmark directions; fares.'),
  B('App files and the sound model are cached (service worker on the web, bundled in the Android app).'),
  H2('10.2 Network diagnosis'),
  table(['Diagnosis', 'How detected', 'Message and fix'], [
    ['Offline', 'Browser reports offline', 'No network: check airplane mode and mobile data, or low-signal spot'],
    ['Wi-Fi without internet', 'Online, check fails, connection type Wi-Fi', 'Turn off Wi-Fi to use mobile data'],
    ['Wi-Fi login page', 'Check returns an unexpected page on Wi-Fi', 'Log in or turn Wi-Fi off'],
    ['Data may be finished', 'Unexpected page on mobile data (operator page)', 'Calls and SMS still work; ask a friend to recharge'],
    ['Mobile data not working', 'Check fails on mobile data', 'Data finished, busy network or weak signal; SMS still works'],
    ['Weak', '2G estimate, round-trip time > 1.5 s, or real signal ≤ −105 dBm (app)', 'Messages go by SMS if needed'],
  ], [1.8, 3, 3.2]),
  P('The check requests a tiny file (ping.json) with a 3-second timeout, every 30/60/120 s depending on power mode.'),
  H2('10.3 Other offline features'),
  B('**Landmark directions:** up to five steps with distances ("Right after 540 m…"), always ending with arrival, for use if the phone dies.'),
  B('**Help QR (basic):** opens a WhatsApp message to her main contact on a helper\'s phone; the helper sees the number. **Relay version (planned):** encrypted link, server sends the message, number hidden, reply shown to the helper. **QR safety card (future):** works with a dead phone.'),
  B('**What still works without internet:** GPS, SMS, calls, 112 (any network), saved data. Android Emergency Location Service shares precise location with 112 where the state has integrated it (Uttar Pradesh first; Delhi to be confirmed).'),
  B('**Offline re-routing (planned):** recalculate from the saved map on the phone when she goes off route.'),
  B('**Signal (Android app):** real dBm feeds the dead-zone map; the website uses an estimate.'),
);

// 11 Preferences
add(H1('11. Personal preferences (learned automatically)'),
  P('No questions are asked. The agent learns from a one-line summary of each finished trip; no location trail is kept, and the data stays on her phone.'),
  table(['Recorded per trip', 'Detail'], [
    ['Distance, hour, dark or not', 'From route and clock'],
    ['Mode', 'Her choice at start; otherwise from speed: < 7 km/h walk, < 28 km/h auto, else cab; 3+ minutes underground (no GPS) = metro; confirmed with one tap'],
    ['Familiar route, battery at start, rain', 'Rain from weather when online'],
    ['Average speed', 'Used to learn her walking pace (median of walking trips)'],
  ], [2.4, 5.6]),
  H2('11.1 Model'),
  B('Decision tree (CART, Gini), maximum depth 4, minimum 6 trips to split, minimum 2 per leaf; retrains after every trip in about a second.'),
  B('Training weights: real trips 3, sample (mock) trips 1.'),
  B('Confidence = leaf share × n ÷ (n + 2), which shrinks confidence for leaves backed by few trips.'),
  B('Explanation: the tightest condition per feature on the path, e.g. "You usually choose auto when distance > 1.5 km, after dark".'),
  B('With no trips: "No trips yet. Suggestions become personal after a few trips."'),
  B('If battery < 15%, a cab suggestion becomes auto (booking needs internet).'),
  H2('11.2 Fares (approximate)'),
  table(['Mode', 'Rule'], [
    ['Metro', 'Distance slabs after the Aug 2025 DMRC revision: ≤2 km Rs. 11, ≤5 km Rs. 21, ≤12 km Rs. 32, ≤21 km Rs. 43, ≤32 km Rs. 54, above Rs. 64 (two slabs vary between sources; verify on the DMRC site)'],
    ['Auto', 'Rs. 30 for the first 1.5 km, then Rs. 11 per km; +25% between 11 pm and 5 am (Delhi Transport notification)'],
    ['Bus', 'About Rs. 10–25'],
    ['Cab', 'Check the app; prices vary with demand'],
    ['Walk / scooty', 'Free / fuel only'],
  ], [1.2, 6.8]),
  H2('11.3 Packing reminder'),
  P('Built from trip context: power bank if battery < 60%; licence, RC and insurance, PUC and helmet for scooty; metro card for metro; torch after dark; umbrella if rain; water and sunglasses on hot afternoons; glasses if in her profile; offline pack for a new area; ID, cash, QR safety card and two written numbers always. Items she marks "Forgot" rise to the top next time.'),
);

// 12 Light
add(H1('12. Light layer'),
  table(['Source', 'Confidence', 'Level used', 'Notes'], [
    ['Phone readings', '1 − e^(−W/2); used if ≥ 0.3', 'Weighted average of camera level (0–255)', 'Street level; simulated in the pilot'],
    ['OpenStreetMap', '0.5', 'Lamp within 30 m: 140; road tagged lit within 25 m: 150; tagged unlit: 20', 'Coverage varies: IGDTUW area 5 of 1,134 roads tagged; Bandra, Mumbai 274 of 1,697 (checked 17 Sept 2026)'],
    ['NASA VIIRS night lights', '0.2', 'Cell value ≥ 250: 100; ≥ 215: 70; else 40', 'About 500 m cells; median of recent nights, June–September skipped (monsoon cloud); central Delhi saturates'],
    ['None', '0', '-', '"No data"'],
  ], [1.6, 1.6, 2.6, 2.2]),
  B('Labels: level ≥ 90 well lit; ≥ 40 some light; otherwise dark.'),
  B('Dark = 20 minutes after sunset until 20 minutes before sunrise (NOAA-style calculation).'),
  B('Map and satellite data are fetched for the area around each route (300 m margin) and cached: map 30 days, satellite 180 days. IGDTUW data is bundled.'),
);

// 13 Data
add(H1('13. Data: real and simulated'),
  table(['Data', 'Status', 'Source'], [
    ['Roads and routes', 'Real', 'OpenStreetMap routing (routing.openstreetmap.de); road times × 2.2 traffic allowance (assumption)'],
    ['Place search', 'Real', 'Photon (OpenStreetMap data)'],
    ['Metro and bus timetables (planned)', 'Real', 'Delhi Open Transit Data: DMRC static GTFS (Aug 2023), DTC static and real-time GTFS'],
    ['Light tags, lamps, help points', 'Real', 'OpenStreetMap (Overpass; main OSM API as backup)'],
    ['Night lights', 'Real', 'NASA VIIRS via NASA GIBS'],
    ['Sunrise and sunset', 'Real', 'Calculated'],
    ['Fares', 'Real (approximate)', 'DMRC; Delhi Transport Department'],
    ['Her phone sensors and sound model', 'Real', 'On the device'],
    ['Other users\' readings', 'Simulated (IGDTUW, 3 km)', 'MockSensing: named spots, hour-of-day activity, stable per 10-minute window'],
    ['Dead zones', 'Simulated', 'data/deadzones.mock.json'],
    ['Trip history', 'Simulated sample (30 trips)', 'data/trips.mock.json'],
    ['Demo walk', 'Simulated', 'Replay script'],
  ], [2.2, 1.8, 4]),
  P('Once students use the app, their readings and trips replace the simulated data automatically. Live corridor walks are not planned before the finale.'),
);

// 14 Authentication and data trust
add(H1('14. Authentication, verification and data trust'),
  P('This section builds on the original project report (Section 5: verified-contributor credential; Section 7: readings weighted by verification tier; corroboration by a second verified traveller; no gender inference) and specifies how verification, confirmation and trust work in practice.'),
  P('**Threat addressed:** someone deliberately feeding false data, especially **positive** claims ("well lit", "busy") to lure women onto a dangerous route. The design ensures **no single account, even a fake one, can make a route look better on its own**.'),
  H2('14.1 Contributor tiers'),
  table(['Tier', 'Who', 'How verified', 'Weight', 'Can confirm positive claims'], [
    ['Gold', 'IGDTUW students', 'College ID photo + live selfie match + college email OTP', '100%', 'Yes'],
    ['Partner', 'Partner women\'s NGOs, campus security', 'Organisation account approved by the team', '100%', 'Yes'],
    ['Verified women', 'Women verified through an official document (e.g. DigiLocker, later)', 'Photo ID + live selfie match + phone OTP', '80%', 'Yes'],
    ['Verified others', 'Other verified users, including men', 'Photo ID + live selfie match + phone OTP', '40%', 'No (their positive claims stay pending)'],
    ['Basic', 'Phone OTP only', 'Phone number', '20%', 'No (always pending until confirmed)'],
    ['Not logged in', 'Anyone', 'None', '-', 'Cannot submit audits; readings not shared'],
  ], [1.1, 1.8, 2.4, 0.8, 1.9]),
  B('Gender and tier come only from **institution** (IGDTUW), **partner organisation**, or **official document**. **Gender is never inferred from a face**: face-based gender classification is error-prone (especially for darker skin tones), easy to fool, unfair to trans women and women who do not look "typical", and adds legal risk under the DPDP Act.'),
  B('Rationale for the positive-claim rule: a targeted protective measure against luring in a women-safety product (special provisions for women are permitted under Article 15(3)); policy and consent wording to be reviewed before any real launch.'),
  H2('14.2 Identity verification'),
  N('**Photograph the ID card:** name, institution and photo read on the phone (e.g. Tesseract.js).', 'idv'),
  N('**Live selfie with liveness step:** random instruction (blink, turn head) so a photo or video cannot be used.', 'idv'),
  N('**Face match on the phone** (e.g. face-api.js): selfie vs ID photo above a threshold passes; borderline cases go to manual review by the team.', 'idv'),
  N('**Gold tier:** plus OTP to an @igdtuw.ac.in email.', 'idv'),
  N('**Stored result only:** "verified, tier, date". ID and selfie images are deleted immediately after the check.', 'idv'),
  B('**No Aadhaar cards or numbers** are collected or stored.'),
  B('Face analysis is used **only to match** the selfie to the ID photo, never to classify people.'),
  H2('14.3 Preventing borrowed or shared IDs'),
  table(['Measure', 'What it stops'], [
    ['Live selfie matched to ID photo', 'Using another person\'s ID card'],
    ['Liveness check', 'Holding up a photo or playing a video'],
    ['College email OTP (Gold)', 'Using a photo of an ID without the owner\'s college account'],
    ['One ID = one account; one account per device', 'Reusing an ID for several accounts'],
    ['Device binding; re-check on a new phone', 'Moving a verified account to another device'],
    ['Random selfie re-checks before an audit is accepted', 'Handing a verified phone to someone else'],
    ['Owner can report misuse', 'Revokes the account and removes its data'],
  ], [3.2, 4.8]),
  H2('14.4 Data life cycle and confirmation'),
  P('Every report or shared reading moves through: **Submitted → Pending → Confirmed**, or **Pending → Disputed → Confirmed / Rejected**, or **expires after 2 hours**.'),
  P('**Combined rule** (original report\'s continuous trust weighting plus luring protection):'),
  B('**Negative claims** (darker, quieter, dog pack, weak signal) are used **while pending at reduced weight** (their effective trust), so a genuine warning is not lost; confirmation raises them to full weight.'),
  B('**Positive claims** (lit, busy, shops open, signal good) are **not used until confirmed**; they can never improve a route while pending.'),
  B('Disputed and rejected items are not used at all.'),
  table(['Claim type', 'Examples', 'Confirmed when', 'Risk if false'], [
    ['Positive', 'Well lit, busy, shops open, signal good', 'Total ≥ 100% from **independent women-verified contributors (Gold, Partner, Verified women)**, or matching **sensor readings** (camera light, YamNet activity)', 'High: could lure her onto a bad route'],
    ['Negative', 'Dark, quiet, dog pack, broken path, no signal', 'Total ≥ 100% from **any independent verified contributors**, or matching sensor readings', 'Low: at worst a detour'],
  ], [1, 2, 3.4, 1.6]),
  B('Gold and Partner reports confirm immediately (100%). Verified women (80%) need one more agreeing report or sensor agreement within 2 hours.'),
  B('**Sensors outweigh typed opinions:** a report that contradicts recent sensor readings (e.g. "well lit" where cameras read dark) is disputed automatically.'),
  B('**Presence check:** an audit counts only if the contributor\'s GPS was at the spot at that time.'),
  B('Disputed data never affects route comparisons; pending positive claims never do; pending negative claims count only at reduced weight.'),
  H2('14.5 Disputes'),
  N('Triggered by an opposite report or a "This is wrong" tap; the item is held back.', 'disp'),
  N('A quick check request ("Is the lane near X lit right now? Yes / No / Not sure") goes to **verified women who opted in as local checkers** for that area (rough area only, about 500 m; never an exact address) and to verified users currently nearby.', 'disp'),
  N('**Effective-trust majority decides**, with at least 3 answers or 200% total trust.', 'disp'),
  N('No decision within 2 hours: the item expires.', 'disp'),
  H2('14.6 Reputation, rewards and penalties'),
  B('**Reputation** = (confirmed + 2) ÷ (confirmed + rejected × k + 2), scaled to 0.5–1.2; k = 1 for false negative claims and **k = 2 for false positive claims**. New users start in the middle.'),
  B('**Effective trust = tier weight × reputation**; this is the trust used in scoring (Section 7).'),
  B('Reputation also includes **Angel feedback and reliability** (Section 15.7).'),
  table(['Event', 'Reputation', 'Reward points'], [
    ['Report confirmed', 'Up', 'Full points'],
    ['Answered a check request that matched the outcome', 'Up', 'Bonus points'],
    ['Report expired unconfirmed', 'No change', 'None'],
    ['Report rejected by the majority', 'Down (double for positive claims)', 'None'],
    ['3 rejections in 30 days', 'Falls sharply; all data held as pending', 'Account reviewed; suspension if repeated'],
  ], [3.2, 2.8, 2]),
  H2('14.7 Anti-abuse rules'),
  B('**Independence:** reports from the same device, network or group do not confirm each other; pairs that always confirm each other are flagged.'),
  B('**Luring pattern alert:** several positive claims for the same lane from new or low-trust accounts in a short time are frozen and the accounts reviewed.'),
  B('**Record integrity (this version):** changes to confirmed data are logged in the backend with who and when; tamper-evident blockchain anchoring is planned for a future version (Section 24).'),
  B('**Rate limits** on audits per hour; photos in audits have faces blurred on the phone before upload.'),
  B('**Honest limit:** a verified woman willingly helping someone, or advanced deepfakes against a browser liveness check, cannot be fully prevented; the asymmetric rule, independence and reputation limit the damage. Stronger liveness (commercial or native) is future work.'),
  H2('14.8 What she sees'),
  B('Route cards say "confirmed by verified women contributors", "based on phone sensors", or "unconfirmed warning" for pending negative claims; unconfirmed positive claims never appear.'),
  B('The "How we compare routes" panel explains tiers, confirmation and that positive claims need women-verified or sensor proof.'),
  B('Contributors see their tier, reputation and rewards in their profile.'),
);

// 15 Angels
add(H1('15. Angels: community help (Connect tab)'),
  P('**Angels** are verified women who opt in to help others. The feature lives in the **Connect** tab alongside the existing posts and chat. Names used in this report: **SixthSense Agent** = the AI on her phone (Section 9); **Guardians** = her family (Section 16); **Angels** = the community.'),
  H2('15.1 Who can be an Angel'),
  B('Gold, Partner or Verified-women tier (Section 14), reputation ≥ 0.9, and a short safety pledge.'),
  B('"Be an Angel" toggle with chosen hours and radius; off by default.'),
  B('The app knows only that an Angel is **in an area** (rough location), never her exact position, unless an Angel Nearby or Walk Together session starts.'),
  H2('15.2 Ask Angels (live pulse about a place)'),
  N('**She asks** from Safe Travel, a route card or Connect, e.g. "Going to Civil Lines Metro at 9:30 pm. How is it right now?"', 'askg'),
  N('**Angels within about 500 m** of that place receive it (widening to 1 km; otherwise "No Angels near there right now").', 'askg'),
  N('**Angels answer with quick taps** (about 10 seconds); their phone sensors (light, activity) are attached automatically.', 'askg'),
  N('**She sees an "Angel Pulse" card** with counts, answer age, a short note and confidence; never "safe" or "unsafe".', 'askg'),
  N('She can ask one follow-up, or request Angel Nearby.', 'askg'),
  table(['Question', 'Tap options'], [
    ['Lighting', 'Well lit / Some dark stretches / Dark'],
    ['People around', 'Busy / Some people / Empty'],
    ['Shops or stalls open', 'Many / Few / None'],
    ['Anything to watch out for', 'Nothing / Dogs / Men loitering / Road work / Other'],
    ['Short note (optional)', 'e.g. "Main gate side is busier than the back lane"'],
  ], [2.4, 5.6]),
  P('Example Angel Pulse: "3 Angels near Civil Lines Metro answered (2–6 min ago). Lighting: well lit (3 of 3). People: some people (2), busy (1). Watch out: dogs near back lane (1). Note: Use the main gate side. Confidence: high."'),
  B('Answers follow Section 14: weighted by tier × reputation; positive answers need agreement from 2+ Angels or matching sensors.'),
  B('Answers become anonymous community readings (2-hour expiry) and feed route comparisons, tagged "live from Angels".'),
  B('Angel identities are hidden in answers (tier, halo level and answer time only).'),
  H2('15.3 Angel Nearby (live help during a trip)'),
  N('**Request:** she taps "Need an Angel", or the agent offers it at Uneasy/Worried when no friend responds.', 'angel'),
  N('**Alert:** available Angels nearby receive the request with her **rough area only**.', 'angel'),
  N('**Consent both ways:** she sees the first Angel\'s first name, tier, halo level and distance, and must accept before exact locations are shared.', 'angel'),
  N('**Session:** both locations, distance and ETA, quick messages, and a suggested **public meeting point** (metro gate, police post, open shop).', 'angel'),
  N('**End:** on arrival, by either person, or after 60 minutes; sharing stops and positions are deleted.', 'angel'),
  N('**Feedback:** both rate each other; she can send a thank-you heart.', 'angel'),
  B('112 always remains available; Angels are extra help, not a replacement.'),
  H2('15.4 Walk Together'),
  P('Matches verified women **leaving the same place around the same time in a similar direction**, e.g. "2 Angels leaving IGDTUW gate towards Kashmere Gate Metro in the next 10 minutes. Walk together?"'),
  B('Match rule: start within 200 m, departure within 10 minutes, destinations in a similar direction (routes overlapping at least half the way).'),
  B('Both must accept; only first names and tiers are shown; they meet at a public point (college gate, metro entry).'),
  B('Group size up to 4; the session ends when paths split or on arrival; Guardians (family) are told "walking with a verified Angel" if she allows.'),
  H2('15.5 Angel Circles'),
  B('Groups for a campus, hostel or PG area (e.g. IGDTUW Circle, Civil Lines PGs), joined by verified women; existing Connect posts and chat live here.'),
  B('Uses: quick area updates ("Streetlight fixed near Gate 2"), questions, thank-you notes, Walk Together invites.'),
  B('Moderated: report button, removal of posts that name or target individuals or communities, no sharing of anyone\'s location.'),
  H2('15.6 Halo levels, badges and rewards'),
  table(['Element', 'Design'], [
    ['Halo points', 'Earned for helpful answers, confirmed audits, Angel Nearby sessions and Walk Together; weighted by accuracy'],
    ['Halo levels', 'Spark → Glow → Shine → Radiant, shown as a small halo on the profile'],
    ['Badges', 'Night Owl (helped after 9 pm), First Responder (answered within 1 minute), Lamp Lighter (lighting reports confirmed), Walk Buddy (5 walks together)'],
    ['Thank-you hearts', 'Heart and short note after help, shown on the Angel\'s profile'],
    ['Impact card', '"This month you helped 12 women and answered 30 questions."'],
    ['Circle highlights', 'Opt-in "Top Angels this week" within a circle, first names only'],
    ['Rewards', 'Existing rewards screen; partner perks as a future option'],
  ], [2, 6]),
  B('**Points follow accuracy, not volume:** answers found wrong earn nothing and lower reputation.'),
  B('**Daily caps** prevent point farming; no points for self-confirmations or repeated pairs.'),
  B('Leaderboards are opt-in and limited to a circle; no public map of people.'),
  H2('15.7 Reputation from Angel activity'),
  table(['Part', 'From', 'Effect'], [
    ['Data accuracy', 'Confirmed vs rejected reports (Section 14.6)', 'Trust in her data'],
    ['Answer accuracy', 'Her "helpful / not accurate" rating; automatic check when she later walks there and sensors agree or disagree', 'Trust and matching priority'],
    ['Session feedback', 'Ratings (1–5) and tags (arrived quickly, respectful, stayed until safe)', 'Matching priority; shown to seekers'],
    ['Reliability', 'Accepted and completed sessions, response time, no-shows', 'Matching priority'],
  ], [1.8, 4, 2.2]),
  B('Good feedback raises reputation; 1–2 stars or clear mismatches lower it; false positive answers are penalised double.'),
  B('A safety report against an Angel suspends her immediately pending review; seekers are rated too.'),
  H2('15.8 Where it appears'),
  table(['Place', 'Content'], [
    ['Connect tab', 'Angels header: Ask Angels, Need an Angel, Walk Together, my Circles, my Halo card; posts and chat below'],
    ['Safe Travel / Routes', '"Ask Angels near [destination]" on route cards; Angel Pulse shown in the "why" list; Walk Together suggestion at departure'],
    ['Agent', 'Suggests Ask Angels for a new area after dark; offers Angel Nearby at Uneasy/Worried'],
    ['Profile', 'Halo level, badges, hearts, reputation; "Be an Angel" settings; agent settings'],
  ], [2, 6]),
);

// 16 Guardians (family)
add(H1('16. Guardians: family journey sharing'),
  P('**Guardians** are people she chooses, typically parents or family, taken from her Emergency Contacts. The existing "Activate your Guardians" screen sets **how they are kept informed**. The agent does the watching; Guardians are who it reports to.'),
  H2('16.1 Guardian modes'),
  table(['Mode', 'What happens', 'When', 'Notes'], [
    ['SMS Guardian', 'Guardians receive agent updates by SMS: trip started, dead-zone check-in, "uneasy", no-response alert, last message at 4%, reached', 'Trips she chooses to share', 'Core mode; works without internet; sent directly in the Android app'],
    ['Voice Guardian', 'Automatic call to the first available guardian (speaker on) so they can hear and talk to her; optional 30-second audio clip sent only to guardians', 'Danger, or no response to check-ins', 'No continuous listening by anyone; the sound model analyses sound on the phone without recording'],
    ['Camera Guardian', 'A few photos (front and back camera) with location sent to guardians', 'SOS only', 'Encrypted; shared only with guardians; deleted after 30 days unless she keeps them; queued if offline'],
  ], [1.4, 3.4, 1.6, 1.6]),
  B('**Journey status:** during shared trips, guardians see "On route to PG, 8 min left, battery 20%, network OK" and her live location (in the app, if installed; otherwise SMS links). Sharing stops on arrival.'),
  H2('16.2 Link to agent events'),
  table(['Agent event', 'SMS Guardian', 'Voice Guardian', 'Camera Guardian'], [
    ['Trip starts / ends', '"Started" / "Reached"', '-', '-'],
    ['Dead zone ahead', 'Check-in with "out by" time', '-', '-'],
    ['Uneasy', '"Feeling uneasy" + location', '-', '-'],
    ['Worried or no answer', 'Alert + location (automatic in app)', 'Automatic call', '-'],
    ['Danger or SOS', 'Alert to all guardians', 'Automatic call + optional 30 s clip', 'Photos + location'],
    ['Battery 4%', 'Last message with route and ETA', '-', '-'],
    ['Walking with an Angel', '"Walking with a verified Angel" (if she allows)', '-', '-'],
  ], [2, 2.4, 1.9, 1.7]),
  H2('16.3 Her control'),
  B('She chooses her guardians, which modes are on, and which trips are shared; she can pause sharing at any time.'),
  B('Guardians see only what she enabled, only during shared trips or emergencies.'),
  B('No continuous audio or camera access for anyone; recording only on Danger or SOS, and only if she enabled that mode.'),
  B('Consent screen explains each mode; recording rules to be reviewed before a real launch.'),
);

// 17 Backend
add(H1('17. Backend (planned: Firebase)'),
  table(['Plan item', 'Free (Spark)', 'Paid (Blaze, pay as you go)'], [
    ['Email-link and Google sign-in', 'Yes', 'Yes'],
    ['Phone OTP sign-in', 'No (billing account required since September 2024)', 'Yes; per-SMS charge, first 10 SMS per day not billed'],
    ['Firestore database', 'Yes, with free daily limits', 'Yes'],
    ['Cloud Functions', 'No', 'Yes, with free monthly quota'],
    ['Region', 'asia-south1 (Mumbai)', 'Same'],
  ], [2.4, 2.8, 2.8]),
  P('**Finale approach:** free plan with email-link/Google sign-in, Firestore and security rules; server-side checks and phone OTP added when a billing account is available. Alternatives are compared in Section 17.1.'),
  P('**What lives where:** everything that changes lives in Firebase (accounts, tiers, reputation, halo, audits, Angel questions and answers); only hashes and the verified-contributor credential would go on-chain (Section 24.1); readings, preferences and trip history stay on the phone. **Nothing that identifies a person goes into either** — no names, no phone numbers, no exact home location, and no browsable list of places.'),
  P('**Status:** live since 17 September 2026 (project sixthsense-b8fcd, Mumbai). Tested between two phones: audits and Ask Angels answers appear on the other phone within seconds, and the rules refuse a Basic account answering as an Angel, anyone raising her own tier or points, and any read while signed out.'),
  table(['Part', 'Contents / rules'], [
    ['Login', 'Free plan: email link (IGDTUW email = Gold check) and Google sign-in. Phone OTP when the paid plan is enabled'],
    ['users', 'Tier, reputation, reward points, verification date, device binding. No ID or selfie images kept'],
    ['reports', 'Status (pending, confirmed, disputed, rejected, expired), claim type (positive/negative), effective trust, confirmations'],
    ['checks', 'Dispute check requests and answers; local checkers stored by rough area only'],
    ['angels', 'Opt-in status, hours, radius, rough current area, halo points, badges, reputation parts; questions, answers, Angel Nearby and Walk Together sessions, ratings, hearts, circles'],
    ['guardians', 'Her chosen family contacts, enabled modes, shared trips; SOS photos and clips encrypted, deleted after 30 days'],
    ['readings', 'Numbers only: area block (~150 m), time, activity, light, dog pack, signal, GPS accuracy, steadiness. No user ID. Deleted after 2 hours'],
    ['deadzones', 'Summaries built from readings (mock for now)'],
    ['audits', 'Existing community audit form'],
    ['sessions ("Stay with me")', 'Requester, friend, status, expiry (60 min); latest positions; quick messages; readable only by the two participants; deleted on end'],
    ['relay (QR)', 'Encrypted help message, short expiry, rate-limited'],
    ['Cloud Functions (paid plan)', 'Summaries, confirmation tallies, relay SMS, notifications, clean-up. On the free plan this logic runs in the app for the demo'],
    ['Rules', 'Minimum 3 different phones before an area summary is shown; consent screen with on/off for sharing readings; preferences stay on the phone'],
  ], [2, 6]),
  H2('17.1 Backend options compared'),
  table(['Option', 'Good for SixthSense', 'Drawbacks'], [
    ['Firebase (Firestore)', 'Live sync between phones, offline cache built in, Google and email-link sign-in, simple web SDK, Mumbai region', 'Phone OTP and server functions need the paid plan; limited geo and aggregate queries (location search needs geohash tricks); vendor lock-in'],
    ['Supabase (Postgres)', 'SQL with PostGIS for "within 500 m" queries and route/segment joins; row-level security; realtime; edge functions on the free plan; open source', 'Free projects pause after 7 days without database activity; 500 MB database; phone OTP needs an SMS provider (paid); offline sync is not built in'],
    ['Appwrite (cloud or self-hosted)', 'Auth, database, storage, functions and realtime in one; open source; can be self-hosted', 'Smaller community; geo queries limited; self-hosting needs a server'],
    ['PocketBase (self-hosted)', 'Single small server file with auth, database and realtime; very quick to set up', 'Needs hosting (e.g. a small VM); one server = single point of failure; not for large scale'],
    ['Custom API (Node/Express or Python) + MongoDB Atlas or Postgres', 'Full control; geo indexes (MongoDB 2dsphere or PostGIS); any logic server-side', 'Most work: auth, realtime, security and hosting built by the team; more to go wrong before the finale'],
  ], [1.8, 3.2, 3]),
  P('**Choice for the finale:** Firebase (least setup, live sync and offline support). **Strong alternative:** Supabase, if the team prefers SQL and proximity queries, provided the project is kept active before the demo.'),
);

// 15 Privacy
add(H1('18. Privacy, fairness and safety rules'),
  B('No audio, images or video leave the phone; audio buffers are cleared after each check and camera frames immediately.'),
  B('Shared readings are anonymous, rounded to an area block, and deleted after 2 hours.'),
  B('No persistent ranking of streets or areas is built, even internally.'),
  B('No safe/unsafe labels; comparisons state confidence and data age.'),
  B('Location sharing only in "Stay with me", with consent from both people, and only for the session.'),
  B('Trip history and preferences stay on the phone; she can view and delete them.'),
  B('Gender is never inferred from faces or sensors; it comes only from institution, partner organisation or official document. Face analysis is used only to match a selfie to an ID photo.'),
  B('ID and selfie images are deleted right after verification; no Aadhaar cards or numbers are collected.'),
  B('Local checkers and Angels are stored by rough area (~500 m) only; Angel identities are hidden in answers; exact locations only in consented Angel Nearby or Walk Together sessions.'),
  B('Guardian (family) modes are her choice; no continuous audio or camera access; SOS photos and clips encrypted and deleted after 30 days.'),
  B('Consent screen before sharing readings; the app works if she opts out.'),
  B('Simulated data is always labelled.'),
  B('Aligned with the principles of the DPDP Act, 2023 (purpose limitation, minimisation, time limits, consent); consent wording to be reviewed before any real launch.'),
  B('The app never promises safety and always keeps 112 available.'),
);

// 16 Platform
add(H1('19. Platform: web app and Android app'),
  table(['Feature', 'Android app', 'Web app'], [
    ['Signal', 'Real dBm (RSRP for 4G/5G) of the data SIM; weak at ≤ −105 dBm', 'Estimate from connection type, round-trip time and speed'],
    ['Trip in background', 'Foreground service (location, microphone if allowed), partial wake lock up to 3 h, notification', 'Works while the screen is on'],
    ['SMS', 'Sent directly (default SMS SIM; long messages split)', 'Opens the SMS app; she taps Send'],
    ['Sound model', 'Bundled (vendor/), works offline from first launch', 'Downloaded and cached'],
    ['Detection', 'Capacitor.isNativePlatform() = true', 'false; every native call falls back to web behaviour'],
  ], [1.6, 3.4, 3]),
  B('Capacitor 8.5 (Android 7.0+, target SDK 36). Test APK compiled on 17 Sept 2026; **not yet tested on a real phone**.'),
  B('Permissions: location, microphone, camera, SMS, notifications, foreground service (location, microphone), wake lock, vibrate, network state.'),
  B('Build: npm install → npm run android:add → npm run android:open → Run. After web changes: npm run android:sync. Full steps in ANDROID_SETUP.md.'),
  B('Known limits: some brands slow background apps (set battery to Unrestricted); Google Play restricts direct SMS (fine for direct APK installs).'),
);

// 17 UI
add(H1('20. Interface design'),
  table(['Item', 'Decision'], [
    ['Palette', 'Warm "streetlight" palette: night brown #231B17, panels #342923, sodium amber #F0A43A, text #F2E9DC, muted #B7A898, alert red #D8432F, okay green #8DB36B. Replaces the pink/violet theme (organiser asked to avoid blue/violet)'],
    ['Type', 'Anek Latin (headings), Hind (body); both support Indian scripts'],
    ['Screens (existing app)', 'Home gets the agent card; Safe Travel shows the predicted mode and why; Routes shows real routes, cards, bars, compare toggle and light strip; Journey shows the agent timeline, check-in and battery plan; SOS gets real calls and SMS; Guardians screen gets working SMS/Voice/Camera modes; Connect gets Angels (Ask Angels, Angel Nearby, Walk Together, Circles, halo); Profile gets "What SixthSense learned", halo and agent settings'],
    ['Critical power mode', 'Plain black screen, large text, no animation'],
    ['Accessibility', 'Word labels next to colour; keyboard focus; reduced motion respected; screen-reader labels on bars'],
  ], [1.8, 6.2]),
);

// 18 PPT alignment
add(H1('21. Status against the submitted PPT'),
  P('Key: Built, Planned (before finale), Future, Changed/Dropped.'),
  table(['PPT item', 'Status', 'Note'], [
    ['SEE: light', 'Built', 'Plus map and satellite light'],
    ['SEE: GPS openness', 'Planned', 'In six-sense scoring'],
    ['HEAR: sound level', 'Built', 'Plus YamNet activity; slide should say "sound type detected on the phone, never recorded"'],
    ['RUN: accelerometer', 'Built', ''],
    ['RUN: GPS exit time', 'Planned', 'As exit ease in scoring'],
    ['CALL: signal below −105 dBm', 'Built (Android app)', 'Estimate on web; to test on a phone'],
    ['TRIBE: Bluetooth counts', 'Future', 'Native Bluetooth scanning'],
    ['TRIBE: "others around?" tap', 'Planned', 'Neutral wording'],
    ['GUT: YamNet at night', 'Built', ''],
    ['GUT: YOLOv8n by day', 'Future', ''],
    ['SOS', 'Built', 'Real 112/1091 and SMS; hold or shake: Planned'],
    ['Heatmap', 'Changed', 'Replaced by light strip and six-sense bars (no area labels)'],
    ['Blockchain (Merkle root, soulbound credential)', 'Future', 'Planned for a future version (Section 24); AI/ML track focus for the finale'],
    ['View live signals', 'Built', ''],
    ['Connect', 'Partly', 'Becomes Angels: Ask Angels, Angel Nearby, Walk Together, Circles (planned)'],
    ['Explainable AI', 'Built / Planned', 'Current why lists built; six-sense explanation planned'],
    ['Rewards for audits', 'Built (existing app)', ''],
    ['Routes from OpenStreetMap', 'Built', 'Any city'],
    ['Readings expire in 2 hours', 'Built', ''],
    ['Firebase backend', 'Planned', ''],
    ['Round 2 offline features', 'Built', 'Offline re-routing: Planned'],
    ['Flutter app, tflite_flutter, Hive', 'Changed', 'MVP is a web app plus Capacitor Android app; Flutter is the production path'],
    ['Mapbox rendering', 'Changed', 'Leaflet with OpenStreetMap (planned)'],
    ['~7 MB models', 'Changed', 'About 4 MB (YamNet only)'],
    ['CCTV and shutter models (Tier 3)', 'Dropped', 'Weak signals'],
    ['"87/100 Safest route" in existing app', 'To remove', 'Contradicts "compared, not scored"'],
  ], [3, 1.6, 3.4]),
  H2('21.1 New features beyond the PPT'),
  B('On-device AI agent, graded help and escalation, automatic SMS (app), battery forecast, dead-zone check-in, network diagnosis, last message, landmark directions, help QR, automatic preference learning, fare estimate, packing reminder, light layer for any city, place search, confidence on every comparison, Android wrapper, demo replay.'),
);

// 19 Limits
add(H1('22. Limitations and risks'),
  table(['Limitation', 'Mitigation'], [
    ['Simulated crowd data in the pilot', 'Labelled everywhere; pipeline is real and replaces it with real use'],
    ['Thresholds (motion, dB, bark, light, signal) not calibrated on local walks', 'Stated as starting values; calibration plan; clip test for YamNet'],
    ['Phone microphone levels differ between models', 'dBFS thresholds per device; activity from YamNet is more robust'],
    ['OSM light tags sparse in Delhi; satellite only area-level', 'Sources and confidence shown; phone readings take priority'],
    ['Public map servers have usage limits', 'Caching; own server for a real launch'],
    ['Web app limits (no dBm, background, direct SMS)', 'Android app via Capacitor'],
    ['Android app not yet tested on a device', 'Test checklist in ANDROID_SETUP.md'],
    ['Background running varies by phone brand', 'Unrestricted battery setting; foreground service'],
    ['Emergency Location Service availability varies by state', 'Pitch it only where confirmed'],
    ['Borrowed IDs, willing helpers, deepfakes', 'Selfie match, liveness, college email, random re-checks, asymmetric confirmation, reputation (Section 14)'],
    ['Browser face matching and liveness are basic', 'Manual review for borderline cases; stronger checks as future work'],
    ['No guarantee of safety', 'Wording rules; 112 always available'],
  ], [3.4, 4.6]),
);

// 20 Plan
add(H1('23. Build plan and demo'),
  H2('23.0 Finale-day constraint'),
  P('If code changes are not allowed on finale day, the **deployed web address and the signed Android build are the whole artifact**, so they must be final the night before.'),
  table(['Prepared in advance', 'Why'], [
    ['Deployed web app on the team domain, with the domain added to Firebase authorised domains', 'Sign-in fails on an unlisted domain, and it cannot be fixed on the day'],
    ['Android build installed on 2-3 phones and opened once', 'First run downloads the sound model and the pilot data'],
    ['Demo account and #journey, #routes, #audit, #verify, #angels shortcuts', 'Judges reach any part in one tap; no typing, no waiting'],
    ['Two phones signed in (one Gold and Available as an Angel)', 'The live Ask Angels moment needs both sides ready'],
    ['Offline pack saved and the app opened once on the venue network', 'The app then works even if the venue network fails'],
    ['Screen recording of the full demo', 'A fallback if the network or a phone fails on stage'],
  ], [3.4, 4.6]),

  table(['#', 'Work', 'Status'], [
    ['1', 'Six-sense scoring, explainable cards, bars, compare toggle, "How we compare" panel', 'Built'],
    ['2', 'Merged into the team interface; fixed scores and Connaught Place data removed; login screen added', 'Built'],
    ['3', 'Firebase: login, audits and Ask Angels shared between phones, security rules', 'Built (live)'],
    ['3a', 'Verification flow, tiers, pending/confirmed/disputed, reputation, halo and rewards', 'Built; face match and local checks still simulated'],
    ['4', 'Offline re-routing on the phone', 'Planned'],
    ['5', 'Angels (Ask Angels live between phones, Angel Nearby, Walk Together, Circles, halo); Guardian modes working', 'Ask Angels and halo built; Angel Nearby and Walk Together simulated'],
    ['6', 'SOS with calls, SMS and photos; GPS openness; help points', 'Built; SOS by shake needs the Android app'],
    ['7', 'Real street map, street-light layer, multi-mode journeys (7.8)', 'Built'],
    ['8', 'YamNet precision/recall on ESC-50; battery and speed tests', 'Planned'],
    ['9', 'Android app rebuilt on this version; APK tested on 2-3 phones', 'Next'],
    ['10', 'PPT update and demo rehearsal; backup recording', 'Planned'],
    ['11', 'QR relay (if time allows)', 'Optional'],
  ], [0.4, 6, 1.6]),
  H2('23.1 Demo script (about 4 minutes)'),
  N('Plan a trip after dark: predicted mode with why, route cards with six-sense bars, compare toggle, "How we compare" panel.', 'demo'),
  N('Start the trip; play the demo walk: dead-zone check-in, power saving, network diagnosis, check-in left unanswered, escalation, last message, arrival.', 'demo'),
  N('Airplane mode: app still opens; sound model reacts to a dog-bark clip.', 'demo'),
  N('Android app: real dBm on the Sense screen; trip notification; direct SMS to a teammate.', 'demo'),
  N('Trust flow: a Basic account\'s "well lit" claim stays pending; a Gold account confirms it; a disputed report is resolved by local check votes.', 'demo'),
  N('Ask Angels: a second phone answers a live question about the destination; Walk Together match; Guardians receive SMS updates (if built).', 'demo'),
);

// 22 Future versions
add(H1('24. Future versions'),
  P('Features deliberately kept for later releases. They remain part of the product vision from the original report and the submitted PPT.'),
  H2('24.1 Web3 trust layer (from the original report, Section 5)'),
  table(['Component', 'Design', 'Purpose'], [
    ['Soulbound verified-contributor credential', 'Non-transferable token minted after identity verification (Section 14.2), held in a custodial in-app wallet (e.g. Thirdweb; no seed phrase for the user)', 'Binds verification to one person; cannot be sold, gifted or reused on another device'],
    ['Tamper-evident contribution record', 'Confirmed contributions (segment, signal values, time, credential hash) batched into a Merkle root and anchored on Polygon (Amoy testnet first)', 'No single administrator can quietly alter or delete confirmed records; anyone can recompute and verify'],
    ['Off-chain data', 'Raw data stays in Firebase; only hashes go on-chain', 'Cost, speed and privacy; no public ledger of places'],
  ], [2, 3.6, 2.4]),
  B('Rules carried over: no browsable on-chain list of "unsafe places"; no speculative reward token; gas kept negligible by batching.'),
  B('**Split with the backend:** hashes and the credential on-chain; everything that changes (accounts, reputation, audits, Angel answers) in Firebase; nothing that identifies a person in either.'),
  B('Fit with Section 14: the credential would record tier and verification date; reputation stays off-chain.'),
  H2('24.2 Other future items'),
  table(['Item', 'Notes'], [
    ['YOLOv8n dog counts by day (camera)', 'Complements YamNet at night'],
    ['Bluetooth crowd counts (TRIBE)', 'Native Android scanning, no device IDs stored'],
    ['Flutter production app; iPhone app', 'The Capacitor app is the MVP path'],
    ['Stronger liveness and DigiLocker verification', 'For "Verified women" and higher assurance'],
    ['QR safety card for a dead phone', 'Needs the QR relay'],
    ['Real chat in Connect', 'Beyond the demo chat'],
    ['Safetipin data partnership', 'Lighting and dark-spot data'],
    ['Learned scoring weights', 'From routes women actually choose'],
    ['Play Store release', 'Signed build; SMS permission declaration'],
    ['Own map and routing servers', 'For scale beyond public server limits'],
  ], [3.2, 4.8]),
);

// Appendix
add(H1('Appendix A: configuration values'),
  table(['Setting', 'Value'], [
    ['Agent tick', 'Full 5 s, saving 15 s, critical 30 s'],
    ['Battery safety margin', '1.3 × remaining trip time'],
    ['Saving / critical / last message', '≤ 15% / ≤ 8% / ≤ 4%'],
    ['Default walking speed', '80 m/min (4.8 km/h) until learned'],
    ['Check-in triggers', 'Still 150 s on foot, 480 s in a vehicle; running 6 s; jolt within 8 s; cool-down 300 s'],
    ['Check-in timeouts', '30 s, then 20 s'],
    ['Level 2 → 3', '60 s without acknowledgement'],
    ['"Stay with you" check interval', '120 s'],
    ['Off route', '60 m for 30 s'],
    ['Arrival radius', '60 m'],
    ['Dead-zone look-ahead', '350 m'],
    ['Reading radius / max age / half-life', '60 m / 2 h / 45 min'],
    ['Segment length', '50 m'],
    ['Network check timeout', '3 s'],
    ['Weak signal', '≤ −105 dBm (app)'],
    ['Pilot area for simulated data', '3 km around IGDTUW (28.6645, 77.2326)'],
    ['Cache', 'Map data 30 days; satellite 180 days'],
    ['Tier weights', 'Gold 100%, Partner 100%, Verified women 80%, Verified others 40%, Basic 20%'],
    ['Confirmation threshold', 'Total effective trust ≥ 100% from independent contributors (positive claims: women-verified or sensors only)'],
    ['Dispute decision', '≥ 3 answers or ≥ 200% total trust; expires after 2 h'],
    ['Reputation range', '0.5–1.2; false positive claims penalised double'],
    ['Angel eligibility', 'Gold, Partner or Verified women; reputation ≥ 0.9'],
    ['Ask Angels radius', '500 m, widening to 1 km'],
    ['Angel Nearby session', 'Consent both ways; ends on arrival or after 60 min'],
    ['Walk Together match', 'Start within 200 m, leave within 10 min, routes overlap ≥ half; up to 4 people'],
    ['Voice Guardian clip / SOS media retention', '30 s / 30 days'],
  ], [3, 5]),
  H1('Appendix B: sources and licences'),
  B('OpenStreetMap data © OpenStreetMap contributors (ODbL).'),
  B('NASA VIIRS imagery via NASA GIBS.'),
  B('YamNet model (Google) via MediaPipe Tasks Audio.'),
  B('Routing: routing.openstreetmap.de; place search: Photon (Komoot).'),
  B('Fares: DMRC (Aug 2025 revision); Delhi Transport Department auto fare notification.'),
  B('Background: Safetipin Delhi safety assessments; Google Emergency Location Service (India, Uttar Pradesh first).'),
);

/* ------------------------------------------------------------ front matter */
const front = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: 'SixthSense', bold: true, size: 72, color: C.accent })] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Project Design Report', size: 40, color: C.ink })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Context-aware travel companion with an on-device AI agent', size: 26, color: C.mute })] }),
  P(`**Version:** ${VERSION}`), P(`**Date:** ${DATE}`),
  P('**Event:** SheVibes (AssetMerkle, IGDTUW), Track 2: AI/ML for Context-Aware Women\'s Travel Recommendations'),
  P('**Team:** Arshpreet Ahuja, Kiran, Vanya Goel, Kashvi Singh'),
  P('**Repository:** github.com/Arshpreet-2/SixthSense'),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Document control')] }),
  P('This report is the design reference. When any feature, rule or threshold changes, update the relevant section, bump the version, and add a row below. Status labels: **Built** (in code), **Planned** (before the finale), **Future** (after the hackathon), **Changed/Dropped**.'),
  table(['Version', 'Date', 'Changes'], CHANGELOG, [1, 1.6, 5.4]),
  gap(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')], pageBreakBefore: true }),
  ...TITLES.map(t => new Paragraph({ children: [new TextRun(t)], spacing: { after: 60 } })),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: C.ink } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: C.accent, font: FONT }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: C.ink, font: FONT }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: C.mute, font: FONT }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
      ] },
      ...['steps', 'usp', 'choose', 'demo', 'idv', 'disp', 'askg', 'angel'].map(ref => ({ reference: ref, levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } },
      ] })),
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `SixthSense Project Design Report · v${VERSION}`, size: 16, color: C.mute })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: C.mute })] })] }) },
    children: [...front, ...S],
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log(`Wrote ${OUT}`); });

/* ============================================================================
 * ask.js — Ask
 * The in-app assistant. Two layers:
 *   1. On the phone: questions about her route, the metro, help points, her
 *      trips and how the app works are answered from data already loaded.
 *      Instant, free, works offline, and every answer is traceable.
 *   2. Online: anything else goes to /api/ask on the deployment, which calls
 *      Gemini with the key kept on the server. Nothing identifying is sent.
 * Exposes: window.Ask
 * ========================================================================== */
(function (root) {
  'use strict';

  // S and userPos are declared with const in the app, so they are not on window
  const ST = () => (typeof S !== 'undefined' ? S : { travel: {}, trips: [], chat: {} });
  const has = (q, ...words) => words.some(w => q.includes(w));

  /* --------------------------------------------------------- local answers */
  const ANSWERS = [
    // why this route
    { when: q => has(q, 'why', 'recommend', 'suggest') && has(q, 'route', 'way', 'option', 'this'),
      run: () => {
        const R = ST().travel.result;
        if (!R) return null;
        const o = R.options.find(x => x.id === R.pick) || R.options[0];
        const pros = (o.pros || []).join('; ') || 'no clear advantage';
        const cons = (o.cons || []).join('; ') || 'nothing flagged';
        return { text: `${o.title} is the pick. ${R.why || R.lead}\n\nIn its favour: ${pros}.\nAgainst: ${cons}.\nHow sure: ${o.confidenceLabel}, from ${o.freshness}.`,
                 source: 'this comparison' };
      } },
    // light on the route
    { when: q => has(q, 'light', 'lit', 'dark', 'roshni', 'andhera'),
      run: () => {
        const R = ST().travel.result;
        if (!R) return null;
        const o = R.options.find(x => x.id === (ST().travel.sel || R.pick)) || R.options[0];
        const see = o.bars && o.bars.SEE;
        const L = root.Light.layers();
        return { text: `On ${o.title.toLowerCase()}, SEE (light, openness, visibility) is ${see && see.pct != null ? see.pct + ' out of 100' : 'not measurable — no recent readings'}.\n\n` +
                 `Light comes from phone readings first, then OpenStreetMap tags (${L.ways.length} roads tagged and ${L.lamps.length} lamps loaded here), then NASA satellite night light for the area. In daylight, light is not counted at all.`,
                 source: 'route scoring and map data' };
      } },
    // metro
    { when: q => has(q, 'metro', 'train', 'last train', 'dmrc'),
      run: () => {
        const R = ST().travel.result;
        const m = R && R.options.find(o => o.rail);
        if (m) {
          const r = m.rail, l = r.legs[0];
          return { text: `${l.line} Line from ${l.from} to ${l.to}: ${r.stations} stops, about ${l.minutes} min riding, ${r.waitMin} min typical wait, ${r.changes ? 'change at ' + r.legs[1].from : 'no change'}. Fare about Rs. ${r.fare}. Last train from ${l.from} at ${r.lastTrain}.` +
                   (r.afterLast ? '\n\nAt the time you chose, that last train has already gone.' : ''),
                   source: 'DMRC timetable' };
        }
        const near = root.Metro && root.Metro.stationsNear(userPos(), 2500);
        if (near && near.length) return { text: `Nearest stations: ${near.slice(0, 3).map(s => `${s.name} (${s.d} m)`).join(', ')}. Plan a trip and I can give the line, stops, wait and last train.`, source: 'DMRC network' };
        return { text: 'No metro station within 2.5 km of you, and the timetable we carry covers Delhi only.', source: 'DMRC network' };
      } },
    // nearest help
    { when: q => has(q, 'police', 'hospital', 'help', 'chemist', 'pharmacy', 'nearest', 'paas'),
      run: () => {
        const u = userPos();
        const pts = root.Light.helpPoints()
          .map(p => ({ ...p, d: Math.round(root.SensorHub.distanceM(u.lat, u.lng, p.lat, p.lng)) }))
          .sort((a, b) => a.d - b.d).slice(0, 4);
        if (!pts.length) return { text: 'No help points loaded for this area yet. Open the Map tab and they load from OpenStreetMap.', source: 'OpenStreetMap' };
        return { text: 'Nearest to you:\n' + pts.map(p => `• ${p.name} — ${p.kind}, ${p.d} m`).join('\n') +
                 '\n\n112 and 1091 are one tap away on Home.', source: 'OpenStreetMap' };
      } },
    // the agent
    { when: q => has(q, 'agent', 'what do you watch', 'trigger', 'battery', 'signal drop'),
      run: () => ({ text: 'The agent runs through every trip. It watches battery (and forecasts whether it lasts the trip), the network and its cause of failure, signal and known low-signal stretches, GPS for off-route and arrival, movement for a long stop, a sudden run or a jolt, and sound for street activity and dog packs.\n\nIt suggests when you might disagree, and acts by itself only when nothing is lost by acting — power saving, preparing a message, escalating if you cannot answer. Your Settings decide which of those are automatic.',
                    source: 'the app' }) },
    // trips
    { when: q => has(q, 'my trip', 'last trip', 'journey', 'history', 'pichli'),
      run: () => {
        const t = (ST().trips || [])[0];
        if (!t) return { text: 'No journeys recorded yet. After a trip, it is listed under Profile → My journeys.', source: 'this phone' };
        return { text: `Last journey: ${t.to}, ${t.title.toLowerCase()}, ${t.minutes} min${t.fare ? ', Rs. ' + t.fare : ''}, ${(t.metres / 1000).toFixed(1)} km. ${t.reached ? 'You reached.' : 'It ended early.'}` +
                 (t.did && t.did.length ? `\nThe agent: ${t.did.join('; ')}.` : ''), source: 'this phone' };
      } },
    // rules
    { when: q => has(q, 'pending', 'confirm', 'tier', 'verified', 'gold', 'trust', 'halo', 'points'),
      run: () => ({ text: 'Your verification decides how much your reports count for others, never what you can use.\n\nA warning counts straight away at reduced weight and fully once confirmed. A claim that makes a place look better counts only when a verified woman or the phone\'s own sensors agree — that rule is what stops anyone luring women down a bad route.\n\nHalo points are separate: they reward helping, and they are written by the backend rules, not by the app.',
                    source: 'the app' }) },
    // data sources
    { when: q => has(q, 'data', 'source', 'where do you get', 'real', 'simulated', 'fake'),
      run: () => ({ text: 'Real: routes, places and help points from OpenStreetMap; lighting tags and street lamps from OpenStreetMap; night light from NASA VIIRS; metro times and fares from the DMRC feed; and your own phone\'s sensors.\n\nSimulated and labelled: other members\' street readings, Angel Nearby and Walk Together matches, low-signal stretches, the face match, and the demo walk.\n\nProfile → What data we use lists all of it with coverage for your area.',
                    source: 'the app' }) },
    // sos
    { when: q => has(q, 'sos', 'emergency', 'danger', 'madad'),
      run: () => ({ text: 'Hold the red Emergency bar on Home for 2 seconds. That starts emergency mode: 112 and 1091 in one tap, an alert with your location ready for your guardians, a help QR for people nearby, and the nearest help points listed.\n\nDuring a trip, if you answer "Danger" to a check-in, or do not answer two check-ins, the agent escalates by itself.',
                    source: 'the app' }) },
  ];

  const userPos = () => (typeof root.userPos === 'function' ? root.userPos() : { lat: 28.6645, lng: 77.2326 });

  function local(question) {
    const q = (question || '').toLowerCase();
    for (const a of ANSWERS) {
      if (!a.when(q)) continue;
      const out = a.run();
      if (out) return out;
    }
    return null;
  }

  /* ------------------------------------------------ what the model may see */
  // Facts only, nothing that identifies her: no name, phone, contacts or home.
  function context() {
    const c = {};
    const R = ST().travel.result;
    if (R) c.routes = R.options.map(o => ({
      option: o.title, minutes: o.minutes, fare: o.fare, sure: o.confidenceLabel,
      good: o.pros, bad: o.cons, recommended: o.id === R.pick,
    }));
    if (R && R.why) c.recommendation = R.why;
    const m = R && R.options.find(o => o.rail);
    if (m) c.metro = { line: m.rail.legs[0].line, stops: m.rail.stations, wait: m.rail.waitMin, last: m.rail.lastTrain, fare: m.rail.fare };
    const u = userPos();
    c.nearbyHelp = root.Light.helpPoints()
      .map(p => ({ name: p.name, kind: p.kind, m: Math.round(root.SensorHub.distanceM(u.lat, u.lng, p.lat, p.lng)) }))
      .sort((a, b) => a.m - b.m).slice(0, 6);
    const S_ = ST(), T = S_.travel;
    c.area = S_.hereName || null;
    c.timeOfDay = new Date().getHours() + ':00';
    c.dark = root.Light.isDark(u.lat, u.lng, Date.now());

    // what she is doing right now, so the answer is about this moment
    c.screen = S_.screen;
    c.offline = !!S_.offline;
    if (T.from || T.to) c.planning = { from: T.from || 'current location', to: T.to || null, leaving: T.at || 'now' };
    if (T.prefs && T.prefs.length) c.addedForThisTrip = T.prefs;
    if (S_.user && S_.user.style && S_.user.style.length) c.usualStyle = S_.user.style;

    // the option she has actually selected, with its own numbers
    const sel = R && R.options.find(o => o.id === T.sel);
    if (sel) c.selected = {
      option: sel.title, minutes: sel.minutes, fare: sel.fare, km: +(sel.metres / 1000).toFixed(2),
      sure: sel.confidenceLabel, good: sel.pros, bad: sel.cons,
      isRecommended: sel.id === R.pick, unusual: sel.unusual ? sel.unusual.text : null,
      senses: sel.bars ? Object.fromEntries(Object.entries(sel.bars)
        .filter(([, b]) => b && b.pct != null).map(([k, b]) => [k, Math.round(b.pct)])) : null,
    };

    // the trip she is on, if one is running
    const A = root.Agent && root.Agent.state;
    if (A && A.trip) {
      c.onTrip = { to: A.trip.destName, level: A.level,
        battery: A.battery ? { level: A.battery.level, lastsMin: A.battery[A.battery.mode] } : null,
        lastCards: (A.cards || []).slice(0, 3).map(x => x.title) };
    }
    const L = root.LIVE;
    c.battery = L && L.batt && L.batt.on ? L.batt.level : null;
    c.network = L && L.net ? (L.net.online ? (L.net.diag || 'ok') : 'offline') : null;
    return c;
  }

  async function remote(question) {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: context() }),
    });
    if (!res.ok) throw new Error(res.status === 404 ? 'The assistant is only available on the deployed site.' : 'The assistant could not answer just now.');
    const j = await res.json();
    return { text: j.answer, source: 'Gemini, with this app\'s data' };
  }

  /* When the open-question model is not reachable, say what is actually
     missing for THIS question rather than repeating one line every time. */
  /* A sentence about whatever she has selected this moment */
  function aboutSelection() {
    const c = context();
    if (c.selected) {
      const s2 = c.selected;
      const senses = s2.senses ? Object.entries(s2.senses).sort((a, b) => a[1] - b[1]) : [];
      const weakest = senses.length ? senses[0] : null;
      return `You have ${s2.option} selected: ${s2.minutes} min, Rs. ${s2.fare}, ${s2.km} km` +
        (s2.isRecommended ? ', and it is the one I recommend' : ', which is not the one I recommend') + '. ' +
        (s2.good && s2.good.length ? 'In its favour: ' + s2.good.slice(0, 2).join('; ') + '. ' : '') +
        (s2.bad && s2.bad.length ? 'Worth knowing: ' + s2.bad.slice(0, 2).join('; ') + '. ' : '') +
        (weakest ? `Weakest of the six senses here is ${weakest[0]} at ${weakest[1]} out of 100.` : '');
    }
    if (c.planning && c.planning.to)
      return `You are planning ${c.planning.from} to ${c.planning.to}, leaving ${c.planning.leaving}. Tap Find routes and I can tell you why one is chosen over the others.`;
    if (c.onTrip)
      return `You are on the way to ${c.onTrip.to}.` +
        (c.onTrip.battery ? ` Battery ${c.onTrip.battery.level}%, about ${c.onTrip.battery.lastsMin} min at this rate.` : '') +
        (c.onTrip.lastCards.length ? ` The agent last said: ${c.onTrip.lastCards[0]}.` : '');
    return null;
  }

  function cannotAnswer(question, err) {
    const q = String(question || '').toLowerCase();
    const why = /404|deployed/.test(err.message)
      ? 'Open questions need the deployed site; here I answer from your own data.'
      : 'I could not reach the language model just now, so I am answering from your own data.';

    const live = aboutSelection();
    const aboutRoute = /route|why|recommend|which way|safer|best|this one|selected|option/.test(q);
    if (aboutRoute) return live ||
      'Nothing is planned yet, so there is no route for me to explain. Open Safe Travel, put in where you are going and when, and ask me again — I will read the comparison that comes back.';
    if (/light|dark|lit/.test(q))
      return why + ' For lighting, open a route and turn on "Show street light on this route" — I can then tell you which stretches are weak.';
    if (/angel|help me|walk with/.test(q))
      return why + ' For a person rather than an answer, open Community — Ask Angels for a question, or Walk Together to ask someone nearby.';
    if (/joke|weather|news|who are you|your name/.test(q))
      return 'That one is outside what I hold on this phone. I answer about your route, the lighting on it, the metro, help nearby, your trips, your audits and how the app works.';
    return (live ? live + ' ' : '') + why +
      ' Try asking about this route, the lighting on it, the metro and last trains, help points nearby, your journeys, or how the agent works.';
  }

  async function ask(question) {
    const l = local(question);
    if (l) return { ...l, local: true };
    if ((typeof S !== 'undefined' && S.offline) || !navigator.onLine) {
      return { text: 'Offline mode is on, so I answer from saved data only. From what is saved I can still tell you about your route, the metro, nearby help, your trips and how the app works.', source: 'offline', local: true };
    }
    try { return { ...(await remote(question)), local: false }; }
    catch (e) {
      return { text: cannotAnswer(question, e), source: 'on this phone', local: true };
    }
  }

  root.Ask = { ask, local, context,
    starters: ['Why is this route recommended?', 'Where is the nearest help?', 'When is the last metro?', 'What does Pending mean?'] };
})(typeof window !== 'undefined' ? window : globalThis);

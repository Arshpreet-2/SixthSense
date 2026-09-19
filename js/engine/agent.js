/* ============================================================================
 * agent.js — Agent
 * One on-device agent. Loop: observe → predict → ask → decide → act → monitor.
 * No cloud AI; works the same online and offline.
 *
 * Rule of thumb it follows:
 *   suggest  — anything about her choices (route, where to go, whom to tell)
 *   act      — only when nothing is lost (save power, save the offline pack,
 *              prepare a message), when time is running out (last message),
 *              or when she does not respond to two check-ins.
 * Needs: SensorHub, Context, Prefs. Exposes: window.Agent
 * ========================================================================== */
(function (root) {
  'use strict';

  const H = () => root.SensorHub;
  const listeners = [];
  const emit = () => listeners.forEach(fn => { try { fn(view()); } catch (e) { console.error(e); } });

  const CFG = {
    tickMs: { full: 5000, eco: 15000, critical: 30000 },
    // Drain in % per minute by power mode; replaced by her phone's measured rate once available
    defaultDrain: { full: 0.45, eco: 0.18, critical: 0.07 },
    safetyMargin: 1.3,          // battery must last 1.3× the remaining trip
    ecoAtOrBelow: 15, criticalAtOrBelow: 8, lastMessageAt: 4,
    walkSpeedMpm: 80,           // 4.8 km/h until learned
    stopAskAfterSec: 150,       // long stop on foot, until learned
    vehicleStopAskAfterSec: 480,
    runAskAfterSec: 6,
    offRouteM: 60, offRouteSec: 30,
    arriveWithinM: 60,
    deadZoneLookaheadM: 350,
    askTimeoutSec: [30, 20],    // first and second check-in
    alertAfterSec: 60,          // after level-2 alert with no answer, show level 3
    stayWithMeEverySec: 120,
    anomalyCooldownSec: 300,
  };
  // Her settings (Profile → Settings)
  const OPT = { autoPower: true, autoSms: true, checkins: true, deadZone: true };

  const S = {
    name: 'Me', contacts: [],               // [{name, phone, primary}]
    trip: null,                             // {destName, dest, route, startedAt, mode, prefersMode}
    pack: null, zones: [], readings: [],
    level: 0,                               // 0 ok, 1 uneasy, 2 worried, 3 danger
    ask: null,                              // {id, question, options, deadline, round}
    cards: [], log: [],
    channel: 'app',                         // 'app' or 'sms'
    batt: [],                               // [{t, level, mode}] on the agent clock
    modeSince: 0, fullRate: null,           // her phone's measured drain, full-mode equivalent
    motion: { activity: 'unknown', stillSince: null, runSince: null, lastJolt: null },
    offRouteSince: null, lastAnomalyAt: 0, lastStayCheck: 0,
    done: {},                               // one-off actions already taken this trip
    queue: [],                              // messages waiting for signal
    replay: null,
  };

  const clock = () => (S.replay ? S.replay.now : Date.now());
  const hhmm = t => new Date(t).toTimeString().slice(0, 5);
  const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* ================================================================ cards */
  function card(c) {
    const id = c.id || `${c.kind}-${Math.random().toString(36).slice(2, 8)}`;
    S.cards = S.cards.filter(x => x.id !== id);
    S.cards.unshift({ ...c, id, t: clock() });
    S.cards = S.cards.slice(0, 12);
    S.log.unshift({ t: clock(), kind: c.kind, text: c.title });
    S.log = S.log.slice(0, 60);
    emit();
    return id;
  }
  const dismiss = id => { S.cards = S.cards.filter(c => c.id !== id); emit(); };

  /* ============================================================ predictors */
  // 1. Battery forecast from her phone's own recent drain
  // Samples are tagged with the power mode, so savings are not double-counted
  function drainRate(mode) {
    const current = H().state.mode;
    const pts = S.batt.filter(p => p.mode === current && p.t >= S.modeSince && p.t >= clock() - 15 * 60000);
    if (pts.length >= 3) {
      const n = pts.length, t0 = pts[0].t;
      const xs = pts.map(p => (p.t - t0) / 60000), ys = pts.map(p => p.level);
      const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
      const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      if (den > 0 && num / den < -0.01) S.fullRate = (-num / den) * CFG.defaultDrain.full / CFG.defaultDrain[current];
    }
    if (S.fullRate == null) return { rate: CFG.defaultDrain[mode], measured: false };
    return { rate: S.fullRate * CFG.defaultDrain[mode] / CFG.defaultDrain.full, measured: true };
  }
  function batteryPlan(needMin) {
    const level = H().state.battery.level;
    if (level == null) return null;
    const lasts = m => Math.round((level - 1) / drainRate(m).rate);
    const plan = { level, needMin, full: lasts('full'), eco: lasts('eco'), critical: lasts('critical'),
                   measured: drainRate('full').measured };
    const need = needMin * CFG.safetyMargin;
    plan.mode = plan.full >= need ? 'full' : plan.eco >= need ? 'eco' : 'critical';
    if (level <= CFG.ecoAtOrBelow && plan.mode === 'full') plan.mode = 'eco';
    if (level <= CFG.criticalAtOrBelow) plan.mode = 'critical';
    plan.enough = plan[plan.mode] >= needMin;
    return plan;
  }

  // 2. Dead zone ahead on the route (zones from walks or mock data)
  function deadZoneAhead(pos) {
    if (!S.trip || !S.zones.length) return null;
    const coords = S.trip.route.coords;
    const me = root.Context.locateOnRoute(coords, pos.lat, pos.lng);
    let best = null;
    for (const z of S.zones) {
      const at = root.Context.locateOnRoute(coords, z.lat, z.lng);
      if (at.offM > (z.radiusM || 80)) continue;
      const ahead = at.alongM - me.alongM;
      if (ahead < -20 || ahead > CFG.deadZoneLookaheadM) continue;
      if (!best || ahead < best.aheadM) best = { ...z, aheadM: Math.max(0, ahead) };
    }
    return best;
  }

  // 3. Remaining trip time
  function remaining(pos) {
    if (!S.trip) return null;
    const loc = root.Context.locateOnRoute(S.trip.route.coords, pos.lat, pos.lng);
    const leftM = Math.max(0, loc.totalM - loc.alongM);
    const speed = tripSpeed();
    return { leftM, min: Math.max(1, Math.round(leftM / speed)), offM: loc.offM };
  }
  // Metres per minute for the current trip
  function tripSpeed() {
    if (!S.trip || S.trip.mode === 'walk') return walkSpeed();
    const r = S.trip.route;
    return Math.max(100, r.distanceM / Math.max(1, r.durationMin));
  }
  const onFoot = () => !S.trip || ['walk', 'metro', 'bus', 'mixed'].includes(S.trip.mode);
  function walkSpeed() {
    const trips = root.Prefs ? root.Prefs.Trips.list().filter(t => t.mode === 'walk' && t.avgSpeedKmh) : [];
    if (trips.length < 3) return CFG.walkSpeedMpm;
    const v = trips.map(t => t.avgSpeedKmh).sort((a, b) => a - b)[Math.floor(trips.length / 2)];
    return Math.max(50, Math.min(110, v * 1000 / 60));
  }

  /* ============================================================== messages */
  function location() {
    const g = H().state.gps;
    return g.lat == null ? null : { lat: +g.lat.toFixed(5), lng: +g.lng.toFixed(5) };
  }
  // Fits one SMS (160 characters) where possible
  function buildSms(kind, extra = {}) {
    const loc = location();
    const b = H().state.battery.level;
    const where = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : 'location unknown';
    const dest = S.trip ? S.trip.destName : 'my destination';
    const base = {
      checkin:  `${S.name} OK ${hhmm(clock())}. Low-signal stretch ahead, out by ${extra.outBy}. Call if no msg by ${extra.callBy}.`,
      fine:     `${S.name}: I'm fine, ${hhmm(clock())}.`,
      out:      `${S.name}: back in network ${hhmm(clock())}, all fine.`,
      reached:  `${S.name}: reached ${extra.dest || dest} ${hhmm(clock())}.`,
      uneasy:   `${S.name}: feeling uneasy, ${hhmm(clock())}. Please stay reachable.`,
      alert:    `${S.name} NEEDS HELP ${hhmm(clock())}. Please call now.`,
      last:     `${S.name}: phone dying ${hhmm(clock())}. Going to ${dest}, ETA ${extra.eta}. Call at ${extra.callBy} if no msg.`,
      // the promise: her deadline leaves the phone before anything can go wrong
      promise:  `${S.name} heading to ${dest}, ${hhmm(clock())}. Due by ${extra.due}. If nothing by ${extra.callBy}, call me.`,
      // the reason, sent while there is still signal to send it
      quietSoon:`${S.name}: no signal expected ${extra.from} to about ${extra.to} on my way to ${dest}. Not a problem — call at ${extra.callBy} if still nothing.`,
      dyingSoon:`${S.name}: phone will likely die about ${extra.at}. Due ${extra.due} at ${dest}. Call at ${extra.callBy} if no msg.`,
      late:     `${S.name}: running late, still walking, ${hhmm(clock())}. Now expect me about ${extra.eta}.`,
    }[kind];
    const withLoc = `${base} ${where}`;
    if (withLoc.length <= 160 || !loc) return withLoc;
    const coords = ` ${loc.lat},${loc.lng}`;
    return (base + coords).length <= 160 ? base + coords : base.slice(0, 160 - coords.length) + coords;
  }
  function smsHref(body, which = 'primary') {
    const list = S.contacts.filter(c => which === 'all' || c.primary);
    const nums = (list.length ? list : S.contacts).map(c => c.phone).join(',');
    const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
    return `sms:${nums}${sep}body=${encodeURIComponent(body)}`;
  }
  const numbersFor = which => {
    const list = S.contacts.filter(c => which === 'all' || c.primary);
    return (list.length ? list : S.contacts).map(c => c.phone);
  };
  const smsAction = (label, kind, extra, which) => {
    const body = buildSms(kind, extra);
    return { label, href: smsHref(body, which), sms: kind, body, numbers: numbersFor(which) };
  };
  // Android app only: send without a tap (used when time is short or she cannot respond)
  async function autoSend(kind, extra, which, why) {
    if (!OPT.autoSms || !(root.Native && root.Native.canSendSmsDirectly) || !S.contacts.length) return false;
    const r = await root.Native.sendSms(numbersFor(which), buildSms(kind, extra));
    if (r.sent) log(`SMS sent automatically (${why})`);
    return r.sent;
  }

  /* ============================================================ asking her */
  function ask(reason, round = 0) {
    const timeout = CFG.askTimeoutSec[Math.min(round, CFG.askTimeoutSec.length - 1)];
    S.ask = { id: `ask-${clock()}`, reason, round, deadline: clock() + timeout * 1000 };
    vibrate(round ? [300, 150, 300, 150, 300] : [200, 100, 200]);
    card({
      id: 'ask', kind: 'ask', title: 'Are you okay?', body: reason,
      options: [
        { label: "I'm fine", answer: 0 }, { label: 'Uneasy', answer: 1 },
        { label: 'Worried', answer: 2 }, { label: 'Danger', answer: 3 },
      ],
      deadline: S.ask.deadline,
    });
  }

  function answer(level) {
    S.ask = null; dismiss('ask');
    S.lastAnomalyAt = clock();
    setLevel(level, 'her answer');
  }

  function setLevel(level, why) {
    S.level = level;
    const pos = location();
    // Prefer staffed places (police, hospital, metro) if one is within 400 m
    let help = [];
    if (pos && S.pack) {
      const staffed = root.Context.nearest(S.pack.help, pos.lat, pos.lng, 2, ['police', 'hospital', 'metro', 'clinic']);
      help = staffed.length && staffed[0].distM <= 400 ? staffed
        : root.Context.nearest(S.pack.help, pos.lat, pos.lng, 2, ['police', 'hospital', 'metro', 'clinic', 'pharmacy', 'shop', 'fuel']);
    }
    const helpText = help.length ? help.map(h => `${h.name || h.kind} (${h.kind}), ${h.distM} m`).join('; ') : 'No saved help points nearby.';

    if (level === 0) {
      dismiss('ladder');
      card({ id: 'ladder', kind: 'info', title: 'Okay. Carrying on.', body: 'I will keep an eye on the trip.' });
      setTimeout(() => dismiss('ladder'), 4000);
    } else if (level === 1) {
      S.lastStayCheck = clock();
      card({ id: 'ladder', kind: 'suggest', title: 'Staying with you',
        body: `I will check on you every ${CFG.stayWithMeEverySec / 60} minutes. Nearest help: ${helpText}`,
        actions: [smsAction('Tell my contact I feel uneasy', 'uneasy')] });
    } else if (level === 2) {
      const noAnswer = /^no answer/.test(why);
      if (noAnswer) autoSend('alert', {}, 'primary', 'no answer to check-ins').then(sent => sent &&
        card({ id: 'autosent', kind: 'act', title: 'Alert sent to your contact', body: 'You did not answer two check-ins, so your location went by SMS.' }));
      card({ id: 'ladder', kind: 'alert', title: 'Tell your contact now',
        body: `Your message with location is ready. Walk towards: ${helpText}`,
        actions: [smsAction('Send alert with location', 'alert'), { label: 'Show help QR', run: 'showQr' }] });
      vibrate([500, 200, 500]);
      S.alertAt = clock();
    } else {
      if (why === 'alert not acknowledged') autoSend('alert', {}, 'all', 'still no answer').then(sent => sent &&
        card({ id: 'autosent', kind: 'act', title: 'Alert sent to all contacts', body: 'Still no answer, so everyone on your list got your location.' }));
      card({ id: 'ladder', kind: 'alert', title: 'Get help now',
        body: `Call 112. On Android, the call can share your location with responders where the state supports it. Nearest: ${helpText}`,
        actions: [{ label: 'Call 112', href: 'tel:112' }, { label: 'Call 1091 (women helpline)', href: 'tel:1091' },
                  smsAction('Alert all contacts', 'alert', {}, 'all'), { label: 'Show help QR', run: 'showQr' }] });
      vibrate([800, 200, 800, 200, 800]);
    }
    log(`Help level ${level} (${why})`);
  }

  /* ================================================================= trips */
  function startTrip({ destName, from, dest, route, mode, prefersMode }) {
    // When she is due, and when silence stops being ordinary. The grace is
    // proportional to the trip, so a ten-minute walk is not written off for
    // being four minutes late, and an hour's journey is not alarmed too soon.
    const started = clock();
    // however the route describes itself, work out how long it should take
    const mins = Number.isFinite(route.durationMin) ? route.durationMin
      : Number.isFinite(route.minutes) ? route.minutes
      : Number.isFinite(route.distanceM) ? Math.max(1, Math.round(route.distanceM / 80)) : 20;
    const dueAt = started + mins * 60000;
    const graceMin = Math.min(20, Math.max(8, Math.round(mins * 0.45)));
    Object.assign(S, { trip: { destName, from, dest, route, mode, prefersMode, startedAt: started,
                               startBattery: H().state.battery.level,
                               minutes: mins, dueAt, graceMin, callByAt: dueAt + graceMin * 60000,
                               told: null, promiseSentAt: null },
                       level: 0, done: {}, offRouteSince: null, ask: null, cards: [] });
    if (root.Native) root.Native.tripStarted(destName);
    card({ id: 'trip', kind: 'info', title: `Trip to ${destName} started`,
           body: `${(route.label || 'Route').length <= 2 ? 'Route ' + route.label : (route.label || 'Route')}, about ${mins} min. ` +
                 `Due by ${hhmm(dueAt)}. I will prepare for low battery and weak signal before they happen.` });
    promptPromise();
    tick();
  }
  /* Ask, once, whether the deadline should leave the phone. Her choice is
     remembered on the trip, and every later message goes to the same person. */
  function promptPromise() {
    if (!S.trip || !S.contacts.length) return;
    if (S.trip.told || S.trip.askedAlready) return;      // she chose while planning
    const due = hhmm(S.trip.dueAt), callBy = hhmm(S.trip.callByAt);
    card({ id: 'promise', kind: 'ask-contact', title: 'Tell someone when you are due?',
      body: `One message: due by ${due}, call if nothing by ${callBy}. Their phone holds the deadline, so it still counts if yours dies.`,
      contacts: S.contacts.map((c, i) => ({ name: c.name, index: i })),
      actions: S.contacts.map((c, i) => ({
        label: `Tell ${c.name}`, href: smsHref(buildSms('promise', { due, callBy }), i === 0 ? 'primary' : 'all'),
        kind: 'promise', to: i,
      })) });
  }

  /* She picked someone (or nobody). From here the trip knows who to tell. */
  function tellWho(index) {
    if (!S.trip) return;
    S.trip.askedAlready = true;
    S.trip.told = index == null ? null : (S.contacts[index] || null);
    S.trip.promiseSentAt = index == null ? null : clock();
    dismiss('promise');
    if (S.trip.told) {
      log('promise', `told ${S.trip.told.name}: due ${hhmm(S.trip.dueAt)}, call by ${hhmm(S.trip.callByAt)}`);
      card({ id: 'promised', kind: 'info', title: `${S.trip.told.name} knows`,
        body: `Due by ${hhmm(S.trip.dueAt)}, call if nothing by ${hhmm(S.trip.callByAt)}. If I see trouble coming I will send the reason before your phone goes quiet.` });
    }
    emit();
  }

  function endTrip(reached = true) {
    if (!S.trip) return;
    const t = S.trip;
    const minutes = Math.max(1, Math.round((clock() - t.startedAt) / 60000));
    if (reached && root.Prefs) {
      const d = new Date(t.startedAt);
      root.Prefs.Trips.add({
        distKm: +(t.route.distanceM / 1000).toFixed(2), hour: d.getHours(), familiar: t.familiar ? 1 : 0,
        battery: t.startBattery ?? 60, rain: 0, mode: t.mode,
        avgSpeedKmh: +((t.route.distanceM / 1000) / (minutes / 60)).toFixed(1),
      });
    }
    if (reached) {
      const body = buildSms('reached', { dest: t.destName });
      if (t.told) {
        // she promised someone: the promise clears itself, she does not have to remember
        autoSend('reached', { dest: t.destName }, 'primary', 'arrived, promise cleared');
        card({ id: 'reached', kind: 'act', title: `Reached ${t.destName}`,
          body: `${t.told.name} has been told you are home. Nothing else to do.`,
          actions: [{ label: `Send again to ${t.told.name}`, href: smsHref(body, 'primary'), kind: 'reached' }] });
      } else {
        card({ id: 'reached', kind: 'suggest', title: `Reached ${t.destName}`,
          body: 'Let your contact know.', actions: [smsAction('Send "reached"', 'reached')] });
      }
    }
    S.trip = null; S.level = 0; S.ask = null;
    if (root.Native) root.Native.tripEnded();
    H().setMode('full');
    emit();
  }

  /* ================================================================== tick */
  /* Compares where she is now against what this place is normally like at this
     hour. Speaks once per trip, never twice near the same spot, and says
     nothing at all unless that cell has enough history to be worth comparing. */
  function checkUnusualQuiet(pos, now) {
    if (!root.Normals || S.done.quiet || S.ask || S.level > 1) return;
    if (now - (S.lastQuietCheck || 0) < 30000) return;
    S.lastQuietCheck = now;
    const st = H().state;
    const current = {
      liveliness: st.sound && st.sound.liveliness != null ? st.sound.liveliness : null,
      light: st.light && st.light.level != null ? st.light.level : null,
      signalDbm: st.signal && st.signal.dbm != null ? st.signal.dbm : null,
    };
    if (current.liveliness == null && current.light == null) return;
    const list = root.Normals.anomaly(pos.lat, pos.lng, current, now)
      .filter(a => a.dir === 'low' && a.z >= 2.5 && a.signal !== 'signal');
    if (!list.length) return;
    if (S.lastQuietAt && H().distanceM(pos.lat, pos.lng, S.lastQuietAt.lat, S.lastQuietAt.lng) < 200) return;

    S.done.quiet = true;
    S.lastQuietAt = { lat: pos.lat, lng: pos.lng };
    const line = root.Normals.sentence(list, now);
    log('unusual', line);
    ask(`${line} This is not how this stretch usually is.`);
  }

  /* When the agent can see a silence coming — a dead zone, or a battery that
     will not last — it says so while there is still signal to say it. */
  function tellReasonAhead(rem, now, pos) {
    const t = S.trip; if (!t || !t.told || !pos) return;
    const callBy = hhmm(t.callByAt), due = hhmm(t.dueAt);

    const dz = deadZoneAhead(pos);
    if (dz && !S.done.quietNote) {
      S.done.quietNote = true;
      const from = hhmm(now + (dz.aheadM / 80) * 60000);
      const to = hhmm(now + ((dz.aheadM + (dz.lengthM || 300)) / 80) * 60000);
      log('reason', `told ${t.told.name}: quiet ${from}–${to} (known dead zone)`);
      autoSend('quietSoon', { from, to, callBy }, 'primary', 'dead zone ahead');
      card({ id: 'quietsoon', kind: 'act', title: 'Telling them before you go quiet',
        body: `No signal expected ${from} to about ${to}. ${t.told.name} will know the silence is the street, not you.`,
        actions: [{ label: `Send to ${t.told.name}`, href: smsHref(buildSms('quietSoon', { from, to, callBy }), 'primary'), kind: 'quietSoon' }] });
    }

    const plan = batteryPlan(rem.min);
    if (plan && !plan.enough && !S.done.dyingNote) {
      S.done.dyingNote = true;
      const at = hhmm(now + plan[plan.mode] * 60000);
      log('reason', `told ${t.told.name}: phone likely dies about ${at}`);
      autoSend('dyingSoon', { at, due, callBy }, 'primary', 'battery will not last');
      card({ id: 'dyingsoon', kind: 'act', title: 'Telling them the phone may die',
        body: `At this drain the phone lasts to about ${at}, and you are due ${due}. ${t.told.name} will know why it went quiet.`,
        actions: [{ label: `Send to ${t.told.name}`, href: smsHref(buildSms('dyingSoon', { at, due, callBy }), 'primary'), kind: 'dyingSoon' }] });
    }
  }

  function tick() {
    const st = H().state;
    const pos = location();
    const now = clock();

    // Pending check-in with no answer
    if (S.ask && now > S.ask.deadline) {
      if (S.ask.round === 0) ask(`${S.ask.reason} No answer yet.`, 1);
      else { const reason = S.ask.reason; S.ask = null; dismiss('ask'); setLevel(2, `no answer: ${reason}`); }
    }
    if (S.level === 2 && S.alertAt && now - S.alertAt > CFG.alertAfterSec * 1000 && !S.done.level3) {
      S.done.level3 = true; setLevel(3, 'alert not acknowledged');
    }

    if (!S.trip || !pos) { emit(); return; }
    const rem = remaining(pos);

    // Arrival
    if (rem.leftM <= CFG.arriveWithinM) { endTrip(true); return; }

    // Keep the trip notification current (Android app)
    if (root.Native && root.Native.isApp && now - (S.lastNote || 0) > 60000) {
      S.lastNote = now;
      root.Native.tripUpdate(`${rem.min} min left${st.battery.level != null ? `, battery ${st.battery.level}%` : ''}`);
    }

    // ---- The reason leaves the phone before the phone does ----
    tellReasonAhead(rem, now, pos);

    // ---- Late, but plainly still walking: a nudge, not an alarm ----
    if (S.trip.told && now > S.trip.callByAt && !S.done.lateNote && st.motion.activity !== 'unknown') {
      S.done.lateNote = true;
      const eta = hhmm(now + rem.min * 60000);
      autoSend('late', { eta }, 'primary', 'running late but still moving');
      card({ id: 'late', kind: 'suggest', title: 'You are past your time',
        body: `${S.trip.told.name} was told ${hhmm(S.trip.callByAt)}. You are still moving, so this is not an alarm — send the new time.`,
        actions: [{ label: `Tell ${S.trip.told.name}`, href: smsHref(buildSms('late', { eta }), 'primary'), kind: 'late' }] });
    }

    // ---- Is this stretch behaving unlike itself tonight? ----
    checkUnusualQuiet(pos, now);

    // ---- Battery: act early, then suggest ----
    const plan = batteryPlan(rem.min);
    if (plan) {
      if (OPT.autoPower && plan.mode !== st.mode && modeRank(plan.mode) > modeRank(st.mode)) {
        H().setMode(plan.mode);
        card({ id: 'power', kind: 'act', title: plan.mode === 'critical' ? 'Critical power saving on' : 'Power saving on',
          body: `Battery ${plan.level}%. The walk needs about ${rem.min} min. ` +
                `Normal use would last about ${plan.full} min; now about ${plan[plan.mode]} min. ` +
                (plan.mode === 'critical' ? 'Sound and camera are off; GPS checks once a minute.' : 'Camera is off; sound checks once a minute.') +
                (plan.measured ? '' : ' (Estimate improves as I learn your phone.)') });
      }
      if (!plan.enough && !S.done.chargeHint) {
        S.done.chargeHint = true;
        const spots = S.pack ? root.Context.nearest(S.pack.help, pos.lat, pos.lng, 2, ['metro', 'shop', 'pharmacy', 'fuel', 'hospital']) : [];
        card({ id: 'charge', kind: 'suggest', title: 'Battery may not last this trip',
          body: (spots.length ? `Places to charge or wait: ${spots.map(s => `${s.name || s.kind}, ${s.distM} m`).join('; ')}. ` : '') +
                'Here are the directions to remember in case the phone switches off.',
          list: S.pack ? S.pack.landmarks[S.trip.route.id] : [] });
      }
      if (plan.level <= CFG.lastMessageAt && !S.done.last) {
        S.done.last = true;
        const eta = hhmm(now + rem.min * 60000), callBy = hhmm(now + (rem.min + 10) * 60000);
        vibrate([400, 100, 400]);
        autoSend('last', { eta, callBy }, 'all', 'battery about to run out');
        card({ id: 'last', kind: 'act', title: 'Phone is about to switch off',
          body: 'Your last message is ready: location, destination and arrival time.',
          actions: [smsAction('Send last message', 'last', { eta, callBy }, 'all')],
          list: S.pack ? S.pack.landmarks[S.trip.route.id] : [] });
      }
    }

    // ---- Connectivity: diagnose and switch channel ----
    // The channel switches quietly: she does not need a card about mobile data.
    // Only battery, movement and the trip itself raise alerts.
    const diag = st.net.diagnosis;
    if (diag !== 'ok' && diag !== 'weak') {
      if (S.channel !== 'sms') { S.channel = 'sms'; log('Messages switched to SMS'); }
    } else if (S.channel === 'sms') {
      S.channel = 'app';
      log('Back in network');
      flushQueue();
    }

    // ---- Dead zone ahead: prepare before it happens ----
    const zone = deadZoneAhead(pos);
    if (OPT.deadZone && zone && !S.done[`zone-${zone.id}`]) {
      S.done[`zone-${zone.id}`] = true;
      if (diag === 'ok') refreshPack();                       // act: nothing lost
      const reach = Math.round(zone.aheadM / tripSpeed());
      const outBy = hhmm(now + (reach + zone.avgMin) * 60000);
      const callBy = hhmm(now + (reach + zone.avgMin + 5) * 60000);
      card({ id: 'zone', kind: 'suggest', title: `Signal usually drops ${zone.aheadM} m ahead`,
        body: `For about ${zone.avgMin} min${zone.source === 'SIM' ? ' (simulated data)' : ''}. Offline pack is saved. Send a check-in now so your contact knows when to expect you.`,
        actions: [smsAction('Send check-in', 'checkin', { outBy, callBy })] });
    }

    // ---- Unusual movement: ask first ----
    const m = S.motion;
    const cooled = now - S.lastAnomalyAt > CFG.anomalyCooldownSec * 1000;
    if (OPT.checkins && !S.ask && cooled) {
      if (m.lastJolt && now - m.lastJolt < 8000) ask('I felt a sudden jolt.');
      else if (onFoot() && m.runSince && now - m.runSince > CFG.runAskAfterSec * 1000) ask('You started running suddenly.');
      else if (m.stillSince && now - m.stillSince > stopLimit() * 1000) ask(`You have stopped for ${Math.round((now - m.stillSince) / 60000)} min.`);
    }
    if (S.level === 1 && !S.ask && now - S.lastStayCheck > CFG.stayWithMeEverySec * 1000) {
      S.lastStayCheck = now; ask('Checking in, as you asked.');
    }

    // ---- Off route ----
    if (rem.offM > CFG.offRouteM) {
      S.offRouteSince = S.offRouteSince || now;
      if (now - S.offRouteSince > CFG.offRouteSec * 1000 && !S.done.offroute) {
        S.done.offroute = true;
        card({ id: 'offroute', kind: 'suggest', title: 'You are off the planned route',
               body: `About ${rem.offM} m away. Replan from here?`, actions: [{ label: 'Replan', run: 'replan' }] });
      }
    } else { S.offRouteSince = null; S.done.offroute = false; }

    emit();
  }

  function stopLimit() {
    // Vehicles stop in traffic all the time, so wait longer before asking
    return onFoot() ? CFG.stopAskAfterSec : CFG.vehicleStopAskAfterSec;
  }
  const modeRank = m => ({ full: 0, eco: 1, critical: 2 })[m];

  /* ========================================================= offline pack */
  async function refreshPack() {
    if (!S.trip || !root.Context) return;
    try {
      const from = location() || S.trip.from;
      const fresh = await root.Context.buildPack({ from, to: S.trip.dest, mode: S.trip.mode,
        destName: S.trip.destName, contacts: S.contacts, readings: S.readings });
      if (S.pack && !fresh.help.length) fresh.help = S.pack.help;
      if (S.pack && S.pack.landmarks) fresh.landmarks = { ...S.pack.landmarks, ...fresh.landmarks };
      S.pack = fresh;
      log('Offline pack refreshed');
    } catch (e) { log(`Offline pack not refreshed: ${e.message}`); }
  }
  function flushQueue() {
    if (!S.queue.length) return;
    card({ id: 'queue', kind: 'suggest', title: `${S.queue.length} message(s) waiting`,
           body: 'They could not be sent earlier.', actions: S.queue.map(q => smsAction(q.label, q.kind, q.extra)) });
    S.queue = [];
  }
  const log = text => { S.log.unshift({ t: clock(), kind: 'log', text }); S.log = S.log.slice(0, 60); };

  /* =========================================================== events in */
  function wire() {
    const hub = H();
    hub.on('battery', b => { if (b.level != null) { S.batt.push({ t: clock(), level: b.level, mode: hub.state.mode }); S.batt = S.batt.filter(p => p.t > clock() - 30 * 60000); } });
    hub.on('motion', mo => {
      const now = clock(), m = S.motion;
      if (mo.activity === 'still') m.stillSince = m.stillSince || now; else m.stillSince = null;
      if (mo.activity === 'run') m.runSince = m.runSince || now; else if (mo.activity !== 'jolt') m.runSince = null;
      if (mo.activity === 'jolt') m.lastJolt = now;
      m.activity = mo.activity;
    });
    hub.on('sound', s => {
      const pos = location();
      if (pos && s.liveliness != null) {
        S.readings.push({ lat: pos.lat, lng: pos.lng, t: clock(), liveliness: s.liveliness,
                          light: hub.state.light.level, dogPack: s.isPack, dbfs: s.dbfs,
                          gpsAcc: hub.state.gps.acc, motionStd: hub.state.motion.std,
                          walking: hub.state.motion.activity === 'walk',
                          signalDbm: hub.state.signal.dbm, signalWeak: hub.state.signal.weak,
                          contributor: 'me', tier: 'me', trust: 1, kind: 'sensor', status: 'confirmed' });
        S.readings = S.readings.slice(-500);
      }
    });
    hub.on('net', () => { if (!S.replay) tick(); });
    hub.on('mode', () => { S.modeSince = clock(); restartLoop(); });
  }
  let loop = null;
  function restartLoop() {
    clearInterval(loop);
    if (S.replay) return;
    loop = setInterval(tick, CFG.tickMs[H().state.mode] || 5000);
  }

  /* ================================================================ replay */
  // Plays a scripted walk along the planned route so the demo does not need
  // a real dead zone or a dying battery. Events fire at a fraction of the route.
  const DEMO_SCRIPT = [
    { at: 0.00, patch: { battery: 24, net: 'ok', signal: { dbm: -86, level: 3, type: '4G', weak: false }, light: 110, sound: { liveliness: 0.62, dogConf: 0.05, isPack: false } }, note: 'Leaves college' },
    { at: 0.15, patch: { sound: { liveliness: 0.35, dogConf: 0.81, isPack: true } }, note: 'Dog pack heard' },
    { at: 0.25, patch: { battery: 17, light: 45 }, note: 'Battery falling fast' },
    { at: 0.35, patch: { battery: 13 } },
    { at: 0.45, patch: { net: 'cellular_no_data', signal: { dbm: -114, level: 0, type: '4G', weak: true }, sound: { liveliness: 0.12, dogConf: 0.02, isPack: false } }, note: 'Enters low-signal stretch' },
    { at: 0.55, hold: 'still', holdSec: 200, patch: { battery: 9 }, note: 'Stops for over 3 minutes' },
    { at: 0.70, patch: { net: 'ok', signal: { dbm: -91, level: 3, type: '4G', weak: false }, battery: 6, light: 95 }, note: 'Signal back' },
    { at: 0.85, patch: { battery: 4 }, note: 'Phone about to die' },
    { at: 1.00, patch: {}, note: 'Arrives' },
  ];
  function startReplay({ speed = 20, script = DEMO_SCRIPT, onStep } = {}) {
    if (!S.trip) throw new Error('Start a trip first, then play the demo walk.');
    stopReplay();
    const coords = S.trip.route.coords;
    const total = root.Context.locateOnRoute(coords, coords[coords.length - 1][1], coords[coords.length - 1][0]).totalM;
    const r = S.replay = { now: Date.now(), speed, along: 0, total, fired: new Set(), holdUntil: 0, timer: null };
    H().inject({ motion: { std: 1.2 } });
    const stepMs = 500;
    r.timer = setInterval(() => {
      r.now += stepMs * speed;
      const holding = r.now < r.holdUntil;
      if (!holding) r.along = Math.min(total, r.along + tripSpeed() * (stepMs * speed / 60000));
      const frac = r.along / total;
      for (const [i, ev] of script.entries()) {
        if (r.fired.has(i) || frac < ev.at) continue;
        r.fired.add(i);
        H().inject(ev.patch);
        if (ev.hold === 'still') { r.holdUntil = r.now + ev.holdSec * 1000; H().inject({ motion: { std: 0.1 } }); }
        if (ev.note) log(`Demo: ${ev.note}`);
        onStep && onStep(ev);
      }
      const stillNow = r.now < r.holdUntil;
      if (!stillNow && S.motion.activity === 'still') H().inject({ motion: { std: 1.2 } });
      const p = pointAt(coords, r.along);
      H().inject({ gps: { lat: p[1], lng: p[0], speedKmh: stillNow ? 0 : +(tripSpeed() * 0.06).toFixed(1) } });
      tick();
      if (!S.trip || r.along >= total) stopReplay();
    }, stepMs);
  }
  function stopReplay() {
    if (!S.replay) return;
    clearInterval(S.replay.timer);
    S.replay = null;
    H().endInject();
    restartLoop();
    emit();
  }
  function pointAt(coords, alongM) {
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const seg = H().distanceM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
      if (acc + seg >= alongM) {
        const f = seg ? (alongM - acc) / seg : 0;
        return [coords[i - 1][0] + f * (coords[i][0] - coords[i - 1][0]), coords[i - 1][1] + f * (coords[i][1] - coords[i - 1][1])];
      }
      acc += seg;
    }
    return coords[coords.length - 1];
  }

  /* ============================================================ public API */
  function view() {
    return {
      trip: S.trip && { destName: S.trip.destName, route: S.trip.route.label, mode: S.trip.mode,
                        minutes: S.trip.minutes, dueAt: S.trip.dueAt, callByAt: S.trip.callByAt,
                        told: S.trip.told ? { name: S.trip.told.name } : null },
      level: S.level, ask: S.ask, cards: S.cards, log: S.log, channel: S.channel,
      replaying: !!S.replay, clock: clock(),
      battery: S.trip && location() ? batteryPlan(remaining(location()).min) : null,
    };
  }

  root.Agent = {
    init({ name, contacts, zones } = {}) {
      if (name) S.name = name;
      if (contacts) S.contacts = contacts;
      if (zones) S.zones = zones;
      wire(); restartLoop();
    },
    setContacts: c => { S.contacts = c; },
    setName: n => { S.name = n; },
    setZones: z => { S.zones = z; },
    setPack: p => { S.pack = p; },
    setOptions: o => Object.assign(OPT, o), get options() { return { ...OPT }; },
    readings: () => S.readings.slice(),
    addReadings: r => { S.readings.push(...r); },
    startTrip, endTrip, answer, tick, dismiss,
    sos() { setLevel(3, 'SOS'); autoSend('alert', {}, 'all', 'SOS'); },
    note: c => card(c),
    startReplay, stopReplay, onChange: fn => listeners.push(fn),
    buildSms, smsHref, batteryPlan, tellWho, config: CFG, DEMO_SCRIPT,
    get state() { return view(); },
    _S: S,
  };
})(typeof window !== 'undefined' ? window : globalThis);

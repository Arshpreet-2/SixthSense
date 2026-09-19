/* ============================================================================
 * store.js — Store
 * Local data layer with the same shape the Firebase backend will have
 * (Project Report v1.5, Sections 14–17). Everything is saved on this phone
 * for now; Angel answers and matches are simulated and marked "sim".
 * Swap the internals for Firebase later without touching the screens.
 * Exposes: window.Store
 * ========================================================================== */
(function (root) {
  'use strict';

  const KEY = 'ss.store.v1';
  /* Four levels of verification:
       Verified woman  — women-only institution email, DigiLocker, an NGO partner, or 2+ vouches
       Verified member — any gender, a verified ID plus 2+ vouches
       ID checked      — a photo ID and a liveness check
       New member      — signed in only                                            */
  const TIERS = {
    gold:    { label: 'Verified woman',  weight: 1,   canConfirmPositive: true },
    partner: { label: 'Verified woman',  weight: 1,   canConfirmPositive: true },
    woman:   { label: 'Verified woman',  weight: 1,   canConfirmPositive: true },
    other:   { label: 'Verified member', weight: 0.6, canConfirmPositive: false },
    idonly:  { label: 'ID checked',      weight: 0.4, canConfirmPositive: false },
    basic:   { label: 'New member',      weight: 0.2, canConfirmPositive: false },
    none:    { label: 'Not verified',    weight: 0,   canConfirmPositive: false },
  };
  const HALO = [[0, 'Spark'], [50, 'Glow'], [150, 'Shine'], [400, 'Radiant']];
  const ANGEL_NAMES = ['Priya', 'Ananya', 'Ritika', 'Sneha', 'Meera', 'Isha', 'Tanvi', 'Nidhi'];

  const listeners = {};
  const emit = (k, v) => (listeners[k] || []).forEach(fn => { try { fn(v); } catch (e) { console.error(e); } });
  const on = (k, fn) => ((listeners[k] = listeners[k] || []).push(fn), () => { listeners[k] = listeners[k].filter(f => f !== fn); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const id = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const D = load() || {
    me: { uid: id('u'), tier: 'none', verifiedAt: null, method: null, confirmed: 0, rejected: 0, rejectedPositive: 0,
          halo: 0, badges: [], hearts: [], helped: 0, answered: 0, demo: false },
    reports: [], questions: [], sessions: [], walks: [],
    angel: { available: false, from: '18:00', to: '23:00', radiusM: 500 },
    circles: [
      { id: 'c-igdtuw', name: 'IGDTUW Circle', members: 214, joined: true, posts: [
        { a: 'Tanvi', tier: 'gold', t: Date.now() - 50 * 60000, b: 'Streetlight near Gate 2 is working again.' },
        { a: 'Isha', tier: 'gold', t: Date.now() - 3 * 3600000, b: 'Leaving for Kashmere Gate metro around 8:30 pm, anyone walking?' },
      ] },
      { id: 'c-civil', name: 'Civil Lines PGs', members: 87, joined: false, posts: [
        { a: 'Meera', tier: 'woman', t: Date.now() - 2 * 3600000, b: 'Back lane behind the market is dark again tonight.' },
      ] },
      { id: 'c-kg', name: 'Kashmere Gate commuters', members: 156, joined: false, posts: [] },
    ],
  };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* storage full */ } emit('change', D); }

  /* ------------------------------------------------------------- identity */
  /* Reputation, 0 to 1: the lower bound of a Wilson interval on her confirmed
     rate. It is deliberately pessimistic while the sample is small, so nobody
     looks trustworthy after two lucky reports, and it rises as the record
     grows. A report that was wrong in a way that made a place look better
     counts twice against her. */
  function wilson(good, bad, z = 1.96) {
    const n = good + bad;
    if (n === 0) return 0;
    const p = good / n, d = 1 + z * z / n;
    const centre = p + z * z / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
    return Math.max(0, (centre - margin) / d);
  }
  const reputation = () => {
    const m = D.me;
    return +wilson(m.confirmed, m.rejected + 2 * m.rejectedPositive).toFixed(2);   // 0.00–1.00
  };
  /* The same score for anyone else, from the counts the backend holds */
  const reputationOf = (confirmed = 0, rejected = 0, rejectedPositive = 0) =>
    +wilson(confirmed, rejected + 2 * rejectedPositive).toFixed(2);
  /* What the number means, in words, so it is never read as a safety rating */
  const reputationWord = r => r >= 0.8 ? 'well established' : r >= 0.6 ? 'established'
    : r >= 0.35 ? 'building a record' : r > 0 ? 'new' : 'no record yet';
  const effectiveTrust = () => +(TIERS[D.me.tier].weight * (0.6 + 0.4 * reputation())).toFixed(2);
  const haloLevel = () => HALO.filter(([p]) => D.me.halo >= p).pop()[1];

  function me() {
    return { ...D.me, tierLabel: TIERS[D.me.tier].label, weight: TIERS[D.me.tier].weight,
             reputation: reputation(), trust: effectiveTrust(), haloLevel: haloLevel(),
             reputationWord: reputationWord(reputation()),
             canAngel: ['gold', 'partner', 'woman'].includes(D.me.tier)
                       && (reputation() >= 0.5 || (D.me.confirmed + D.me.rejected) < 5) };
  }
  function demoSignIn() {
    Object.assign(D.me, { tier: 'gold', verifiedAt: Date.now(), method: 'demo', demo: true, halo: Math.max(D.me.halo, 62),
                          badges: D.me.badges.length ? D.me.badges : ['Night Owl'] });
    save(); return me();
  }
  // Verification result from the verify screen. Images are never stored.
  function setVerified({ method, email }) {
    const tier = method === 'igdtuw' && /@igdtuw\.ac\.in$/i.test(email || '') ? 'gold'
      : method === 'partner' ? 'partner' : method === 'digilocker-woman' ? 'woman' : method === 'photo-id' ? 'other' : 'basic';
    Object.assign(D.me, { tier, method, verifiedAt: Date.now() });
    save();
    if (cloudOn()) root.Cloud.setTier(tier).catch(() => {});
    return me();
  }
  const signOut = () => { Object.assign(D.me, { tier: 'none', verifiedAt: null, method: null, demo: false }); save();
    if (root.Cloud && root.Cloud.signedIn) root.Cloud.signOut().catch(() => {}); };

  /* -------------------------------------------------------------- reports */
  // claims: { light: 'well lit'|'dark'..., crowd, shops, path, dogs } → polarity per claim
  const POSITIVE = /well lit|very well lit|comfortable|moderately crowded|mostly open|some open|very safe|^safe$|none/i;
  function polarityOf(key, value) {
    if (key === 'dogs') return value === 'None' ? 'positive' : 'negative';
    if (key === 'crowd') return /isolated|quiet/i.test(value) ? 'negative' : 'positive';
    return POSITIVE.test(value) ? 'positive' : 'negative';
  }
  const cloudOn = () => root.Cloud && root.Cloud.signedIn;

  function addReport({ lat, lng, place, claims, readingsAgree, note, tags, unusual, light, liveliness, dogPack, source }) {
    const m = me();
    claims = claims || {};
    const polarity = Object.entries(claims).some(([k, v]) => v && polarityOf(k, v) === 'positive') ? 'positive' : 'negative';
    let status = 'pending';
    if (m.tier === 'gold' || m.tier === 'partner') status = 'confirmed';
    else if (readingsAgree) status = 'confirmed';
    const r = { id: id('r'), t: Date.now(), lat, lng, place, claims, polarity, status, tier: m.tier, trust: m.trust,
                contributor: D.me.uid, kind: 'report', confirmations: [],
                note, tags, unusual: unusual || null, light, liveliness, dogPack, source };
    D.reports.unshift(r);
    if (status === 'confirmed') confirmed(r);
    save();
    if (cloudOn()) {
      root.Cloud.addReport(r).then(id => { if (id) { r.cloudId = id; save(); } }).catch(() => {});
    } else if (status === 'pending') {
      simulateConfirm(r);   // demo: simulated confirmation when there is no backend
    }
    return r;
  }
  function confirmed(r) {
    if (r.contributor !== D.me.uid) return;
    D.me.confirmed++; D.me.halo += 10;
    if (/light/.test(Object.keys(r.claims).join()) && D.me.confirmed >= 3 && !D.me.badges.includes('Lamp Lighter')) D.me.badges.push('Lamp Lighter');
  }
  async function simulateConfirm(r) {
    await wait(6000);
    const x = D.reports.find(y => y.id === r.id);
    if (!x || x.status !== 'pending') return;
    const tier = x.polarity === 'positive' ? 'gold' : 'woman';
    x.confirmations.push({ tier, sim: true, t: Date.now() });
    const total = x.trust + x.confirmations.reduce((a, c) => a + TIERS[c.tier].weight, 0);
    if (total >= 1 && (x.polarity === 'negative' || x.confirmations.some(c => TIERS[c.tier].canConfirmPositive))) {
      x.status = 'confirmed'; confirmed(x);
      emit('report', { id: x.id, status: 'confirmed', text: `Your report on ${x.place} was confirmed by a verified member (simulated).` });
    }
    save();
  }
  function dispute(reportId) {
    const x = D.reports.find(y => y.id === reportId);
    if (!x) return null;
    x.status = 'disputed'; x.disputedAt = Date.now(); save();
    // Local check: simulated nearby women answer; weighted majority decides
    setTimeout(() => {
      const votes = [['gold', 'agree'], ['woman', 'disagree'], ['gold', 'agree']];
      const agree = votes.filter(v => v[1] === 'agree').reduce((a, v) => a + TIERS[v[0]].weight, 0);
      const disagree = votes.filter(v => v[1] === 'disagree').reduce((a, v) => a + TIERS[v[0]].weight, 0);
      x.status = agree >= disagree ? 'confirmed' : 'rejected';
      x.votes = votes;
      if (x.contributor === D.me.uid) {
        if (x.status === 'rejected') x.polarity === 'positive' ? D.me.rejectedPositive++ : D.me.rejected++;
        else confirmed(x);
      }
      emit('report', { id: x.id, status: x.status, text: `Local check on ${x.place}: ${x.status} (3 nearby members answered, simulated).` });
      save();
    }, 5000);
    return x;
  }
  // Reports as readings for scoring
  function reportReadings() {
    const mine = ownReadings();
    const theirs = (D.remote || []).map(r => ({
      lat: r.lat, lng: r.lng, t: r.t, kind: 'report', status: r.status, polarity: r.polarity,
      trust: r.trust, tier: r.tier, contributor: r.by,
      light: LIGHT_LEVEL[r.claims && r.claims.light] ?? null,
      liveliness: ACT_LEVEL[r.claims && r.claims.crowd] ?? null,
      dogPack: r.claims && r.claims.dogs ? /Several|Many/.test(r.claims.dogs) : null,
    }));
    return mine.concat(theirs);
  }
  const LIGHT_LEVEL = { 'Very well lit': 200, 'Well lit': 150, 'Adequate': 90, 'Poorly lit': 40, 'Very poorly lit': 15 };
  const ACT_LEVEL = { 'Very crowded': 0.9, 'Moderately crowded': 0.7, 'Comfortable': 0.55, 'Quiet': 0.2, 'Very isolated': 0.05 };
  function ownReadings() {
    return D.reports.filter(r => r.lat != null).map(r => ({
      lat: r.lat, lng: r.lng, t: r.t, kind: 'report', status: r.status, polarity: r.polarity,
      trust: r.trust, tier: r.tier, contributor: r.contributor,
      light: LIGHT_LEVEL[r.claims.light] ?? null, liveliness: ACT_LEVEL[r.claims.crowd] ?? null,
      dogPack: r.claims.dogs ? /Several|Many/.test(r.claims.dogs) : null,
    }));
  }

  /* --------------------------------------------------------------- Angels */
  const TAPS = {
    lighting: ['Well lit', 'Some dark stretches', 'Dark'],
    people: ['Busy', 'Some people', 'Empty'],
    shops: ['Many', 'Few', 'None'],
    watch: ['Nothing', 'Dogs', 'Men loitering', 'Road work', 'Other'],
  };
  function askAngels({ place, lat, lng, when }) {
    if (cloudOn()) {
      const pending = { id: 'q-pending', place, lat, lng, when, t: Date.now(), answers: [], status: 'asking' };
      D.questions.unshift(pending); save();
      root.Cloud.ask({ place, lat, lng, when })
        .then(q => { D.questions = D.questions.filter(x => x.id !== 'q-pending'); emit('answer', { qid: q.id, swap: q.id }); })
        .catch(() => { D.questions = D.questions.filter(x => x.id !== 'q-pending'); askLocal({ place, lat, lng, when }); });
      return pending;
    }
    return askLocal({ place, lat, lng, when });
  }
  function askLocal({ place, lat, lng, when }) {
    const q = { id: id('q'), place, lat, lng, when, t: Date.now(), answers: [], status: 'asking' };
    D.questions.unshift(q); save();
    // Simulated Angels near the place answer over the next seconds
    const n = 3;
    const pool = ANGEL_NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const dark = root.Light ? root.Light.isDark(lat, lng) : false;
        const a = {
          by: pool[i], tier: i === 2 ? 'woman' : 'gold', halo: ['Glow', 'Shine', 'Spark'][i],
          t: Date.now(), sim: true,
          lighting: dark ? (i === 1 ? 'Some dark stretches' : 'Well lit') : 'Well lit',
          people: i === 0 ? 'Busy' : 'Some people',
          shops: i === 2 ? 'Few' : 'Many',
          watch: i === 1 && dark ? 'Dogs' : 'Nothing',
          note: i === 0 ? 'Use the main gate side; the back lane is quieter.' : '',
          sensor: { light: dark ? (i === 1 ? 60 : 130) : 220, activity: i === 0 ? 0.7 : 0.45 },
        };
        const x = D.questions.find(y => y.id === q.id);
        if (!x) return;
        x.answers.push(a);
        if (x.answers.length >= n) x.status = 'answered';
        save(); emit('answer', { qid: q.id, answer: a });
      }, 2500 + i * 2200);
    }
    return q;
  }
  const question = qid => D.questions.find(q => q.id === qid);
  function pulse(q) {
    if (!q || !q.answers.length) return null;
    const count = key => {
      const c = {};
      for (const a of q.answers) c[a[key]] = (c[a[key]] || 0) + 1;
      return Object.entries(c).sort((a, b) => b[1] - a[1]);
    };
    const w = q.answers.reduce((s, a) => s + TIERS[a.tier].weight, 0);
    const agreeLight = count('lighting')[0][1];
    // Positive answers need 2+ Angels agreeing (or matching sensors)
    const conf = w >= 2 && agreeLight >= 2 ? 'high' : w >= 1 ? 'medium' : 'low';
    const newest = Math.round((Date.now() - Math.max(...q.answers.map(a => a.t))) / 60000);
    const oldest = Math.round((Date.now() - Math.min(...q.answers.map(a => a.t))) / 60000);
    return { n: q.answers.length, lighting: count('lighting'), people: count('people'), shops: count('shops'),
             watch: count('watch').filter(([k]) => k !== 'Nothing'), notes: q.answers.filter(a => a.note),
             confidence: conf, age: newest === oldest ? `${newest} min ago` : `${newest}–${oldest} min ago` };
  }
  function rateAnswer(qid, helpful) {
    const q = question(qid); if (!q) return;
    q.rated = helpful; save();
  }
  function heart(name, note) {
    D.me.helped++; save();
    return { to: name, note };
  }

  // Angel Nearby
  function requestAngel({ area }) {
    const s = { id: id('s'), area, t: Date.now(), status: 'searching', messages: [] };
    D.sessions.unshift(s); save();
    setTimeout(() => {
      const x = D.sessions.find(y => y.id === s.id);
      if (!x || x.status !== 'searching') return;
      Object.assign(x, { status: 'offered', angel: { name: 'Ritika', tier: 'gold', halo: 'Shine', distM: 420, etaMin: 6, sim: true },
                         meet: 'Kashmere Gate Metro, Gate 2 (staffed)' });
      save(); emit('session', x);
    }, 3500);
    return s;
  }
  function acceptAngel(sid) {
    const x = D.sessions.find(y => y.id === sid); if (!x) return;
    x.status = 'active'; x.startedAt = Date.now();
    x.messages.push({ from: 'angel', b: 'I\'m on my way. Meet at Gate 2, I\'ll wait inside the gate.', t: Date.now() });
    save(); emit('session', x);
    const tick = setInterval(() => {
      const y = D.sessions.find(z => z.id === sid);
      if (!y || y.status !== 'active') return clearInterval(tick);
      y.angel.distM = Math.max(0, y.angel.distM - 70);
      y.angel.etaMin = Math.max(0, Math.round(y.angel.distM / 80));
      if (y.angel.distM === 0 && !y.arrived) { y.arrived = true; y.messages.push({ from: 'angel', b: 'I\'m here.', t: Date.now() }); }
      save(); emit('session', y);
    }, 3000);
  }
  function sessionMessage(sid, b) {
    const x = D.sessions.find(y => y.id === sid); if (!x) return;
    x.messages.push({ from: 'me', b, t: Date.now() }); save(); emit('session', x);
  }
  function endSession(sid, rating) {
    const x = D.sessions.find(y => y.id === sid); if (!x) return;
    x.status = 'ended'; x.endedAt = Date.now(); if (rating) x.rating = rating;
    save(); emit('session', x);
  }
  const session = sid => D.sessions.find(y => y.id === sid);

  // Walk Together
  function walkTogether({ from, to }) {
    const matches = [
      { name: 'Isha', tier: 'gold', halo: 'Glow', leaves: 'in 6 min', from: from, to: 'towards ' + to, meet: 'IGDTUW main gate', sim: true },
      { name: 'Nidhi', tier: 'gold', halo: 'Spark', leaves: 'in 9 min', from: from, to: 'towards ' + to, meet: 'IGDTUW main gate', sim: true },
    ];
    const w = { id: id('w'), from, to, t: Date.now(), matches, status: 'matching' };
    D.walks.unshift(w); save();
    return w;
  }
  function joinWalk(wid, name) {
    const w = D.walks.find(x => x.id === wid); if (!w) return;
    w.status = 'joined'; w.with = name; save();
    return w;
  }
  function finishWalk(wid) {
    const w = D.walks.find(x => x.id === wid); if (!w) return;
    w.status = 'done';
    D.me.halo += 5;
    const done = D.walks.filter(x => x.status === 'done').length;
    if (done >= 5 && !D.me.badges.includes('Walk Buddy')) D.me.badges.push('Walk Buddy');
    save();
  }

  // Being an Angel
  function setAngel(patch) { Object.assign(D.angel, patch); save(); if (cloudOn()) root.Cloud.setAngel({ ...D.angel }).catch(() => {}); }
  function inbox() {
    if (!D.angel.available) return [];
    if (cloudOn()) return (D.cloudInbox || []).filter(q => !(D.answeredInbox || []).includes(q.id));
    return [{ id: 'in-1', place: 'Kashmere Gate Metro, Gate 2', distM: 220, when: 'now', t: Date.now() - 60000, sim: true }]
      .filter(q => !(D.answeredInbox || []).includes(q.id));
  }
  function answerInbox(qid, taps) {
    if (cloudOn()) {
      const hub = root.SensorHub && root.SensorHub.state;
      root.Cloud.answerQuestion(qid, taps, hub ? { light: hub.light.level, activity: hub.sound.liveliness } : null).catch(() => {});
    }
    D.answeredInbox = (D.answeredInbox || []).concat(qid);
    D.me.answered++; D.me.halo += 3;
    if (new Date().getHours() >= 21 && !D.me.badges.includes('Night Owl')) D.me.badges.push('Night Owl');
    if (!D.me.badges.includes('First Responder')) D.me.badges.push('First Responder');
    save();
    return { taps, points: 3 };
  }

  // Circles
  const circles = () => D.circles;
  function joinCircle(cid) { const c = D.circles.find(x => x.id === cid); if (c) { c.joined = !c.joined; c.members += c.joined ? 1 : -1; save(); } }
  function postCircle(cid, b, name) {
    const c = D.circles.find(x => x.id === cid); if (!c || !b.trim()) return;
    c.posts.unshift({ a: name || 'You', tier: D.me.tier, t: Date.now(), b: b.trim() }); save();
  }

  function reset() { localStorage.removeItem(KEY); }

  root.Store = {
    TIERS, TAPS, on, me, demoSignIn, setVerified, signOut,
    addReport, dispute, reports: () => D.reports, reportReadings,
    unusualNear: (lat, lng, withinM = 1500, now = Date.now()) =>
      (D.reports || []).concat(D.remote || [])
        .filter(r => r.unusual && (r.unusualUntil ? r.unusualUntil > now : (now - r.t) < 6 * 3600000)
                  && root.SensorHub.distanceM(lat, lng, r.lat, r.lng) <= withinM)
        .map(r => ({ ...r, distM: Math.round(root.SensorHub.distanceM(lat, lng, r.lat, r.lng)) }))
        .sort((a, b) => a.distM - b.distM),
    askAngels, question, pulse, rateAnswer, heart,
    requestAngel, acceptAngel, sessionMessage, endSession, session,
    walkTogether, joinWalk, finishWalk, walks: () => D.walks, cancelWalk: wid => { D.walks = D.walks.filter(x => x.id !== wid); save(); },
    angel: () => ({ ...D.angel }), setAngel, inbox, answerInbox,
    circles, joinCircle, postCircle, reset,
    TIER_OF: m => TIERS[m] || TIERS.none,
    get backend() { return root.Cloud && root.Cloud.on ? 'Firebase (' + root.Cloud.status + ')' : 'this phone only'; },
    // Used by the Firebase layer to keep the same screens working with live data
    reputationOf, reputationWord,
    _internal: { D, save, emit, id, reputation, wilson },
  };
})(typeof window !== 'undefined' ? window : globalThis);

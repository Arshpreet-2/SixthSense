/* ============================================================================
 * firebase.js — Cloud
 * The backend for SixthSense (Project Report v1.5, Section 17).
 * Free (Spark) plan: email-link and Google sign-in, Firestore, security rules.
 * Phone OTP and server functions need the paid plan and are not used here.
 *
 * What runs through the backend:
 *   • accounts, verification tier, reputation, halo points
 *   • audits (reports) shared between phones, with the confirmation rules
 *   • Ask Angels: questions and answers, live between phones
 *   • Angel availability (rough area only)
 * Everything else stays on the phone. The screens do not change: this file
 * keeps window.Store's data in step with Firestore.
 * Exposes: window.Cloud
 * ========================================================================== */
(function (root) {
  'use strict';

  const CONFIG = {
    apiKey: 'AIzaSyCwHAP8DTbQXtVPXUtU2NdUrzkIafU-Mtg',
    authDomain: 'sixthsense-b8fcd.firebaseapp.com',
    projectId: 'sixthsense-b8fcd',
    storageBucket: 'sixthsense-b8fcd.firebasestorage.app',
    messagingSenderId: '94124991302',
    appId: '1:94124991302:web:bb90de1a41602d524b7b47',
  };
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.0/';
  const AREA_M = 500;            // Angels near a place
  const QUESTION_LIFE = 30 * 60000;
  const READING_LIFE = 2 * 3600000;
  const life = () => (typeof S !== 'undefined' && S.demoData ? 7 * 24 * 3600000 : READING_LIFE);

  const listeners = {};
  const emit = (k, v) => (listeners[k] || []).forEach(fn => { try { fn(v); } catch (e) { console.error(e); } });
  const on = (k, fn) => ((listeners[k] = listeners[k] || []).push(fn), () => { listeners[k] = listeners[k].filter(f => f !== fn); });

  let fb = null, auth = null, db = null, user = null, unsubs = [];
  const S = { status: 'off', error: null };
  const St = () => root.Store._internal;

  /* ----------------------------------------------------------- connect */
  async function init() {
    if (typeof S !== 'undefined' && S.offline) return null;   // offline mode: no cloud
    if (fb) return fb;
    S.status = 'connecting'; emit('status', S);
    try {
      const [app, a, f] = await Promise.all([
        import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
      ]);
      fb = { app, a, f };
      const application = app.initializeApp(CONFIG);
      auth = a.getAuth(application);
      db = f.getFirestore(application);
      a.onAuthStateChanged(auth, u => { user = u; u ? afterSignIn(u) : afterSignOut(); });
      await finishEmailLink();
      S.status = 'connected'; S.error = null;
    } catch (e) {
      S.status = 'offline'; S.error = e.message;
    }
    emit('status', S);
    return fb;
  }

  /* -------------------------------------------------------------- auth */
  // The link must return to a domain Firebase allows. On any other host (a preview,
  // a file, a new deployment not yet listed) we send it to the project's own domain.
  function continueUrl() {
    const h = location.hostname;
    const allowed = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.web.app') ||
                    h.endsWith('.firebaseapp.com') || h.endsWith('sixth-sense-rose.vercel.app');
    return allowed ? location.origin + location.pathname + '#signin'
                   : 'https://' + CONFIG.authDomain + '/#signin';
  }
  async function sendSignInLink(email) {
    await init();
    if (!fb) throw new Error('No internet connection.');
    try {
      await fb.a.sendSignInLinkToEmail(auth, email, { url: continueUrl(), handleCodeInApp: true });
    } catch (e) {
      if (e.code === 'auth/invalid-continue-uri' || e.code === 'auth/unauthorized-continue-uri') {
        // fall back to the project domain, which is always allowed
        await fb.a.sendSignInLinkToEmail(auth, email, { url: 'https://' + CONFIG.authDomain + '/#signin', handleCodeInApp: true });
      } else throw e;
    }
    localStorage.setItem('ss.signin.email', email);
    return true;
  }
  async function finishEmailLink() {
    if (!fb || !fb.a.isSignInWithEmailLink(auth, location.href)) return false;
    let email = localStorage.getItem('ss.signin.email');
    if (!email) email = prompt('Confirm the email you used to sign in');
    if (!email) return false;
    await fb.a.signInWithEmailLink(auth, email, location.href);
    localStorage.removeItem('ss.signin.email');
    history.replaceState(null, '', location.pathname);
    return true;
  }
  async function signInPassword(email, password) {
    await init();
    if (!fb) throw new Error('No internet connection.');
    try { await fb.a.signInWithEmailAndPassword(auth, email, password); }
    catch (e) {
      if (e.code === 'auth/user-not-found') await fb.a.createUserWithEmailAndPassword(auth, email, password);
      else throw e;
    }
    return true;
  }

  async function signInGoogle() {
    await init();
    if (!fb) throw new Error('No internet connection.');
    const provider = new fb.a.GoogleAuthProvider();
    try {
      await fb.a.signInWithPopup(auth, provider);
    } catch (e) {
      // a popup is blocked inside frames and on some mobile browsers: use a redirect
      if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request',
           'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
        await fb.a.signInWithRedirect(auth, provider);
        return true;
      }
      throw e;
    }
    return true;
  }
  // plain words for the errors people actually hit
  const SAYS = {
    'auth/operation-not-allowed': 'This sign-in method is switched off in Firebase.',
    'auth/unauthorized-domain': 'This web address is not on the allowed list in Firebase.',
    'auth/invalid-continue-uri': 'This web address is not on the allowed list in Firebase.',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/wrong-password': 'That password is not right for this account.',
    'auth/invalid-credential': 'That email and password do not match.',
    'auth/weak-password': 'Firebase needs a password of at least 6 characters.',
    'permission-denied': 'The backend refused that. If this is Angel matching, publish the updated firestore.rules in the Firebase console.',
    'auth/network-request-failed': 'No internet connection.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window.',
  };
  const explain = e => SAYS[e && e.code] || (e && e.message) || 'Sign-in failed.';
  async function signOut() { if (auth) await fb.a.signOut(auth); }

  /* ------------------------------------------------------ profile and tier */
  const tierFor = email => /@igdtuw\.ac\.in$/i.test(email || '') ? 'gold' : 'basic';

  async function afterSignIn(u) {
    const { doc, getDoc, setDoc, onSnapshot, serverTimestamp } = fb.f;
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        tier: tierFor(u.email), email: u.email || null, name: u.displayName || null,
        verifiedAt: serverTimestamp(), confirmed: 0, rejected: 0, rejectedPositive: 0,
        halo: 0, badges: [], helped: 0, answered: 0, angel: { available: false, radiusM: AREA_M },
      });
    }
    unsubs.push(onSnapshot(ref, d => {
      const v = d.data(); if (!v) return;
      const D = St().D;
      Object.assign(D.me, {
        uid: u.uid, tier: v.tier || 'basic', method: 'firebase', demo: false,
        confirmed: v.confirmed || 0, rejected: v.rejected || 0, rejectedPositive: v.rejectedPositive || 0,
        halo: v.halo || 0, badges: v.badges || [], helped: v.helped || 0, answered: v.answered || 0,
        verifiedAt: Date.now(),
      });
      if (v.angel) Object.assign(D.angel, v.angel);
      St().save();
      emit('user', root.Store.me());
    }));
    watchReports();
    watchQuestions();
    S.status = 'signed in'; emit('status', S); emit('user', root.Store.me());
  }
  function afterSignOut() {
    unsubs.forEach(f => { try { f(); } catch (e) {} });
    unsubs = [];
    S.status = fb ? 'connected' : 'off';
    emit('status', S);
  }
  async function updateMe(patch) {
    if (!user) return;
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'users', user.uid), patch);
  }
  // Verification result from the verify screen (images never leave the phone)
  async function setTier(tier) { await updateMe({ tier }); }
  async function setAngel(angel) { await updateMe({ angel }); }

  /* ----------------------------------------------------------- reports */
  // Audits are shared so other women's route comparisons can use them.
  async function addReport(r) {
    if (!user) return null;
    const { collection, addDoc, serverTimestamp } = fb.f;
    const geo = cell(r.lat, r.lng);
    // an unusual thing outlives an ordinary reading, and carries its own fields
    const unusualMs = r.unusual
      ? (r.unusual.severity === 'high' ? 6 * 3600000 : r.unusual.severity === 'medium' ? 3 * 3600000 : 90 * 60000)
      : 0;
    const d = await addDoc(collection(db, 'reports'), {
      lat: r.lat, lng: r.lng, cell: geo, place: r.place, claims: r.claims, polarity: r.polarity,
      status: r.status, tier: r.tier, trust: r.trust, by: user.uid, t: serverTimestamp(),
      expires: Date.now() + Math.max(life(), unusualMs), confirmations: [],
      // what was read from her words or her photo
      note: r.note || null, tags: r.tags || [], source: r.source || null,
      light: r.light != null ? r.light : null, liveliness: r.liveliness != null ? r.liveliness : null,
      dogPack: !!r.dogPack,
      unusual: r.unusual ? { what: r.unusual.what, severity: r.unusual.severity, at: Date.now() } : null,
      unusualUntil: unusualMs ? Date.now() + unusualMs : null,
    });
    return d.id;
  }
  async function confirmReport(id, tier) {
    const { doc, updateDoc, arrayUnion } = fb.f;
    await updateDoc(doc(db, 'reports', id), { confirmations: arrayUnion({ by: user.uid, tier, t: Date.now() }) });
  }
  function watchReports() {
    const { collection, query, where, onSnapshot } = fb.f;
    const demo = typeof S !== 'undefined' && S.demoData;
    const q = query(collection(db, 'reports'),
      where('expires', '>', demo ? Date.now() - 7 * 24 * 3600000 : Date.now()));
    unsubs.push(onSnapshot(q, snap => {
      const D = St().D;
      // t may be a server timestamp, a number, or missing (seeded data)
      const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : Date.now());
      D.remote = snap.docs.map(d => ({ id: d.id, ...d.data(), t: ms(d.data().t) }))
                          .filter(x => x.by !== user.uid);
      St().save();
      emit('reports', D.remote);
    }));
  }

  /* ------------------------------------------------------- Ask Angels */
  async function ask({ place, lat, lng, when }) {
    if (!user) throw new Error('Sign in first.');
    const { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } = fb.f;
    const ref = await addDoc(collection(db, 'questions'), {
      place, lat, lng, cell: cell(lat, lng), when, by: user.uid, t: serverTimestamp(), expires: Date.now() + QUESTION_LIFE,
    });
    const D = St().D;
    const q = { id: ref.id, place, lat, lng, when, t: Date.now(), answers: [], status: 'asking', cloud: true };
    D.questions.unshift(q); St().save();
    unsubs.push(onSnapshot(query(collection(db, 'questions', ref.id, 'answers'), orderBy('t')), snap => {
      const x = D.questions.find(y => y.id === ref.id); if (!x) return;
      x.answers = snap.docs.map(d => ({ ...d.data(),
        t: (d.data().t && typeof d.data().t.toMillis === 'function') ? d.data().t.toMillis()
           : (typeof d.data().t === 'number' ? d.data().t : Date.now()) }));
      if (x.answers.length) x.status = 'answered';
      St().save(); emit('answer', { qid: ref.id });
    }));
    return q;
  }
  // Questions near me that I can answer as an Angel
  function watchQuestions() {
    const { collection, query, where, onSnapshot } = fb.f;
    const demoQ = typeof S !== 'undefined' && S.demoData;
    const q = query(collection(db, 'questions'),
      where('expires', '>', demoQ ? Date.now() - 7 * 24 * 3600000 : Date.now()));
    unsubs.push(onSnapshot(q, snap => {
      const D = St().D;
      const me = root.SensorHub && root.SensorHub.state.gps;
      D.cloudInbox = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(x => x.by !== user.uid)
        .filter(x => !me || me.lat == null || root.SensorHub.distanceM(me.lat, me.lng, x.lat, x.lng) <= (D.angel.radiusM || AREA_M) * 2)
        .map(x => ({ ...x, distM: me && me.lat != null ? Math.round(root.SensorHub.distanceM(me.lat, me.lng, x.lat, x.lng)) : null,
                     t: x.t ? x.t.toMillis && x.t.toMillis() : Date.now() }));
      St().save(); emit('inbox', D.cloudInbox);
    }));
  }
  async function answerQuestion(qid, taps, sensor) {
    if (!user) return;
    const { collection, addDoc, serverTimestamp, doc, updateDoc, increment } = fb.f;
    const me = root.Store.me();
    await addDoc(collection(db, 'questions', qid, 'answers'), {
      by: user.uid, name: (root.Store._internal.D.me.name || 'Angel'), tier: me.tier, halo: me.haloLevel,
      lighting: taps.lighting || null, people: taps.people || null, shops: taps.shops || null,
      watch: taps.watch || null, note: taps.note || '', sensor: sensor || null, t: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', user.uid), { answered: increment(1), halo: increment(3) });
  }

  /* --------------------------------------------------------------- utils */
  // Rough 500 m cell, so nothing stores an exact position
  const cell = (lat, lng) => `${lat.toFixed(3)}_${lng.toFixed(3)}`;

  /* Remove this account's data from the backend: her audits, her answers, her profile */
  async function deleteMyData() {
    await init();
    if (!fb || !user) throw new Error('You are not signed in, so there is nothing stored in the cloud.');
    const out = { reports: 0, answers: 0, profile: false };
    const mine = await fb.f.getDocs(fb.f.query(fb.f.collection(db, 'reports'), fb.f.where('by', '==', user.uid)));
    for (const d of mine.docs) { await fb.f.deleteDoc(d.ref); out.reports++; }
    const ans = await fb.f.getDocs(fb.f.query(fb.f.collection(db, 'answers'), fb.f.where('by', '==', user.uid)));
    for (const d of ans.docs) { await fb.f.deleteDoc(d.ref); out.answers++; }
    try { await fb.f.deleteDoc(fb.f.doc(db, 'users', user.uid)); out.profile = true; } catch (e) {}
    return out;
  }

  /* ---------------- Angels on the backend ----------------
     presence/{uid}   who is available near where, refreshed while she is on
     sessions/{id}    a request, its acceptance, and the live session
     Location is exchanged only inside an accepted session, and only while it
     is running: both sides can end it, and it expires by itself. */

  const PRESENCE_LIFE = 5 * 60000;     // presence goes stale in 5 minutes
  const SESSION_LIFE = 60 * 60000;     // an accepted session expires after an hour

  async function setAvailable(on, pos, kind = 'both') {
    await init();
    if (!fb || !user) return false;
    const { doc, setDoc, deleteDoc } = fb.f;
    const ref = doc(db, 'presence', user.uid);
    if (!on) { try { await deleteDoc(ref); } catch (e) {} return true; }
    await setDoc(ref, {
      by: user.uid, name: (user.displayName || (user.email || '').split('@')[0] || 'Angel'),
      tier: (D_tier() || 'basic'), kind,                       // 'nearby' | 'walk' | 'both'
      reputation: (() => { try { return root.Store.me().reputation; } catch (e) { return null; } })(),
      helped: (() => { try { return root.Store.me().helped || 0; } catch (e) { return 0; } })(),
      cell: cell(pos.lat, pos.lng), lat: round3(pos.lat), lng: round3(pos.lng),   // ~100 m, never exact
      t: Date.now(), until: Date.now() + PRESENCE_LIFE,
    });
    return true;
  }
  const round3 = v => Math.round(v * 1000) / 1000;
  const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  function myName() {
    try { const n = root.Store && root.Store.me().name; if (n) return cap(n.split(' ')[0]); } catch (e) {}
    if (user && user.displayName) return cap(user.displayName.split(' ')[0]);
    return cap((user && user.email || '').split('@')[0]) || 'Member';
  }
  const D_tier = () => { try { return root.Store && root.Store.me().tier; } catch (e) { return 'basic'; } };

  function watchAngels(pos, cb) {
    if (!fb || !user) return () => {};
    const { collection, query, where, onSnapshot } = fb.f;
    const q = query(collection(db, 'presence'), where('until', '>', Date.now()));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => d.data())
        .filter(a => a.by !== user.uid)
        .map(a => ({ ...a, distM: Math.round(root.SensorHub.distanceM(pos.lat, pos.lng, a.lat, a.lng)) }))
        .filter(a => a.distM <= 3000)
        .sort((a, b) => a.distM - b.distM);
      cb(list);
    }, () => cb([]));
  }

  /* She asks: 'stay with me' (nearby) or 'walk with me' (walk) */
  async function askAngel({ kind, to, meet, pos, only }) {
    await init();
    if (!fb || !user) throw new Error('You are not signed in.');
    const { collection, addDoc } = fb.f;
    const d = await addDoc(collection(db, 'sessions'), {
      kind, status: 'asked',
      by: user.uid, byName: myName(), byTier: D_tier(),
      lat: round3(pos.lat), lng: round3(pos.lng), cell: cell(pos.lat, pos.lng),
      to: to || null, meet: meet || null, only: only || null,
      t: Date.now(), expires: Date.now() + SESSION_LIFE,
      angel: null, angelName: null, angelTier: null,
      herePing: null, angelPing: null, endedBy: null, rating: null,
    });
    return d.id;
  }

  async function acceptSession(id) {
    const { doc, updateDoc, getDoc } = fb.f;
    const ref = doc(db, 'sessions', id);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().status !== 'asked') throw new Error('That request was already taken.');
    await updateDoc(ref, { status: 'joined', angel: user.uid,
      angelName: myName(),
      angelTier: D_tier(), joinedAt: Date.now() });
    return true;
  }

  /* Location is shared only here, only while the session runs */
  async function pingSession(id, pos, asAngel) {
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'sessions', id),
      asAngel ? { angelPing: { lat: pos.lat, lng: pos.lng, t: Date.now() } }
              : { herePing: { lat: pos.lat, lng: pos.lng, t: Date.now() } });
  }

  async function endSessionCloud(id, rating) {
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'sessions', id),
      { status: 'ended', endedBy: user.uid, endedAt: Date.now(), rating: rating || null });
  }

  function watchSession(id, cb) {
    if (!fb) return () => {};
    const { doc, onSnapshot } = fb.f;
    return onSnapshot(doc(db, 'sessions', id), d => cb(d.exists() ? { id: d.id, ...d.data() } : null), () => cb(null));
  }

  /* Open requests near an Angel who is available */
  function watchRequests(pos, cb) {
    if (!fb || !user) return () => {};
    const { collection, query, where, onSnapshot } = fb.f;
    const q = query(collection(db, 'sessions'), where('status', '==', 'asked'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(x => x.by !== user.uid && x.expires > Date.now())
        .filter(x => !x.only || x.only === user.uid)
        .map(x => ({ ...x, distM: Math.round(root.SensorHub.distanceM(pos.lat, pos.lng, x.lat, x.lng)) }))
        .filter(x => x.distM <= 3000)
        .sort((a, b) => a.distM - b.distM);
      cb(list);
    }, () => cb([]));
  }

  /* Typical conditions per cell and hour, and the sample alerts, both seeded
     into the backend rather than written into the app. */
  async function loadNormals() {
    await init();
    if (!fb || !user) return 0;
    const { collection, getDocs } = fb.f;
    const snap = await getDocs(collection(db, 'normals'));
    const rows = snap.docs.map(d => d.data());
    return root.Normals ? root.Normals.ingest(rows) : 0;
  }
  /* Fixtures the demo accounts start with — guardians, and anything else the
     demo needs — held in the backend so nothing is written into the app. */
  async function loadDemoFixture(name) {
    await init();
    if (!fb || !user) return null;
    const { doc, getDoc } = fb.f;
    const d = await getDoc(doc(db, 'demo', name));
    return d.exists() ? d.data() : null;
  }

  async function loadAlerts() {
    await init();
    if (!fb || !user) return [];
    const { collection, getDocs } = fb.f;
    const snap = await getDocs(collection(db, 'alerts'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /* ---------------- Vouching ----------------
     She shows a short-lived code; a Verified woman scans or types it and
     confirms she knows her. Two live vouches lift her a tier. The voucher
     carries the risk: her own reputation follows the person she vouched for. */

  const VOUCH_CODE_LIFE = 10 * 60000;      // a code is good for ten minutes
  const VOUCH_LIFE = 182 * 24 * 3600000;   // a vouch lasts six months
  const VOUCH_CAP = 5;                     // per voucher per month

  const shortCode = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';        // no I, O, 0, 1
    return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
  };

  /* Her side: make a code others can scan or type */
  async function makeVouchCode() {
    await init();
    if (!fb || !user) throw new Error('Sign in first.');
    const { doc, setDoc } = fb.f;
    const code = shortCode();
    await setDoc(doc(db, 'vouchcodes', code), {
      uid: user.uid, name: myName(), tier: D_tier(),
      t: Date.now(), expires: Date.now() + VOUCH_CODE_LIFE,
    });
    return { code, expires: Date.now() + VOUCH_CODE_LIFE };
  }

  /* The voucher's side: read the code, see who it is */
  async function readVouchCode(code) {
    await init();
    if (!fb || !user) throw new Error('Sign in first.');
    const { doc, getDoc } = fb.f;
    const d = await getDoc(doc(db, 'vouchcodes', String(code || '').trim().toUpperCase()));
    if (!d.exists()) throw new Error('That code does not exist. Ask her to show it again.');
    const x = d.data();
    if (x.expires < Date.now()) throw new Error('That code has expired. Ask her for a fresh one.');
    if (x.uid === user.uid) throw new Error('You cannot vouch for yourself.');
    return x;
  }

  /* And commit it */
  async function vouchFor(code) {
    const target = await readVouchCode(code);
    if (!isAngelTier()) throw new Error('Only a Verified woman can vouch for someone.');
    const { collection, addDoc, getDocs, query, where } = fb.f;

    const mine = await getDocs(query(collection(db, 'vouches'), where('by', '==', user.uid)));
    const month = Date.now() - 30 * 24 * 3600000;
    const recent = mine.docs.filter(d => (d.data().t || 0) > month);
    if (recent.length >= VOUCH_CAP) throw new Error(`You have used all ${VOUCH_CAP} vouches this month.`);
    if (recent.some(d => d.data().forUid === target.uid)) throw new Error('You have already vouched for her.');

    await addDoc(collection(db, 'vouches'), {
      by: user.uid, byName: myName(), byTier: D_tier(),
      forUid: target.uid, forName: target.name,
      t: Date.now(), expires: Date.now() + VOUCH_LIFE, withdrawn: false,
    });
    return { name: target.name, left: VOUCH_CAP - recent.length - 1 };
  }

  /* How many live vouches she holds, and from whom */
  async function myVouches() {
    await init();
    if (!fb || !user) return { count: 0, from: [] };
    const { collection, getDocs, query, where } = fb.f;
    const snap = await getDocs(query(collection(db, 'vouches'), where('forUid', '==', user.uid)));
    const live = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(v => !v.withdrawn && v.expires > Date.now());
    return { count: live.length, from: live.map(v => v.byName) };
  }

  async function vouchesGiven() {
    await init();
    if (!fb || !user) return [];
    const { collection, getDocs, query, where } = fb.f;
    const snap = await getDocs(query(collection(db, 'vouches'), where('by', '==', user.uid)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => !v.withdrawn && v.expires > Date.now());
  }

  async function withdrawVouch(id) {
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'vouches', id), { withdrawn: true, withdrawnAt: Date.now() });
  }

  /* ---------------- Watched mode ----------------
     One record per trip, overwritten each time — not a trail. It holds only
     what a guardian needs to read a silence: how she was doing just before it,
     when she is due, and any silence the app has already predicted. Deleted
     the moment she arrives. Location is rounded to about 100 m. */

  const round3w = v => Math.round(v * 1000) / 1000;          // ~100 m
  const cell100 = (lat, lng) => `${round3w(lat)}_${round3w(lng)}`;

  function newWatchToken() {
    const a = 'abcdefghijkmnpqrstuvwxyz23456789';
    return Array.from({ length: 22 }, () => a[Math.floor(Math.random() * a.length)]).join('');
  }

  async function startWatch({ token, name, destName, dueAt, callByAt }) {
    await init();
    if (!fb || !user) throw new Error('Sign in to use watched mode.');
    const { doc, setDoc } = fb.f;
    await setDoc(doc(db, 'watch', token), {
      by: user.uid, name, destName, dueAt, callByAt,
      startedAt: Date.now(), lastSeen: Date.now(),
      battery: null, signal: null, moving: null, onRoute: null,
      lat: null, lng: null, metresLeft: null,
      expect: null,                      // a silence the app has already predicted
      arrived: false,
    });
    return token;
  }

  /* The short note. Same document every time, so nothing accumulates. */
  async function watchPing(token, note) {
    if (!fb || !user || !token) return;
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'watch', token), {
      lastSeen: Date.now(),
      battery: note.battery ?? null, signal: note.signal ?? null,
      moving: note.moving ?? null, onRoute: note.onRoute ?? null,
      lat: note.lat != null ? round3w(note.lat) : null,
      lng: note.lng != null ? round3w(note.lng) : null,
      metresLeft: note.metresLeft ?? null,
    });
  }

  /* The reason, sent before the silence starts */
  async function watchExpect(token, expect) {
    if (!fb || !user || !token) return;
    const { doc, updateDoc } = fb.f;
    await updateDoc(doc(db, 'watch', token), { expect, lastSeen: Date.now() });
  }

  async function endWatch(token, arrived = true) {
    if (!fb || !user || !token) return;
    const { doc, deleteDoc, updateDoc } = fb.f;
    try { await updateDoc(doc(db, 'watch', token), { arrived, lastSeen: Date.now() }); } catch (e) {}
    setTimeout(() => { deleteDoc(doc(db, 'watch', token)).catch(() => {}); }, 20000);
  }

  /* The guardian has no account, so the connection is opened for her here */
  async function readWatch(token, cb) {
    if (!fb) { try { await init(); } catch (e) { cb(null); return () => {}; } }
    if (!fb) { cb(null); return () => {}; }
    const { doc, onSnapshot } = fb.f;
    return onSnapshot(doc(db, 'watch', token), d => cb(d.exists() ? { token, ...d.data() } : null), () => cb(null));
  }

  /* Anonymous street coverage: does this 100 m cell have signal right now?
     No identity, no link to a person — a count of devices and how many can
     reach the network. It is what separates "the street went quiet" from
     "her phone went quiet". */
  async function reportCoverage(lat, lng, online) {
    await init();
    if (!fb || !user) return;
    const { doc, setDoc, increment } = fb.f;
    const win = Math.floor(Date.now() / 120000);                 // a two-minute window
    await setDoc(doc(db, 'coverage', `${cell100(lat, lng)}_${win}`), {
      cell: cell100(lat, lng), window: win, t: Date.now(),
      devices: increment(1), online: increment(online ? 1 : 0),
    }, { merge: true });
  }

  /* What the street looked like around a moment, for the guardian's reading */
  async function coverageAround(lat, lng, atMs) {
    if (!fb) { try { await init(); } catch (e) { return null; } }
    if (!fb) return null;
    const { collection, getDocs, query, where } = fb.f;
    const win = Math.floor(atMs / 120000);
    const snap = await getDocs(query(collection(db, 'coverage'),
      where('cell', '==', cell100(lat, lng))));
    const rows = snap.docs.map(d => d.data()).filter(r => Math.abs(r.window - win) <= 1);
    if (!rows.length) return null;
    const devices = rows.reduce((a, r) => a + (r.devices || 0), 0);
    const online = rows.reduce((a, r) => a + (r.online || 0), 0);
    if (devices < 2) return null;                     // one device tells us nothing
    return { devices, online, streetQuiet: online === 0 };
  }

  root.Cloud = {
    init, on, get status() { return S.status; }, get error() { return S.error; },
    get signedIn() { return !!user; }, get user() { return user && { uid: user.uid, email: user.email, name: user.displayName }; },
    sendSignInLink, signInGoogle, signInPassword, signOut, setTier, setAngel, explain,
    addReport, confirmReport, ask, answerQuestion, deleteMyData,
    setAvailable, watchAngels, askAngel, acceptSession, pingSession, endSessionCloud, watchSession, watchRequests,
    loadNormals, loadAlerts, loadDemoFixture,
    makeVouchCode, readVouchCode, vouchFor, myVouches, vouchesGiven, withdrawVouch, VOUCH_CAP,
    newWatchToken, startWatch, watchPing, watchExpect, endWatch, readWatch, reportCoverage, coverageAround,
    config: CONFIG,
  };
})(typeof window !== 'undefined' ? window : globalThis);

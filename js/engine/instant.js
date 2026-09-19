/* ============================================================================
 * instant.js — Instant
 * Turns what she wrote (and a photo, if she added one) into the same structured
 * fields an audit form would produce.
 *
 *   • Online, with a key on the deployment: /api/audit reads it with Gemini.
 *   • Otherwise: keyword rules on the phone, in English, Hindi and Hinglish.
 *     Fewer fields, lower confidence, and the app says which was used.
 *
 * Nothing about a named person is ever stored: a remark that accuses or
 * identifies someone is kept out of the shared record and only the place
 * conditions are used.
 * Exposes: window.Instant
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------ on-phone keyword reading */
  const WORDS = {
    light: [
      [/\b(pitch dark|no light|lights? (are )?(out|off|not working)|andhera|andhera hai|bilkul dark|unlit|bahut dark)\b/i, 'dark'],
      [/\b(dim|kam roshni|thodi light|poorly lit|badly lit|low light)\b/i, 'some'],
      [/\b(well lit|bright|roshni|light thi|lights? (are )?(on|working)|achhi light)\b/i, 'lit'],
    ],
    people: [
      [/\b(no one|nobody|empty|sunsan|koi nahi|deserted|khali)\b/i, 'empty'],
      [/\b(few people|kam log|hardly any|thode log|barely anyone)\b/i, 'few'],
      [/\b(some people|kuch log|a few women|thodi bheed)\b/i, 'some'],
      [/\b(crowded|busy|bheed|lots of people|bahut log|market open)\b/i, 'busy'],
    ],
    shops: [
      [/\b(shops? (are )?(shut|closed)|dukaan band|sab band|everything closed)\b/i, 'shut'],
      [/\b(some shops|kuch dukaan|a few shops|tea stall|chai)\b/i, 'some'],
      [/\b(shops? (are )?open|dukaan khuli|market open|sab khula)\b/i, 'open'],
    ],
    path: [
      [/\b(broken|toota|khudai|dug up|construction|no footpath|footpath nahi)\b/i, 'broken'],
      [/\b(uneven|ubad|potholes|gaddha|rough)\b/i, 'uneven'],
      [/\b(smooth|even footpath|good footpath|achha footpath)\b/i, 'even'],
    ],
  };
  const DOGS = /\b(dogs?|kutte|kutta|barking|bhonk|stray dogs?)\b/i;
  const UNUSUAL = [
    [/\b(fight|jhagda|marpeet|brawl|mob|crowd gathered|hangama)\b/i, 'a crowd or fight', 'high'],
    [/\b((whole|entire|poori|puri)\s+(street|road|lane|gali)[^.]{0,20}(dark|unlit|lights?\s*(are|were)?\s*(out|off))|all (the )?lights?\s*(are|were)?\s*(out|off)|street lights? (are|were)? ?(out|off|not working)|blackout|power cut|bijli nahi)\b/i, 'the whole stretch is unlit', 'high'],
    [/\b(road (is )?(closed|blocked|dug)|rasta band|diversion|khudai chal rahi)\b/i, 'the road is blocked or dug up', 'medium'],
    [/\b(gate (is )?(closed|shut)|metro gate band|station gate closed)\b/i, 'a gate or entrance is shut', 'medium'],
    [/\b(following me|peecha|stalking|harass|chhed|catcall)\b/i, 'someone following or harassing', 'high'],
    [/\b(waterlogg|flooded|paani bhara|knee deep)\b/i, 'water on the road', 'medium'],
  ];
  // A remark that points at a person, rather than the place
  const PERSON = /\b(uska naam|his name|that man called|shop owner named|wearing a|auto number|DL ?\d|number plate)\b/i;

  function readLocally(remark) {
    const t = String(remark || '');
    const out = { light: null, people: null, shops: null, path: null, dogs: null,
                  unusual: null, tags: [], targets_person: PERSON.test(t),
                  confidence: 0.45, source: 'phone' };
    for (const [field, list] of Object.entries(WORDS)) {
      for (const [re, val] of list) if (re.test(t)) { out[field] = val; break; }
    }
    if (DOGS.test(t)) out.dogs = true;
    for (const [re, what, severity] of UNUSUAL) {
      if (re.test(t)) { out.unusual = { what, severity }; break; }
    }
    const found = ['light', 'people', 'shops', 'path'].filter(k => out[k]).length;
    out.confidence = Math.min(0.75, 0.3 + found * 0.12 + (out.unusual ? 0.1 : 0));
    out.summary = summarise(out);
    out.tags = [out.light && 'light: ' + out.light, out.people && 'people: ' + out.people,
                out.dogs && 'dogs', out.unusual && out.unusual.what].filter(Boolean).slice(0, 4);
    return out;
  }

  function summarise(a) {
    const bits = [];
    if (a.light) bits.push({ dark: 'dark', some: 'partly lit', lit: 'well lit' }[a.light]);
    if (a.people) bits.push({ empty: 'nobody about', few: 'few people about', some: 'some people about', busy: 'busy' }[a.people]);
    if (a.shops === 'open') bits.push('shops open');
    if (a.shops === 'shut') bits.push('shops shut');
    if (a.dogs) bits.push('dogs around');
    if (a.path === 'broken') bits.push('broken footpath');
    return bits.length ? bits.join(', ') + '.' : 'No clear conditions could be read from this.';
  }

  /* ------------------------------------------------------------- the reader */
  async function read({ remark, imageBase64, mime, place, hour }) {
    const local = readLocally(remark);
    if (typeof S !== 'undefined' && S.offline) return { ...local, why: 'offline: read on your phone' };
    try {
      const res = await fetch('/api/audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark, image: imageBase64, mime, place, hour }),
      });
      if (res.status === 503 || res.status === 404) return { ...local, why: 'read on your phone (no reader configured)' };
      if (!res.ok) return { ...local, why: 'read on your phone (the reader was busy)' };
      const j = await res.json();
      // the phone's own reading wins where the model said nothing
      for (const k of ['light', 'people', 'shops', 'path', 'dogs']) if (j[k] == null && local[k] != null) j[k] = local[k];
      if (!j.unusual && local.unusual) j.unusual = local.unusual;
      j.targets_person = j.targets_person || local.targets_person;
      j.summary = j.summary || summarise(j);
      j.why = imageBase64 ? 'read from your words and your photo' : 'read from your words';
      return j;
    } catch (e) {
      return { ...local, why: 'read on your phone (no internet)' };
    }
  }

  /* Turn the reading into the numbers the scoring already understands */
  function toReading(a, pos, now = Date.now()) {
    const light = { dark: 22, some: 80, lit: 195 }[a.light];
    const live = { empty: 0.05, few: 0.18, some: 0.45, busy: 0.8 }[a.people];
    return {
      lat: pos.lat, lng: pos.lng, t: now,
      light: light != null ? light : undefined,
      liveliness: live != null ? live : undefined,
      dogPack: a.dogs === true,
      shopsOpen: a.shops === 'open' ? 2 : a.shops === 'some' ? 1 : a.shops === 'shut' ? 0 : undefined,
      kind: 'report', claim: (a.light === 'lit' || a.people === 'busy') ? 'positive' : 'warning',
      note: a.summary, tags: a.tags, unusual: a.unusual || null,
      source: a.source, confidence: a.confidence,
    };
  }

  /* How long an unusual thing should keep counting, and how loudly to say it */
  function unusualLife(u) {
    if (!u) return 0;
    return u.severity === 'high' ? 6 * 3600000 : u.severity === 'medium' ? 3 * 3600000 : 90 * 60000;
  }

  root.Instant = { read, readLocally, toReading, summarise, unusualLife };
})(typeof window !== 'undefined' ? window : globalThis);

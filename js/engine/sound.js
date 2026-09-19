/* ============================================================================
 * sound.js — SoundSense (replaces dogdetect.js)
 * One on-device YamNet pass gives two signals:
 *   liveliness : are people and traffic around? (0–1)
 *   dog pack   : sustained barking bursts
 * Raw audio lives only in a 1-second rolling buffer and is overwritten.
 * Needs: SensorHub (sensors.js). Exposes: window.SoundSense
 * ========================================================================== */
(function (root) {
  'use strict';

  // In the Android app the model ships inside the APK (vendor/), so it works offline from the start
  const LOCAL = !!(root.Native && root.Native.isApp);
  const MP = LOCAL ? new URL('vendor/mediapipe', root.location.href).href.replace(/\/$/, '')
                   : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.0.1';
  const MODEL_URL = LOCAL ? 'vendor/yamnet.tflite'
                          : 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite';

  // YamNet class indices (AudioSet class map)
  const HUMAN   = [0, 1, 48, 63, 64, 65, 66];            // speech, child speech, footsteps, chatter, crowd, babble, children playing
  const TRAFFIC = [294, 300, 301, 302, 310, 315, 320, 321]; // vehicle, motor vehicle, car, horn, truck, bus, motorcycle, traffic noise
  const DOG     = [69, 70, 71, 72, 73, 74, 75];
  const BARK    = [70, 71, 73];                           // bark, yip, bow-wow
  const PLAYBACK = [132, 518, 519];                       // music, television, radio

  const CFG = {
    windowSec: 1.0,
    hopMs: 500,             // full mode: classify every 0.5 s
    sparseEveryMs: 60000,   // eco mode: one 1-second sample per minute
    barkThreshold: 0.5,     // calibrate on your clips
    packWindowSec: 10,
    packMinEvents: 3,
    packMinConsecutive: 4,
    packHoldMs: 2 * 60 * 60 * 1000,
    livelinessSmoothing: 0.3,  // EMA weight of the newest frame
  };

  let classifier = null, ctx = null, stream = null, node = null, src = null;
  let ring = null, ringPos = 0, filled = false, timer = null, mode = 'off';
  let history = [], lastPackAt = null, liveEma = null;
  const out = { status: 'off', liveliness: null, human: null, traffic: null,
                dogConf: null, isPack: false, dbfs: null, latencyMs: null, error: null };

  const push = () => root.SensorHub && root.SensorHub.setSound({ ...out });

  async function loadModel() {
    if (classifier) return classifier;
    out.status = 'loading'; push();
    const { FilesetResolver, AudioClassifier } = await import(`${MP}/audio_bundle.mjs`);
    const files = await FilesetResolver.forAudioTasks(`${MP}/wasm`);
    classifier = await AudioClassifier.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL }, maxResults: -1,
    });
    return classifier;
  }

  function scores(samples, rate) {
    const t0 = performance.now();
    const res = classifier.classify(samples, rate);
    out.latencyMs = Math.round(performance.now() - t0);
    const cats = (res[0] && res[0].classifications[0].categories) || [];
    const byIdx = new Map(cats.map(c => [c.index, c.score]));
    const max = ids => Math.max(0, ...ids.map(i => byIdx.get(i) || 0));
    return { human: max(HUMAN), traffic: max(TRAFFIC), dog: max(DOG), bark: max(BARK), playback: max(PLAYBACK) };
  }

  function rmsDbfs(samples) {
    let s = 0;
    for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
    const rms = Math.sqrt(s / samples.length);
    return rms > 0 ? +(20 * Math.log10(rms)).toFixed(1) : -120;
  }

  function currentFrame() {
    const f = new Float32Array(ring.length);
    f.set(ring.subarray(ringPos));
    f.set(ring.subarray(0, ringPos), ring.length - ringPos);
    return f;
  }

  function updatePack(positive, now) {
    history.push({ t: now, positive });
    history = history.filter(h => h.t >= now - CFG.packWindowSec * 1000);
    let events = 0, run = 0, maxRun = 0, prev = false;
    for (const h of history) {
      if (h.positive && !prev) events++;
      run = h.positive ? run + 1 : 0;
      maxRun = Math.max(maxRun, run);
      prev = h.positive;
    }
    if (events >= CFG.packMinEvents || maxRun >= CFG.packMinConsecutive) lastPackAt = now;
    out.isPack = !!lastPackAt && now - lastPackAt < CFG.packHoldMs;
  }

  function tick() {
    if (!filled || !classifier) return;
    const frame = currentFrame();
    out.dbfs = rmsDbfs(frame);
    const s = scores(frame, ctx.sampleRate);
    frame.fill(0);                                   // audio discarded

    const playbackPenalty = s.playback > 0.6 ? 0.5 : 1;
    const live = Math.min(1, (0.65 * s.human + 0.35 * s.traffic) * playbackPenalty);
    liveEma = liveEma == null ? live : CFG.livelinessSmoothing * live + (1 - CFG.livelinessSmoothing) * liveEma;
    const bark = s.bark * playbackPenalty;

    Object.assign(out, {
      status: 'live', liveliness: +liveEma.toFixed(3),
      human: +s.human.toFixed(3), traffic: +s.traffic.toFixed(3),
      dogConf: +bark.toFixed(3),
    });
    updatePack(bark >= CFG.barkThreshold, Date.now());
    push();
  }

  async function openMic() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx = new (root.AudioContext || root.webkitAudioContext)();
    src = ctx.createMediaStreamSource(stream);
    ring = new Float32Array(Math.round(ctx.sampleRate * CFG.windowSec));
    ringPos = 0; filled = false;
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = e => {
      const input = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        ring[ringPos++] = input[i];
        if (ringPos === ring.length) { ringPos = 0; filled = true; }
      }
    };
    const mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
  }

  function closeMic() {
    try { node && node.disconnect(); src && src.disconnect(); } catch (e) {}
    stream && stream.getTracks().forEach(t => t.stop());
    ctx && ctx.close();
    if (ring) ring.fill(0);
    node = src = stream = ctx = ring = null; filled = false;
  }

  // mode: 'model' (full), 'sparse' (eco: 1 s per minute), 'off' (critical)
  async function setMode(next) {
    if (next === mode) return;
    clearInterval(timer); timer = null;
    mode = next;
    if (next === 'off') { closeMic(); out.status = 'off'; push(); return; }
    try {
      await loadModel();
      if (next === 'model') {
        if (!stream) await openMic();
        timer = setInterval(tick, CFG.hopMs);
      } else {
        // eco: open the mic briefly once a minute, classify, close again
        closeMic();
        const sample = async () => { await openMic(); setTimeout(() => { tick(); closeMic(); }, 1200); };
        sample();
        timer = setInterval(sample, CFG.sparseEveryMs);
      }
      out.status = next === 'model' ? 'live' : 'sparse'; out.error = null; push();
    } catch (err) {
      closeMic(); mode = 'off';
      out.status = 'sim'; out.error = err.message || String(err); push();
    }
  }

  // Follow SensorHub power modes automatically
  if (root.SensorHub) root.SensorHub.on('mode', m => { if (mode !== 'off' || m.policy.sound === 'off') setMode(m.policy.sound); });

  /* ---------------------------------------------------- evaluation harness */
  async function evaluateFile(file) {
    await loadModel();
    const actx = new (root.AudioContext || root.webkitAudioContext)();
    const audio = await actx.decodeAudioData(await file.arrayBuffer());
    actx.close();
    const data = audio.getChannelData(0), sr = audio.sampleRate;
    const win = Math.round(sr * CFG.windowSec), hop = Math.round(sr * CFG.hopMs / 1000);
    const frames = [];
    for (let i = 0; i + win <= data.length; i += hop) {
      const s = scores(data.slice(i, i + win), sr);
      frames.push({ t: +(i / sr).toFixed(2), ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +v.toFixed(3)])) });
    }
    return {
      file: file.name, frames,
      dogDetected: frames.some(f => f.bark >= CFG.barkThreshold),
      meanLiveliness: frames.length ? +(frames.reduce((a, f) => a + 0.65 * f.human + 0.35 * f.traffic, 0) / frames.length).toFixed(3) : 0,
    };
  }

  // Label clips by file name: names containing "dog" are positives
  async function evaluateSet(files) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    const rows = [];
    for (const f of files) {
      const r = await evaluateFile(f);
      const truth = /dog/i.test(f.name);
      if (r.dogDetected && truth) tp++; else if (r.dogDetected) fp++; else if (truth) fn++; else tn++;
      rows.push({ file: f.name, truth, predicted: r.dogDetected, liveliness: r.meanLiveliness });
    }
    return {
      rows, tp, fp, tn, fn, threshold: CFG.barkThreshold,
      precision: +(tp / Math.max(1, tp + fp)).toFixed(3),
      recall: +(tp / Math.max(1, tp + fn)).toFixed(3),
    };
  }

  root.SoundSense = { setMode, preload: loadModel, evaluateFile, evaluateSet, config: CFG, get state() { return { ...out, mode }; } };
})(typeof window !== 'undefined' ? window : globalThis);

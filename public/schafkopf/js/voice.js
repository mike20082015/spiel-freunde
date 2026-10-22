/*
 * Spiel-Freunde Schafkopf: Stimmen von Horst, Sepp und Margarethe über /api/sf/tts.
 * Ton startet erst nach der ersten Nutzeraktion.
 */
(function (root) {
  'use strict';
  const Talk = root.SchafkopfTalk;
  const SYNTH = {
    horst: { pitch: 0.65, rate: 0.95, male: true },
    sepp: { pitch: 0.7, rate: 0.88, male: true },
    margarethe: { pitch: 1.2, rate: 0.9, male: false },
  };
  const MALE = /(male|mann|markus|stefan|hans|yannick|conrad|klaus|jonas|florian|killian|bernd|daniel)/i;
  const FEMALE = /(female|frau|anna|petra|katja|helena|hedda|marlene|vicki|amala|seraphina|elke|google deutsch)/i;
  const VOICED = { horst: 1, margarethe: 1, sepp: 1 };

  function seatVoice(character) {
    if (VOICED[character]) return true;
    var bridge = root.SpielpartnerStimmen;
    return !!(bridge && typeof bridge.voiced === 'function' && bridge.voiced(character));
  }

  const V = {
    unlocked: false,
    queue: [],
    current: null,
    getSettings: () => ({ sound: true, volume: 80 }),
    log: [],
    ctx: null,
    onPlayback: null,
  };

  function enabled() { const s = V.getSettings(); return V.unlocked && s.sound; }
  function volume() { const s = V.getSettings(); return Math.max(0, Math.min(1, (s.volume == null ? 80 : s.volume) / 100)); }

  function unlock() {
    const first = !V.unlocked;
    V.unlocked = true;
    try {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (Ctx) {
        V.ctx = V.ctx || new Ctx();
        if (V.ctx.state === 'suspended') V.ctx.resume();
        if (first) {
          const b = V.ctx.createBuffer(1, 1, 22050);
          const s = V.ctx.createBufferSource();
          s.buffer = b;
          s.connect(V.ctx.destination);
          try { s.start(0); } catch (e) { /* noch gesperrt */ }
        }
      }
    } catch (e) { /* egal */ }
    try { if (root.speechSynthesis) root.speechSynthesis.getVoices(); } catch (e) { /* egal */ }
  }

  function emitPlay(phase, text) {
    if (typeof V.onPlayback !== 'function') return;
    try { V.onPlayback(phase, text || ''); } catch (e) { /* Zuhörer darf die Schlange nicht stoppen */ }
  }

  function speak(character, text, opts) {
    opts = opts || {};
    if (!seatVoice(character) || !enabled() || !text) return false;
    while (V.queue.length >= 3) {
      let i = V.queue.findIndex((x) => !x.priority);
      if (i < 0) i = 0;
      const old = V.queue.splice(i, 1)[0];
      if (old.onEnd) old.onEnd(true);
    }
    const maxAge = opts.priority ? 15000 : 7000;
    const item = {
      character: character,
      text: opts.speech || text,
      onStart: opts.onStart,
      onEnd: opts.onEnd,
      priority: !!opts.priority,
      expires: Date.now() + maxAge,
    };
    if (item.priority) {
      const j = V.queue.findIndex((x) => !x.priority);
      if (j < 0) V.queue.push(item);
      else V.queue.splice(j, 0, item);
    } else V.queue.push(item);
    pump();
    return true;
  }

  async function pump() {
    if (V.current || !V.queue.length) return;
    let item = V.queue.shift();
    while (item && Date.now() > item.expires) {
      if (item.onEnd) item.onEnd(true);
      item = V.queue.shift();
    }
    if (!item) return;
    V.current = item;
    emitPlay('start', item.text);
    if (item.onStart) item.onStart();
    let owned = null;
    try {
      let src = null;
      try { src = Talk && Talk.speakAI ? await Talk.speakAI(item.character, item.text) : null; } catch (e) { src = null; }
      if (typeof src === 'string' && src.indexOf('blob:') === 0) owned = src;
      let ok = false;
      if (src) {
        try { ok = await playElement(src, item); } catch (e) { ok = false; }
      }
      if (!ok) await holdText(item);
    } catch (e) { /* nächster Satz */ }
    if (owned) { try { root.URL.revokeObjectURL(owned); } catch (e) { /* egal */ } }
    V.log.push({ character: item.character, text: item.text });
    if (V.log.length > 200) V.log.shift();
    V.current = null;
    if (item.onEnd) item.onEnd(false);
    if (!V.queue.length) emitPlay('idle');
    pump();
  }

  function playElement(src, item) {
    return new Promise((resolve) => {
      let a;
      try { a = new root.Audio(src); } catch (e) { resolve(false); return; }
      a.volume = volume();
      item.audio = a;
      let done = false;
      const fin = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        resolve(ok);
      };
      const guard = setTimeout(() => { try { a.pause(); } catch (e) { /* egal */ } fin(true); }, 14000);
      a.addEventListener('ended', () => fin(true));
      a.addEventListener('error', () => fin(false));
      item.stop = () => { try { a.pause(); } catch (e) { /* egal */ } fin(true); };
      const p = a.play();
      if (p && p.then) p.then(() => {}).catch(() => fin(false));
    });
  }

  let voicesCache = null;
  function germanVoices() {
    if (!root.speechSynthesis) return [];
    const all = root.speechSynthesis.getVoices() || [];
    if (all.length) voicesCache = all.filter((v) => /^de(-|_|$)/i.test(v.lang));
    return voicesCache || [];
  }
  function pickVoice(character) {
    const vs = germanVoices();
    if (!vs.length) return null;
    const extra = root.SpielpartnerStimmen && root.SpielpartnerStimmen.synth ? root.SpielpartnerStimmen.synth(character) : null;
    const male = (SYNTH[character] && SYNTH[character].male) || (extra && extra.male);
    return vs.find((v) => (male ? MALE : FEMALE).test(v.name)) || vs[character === 'horst' ? 0 : vs.length - 1];
  }

  function holdText(item) {
    return new Promise(function (resolve) {
      var ms = Math.min(4200, 1400 + String((item && item.text) || '').length * 38);
      var timer = setTimeout(resolve, ms);
      if (item) item.stop = function () { clearTimeout(timer); resolve(); };
    });
  }

  function stopAll() {
    const q = V.queue.splice(0);
    for (let i = 0; i < q.length; i++) if (q[i].onEnd) q[i].onEnd(true);
    if (V.current && V.current.stop) V.current.stop();
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) { /* egal */ }
  }
  function setVolume() {
    const v = volume();
    if (V.current && V.current.audio) V.current.audio.volume = v;
  }
  function busy() { return !!V.current || V.queue.length > 0; }

  root.SchafkopfVoice = {
    init(opts) { if (opts && opts.getSettings) V.getSettings = opts.getSettings; },
    unlock: unlock,
    speak: speak,
    stopAll: stopAll,
    setVolume: setVolume,
    busy: busy,
    onPlayback(fn) { V.onPlayback = fn; },
    get unlocked() { return V.unlocked; },
    get log() { return V.log; },
  };
})(typeof self !== 'undefined' ? self : this);

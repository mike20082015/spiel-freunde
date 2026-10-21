/*
 * Spiel-Freunde Skat: Stimmen der Figuren
 * Reihenfolge je Satz:
 *   1. vorab erzeugte MP3 aus js/voice-manifest.js (feste Sprüche, assets/voice/<figur>/<id>.mp3)
 *   2. Talk.speakAI(character, text) nur ohne MP3 (serverseitiges ElevenLabs, Objekt-URL)
 *   3. Sprachausgabe des Browsers (speechSynthesis, de-DE), je Figur andere Tonhöhe und Tempo
 * Es spricht immer nur eine Figur (Warteschlange). Ton startet erst nach der ersten Nutzeraktion (Autoplay-Regeln).
 *
 * Damit die Sätze ohne Loch aneinanderhängen:
 *   - Begrüßung und häufige Ansagen werden beim Start schon geholt und dekodiert.
 *   - Jeder neue Satz in der Warteschlange startet den Download des nächsten sofort.
 *   - Dekodierte AudioBuffer bleiben im Speicher, die Dateien zusätzlich im Cache Storage.
 *   - Fällt Web Audio aus, spielt ein kleiner Pool von Audio-Elementen (ebenfalls vorab geladen).
 */
(function (root) {
  'use strict';
  const Talk = root.SkatTalk;
  const MANIFEST = root.SkatVoiceManifest || {};
  const SYNTH = {
    horst: { pitch: 0.65, rate: 0.95, male: true },
    margarethe: { pitch: 1.2, rate: 0.9, male: false },
  };
  const MALE = /(male|mann|markus|stefan|hans|yannick|conrad|klaus|jonas|florian|killian|bernd|daniel)/i;
  const FEMALE = /(female|frau|anna|petra|katja|helena|hedda|marlene|vicki|amala|seraphina|elke|google deutsch)/i;
  const CACHE_NAME = 'sf-skat-voice-v2';
  const POOL_MAX = 4;
  // Begrüßung, Spielstart, Passen/Mitgehen und die ersten Reizwerte. Nicht alle 248 Dateien.
  const PRELOAD_RE = /\/(l-welcome-\d+|l-gameStart-[01]|l-passBid-0|l-bidHigh-0|c-pass|c-hold|c-open|c-18|c-20|c-22|r-greet-0|r-default-0)\.mp3$/;

  const V = {
    unlocked: false,
    queue: [],
    current: null,
    getSettings: () => ({ sound: true, volume: 80 }),
    log: [],
    ctx: null,
  };

  const bytesCache = new Map();
  const bufferCache = new Map();
  const ready = new Set();
  const POOL = [];

  // Skript liegt unter /skat/js/. Die MP3s bleiben dadurch unter /skat/assets/, auch ohne Schrägstrich am Seitenende.
  const SKAT_ROOT = (function () {
    try {
      const s = root.document && root.document.currentScript && root.document.currentScript.src;
      if (s) return new URL('../', s);
    } catch (e) { /* file:// oder Worker */ }
    return null;
  })();

  function enabled() { const s = V.getSettings(); return V.unlocked && s.sound; }
  function volume() { const s = V.getSettings(); return Math.max(0, Math.min(1, (s.volume == null ? 80 : s.volume) / 100)); }
  function soundOn() { const s = V.getSettings(); return !s || s.sound !== false; }

  function absUrl(src) {
    try {
      if (SKAT_ROOT) return new URL(src, SKAT_ROOT).href;
      const base = (root.document && root.document.baseURI) || (root.location && root.location.href) || 'http://localhost/';
      return new URL(src, base).href;
    } catch (e) { return src; }
  }

  function notePlayed(src) {
    try {
      if (Array.isArray(root.__plays)) root.__plays.push(absUrl(src));
    } catch (e) { /* egal */ }
  }

  async function loadBytes(key) {
    try {
      if (root.caches && typeof root.caches.open === 'function') {
        const cache = await root.caches.open(CACHE_NAME);
        let res = await cache.match(key);
        if (!res) {
          res = await fetch(key);
          if (!res || !res.ok) throw new Error('mp3');
          try { await cache.put(key, res.clone()); } catch (e) { /* Speicher voll: nur im RAM halten */ }
        }
        return await res.arrayBuffer();
      }
    } catch (e) { /* Cache Storage fehlt (file://) oder ist voll */ }
    const res = await fetch(key);
    if (!res || !res.ok) throw new Error('mp3');
    return res.arrayBuffer();
  }

  function fetchBytes(src) {
    const key = absUrl(src);
    if (bytesCache.has(key)) return bytesCache.get(key);
    const p = loadBytes(key).catch((err) => { bytesCache.delete(key); throw err; });
    bytesCache.set(key, p);
    return p;
  }

  function acquireAudio(src) {
    const url = absUrl(src);
    let a = null;
    for (let i = 0; i < POOL.length; i++) {
      if (POOL[i]._sfUrl === url && !POOL[i]._sfBusy) { a = POOL[i]; break; }
    }
    if (!a) {
      for (let i = 0; i < POOL.length; i++) {
        if (!POOL[i]._sfBusy) { a = POOL[i]; break; }
      }
    }
    if (!a) {
      a = new root.Audio();
      a.preload = 'auto';
      if (POOL.length < POOL_MAX) POOL.push(a);
    }
    if (a._sfUrl !== url) {
      a._sfUrl = url;
      a.preload = 'auto';
      a.src = url;
      try { a.load(); } catch (e) { /* egal */ }
    }
    return a;
  }

  // Holt und, sobald ein AudioContext da ist, dekodiert die Datei. Mehrfachaufrufe teilen sich dasselbe Versprechen.
  function warm(src) {
    if (!src) return Promise.resolve(null);
    const key = absUrl(src);
    const bytesP = fetchBytes(src);
    if (!V.ctx) {
      bytesP.catch(function () {});
      return Promise.resolve(null);
    }
    if (bufferCache.has(key)) return bufferCache.get(key);
    const p = bytesP.then((bytes) => V.ctx.decodeAudioData(bytes.slice(0))).then((buf) => {
      ready.add(key);
      return buf;
    }).catch((err) => { bufferCache.delete(key); throw err; });
    bufferCache.set(key, p);
    return p;
  }

  function preloadLikely() {
    if (!soundOn()) return;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    for (const character of Object.keys(MANIFEST)) {
      const lines = MANIFEST[character];
      for (const text of Object.keys(lines)) {
        const src = lines[text];
        if (!PRELOAD_RE.test('/' + src)) continue;
        if (V.ctx || Ctx) warm(src).catch(function () {});
        else { try { acquireAudio(src); } catch (e) { /* egal */ } }
      }
    }
  }

  function prefetchItem(item) {
    if (!item) return;
    const src = srcFor(item.character, item.text);
    if (!src) return;
    if (V.ctx || (root.AudioContext || root.webkitAudioContext)) warm(src).catch(function () {});
    else { try { acquireAudio(src); } catch (e) { /* egal */ } }
  }

  function prefetchAhead() {
    const list = [];
    if (V.current) list.push(V.current);
    for (let i = 0; i < V.queue.length && list.length < 3; i++) list.push(V.queue[i]);
    for (const it of list) prefetchItem(it);
  }

  // Nach der ersten Nutzeraktion aufrufen. Ein stummes Mini-Audio entsperrt die Wiedergabe auf iOS/Safari.
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
          try { s.start(0); } catch (e) { /* noch gesperrt, der nächste Klick versucht es wieder */ }
        }
      }
    } catch (e) { /* egal */ }
    try { if (root.speechSynthesis) root.speechSynthesis.getVoices(); } catch (e) { /* egal */ }
    preloadLikely();
    prefetchAhead();
  }

  function srcFor(character, text) {
    const m = MANIFEST[character];
    return m && m[text] ? m[text] : null;
  }

  /*
   * speak(character, text, opts) -> true, wenn der Satz in die Warteschlange kam (dann ruft die Stimme
   * opts.onStart beim Losreden und opts.onEnd am Ende); false, wenn Ton aus ist (Aufrufer zeigt die Blase selbst).
   * opts.priority: Antwort auf den Spieler, wird vorgezogen und nicht verworfen.
   * opts.kind 'bid': kurze Ansage, wird bei voller Warteschlange verworfen statt hinterherzuhinken.
   * opts.speech: abweichender Sprechtext (z. B. "Achtzehn." statt "18").
   * Talk.spokenText schreibt nur die Aussprache um ("Re." wird "Reh."), die Blase bleibt beim Aufrufer.
   */
  function forSpeech(text) {
    return Talk && typeof Talk.spokenText === 'function' ? Talk.spokenText(text) : text;
  }
  function speak(character, text, opts) {
    opts = opts || {};
    if (!enabled() || !text) return false;
    const spoken = forSpeech(opts.speech || text);
    if (opts.kind === 'bid' && V.queue.length >= 1) { V.log.push({ character, text: spoken, mode: 'skipped' }); return false; }
    while (V.queue.length >= 3) {
      let i = V.queue.findIndex((x) => !x.priority);
      if (i < 0) i = 0;
      const old = V.queue.splice(i, 1)[0];
      if (old.onEnd) old.onEnd(true);
    }
    const maxAge = opts.priority ? 15000 : opts.kind === 'bid' ? 2500 : 7000;
    const item = { character, text: spoken, onStart: opts.onStart, onEnd: opts.onEnd, priority: !!opts.priority, expires: Date.now() + maxAge };
    if (item.priority) { const j = V.queue.findIndex((x) => !x.priority); if (j < 0) V.queue.push(item); else V.queue.splice(j, 0, item); }
    else V.queue.push(item);
    prefetchAhead();
    pump();
    return true;
  }

  async function pump() {
    if (V.current || !V.queue.length) return;
    let item = V.queue.shift();
    while (item && Date.now() > item.expires) {
      V.log.push({ character: item.character, text: item.text, mode: 'stale' });
      if (item.onEnd) item.onEnd(true);
      item = V.queue.shift();
    }
    if (!item) return;
    V.current = item;
    prefetchAhead();
    emitPlay('start', item.text);
    if (item.onStart) item.onStart();
    let mode = 'none';
    let owned = null;
    try {
      let src = srcFor(item.character, item.text);
      if (!src) {
        try { src = Talk && Talk.speakAI ? await Talk.speakAI(item.character, item.text) : null; } catch (e) { src = null; }
        if (typeof src === 'string' && src.indexOf('blob:') === 0) owned = src;
      }
      if (src) {
        mode = 'mp3';
        prefetchAhead();
        let ok = false;
        try { ok = await playBuffer(src, item); } catch (e) { ok = false; }
        if (!ok) {
          try { ok = await playElement(src, item); } catch (e) { ok = false; }
        }
        if (!ok) { mode = 'synth'; await playSynth(item); }
      } else { mode = 'synth'; await playSynth(item); }
    } catch (e) { /* weiter mit dem nächsten Satz */ }
    if (owned) { try { root.URL.revokeObjectURL(owned); } catch (e) { /* egal */ } }
    V.log.push({ character: item.character, text: item.text, mode });
    if (V.log.length > 300) V.log.shift();
    V.current = null;
    if (item.onEnd) item.onEnd(false);
    if (!V.queue.length) emitPlay('idle');
    // Kein künstliches Loch: der nächste Satz startet, sobald dieser endet. Liegt er schon dekodiert, ist der Übergang direkt.
    pump();
  }

  function emitPlay(phase, text) {
    if (typeof V.onPlayback !== 'function') return;
    try { V.onPlayback(phase, text || ''); } catch (e) { /* Zuhörer darf die Warteschlange nicht stoppen */ }
  }

  function playBuffer(src, item) {
    if (!V.ctx) return Promise.resolve(false);
    let cancelled = false;
    let node = null;
    item.stop = () => { cancelled = true; try { if (node) node.stop(); } catch (e) { /* egal */ } };
    return warm(src).then((buffer) => {
      if (cancelled) return true;
      if (!buffer) return false;
      node = V.ctx.createBufferSource();
      const gain = V.ctx.createGain();
      const now = V.ctx.currentTime;
      const vol = volume();
      if (vol <= 0.001) gain.gain.setValueAtTime(0, now);
      else {
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
      }
      node.buffer = buffer;
      node.connect(gain);
      gain.connect(V.ctx.destination);
      item.gain = gain;
      return new Promise((resolve) => {
        let done = false;
        const fin = (ok) => { if (done) return; done = true; clearTimeout(guard); resolve(ok); };
        const guard = setTimeout(() => { try { node.stop(); } catch (e) { /* egal */ } fin(true); }, Math.ceil(buffer.duration * 1000) + 1500);
        node.onended = () => fin(true);
        item.stop = () => { cancelled = true; try { node.stop(); } catch (e) { /* egal */ } fin(true); };
        if (cancelled) { fin(true); return; }
        try {
          if (V.ctx.state === 'suspended') V.ctx.resume();
          node.start(0);
          notePlayed(src);
        } catch (e) { fin(false); }
      });
    }).catch(() => false);
  }

  function playElement(src, item) {
    return new Promise((resolve) => {
      let a;
      try { a = acquireAudio(src); } catch (e) { resolve(false); return; }
      a._sfBusy = true;
      a.volume = volume();
      item.audio = a;
      let done = false;
      const fin = (ok) => {
        if (done) return;
        done = true;
        a._sfBusy = false;
        a.removeEventListener('ended', onEnd);
        a.removeEventListener('error', onErr);
        clearTimeout(guard);
        resolve(ok);
      };
      const onEnd = () => fin(true);
      const onErr = () => fin(false);
      const guard = setTimeout(() => { try { a.pause(); } catch (e) { /* egal */ } fin(true); }, 12000);
      a.addEventListener('ended', onEnd);
      a.addEventListener('error', onErr);
      item.stop = () => { try { a.pause(); a.currentTime = 0; } catch (e) { /* egal */ } fin(true); };
      const p = a.play();
      if (p && p.catch) p.catch(() => fin(false));
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

  function playSynth(item) {
    return new Promise((resolve) => {
      const synth = root.speechSynthesis;
      if (!synth || !root.SpeechSynthesisUtterance) { setTimeout(resolve, Math.min(4000, 900 + item.text.length * 45)); return; }
      const u = new root.SpeechSynthesisUtterance(item.text);
      const extraTone = root.SpielpartnerStimmen && root.SpielpartnerStimmen.synth ? root.SpielpartnerStimmen.synth(item.character) : null;
      const cfg = SYNTH[item.character] || extraTone || { pitch: 1, rate: 1 };
      u.lang = 'de-DE'; u.pitch = cfg.pitch; u.rate = cfg.rate; u.volume = volume();
      const v = pickVoice(item.character);
      if (v) u.voice = v;
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(guard); resolve(); };
      const guard = setTimeout(fin, 2500 + item.text.length * 110);
      u.onend = fin; u.onerror = fin;
      item.stop = () => { try { synth.cancel(); } catch (e) { /* egal */ } fin(); };
      try { synth.speak(u); } catch (e) { fin(); }
    });
  }

  function stopAll() {
    const q = V.queue.splice(0);
    for (const it of q) if (it.onEnd) it.onEnd(true);
    if (V.current && V.current.stop) V.current.stop();
  }
  function setVolume() {
    const v = volume();
    if (V.current && V.current.audio) V.current.audio.volume = v;
    if (V.current && V.current.gain) {
      try { V.current.gain.gain.setValueAtTime(v, V.ctx ? V.ctx.currentTime : 0); }
      catch (e) { V.current.gain.gain.value = v; }
    }
  }
  function busy() { return !!V.current || V.queue.length > 0; }

  root.SkatVoice = {
    init(opts) { if (opts && opts.getSettings) V.getSettings = opts.getSettings; preloadLikely(); },
    unlock, speak, stopAll, setVolume, busy, srcFor, preload: preloadLikely,
    onPlayback(fn) { V.onPlayback = fn; },
    get unlocked() { return V.unlocked; },
    get log() { return V.log; },
  };
})(typeof self !== 'undefined' ? self : this);

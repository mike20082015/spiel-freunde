/*
 * Stimmen am Wattentisch.
 * Zuerst /api/sf/tts über Talk.speakAI, danach die Browserstimme.
 * Es spricht immer nur eine Figur. Ton erst nach der ersten Nutzeraktion.
 */
(function (root) {
  'use strict';
  var Talk = root.WattenTalk;
  var SYNTH = {
    sepp: { pitch: 0.86, rate: 0.94, male: true },
    horst: { pitch: 0.65, rate: 0.95, male: true },
    hilde: { pitch: 1.12, rate: 0.9, male: false }
  };
  var MALE = /(male|mann|markus|stefan|hans|yannick|conrad|klaus|jonas|florian)/i;
  var FEMALE = /(female|frau|anna|petra|katja|helena|vicki|amala|elke)/i;
  var V = {
    unlocked: false,
    queue: [],
    current: null,
    playing: false,
    getSettings: function () { return { sound: true, volume: 80 }; },
    listeners: []
  };

  function enabled() {
    var s = V.getSettings();
    return V.unlocked && s && s.sound !== false;
  }
  function volume() {
    var s = V.getSettings();
    var n = s && s.volume != null ? s.volume : 80;
    return Math.max(0, Math.min(1, n / 100));
  }
  function emit(phase, text) {
    for (var i = 0; i < V.listeners.length; i++) {
      try { V.listeners[i](phase, text); } catch (e) { /* Zuhörer */ }
    }
  }
  function unlock() { V.unlocked = true; pump(); }
  function busy() { return V.playing || V.queue.length > 0; }
  function stopAll() {
    V.queue = [];
    V.current = null;
    V.playing = false;
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) { /* fehlt */ }
    emit('idle', '');
  }
  function onPlayback(fn) { if (typeof fn === 'function') V.listeners.push(fn); }
  function setGetter(fn) { if (typeof fn === 'function') V.getSettings = fn; }

  function tone(character) {
    if (SYNTH[character]) return SYNTH[character];
    var bridge = root.SpielpartnerStimmen;
    if (bridge && typeof bridge.synth === 'function') return bridge.synth(character);
    return null;
  }

  function speak(character, text, opts) {
    opts = opts || {};
    var spoken = String(text || '').trim();
    if (!spoken || !tone(character)) return false;
    if (!V.getSettings() || V.getSettings().sound === false) return false;
    var item = { character: character, text: spoken, priority: !!opts.priority };
    if (item.priority) V.queue.unshift(item);
    else V.queue.push(item);
    if (V.queue.length > 6) V.queue.length = 6;
    pump();
    return true;
  }

  function pump() {
    if (V.playing || !V.queue.length || !enabled()) return;
    var item = V.queue.shift();
    V.current = item;
    V.playing = true;
    emit('start', item.text);
    playItem(item).then(function () { finish(); }, function () { finish(); });
  }
  function finish() {
    V.playing = false;
    V.current = null;
    if (!V.queue.length) emit('idle', '');
    pump();
  }
  function playItem(item) {
    return remote(item).then(function (url) {
      if (url) return playUrl(url);
      return synth(item);
    });
  }
  function remote(item) {
    if (!Talk || !Talk.speakAI) return Promise.resolve(null);
    return Talk.speakAI(item.character, item.text).catch(function () { return null; });
  }
  function playUrl(url) {
    return new Promise(function (resolve) {
      var audio = new root.Audio(url);
      audio.volume = volume();
      var done = function () {
        try { root.URL.revokeObjectURL(url); } catch (e) { /* schon weg */ }
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      var started = audio.play();
      if (started && typeof started.catch === 'function') started.catch(done);
    });
  }
  function pickVoice(character) {
    var vs = (root.speechSynthesis && root.speechSynthesis.getVoices && root.speechSynthesis.getVoices()) || [];
    var profile = tone(character) || { male: false };
    var male = profile.male;
    var list = vs.filter(function (v) { return /de/i.test(v.lang || ''); });
    var pool = list.length ? list : vs;
    return pool.find(function (v) { return (male ? MALE : FEMALE).test(v.name); }) || pool[male ? 0 : pool.length - 1] || null;
  }
  function synth(item) {
    return new Promise(function (resolve) {
      if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== 'function') { resolve(); return; }
      var utter = new root.SpeechSynthesisUtterance(item.text);
      utter.lang = 'de-DE';
      var profile = tone(item.character) || { pitch: 1, rate: 1 };
      utter.pitch = profile.pitch;
      utter.rate = profile.rate;
      utter.volume = volume();
      var voice = pickVoice(item.character);
      if (voice) utter.voice = voice;
      utter.onend = function () { resolve(); };
      utter.onerror = function () { resolve(); };
      try { root.speechSynthesis.cancel(); root.speechSynthesis.speak(utter); }
      catch (e) { resolve(); }
    });
  }

  root.WattenVoice = {
    speak: speak,
    unlock: unlock,
    stopAll: stopAll,
    busy: busy,
    onPlayback: onPlayback,
    setGetter: setGetter,
    setVolume: function () { /* die nächste Stimme liest die Lautstärke neu */ }
  };
})(typeof self !== 'undefined' ? self : this);

/*
 * Tischgespräch beim Schnapsen.
 * askAI() und speakAI() fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten die festen Sprüche und danach die Browserstimme.
 */
(function (root) {
  'use strict';

  var CHARACTERS = {
    sepp: { id: 'sepp', name: 'Sepp Huber', short: 'Sepp', role: 'Der ruhige Gegner aus dem Kaffeehaus' }
  };

  var LINES = {
    sepp: {
      welcome: ['Servus. Setz di her, i misch schon.', 'Na endlich. Fünf Karten, und dann schaun ma.'],
      marriage: ['Zwanzig. Passt.', 'Vierzig in Trumpf. Des sitzt.'],
      close: ['I dreh zu. Jetzt wirds ernst.', 'Talon zu. Farbe und stechen.'],
      exchange: ['Den Unter geb i her. Die da nehm i.'],
      trick: ['Mei Stich.', 'Nimm du den. I wart.'],
      handWin: ['Die Runde is mei. Bummerl rückt näher.', 'Sechsundsechzig. So geht des.'],
      handLose: ['Dein Stich, dein Punkt. Nächstes Blatt.', 'Sauber. I hob zu früh zugedreht.'],
      matchWin: ['Sieben. Das Bummerl bleibt bei dir.', 'Aus. War ein feines Duell.'],
      matchLose: ['Du bist zuerst bei sieben. Respekt.', 'Doppel-Bummerl, wenn i gar nix geschrieben hab. Autsch.'],
      thinking: ['Moment. I zähl die Augen.'],
      encourage: ['Ruhig. Schnapsen verzeiht den nächsten Stich.']
    }
  };

  var CHAT = [
    { keys: ['hallo', 'servus', 'moin', 'guten', 'hi ', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'bummerl', 'zudreh', 'zwanzig', 'vierzig', '66', 'schnaps'], kind: 'rules' },
    { keys: ['gut', 'super', 'toll', 'bravo', 'stark', 'sauber'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd'], kind: 'anger' },
    { keys: ['kaffee', 'kaffehaus', 'wein', 'bier', 'prost', 'melange'], kind: 'drink' },
    { keys: ['sepp'], kind: 'sepp' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'servus', 'ciao', 'pfiat'], kind: 'bye' }
  ];

  var REPLIES = {
    sepp: {
      greet: ['Servus. Der Talon liegt schon.', 'Grüß di. Fünf Karten, du bist gleich dran.'],
      rules: ['Offener Talon: du darfst jede Karte legen. Zugedreht oder leer: erst die Farbe, und stechen, wenn du kannst.', 'König und Ober sind zwanzig, in Trumpf vierzig. Die Augen zählen mit deinem Stich. Sechsundsechzig gewinnt die Runde, sieben Punkte das Bummerl.'],
      praise: ['Passt. Weiter so.', 'Des war ein feiner Stich.'],
      anger: ['Lass es gut sein. Die nächste Karte kommt ohnehin.', 'Ärger schreibt keine Augen.'],
      drink: ['Eine Melange, und dann weiter. I rühr mich nicht vom Tisch.'],
      sepp: ['I bin der Sepp. I sag, was i denk, und i zähl mit.'],
      thanks: ['Gern. Gegner bleiben höflich.'],
      bye: ['Pfiat di. Der Tisch bleibt gedeckt.', 'Servus. Komm wieder, wenn du 66 willst.'],
      default: ['Mhm.', 'I hör di. Und i spiel weiter.', 'Basst.']
    }
  };

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor((rng || Math.random)() * arr.length)];
  }
  function line(character, event, rng) {
    return pick((LINES[character] || {})[event], rng);
  }
  function classify(text) {
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    for (var i = 0; i < CHAT.length; i++) {
      if (CHAT[i].keys.some(function (k) { return t.indexOf(k) !== -1; })) return CHAT[i].kind;
    }
    return 'default';
  }
  function cannedReply(character, text, rng) {
    var pool = (REPLIES[character] || {})[classify(text)] || (REPLIES[character] || {}).default;
    return pick(pool, rng);
  }

  var PATHS = {
    chat: ['/api/sf/chat', '/api/chat', '/api/default/chat'],
    tts: ['/api/sf/tts', '/api/tts', '/api/default/tts']
  };
  var history = [];
  var live = null;
  var base = 0;
  var failures = 0;
  var probeP = null;
  var VOICES = { sepp: 1 };

  function globalObj() { return typeof globalThis !== 'undefined' ? globalThis : root; }
  function doFetch(url, options) {
    var g = globalObj();
    if (!g || typeof g.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    return g.fetch.call(g, url, options);
  }
  function abortSignal(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    } catch (e) { /* älterer Browser */ }
    return undefined;
  }
  function endpoint(kind) { return PATHS[kind][base] || PATHS[kind][0]; }
  function pushHistory(role, text) {
    var t = String(text || '').trim();
    if (!t) return;
    history.push({ role: role, text: t });
    while (history.length > 12) history.shift();
  }
  function remember(message, character, reply) {
    pushHistory('du', message);
    pushHistory(character, reply);
  }
  async function runProbe() {
    for (var i = 0; i < PATHS.chat.length; i++) {
      try {
        var res = await doFetch(PATHS.chat[i], { method: 'GET', cache: 'no-store', signal: abortSignal(4000) });
        if (!res || !res.ok) continue;
        var data = await res.json();
        if (data && data.ok === true) { base = i; live = true; failures = 0; return true; }
      } catch (e) { /* nächster Pfad */ }
    }
    live = false;
    return false;
  }
  function probe() {
    if (live === true) return Promise.resolve(true);
    if (live === false) return Promise.resolve(false);
    if (!probeP) probeP = runProbe().finally(function () { probeP = null; });
    return probeP;
  }
  function disableLive() { live = false; probeP = null; }
  function resetForTests() {
    live = null; base = 0; failures = 0; probeP = null; history.length = 0;
  }

  async function askAI(character, context) {
    context = context || {};
    var message = String(context.message || '');
    function canned() {
      var text = cannedReply(character, message);
      remember(message, character, text);
      return text;
    }
    if (!VOICES[character]) return canned();
    if (live === false) return canned();
    var up = await probe();
    if (!up) return canned();
    try {
      var res = await doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          character: character,
          message: message,
          game: context.game || null,
          history: history.slice(-6)
        }),
        signal: abortSignal(9000)
      });
      if (!res || !res.ok) throw new Error('status');
      var data = await res.json();
      var text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) throw new Error('leer');
      failures = 0;
      remember(message, character, text);
      return text;
    } catch (e) {
      failures += 1;
      if (failures >= 2) live = false;
      return canned();
    }
  }

  async function speakAI(character, text) {
    var lineText = String(text || '').trim();
    if (!lineText || !VOICES[character]) return null;
    if (live === false) return null;
    var up = await probe();
    if (!up) return null;
    try {
      var res = await doFetch(endpoint('tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: character, text: lineText }),
        signal: abortSignal(12000)
      });
      if (!res || !res.ok || typeof res.blob !== 'function') throw new Error('status');
      var blob = await res.blob();
      if (!blob || !blob.size) throw new Error('leer');
      var g = globalObj();
      var URLRef = (g && g.URL) || (typeof URL !== 'undefined' ? URL : null);
      if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
      return URLRef.createObjectURL(blob);
    } catch (e) {
      return null;
    }
  }

  function responders(text, rng) {
    var t = String(text || '').toLowerCase();
    if (/sepp/.test(t) || classify(text) === 'sepp') return ['sepp'];
    return [pick(['sepp'], rng)];
  }

  root.SchnapsenTalk = {
    CHARACTERS: CHARACTERS,
    LINES: LINES,
    REPLIES: REPLIES,
    line: line,
    cannedReply: cannedReply,
    classify: classify,
    askAI: askAI,
    speakAI: speakAI,
    responders: responders,
    probe: probe,
    disableLive: disableLive,
    resetForTests: resetForTests
  };
})(typeof self !== 'undefined' ? self : this);

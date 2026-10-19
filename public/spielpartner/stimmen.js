/*
 * Sprüche und Stimme für jede Figur an jedem Tisch.
 * Die festen Sätze eines Spiels bleiben, wenn die Figur sie hat.
 * Sonst spricht sie mit ihrer eigenen kurzen Stimme, und Chat wie TTS
 * gehen mit ihrer Kennung an /api/sf/chat und /api/sf/tts.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerStimmen = api;
  if (root && root.document) api.install();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function lineupApi() {
    if (root && root.SpielpartnerLineup) return root.SpielpartnerLineup;
    if (typeof require === 'function') {
      try { return require('./lineup.js'); } catch (err) { return null; }
    }
    return null;
  }

  function canonical(id) {
    var L = lineupApi();
    if (L) return L.canonical(id);
    return id === 'oma-hilde' ? 'hilde' : id;
  }

  var ALIAS = {
    bigTrick: 'trick', partnerSchmier: 'trick', trick: 'trick',
    selfWins: 'win', humanWins: 'win', roundWin: 'win', sessionSelf: 'win', sessionHuman: 'win',
    sessionSelfWins: 'win', sessionHumanWins: 'win', schneider: 'win', schwarz: 'win',
    selfLoses: 'lose', humanLoses: 'lose', roundLose: 'lose', overbid: 'lose',
    weakPlayKind: 'encourage', encourage: 'encourage',
    gameStart: 'gameStart', declare: 'gameStart', sauspiel: 'gameStart', solo: 'gameStart',
    wenz: 'gameStart', bid: 'gameStart', bidHigh: 'gameStart',
    handWin: 'win', matchWin: 'win',
    handLose: 'lose', matchLose: 'lose',
    marriage: 'gameStart', close: 'gameStart', schlag: 'gameStart', bieten: 'gameStart',
    ansage: 'gameStart', trump: 'gameStart', exchange: 'trick',
    welcome: 'welcome'
  };

  var BANKS = {
    horst: {
      welcome: ['Na endlich. Setz dich, ick hab nich ewig Zeit.'],
      gameStart: ['Na denn. Wat soll ick sonst machen.'],
      trick: ['Zack. Det is meiner.'],
      win: ['Jewonnen. Wie immer, wenn man mich lässt.'],
      lose: ['Det lag nur an die Karten.'],
      encourage: ['Kopf hoch, det wird schon.'],
      default: ['Wat?', 'Red nich, spiel.', 'Na jut.']
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen. Setz Dich.'],
      gameStart: ['Schätzchen, gib Dir Mühe. Ich möchte glänzen.'],
      trick: ['Oh, wie hübsch. Die nehme ich.'],
      win: ['Gewonnen. Applaus ist erlaubt.'],
      lose: ['Das waren die Karten, nicht ich.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon.'],
      default: ['Wie bitte, Schätzchen?', 'Ach was.', 'Interessant.']
    },
    urs: {
      welcome: ['Grüessech. Hock di, es pressiert nid.'],
      gameStart: ['Guet. Mir nähmed das ruhig.'],
      trick: ['Dä Stich blibt da.'],
      win: ['Äuä händ mir das verdient.'],
      lose: ['Nid schlimm. Nächscht Rundi.'],
      encourage: ['Chopf ufe. Es chunnt scho.'],
      default: ['Gäll?', 'Isch guet.', 'Mir blibe ruhig.']
    },
    vreni: {
      welcome: ['Hoi. Jetzt wirds lustig, oder?'],
      gameStart: ['Also denn. Ich schlafe nicht am Tisch.'],
      trick: ['Weg damit. Der ist meiner.'],
      win: ['Gsehsch. Hab ich doch gesagt.'],
      lose: ['Pfuus. Nächstes Mal stimmt die Karte.'],
      encourage: ['Nöd hänge lah. Wir sind noch da.'],
      default: ['Oder?', 'Chli schneller, bitte.', 'Aha.']
    },
    sepp: {
      welcome: ['Servus. Setz di her, die Karten warten.'],
      gameStart: ['Basst. A Runde, und danach schaun ma weiter.'],
      trick: ['Des war mei Stich. Passt scho.'],
      win: ['Schau her. So geht des.'],
      lose: ['Mei. Die Karten waren grantig.'],
      encourage: ['Kopf hoch. Nächstes Spiel wird feiner.'],
      default: ['Basst.', 'Sag amoi.', 'Gemmas halt.']
    },
    hilde: {
      welcome: ['Na, Kind. Der Kaffee steht, die Karten auch.'],
      gameStart: ['Ganz ruhig. Oma passt schon auf.'],
      trick: ['Den Stich räum ich kurz weg.'],
      win: ['Siehste. Leise geht das auch.'],
      lose: ['Macht nichts. Ich strick das nächste Mal fester.'],
      encourage: ['Nicht ärgern. Es ist nur ein Spiel.'],
      default: ['So, so.', 'Ich hab das gesehen.', 'Gemütlich bleiben.']
    },
    lena: {
      welcome: ['Hi. Ich bin gerade erst vom Training, aber die Karten können los.'],
      gameStart: ['Alles klar. Fair spielen, und dann sehen wir.'],
      trick: ['Der Stich ist meiner. Sorry.'],
      win: ['Läuft. Nächstes Mal darfst du.'],
      lose: ['Okay, das war deins. Respekt.'],
      encourage: ['Kopf hoch. Eine Karte macht noch kein Spiel.'],
      default: ['Echt?', 'Alles gut.', 'Ich bin dabei.']
    },
    jonas: {
      welcome: ['Schön, dass du da bist. Die Tür hab ich schon aufgehalten.'],
      gameStart: ['Ruhig bleiben. Die Karten mögen keine Hektik.'],
      trick: ['Der Stich bleibt bei mir. Nichts für ungut.'],
      win: ['Das saß. Ich lächle trotzdem.'],
      lose: ['Sauber gespielt. Das nehm ich mit.'],
      encourage: ['Nicht schlecht. Beim nächsten Stich klappt es.'],
      default: ['Verstehe.', 'Nach dir.', 'Interessant.']
    },
    oemer: {
      welcome: ['Komm rein. Tee steht, und für dich ist auch ein Platz frei.'],
      gameStart: ['So, jetzt sind wir vollzählig. Viel Spaß.'],
      trick: ['Den Stich nehm ich mit, wie den Teller extra.'],
      win: ['Schön für uns. Lachen darfst du trotzdem.'],
      lose: ['Macht nichts. Beim nächsten Mal gibt es noch einen Tee.'],
      encourage: ['Kopf hoch. Hier gewinnt die Runde, nicht der Ärger.'],
      default: ['Gern.', 'Setz dich.', 'Alles gut bei dir?']
    },
    ruediger: {
      welcome: ['Guten Abend. Die Regeln liegen bereit, die Karten auch.'],
      gameStart: ['Wir spielen, wie es geschrieben steht. Ohne Fußnote daneben.'],
      trick: ['Der Stich ist korrekt und gehört mir.'],
      win: ['Ergebnis festgestellt. Ich korrigiere ungern, aber es stimmt.'],
      lose: ['Zur Kenntnis genommen. Die nächste Runde bleibt sauber.'],
      encourage: ['Kein Grund zur Aufregung. Der nächste Zug ist offen.'],
      default: ['Einen Moment.', 'Das ist zulässig.', 'Ich prüfe das kurz.']
    },
    chantal: {
      welcome: ['Hömma, da biste ja. Rück den Stuhl ran, dat wird laut.'],
      gameStart: ['Los jetzt. Wer mauert, zahlt den nächsten Lacher.'],
      trick: ['Ey, der Stich ist meiner. Nich schmollen.'],
      win: ['Hah. Dat hat gesessen. Nächste Runde bist du dran.'],
      lose: ['Och. War halt nich mein Stich. Trotzdem geil hier.'],
      encourage: ['Kopf hoch, ne. Wir sind doch ne Runde.'],
      default: ['Wat?', 'Hömma.', 'Alles easy.']
    }
  };

  var REPLIES = {
    horst: { greet: ['Ja ja, hallo. Spiel lieber.'], thanks: ['Jaja, schon jut.'], bye: ['Na denn, tschüss.'], default: ['Wat?', 'Red nich, spiel.'] },
    margarethe: { greet: ['Guten Abend, Schätzchen.'], thanks: ['Gern geschehen, Schätzchen.'], bye: ['Gute Nacht, Schätzchen.'], default: ['Wie bitte, Schätzchen?'] },
    urs: { greet: ['Grüessech.'], thanks: ['Gere gnue.'], bye: ['Bis bald, gäll.'], default: ['Isch guet.'] },
    vreni: { greet: ['Hoi, oder?'], thanks: ['Gere.'], bye: ['Tschüss, nöd trödele.'], default: ['Aha.'] },
    sepp: { greet: ['Servus, setz di.'], thanks: ['Basst scho.'], bye: ['Pfiat di.'], default: ['Sag amoi.'] },
    hilde: { greet: ['Na, Kind. Schön, dass du da bist.'], thanks: ['Gern, mein Kind.'], bye: ['Schlaf gut. Der Kuchen bleibt stehen.'], default: ['So, so.'] },
    lena: { greet: ['Hi. Schön, dass du da bist.'], thanks: ['Gern.'], bye: ['Bis dann.'], default: ['Alles gut.'] },
    jonas: { greet: ['Guten Abend. Schön, dich zu sehen.'], thanks: ['Gern geschehen.'], bye: ['Schlaf gut.'], default: ['Verstehe.'] },
    oemer: { greet: ['Willkommen. Setz dich zu uns.'], thanks: ['Immer gern.'], bye: ['Komm gut heim.'], default: ['Erzähl.'] },
    ruediger: { greet: ['Guten Abend. Bitte, nimm Platz.'], thanks: ['Gern. Das war korrekt.'], bye: ['Auf Wiedersehen.'], default: ['Einen Moment.'] },
    chantal: { greet: ['Hömma, moin. Setz dich.'], thanks: ['Schon gut, ne.'], bye: ['Machs gut, ey.'], default: ['Wat denn?'] }
  };

  var TONE = {
    horst: { pitch: 0.65, rate: 0.95, male: true },
    margarethe: { pitch: 1.2, rate: 0.9, male: false },
    urs: { pitch: 0.82, rate: 0.92, male: true },
    vreni: { pitch: 1.18, rate: 1.04, male: false },
    sepp: { pitch: 0.78, rate: 0.9, male: true },
    hilde: { pitch: 1.08, rate: 0.86, male: false },
    lena: { pitch: 1.16, rate: 1.05, male: false },
    jonas: { pitch: 0.9, rate: 0.96, male: true },
    oemer: { pitch: 0.86, rate: 0.98, male: true },
    ruediger: { pitch: 0.74, rate: 0.92, male: true },
    chantal: { pitch: 1.12, rate: 1.06, male: false }
  };

  var PATHS = {
    chat: ['/api/sf/chat', '/api/chat', '/api/default/chat'],
    tts: ['/api/sf/tts', '/api/tts', '/api/default/tts']
  };

  var seated = [];
  var lastAudio = null;
  var live = null;
  var base = 0;
  var failures = 0;
  var probeP = null;

  function known(id) {
    return !!BANKS[canonical(id)];
  }

  function voiced(id) {
    return known(id);
  }

  function synth(id) {
    return TONE[canonical(id)] || null;
  }

  function setSeated(ids) {
    seated = [];
    var list = ids || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i] !== 'du') seated.push(list[i]);
    return seated.slice();
  }

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    var roll = typeof rng === 'function' ? rng() : Math.random();
    var n = Math.floor(roll * arr.length);
    if (n < 0 || n >= arr.length) n = 0;
    return arr[n];
  }

  function line(id, event, rng) {
    var bank = BANKS[canonical(id)];
    if (!bank) return null;
    var key = bank[event] ? event : (ALIAS[event] || 'default');
    if (!bank[key]) key = 'default';
    return pick(bank[key], rng);
  }

  function canned(id, text, rng) {
    var bank = REPLIES[canonical(id)];
    if (!bank) return line(id, 'default', rng);
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    var kind = 'default';
    if (/hallo|moin|servus|guten|hoi|hi |grüß|gruess/.test(t)) kind = 'greet';
    else if (/danke|merci/.test(t)) kind = 'thanks';
    else if (/tschü|tschu|ciao|gute nacht|bis bald/.test(t)) kind = 'bye';
    return pick(bank[kind] || bank.default, rng);
  }

  function mentions(text, id) {
    var L = lineupApi();
    var person = L ? L.avatar(id) : null;
    var t = String(text || '').toLowerCase();
    var keys = person ? [person.id, person.name, person.full, person.slug] : [id];
    if (canonical(id) === 'hilde') keys.push('oma', 'hilde', 'oma-hilde');
    if (canonical(id) === 'margarethe') keys.push('grete');
    if (canonical(id) === 'ruediger') keys.push('rüdiger');
    if (canonical(id) === 'oemer') keys.push('ömer');
    for (var i = 0; i < keys.length; i++) {
      var key = String(keys[i] || '').toLowerCase();
      if (key.length >= 3 && t.indexOf(key) >= 0) return true;
    }
    return false;
  }

  function globalObj() {
    return root || (typeof globalThis !== 'undefined' ? globalThis : {});
  }

  function doFetch(url, options) {
    var g = globalObj();
    if (!g || typeof g.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    return g.fetch(url, options);
  }

  function abortSignal(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
    } catch (err) { /* alter Browser */ }
    return undefined;
  }

  function endpoint(kind) {
    return PATHS[kind][base] || PATHS[kind][0];
  }

  function runProbe() {
    var chain = Promise.resolve(false);
    PATHS.chat.forEach(function (url, i) {
      chain = chain.then(function (found) {
        if (found) return true;
        return doFetch(url, { method: 'GET', cache: 'no-store', signal: abortSignal(4000) }).then(function (res) {
          if (!res || !res.ok) return false;
          return res.json().then(function (data) {
            if (data && data.ok === true) { base = i; live = true; failures = 0; return true; }
            return false;
          }, function () { return false; });
        }, function () { return false; });
      });
    });
    return chain.then(function (ok) {
      if (!ok) live = false;
      return !!ok;
    });
  }

  function probe() {
    if (live === true) return Promise.resolve(true);
    if (live === false) return Promise.resolve(false);
    if (!probeP) probeP = runProbe().then(function (ok) { probeP = null; return ok; }, function () { probeP = null; live = false; return false; });
    return probeP;
  }

  function ask(id, context) {
    context = context || {};
    var message = String(context.message || '');
    var canon = canonical(id);
    function local() { return canned(canon, message); }
    if (!known(canon) || live === false) return Promise.resolve(local());
    return probe().then(function (up) {
      if (!up) return local();
      var history = Array.isArray(context.history) ? context.history.slice(-6) : [];
      return doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: canon, message: message, game: context.game || null, history: history }),
        signal: abortSignal(9000)
      }).then(function (res) {
        if (!res || !res.ok) throw new Error('status');
        return res.json();
      }).then(function (data) {
        var text = data && typeof data.text === 'string' ? data.text.trim() : '';
        if (!text) throw new Error('leer');
        failures = 0;
        return text;
      });
    }).catch(function () {
      failures += 1;
      if (failures >= 2) live = false;
      return local();
    });
  }

  function speak(id, text) {
    var spoken = String(text || '').trim();
    var canon = canonical(id);
    if (!spoken || !known(canon) || live === false) return Promise.resolve(null);
    return probe().then(function (up) {
      if (!up) return null;
      return doFetch(endpoint('tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: canon, text: spoken }),
        signal: abortSignal(12000)
      }).then(function (res) {
        if (!res || !res.ok || typeof res.blob !== 'function') throw new Error('status');
        return res.blob();
      }).then(function (blob) {
        if (!blob || !blob.size) return null;
        var g = globalObj();
        var URLRef = (g && g.URL) || (typeof URL !== 'undefined' ? URL : null);
        if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
        return URLRef.createObjectURL(blob);
      });
    }).catch(function () { return null; });
  }

  function stopPreview() {
    if (lastAudio) {
      try { lastAudio.pause(); } catch (err) { /* schon aus */ }
      lastAudio = null;
    }
    try { if (root && root.speechSynthesis) root.speechSynthesis.cancel(); } catch (err) { /* fehlt */ }
  }

  function preview(id) {
    var text = line(id, 'welcome') || 'Hallo.';
    stopPreview();
    return speak(id, text).then(function (url) {
      var g = globalObj();
      if (url && typeof g.Audio === 'function') {
        var audio = new g.Audio(url);
        lastAudio = audio;
        var played = audio.play();
        if (played && typeof played.catch === 'function') played.catch(function () {});
        return { ok: true, via: 'tts', text: text };
      }
      if (g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function') {
        var utter = new g.SpeechSynthesisUtterance(text);
        var tone = synth(id) || { pitch: 1, rate: 1 };
        utter.lang = 'de-DE';
        utter.pitch = tone.pitch;
        utter.rate = tone.rate;
        try { g.speechSynthesis.cancel(); g.speechSynthesis.speak(utter); } catch (err) { /* gesperrt */ }
        return { ok: true, via: 'browser', text: text };
      }
      return { ok: false, via: '', text: text };
    });
  }

  function usesNativeApi(talk, id) {
    if (!talk || !id) return false;
    if (talk.REPLIES && talk.REPLIES[id]) return true;
    if ((id === 'urs' || id === 'vreni') && talk.CHARACTERS && talk.CHARACTERS[id]) return true;
    return false;
  }

  function patchTalk(talk) {
    if (!talk || talk.__sfStimmen || typeof talk.line !== 'function') return;
    var origLine = talk.line;
    var origCanned = talk.cannedReply;
    var origAsk = talk.askAI;
    var origSpeak = talk.speakAI;
    var origResponders = talk.responders;
    var origCall = talk.callText;
    talk.line = function (id, event, rng) {
      var own = null;
      try { if (talk.LINES && talk.LINES[id]) own = origLine(id, event, rng); } catch (err) { own = null; }
      return own || line(id, event, rng);
    };
    if (typeof origCanned === 'function') {
      talk.cannedReply = function (id, text, rng) {
        try { if (talk.REPLIES && talk.REPLIES[id]) return origCanned(id, text, rng); } catch (err) { /* gemeinsame Antwort */ }
        return canned(id, text, rng);
      };
    }
    if (typeof origAsk === 'function') {
      talk.askAI = function (id, context) {
        if (usesNativeApi(talk, id)) return origAsk(id, context);
        if (!known(id)) return origAsk(id, context);
        return ask(id, context);
      };
    }
    if (typeof origSpeak === 'function') {
      talk.speakAI = function (id, text) {
        if (usesNativeApi(talk, id)) return origSpeak(id, text);
        if (!known(id)) return origSpeak(id, text);
        return speak(id, text);
      };
    }
    if (typeof origResponders === 'function') {
      talk.responders = function (text, rng) {
        if (!seated.length) return origResponders(text, rng);
        var named = [];
        for (var i = 0; i < seated.length; i++) if (mentions(text, seated[i])) named.push(seated[i]);
        if (named.length) return named;
        var native = [];
        try { native = origResponders(text, rng) || []; } catch (err) { native = []; }
        var hit = [];
        for (var j = 0; j < native.length; j++) if (seated.indexOf(native[j]) >= 0) hit.push(native[j]);
        if (hit.length) return hit;
        var roll = typeof rng === 'function' ? rng() : Math.random();
        return [seated[Math.floor(roll * seated.length) % seated.length]];
      };
    }
    if (typeof origCall === 'function') {
      talk.callText = function (id, token) {
        try {
          var said = origCall(id, token);
          if (said) return said;
        } catch (err) { /* Figur ohne Ansage */ }
        return null;
      };
    }
    talk.__sfStimmen = true;
  }

  function install() {
    if (!root) return;
    ['SkatTalk', 'CanastaTalk', 'SchafkopfTalk', 'JassTalk', 'DoppelkopfTalk', 'MauMauTalk', 'RommeTalk', 'SchnapsenTalk', 'WattenTalk', 'BridgeTalk'].forEach(function (name) {
      patchTalk(root[name]);
    });
  }

  return {
    line: line,
    canned: canned,
    known: known,
    voiced: voiced,
    synth: synth,
    setSeated: setSeated,
    mentions: mentions,
    ask: ask,
    speak: speak,
    preview: preview,
    stopPreview: stopPreview,
    install: install,
    canonical: canonical
  };
});

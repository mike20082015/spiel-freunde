/*
 * Tischgespräch beim Watten.
 * askAI() und speakAI() fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten die festen Sprüche und danach die Browserstimme.
 */
(function (root) {
  'use strict';

  var CHARACTERS = {
    sepp: { id: 'sepp', name: 'Sepp Huber', short: 'Sepp', role: 'Der Partner gegenüber' },
    horst: { id: 'horst', name: 'Horst Kaluppke', short: 'Horst', role: 'Der Gegner zur Linken' },
    hilde: { id: 'hilde', name: 'Oma Hilde', short: 'Oma Hilde', role: 'Die Gegnerin zur Rechten' }
  };

  var LINES = {
    sepp: {
      welcome: ['Servus. Wir zwei gegen die da drüben.', 'Setz di. I pass auf den Schlag auf.'],
      schlag: ['Den Schlag nehmen wir.', 'Passt. Jetzt die Farb.'],
      trump: ['Die Farb. Und jetzt drei Stiche.', 'Trumpf liegt. Ruhig ausspielen.'],
      bieten: ['I geh höher. Halten sie?', 'Drei. Schauen ma, ob sie mitgehen.'],
      gehen: ['I geh. Des Blatt reicht nicht.', 'Lassen wir ihnen die Punkte.'],
      trick: ['Unser Stich.', 'Gut so. Noch einer, dann haben wir sie.'],
      handWin: ['Drei Stiche. Die Punkte sind unser.', 'Sauber gespielt, Partner.'],
      handLose: ['Sie haben die drei. Nächstes Blatt.', 'Macht nix. Der Max kommt wieder.'],
      matchWin: ['Ziel erreicht. Schöne Runde.', 'Wir sind durch. Pfiat euch.'],
      matchLose: ['Sie waren früher dort. Nächstes Mal halten wir länger.', 'Verloren, aber ehrlich.'],
      encourage: ['Kopf hoch. Ein Kritischer dreht das Spiel.']
    },
    horst: {
      welcome: ['Na, Watten statt Skat. Ick spiel trotzdem.', 'Setz dir. Und bloß keene Farbe bedienen, wa?'],
      schlag: ['Der Schlag. Merkt euch det.', 'Ick sag an. Diskussion zwecklos.'],
      trump: ['Die Farbe. Und nu mal sehen.', 'Trumpf. Ick hab schon schlechtere Hände jehabt.'],
      bieten: ['Ick geh höher. Geht ihr mit?', 'Drei. Wer kneift, schreibt die alten Punkte.'],
      gehen: ['Ick geh. Det Blatt is nischt.', 'Nee. Die Punkte könnt ihr haben.'],
      trick: ['Meiner. Wat dachtest du denn?', 'Weg damit. Der nächste kommt.'],
      handWin: ['Drei Stiche. Ick kann auch Watten.', 'Na? Hat det wehjetan?'],
      handLose: ['Die haben die drei. Lag an die Karten.', 'Na toll. Und der Max war wieder woanders.'],
      matchWin: ['Ziel erreicht. Ick hab et euch jesagt.', 'Fertig. Ihr dürft euch bedanken.'],
      matchLose: ['Die waren eher da. Nächstes Mal nich.', 'Verloren. Aber gemeckert wird trotzdem.'],
      encourage: ['Kopf hoch. Is doch bloss Watten.']
    },
    hilde: {
      welcome: ['Na, Kind. Der Kaffee steht, die Karten auch.', 'Setz dich. Horst meckert schon, das gehört dazu.'],
      schlag: ['Diesen Schlag nehmen wir. Ganz ruhig.', 'Schlag angesagt. Nun die Farbe.'],
      trump: ['Die Farbe passt mir. Mal sehen.', 'Trumpf liegt. Drei Stiche reichen.'],
      bieten: ['Ich erhöhe um eins. Haltet ihr?', 'Ein Punkt mehr. Ihr dürft gehen.'],
      gehen: ['Ich gehe. Das Blatt will nicht.', 'Lasst uns die Punkte. Die nächste Runde kommt.'],
      trick: ['Den Stich räum ich kurz weg.', 'Unser Stich. Schön leise.'],
      handWin: ['Drei Stiche. Siehste, es geht auch freundlich.', 'Die Punkte schreiben wir uns auf.'],
      handLose: ['Die anderen haben die drei. Macht nichts.', 'Nächstes Blatt. Ich behalt den Max im Auge.'],
      matchWin: ['Wir sind am Ziel. War doch gemütlich.', 'Aus. Jetzt gibt es Kaffee.'],
      matchLose: ['Sie waren zuerst da. Sauber gespielt.', 'Verloren. Ich strick das nächste Mal fester.'],
      encourage: ['Nicht ärgern. Es ist nur ein Spiel.']
    }
  };

  var CHAT = [
    { keys: ['hallo', 'servus', 'moin', 'guten', 'hi ', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'kritisch', 'max', 'belle', 'spitz', 'weli', 'schlag', 'bieten', 'haube'], kind: 'rules' },
    { keys: ['gut', 'super', 'toll', 'bravo', 'stark', 'sauber'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd'], kind: 'anger' },
    { keys: ['kaffee', 'bier', 'wein', 'prost'], kind: 'drink' },
    { keys: ['sepp'], kind: 'sepp' },
    { keys: ['horst', 'berlin'], kind: 'horst' },
    { keys: ['hilde', 'oma'], kind: 'hilde' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'pfiat', 'ciao'], kind: 'bye' }
  ];

  var REPLIES = {
    sepp: {
      greet: ['Servus. Partner, wir halten zusammen.', 'Grüß di. Schlag und Trumpf kommen gleich.'],
      rules: ['Kein Farbzwang, außer die Haube liegt als Erstes: dann Trumpf oder ein Kritischer.', 'Max, Belle und Spitz stechen alles. Drei Stiche gewinnen. Bieten geht abwechselnd, und ab 13 bei einem Spiel auf 15 ist man gespannt.'],
      praise: ['Passt. So spielen Partner.', 'Des war der richtige Stich.'],
      anger: ['Ruhig. Der nächste Kritische kommt schon.', 'Ärger sticht nicht.'],
      drink: ['Ein Wasser, und dann der nächste Stich.'],
      sepp: ['I sitz dir gegenüber. Was i hab, siehst du am Spiel.'],
      horst: ['Der Horst meckert. Stechen kann er trotzdem.'],
      hilde: ['Die Hilde ist leise und hat oft den Max.'],
      thanks: ['Gern. Wir zwei.'],
      bye: ['Pfiat di. Der Tisch bleibt.'],
      default: ['Basst.', 'I hör di.', 'Weiter.']
    },
    horst: {
      greet: ['Na, ooch hier. Setz dir, bevor der Kaffee kalt wird.', 'Tach. Watten is nich Skat, aber ick lern das.'],
      rules: ['Farbe musst du nich bedienen. Kritische zuerst, dann der Schlag, dann Trumpf.', 'Drei Stiche, zwei Punkte. Wer bietet und der andere geht, schreibt den alten Wert. Ab 13 bei fünfzehn bist du gespannt und darfst nich mehr erhöhen.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dir ab. Ick meckere hier schon genug.', 'Is doch bloss Watten.'],
      drink: ['N Molle wär jut. Hier gibts wohl nur Kaffee.', 'Kaffee. Wenn er stark is, meinetwegen.'],
      sepp: ['Der Sepp is dein Partner. Frag den, nich mir.'],
      horst: ['Berlin fehlt mir. Der Watten geht trotzdem.'],
      hilde: ['Oma Hilde lächelt und sticht dir den Max weg.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Na denn. Komm wieder, wenn de drei Stiche kannst.', 'Tschüss. Die Kritischen bleiben hier.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha.']
    },
    hilde: {
      greet: ['Na, Kind. Schön, dass du da bist.', 'Setz dich. Ich hab schon Platz gemacht.'],
      rules: ['Du musst keine Farbe zugeben. Nur wenn die Haube als erste Karte kommt, legst du Trumpf oder einen Kritischen, solange keiner den Stich schon gestochen hat.', 'Drei Stiche reichen. Das Spiel geht gewöhnlich bis fünfzehn, und ab dreizehn ist man gespannt.'],
      praise: ['Das war hübsch. Darfst du noch einmal machen.', 'Siehste. Es geht.'],
      anger: ['Nicht schimpfen. Die Karten hören das nicht.', 'Atme einmal. Dann die nächste Karte.'],
      drink: ['Kaffee ist da. Horst will natürlich wieder etwas anderes.'],
      sepp: ['Der Sepp ist dein Partner. Hört aufeinander.'],
      horst: ['Horst meckert aus Gewohnheit. Er meint es nicht böse.'],
      hilde: ['Ich sitz rechts. Und ich pass auf.'],
      thanks: ['Gern geschehen, Kind.'],
      bye: ['Geh nur. Der Stuhl bleibt frei.', 'Machs gut. Bis zum nächsten Blatt.'],
      default: ['So, so.', 'Ich hab das gesehen.', 'Gemütlich bleiben.']
    }
  };


  function spruecheApi() {
    var g = typeof globalThis !== 'undefined' ? globalThis : root;
    if (g && g.SpielpartnerSprueche) return g.SpielpartnerSprueche;
    if (typeof require === 'function') {
      try {
        var api = require('../../assets/sprueche.js');
        if (g) g.SpielpartnerSprueche = api;
        return api;
      } catch (err) { return null; }
    }
    return null;
  }
  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor((rng || Math.random)() * arr.length)];
  }
  function line(character, event, rng) {
    var local = (LINES[character] || {})[event];
    var api = spruecheApi();
    if (api && typeof api.line === 'function') {
      var said = api.line(character, event, local, rng);
      if (said) return said;
    }
    return pick(local, rng);
  }
  function classify(text) {
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    for (var i = 0; i < CHAT.length; i++) {
      if (CHAT[i].keys.some(function (k) { return t.indexOf(k) !== -1; })) return CHAT[i].kind;
    }
    return 'default';
  }
  function cannedReply(character, text, rng) {
    var kind = classify(text);
    var bank = (typeof REPLIES !== 'undefined' && REPLIES[character]) || {};
    var local = bank[kind] || bank.default || [];
    var api = spruecheApi();
    if (api && typeof api.reply === 'function') {
      var said = api.reply(character, kind, local, rng);
      if (said) return said;
    }
    return pick(local, rng) || 'Mhm.';
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
  var VOICES = { sepp: 1, horst: 1, hilde: 1 };

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
    try {
      var ctrl = new AbortController();
      setTimeout(function () { try { ctrl.abort(); } catch (err) { /* schon weg */ } }, ms);
      return ctrl.signal;
    } catch (e2) { return undefined; }
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
        signal: abortSignal(11500)
      });
      if (!res || !res.ok) throw new Error('status');
      var data = await res.json();
      var text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text || /nicht erreichbar|gateway timeout/i.test(text)) throw new Error('leer');
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
    var kind = classify(text);
    if (kind === 'sepp' || /sepp/.test(t)) return ['sepp'];
    if (kind === 'horst' || /horst/.test(t)) return ['horst'];
    if (kind === 'hilde' || /hilde|oma/.test(t)) return ['hilde'];
    if (kind === 'greet' || kind === 'bye') return ['sepp', 'hilde'];
    var order = ['sepp', 'horst', 'hilde'];
    return [order[Math.floor((rng || Math.random)() * order.length)]];
  }

  root.WattenTalk = {
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

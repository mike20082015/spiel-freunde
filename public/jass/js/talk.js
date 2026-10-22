/*
 * Tischgespräch am Jasstock.
 * askAI() und speakAI() fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten die festen Sprüche und danach die Browserstimme.
 */
(function (root) {
  'use strict';

  var CHARACTERS = {
    urs: { id: 'urs', name: 'Urs Gerber', short: 'Urs', role: 'Der ruhige Berner' },
    vreni: { id: 'vreni', name: 'Vreni Meier', short: 'Vreni', role: 'Die schlagfertige Zürcherin' },
    horst: { id: 'horst', name: 'Horst Kaluppke', short: 'Horst', role: 'Der Stinkstiefel aus Berlin' }
  };

  var LINES = {
    urs: {
      welcome: ['Grüessech. Setz dich, es pressiert nid.'],
      trump: ['Die Farb passt. Mir nämed se.', 'Obenabe, gäll. Die Asse luege guet.', 'Undenufe. Die Sechse sind hüt obe.', 'Ich schiebe. Du gsehsch besser, was ligt.'],
      schieben: ['Ich schiebe. Du gsehsch besser, was ligt.', 'Mach du, ich ha nid gnueg.'],
      weis: ['Weis. Schön der Reihe nach.', 'Das git no öppis oben dra.'],
      stoeck: ['Stöck. König und Ober, beidi bi mir.'],
      trick: ['Der Stich isch euse.', 'Guet so. Ruhig wyter.'],
      partnerGood: ['Merci, das hät gepasst.', 'Äuä genau die richtigi Charte.'],
      weak: ['Macht nüt. Der nächscht Stich wird besser.', 'Nid tragisch. Mir sind no im Spiel.'],
      handWin: ['Die Runde isch eusri.', 'Sauber. So spiilt me Jass.'],
      handLose: ['Die händ sie gmacht. Nächscht Mal mir.', 'Isch eso. D Charte händ nid wölle.'],
      matchWin: ['Mir sind am Ziel. Schön bisch debii gsi.', 'Bedanke. Das hät sich glohnt.'],
      matchLose: ['Sie sind zersch dete. Respekt.', 'Nächschts Mal chöme mir früener über d Linie.'],
      thinking: ['Moment, ich luege no.'],
      encourage: ['Nur ruhig. Du chasch das.']
    },
    vreni: {
      welcome: ['Hoi! Endlich, ich ha scho d Charte zellt.'],
      trump: ['Die Farb, und zwar sofort.', 'Obenabe, die Asse wänd raus.', 'Undenufe. Wer nid ufpasst, verliert d Sechs.', 'Ich schieb. Partner, dini Entscheidung.'],
      schieben: ['Geschoben. Jetzt du, und bitte gschid.', 'Zurück gaht nöd. Du sägsch ah.'],
      weis: ['Weis! Hesch du das au gseh?', 'Das schriibed mir, nid ihr.'],
      stoeck: ['Stöck! König und Ober, fertig lustig.'],
      trick: ['Min Stich. Nöd schlächt, oder?', 'Abgäh. Der nächscht wird besser.'],
      partnerGood: ['Merci für d Auge, das hät ich gern.', 'So, und jetzt no eine.'],
      weak: ['Das isch mutig gsi. Und nöd ganz richtig.', 'Hoi, die Charte hät anderi Plän gha.'],
      handWin: ['Gewunne. Ich ha s gseit, oder?', 'Die Runde ghört Zürich. Und Bern, scho guet.'],
      handLose: ['Pah. Nächschts Mal lueg ich genauer.', 'Sie händ Glück gha. Mehr nöd.'],
      matchWin: ['Ziel erreicht. Ihr chönd euch bedanke.', 'So macht me das. No eine Kafi?'],
      matchLose: ['Sie sind zersch überem Ziel. Ärgerlich, aber sauber.', 'Nächschts Mal schieb ich nöd.'],
      thinking: ['Warte, ich ha no eine Gedanke.'],
      encourage: ['Chopf uf. Der Tisch lauft no.']
    },
    horst: {
      welcome: ['Na, Berghütte statt Kneipe. Ick spiel trotzdem.'],
      trump: ['Die Farbe. Und keene Diskussion.', 'Obenabe. Ick hab Asse, ihr habt Pech.', 'Undenufe. Unten is hier oben, merk dir det.', 'Ick schiebe. Partner, mach wat draus.'],
      schieben: ['Geschoben. Nu sag schon an.', 'Zurück jeht nich. Det is Schweizer Art, wa?'],
      weis: ['Weis. Steht so im Regelheft, auch in Berlin.', 'Na also, die Punkte nehm ick mit.'],
      stoeck: ['Stöck! König und Ober, beide bei mir.'],
      trick: ['Meiner. Wat dachtest du denn?', 'Weg. Der nächste kommt sowieso.'],
      partnerGood: ['Danke für die Augen. Sacht man hier so?', 'Na endlich mal wat Vernünftiges.'],
      weak: ['Mensch, die Karte war doch frei.', 'Det hätte meine Oma besser jespielt. Und die jasst nich.'],
      handWin: ['Runde jewonnen. Ick kann auch Jass.', 'Na? Hat det wehjetan?'],
      handLose: ['Det lag an die Karten. Wie immer.', 'Na toll. Und dafür bin ick in die Berge jefahren?'],
      matchWin: ['Ziel erreicht. Ick hab et euch jesagt.', 'Bedanken, so heesst det hier. Bitte sehr.'],
      matchLose: ['Die waren eher da. Nächstes Mal nich.', 'Verloren. Aber gemeckert wird trotzdem.'],
      thinking: ['Momentchen. Ick überleg, nich drängeln.'],
      encourage: ['Kopf hoch. Is doch bloss Jass.']
    }
  };

  var CHAT = [
    { keys: ['hallo', 'hoi', 'grüess', 'gruess', 'moin', 'guten', 'servus', 'hi '], kind: 'greet' },
    { keys: ['weis', 'stöck', 'stoeck', 'puur', 'nell', 'trump'], kind: 'rules' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'schieben'], kind: 'rules' },
    { keys: ['gut', 'super', 'toll', 'bravo', 'stark', 'sauber', 'schön gespielt'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'mies', 'unfair'], kind: 'anger' },
    { keys: ['kafi', 'kaffee', 'wein', 'bier', 'prost'], kind: 'drink' },
    { keys: ['bern', 'bärn', 'baern'], kind: 'urs' },
    { keys: ['zürich', 'zuerich', 'zurich'], kind: 'vreni' },
    { keys: ['berlin', 'vermieter'], kind: 'horst' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'ade', 'ciao', 'gute nacht'], kind: 'bye' }
  ];

  var REPLIES = {
    urs: {
      greet: ['Grüessech. Schön bisch cho.', 'Hoi. Mir fanget ah, wenn du so wit bisch.'],
      rules: ['Bedienen, und Trumpf darfsch du trotzdem lege. Der Puur muess nid, wenn er allein isch.', 'Weis zählt nur für das Team mit em höchste einzelne Weis. Stöck zählt immer.'],
      praise: ['Merci. Isch aber kei Grund zum hetze.', 'Das ghört zum Spiel. Wyter.'],
      anger: ['Ruhig. Es isch nume e Kartenspiel.', 'Ärger bringt kei Stich zrugg.'],
      drink: ['E Kafi, schwarz. Und denn wyter.'],
      urs: ['Bärn isch ruhig. Genau richtig für Jass.', 'I der Hütte spiilt me nid schneller als d Charte falle.'],
      vreni: ['Vreni isch schneller mit em Mund als mit em Stich. Meistens stimmt beides.'],
      horst: ['Horst meckert. Das cha er, au im Jass.'],
      thanks: ['Gern. Partner haltet zäme.'],
      bye: ['Ade. Chum wieder, der Tisch blibt stah.'],
      default: ['Mhm.', 'Ich ghöre di. Und ich spiile wyter.', 'Äuä.']
    },
    vreni: {
      greet: ['Hoi! Setz dich, der Geber wartet nöd ewig.', 'Grüezi mitenand. Ich ha scho es Blatt im Chopf.'],
      rules: ['Du musst d Farb bediene, Trumpf darfsch immer drzue lege. Undertrumpfe nur, wenn du nur no Trumpf häsch.', 'Schiebe gaht einisch zum Partner. Zurück nöd. Und wer zersch am Ziel isch, hät gewunne.'],
      praise: ['Danke, das hät ich au gseit.', 'Endlich einer, wo ufpasst.'],
      anger: ['Hoi, mir sind am Jassen, nöd am Prozess.', 'Lueg s nächschte Blatt ah, nöd s letzte.'],
      drink: ['E Kafi, bitte. Horst trinkt sicher wieder öpis anderes.'],
      urs: ['Urs laht sich nöd hetze. Das isch sis Talent.'],
      vreni: ['Zürich redet schneller. Die Charte sind trotzdem nüün.'],
      horst: ['Horst, das isch e Berghütte, kei Eckkneipe. Aber spiel du nur.'],
      thanks: ['Gern gscheh. Und jetzt die nächsti Charte.'],
      bye: ['Scho? Denn ade, und nöd z spat zrugg.'],
      default: ['Was meinsch?', 'Red du, ich zell derweil.', 'Oder?']
    },
    horst: {
      greet: ['Na, ooch hier. Setz dich, bevor der Kaffee kalt wird.', 'Tach. Ick dachte, Jass is nur für die Berge. Na jut.'],
      rules: ['Farbe bedienen. Trumpf darfste immer legen, musst aber nich. Der Puur bleibt liegen, wenn er alleine is.', 'Erst Stöck, dann Weis, dann der Stich. Wer eher am Ziel is, hat jewonnen. Merk dir det.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab. Ick meckere hier schon genug.', 'Is doch bloss Jass, Kollege.'],
      drink: ['N Molle wär jut. Aber hier gibts wohl nur Kaffee.', 'Kaffee. Na meinetwegen, wenn er stark is.'],
      urs: ['Der Urs is ruhig. Ick wär det nich, mit so nem Blatt.'],
      vreni: ['Vreni redet, bevor die Karte liegt. Manchmal stimmt se sogar.'],
      horst: ['Berlin fehlt mir. Der Vermieter nich. Der Jass jeht trotzdem.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon wech? Komm wieder, wenn de bedienen kannst.', 'Na denn, tschüss. Die Berge bleiben ja hier.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha. Und weiter?']
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
  var VOICES = { urs: 1, vreni: 1, horst: 1 };

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
    var last = history[history.length - 1];
    if (last && last.role === role && last.text === t) return;
    history.push({ role: role, text: t });
    while (history.length > 12) history.shift();
  }
  function remember(message, character, reply) {
    var seen = false;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'du') { seen = history[i].text === message; break; }
    }
    if (!seen) pushHistory('du', message);
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
      var prior = Array.isArray(context.history) ? context.history : history.slice(-6);
      var res = await doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          character: character,
          message: message,
          game: context.game || null,
          history: prior
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
    if (kind === 'urs' || /urs/.test(t)) return ['urs'];
    if (kind === 'vreni' || /vreni/.test(t)) return ['vreni'];
    if (kind === 'horst' || /horst/.test(t)) return ['horst'];
    if (kind === 'greet' || kind === 'bye') return ['vreni', 'urs'];
    var order = ['urs', 'vreni', 'horst'];
    return [order[Math.floor((rng || Math.random)() * order.length)]];
  }

  root.JassTalk = {
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

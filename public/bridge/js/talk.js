/*
 * Tischgespräch am Bridgetisch.
 * askAI() und speakAI() fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten die festen Sprüche und danach die Browserstimme.
 */
(function (root) {
  'use strict';

  var CHARACTERS = {
    margarethe: { id: 'margarethe', name: 'Margarethe von Hohenfels', short: 'Margarethe', role: 'Partnerin im Norden' },
    jonas: { id: 'jonas', name: 'Jonas Rehm', short: 'Jonas', role: 'Gegner im Westen' },
    ruediger: { id: 'ruediger', name: 'Rüdiger Falk', short: 'Rüdiger', role: 'Gegner im Osten' }
  };

  var LINES = {
    margarethe: {
      welcome: ['Setz dich, Schätzchen. Ich bin dein Partner, und ich vergesse das nicht.', 'Guten Abend. Wir beide gegen die Herren, das kann hübsch werden.'],
      bid: ['Ich reize, und zwar mit Stil.', 'Passen ist auch eine Ansage. Manchmal die kluge.'],
      contract: ['Abgemacht. Jetzt die Karten, nicht die Perlen.', 'Der Kontrakt steht. Ich spiele ihn, wenn er meiner ist.'],
      dummy: ['Ich liege offen. Bitte enttäusche mich nicht, Schätzchen.', 'Strohmann. Ich sehe alles und sage erst hinterher, was ich gesehen habe.'],
      trick: ['Unser Stich. So bleibt das auch.', 'Weg. Der nächste kommt von allein.'],
      handWin: ['Erfüllt. Ich habe es dir doch gesagt.', 'Das Blatt gehört uns. Ein Spiel, wenn die Punkte reichen.'],
      handLose: ['Zu wenig. Nicht tragisch, nur ärgerlich.', 'Sie haben den Kontrakt. Wir holen das nächste Blatt.'],
      matchWin: ['Der Rubber ist unser. Du darfst dich ruhig freuen.', 'Gewonnen. Chicago oder Rubber, der Tisch merkt sich das.'],
      matchLose: ['Sie waren früher am Ziel. Nächstes Mal wir.', 'Verloren, aber mit Haltung. Noch eine Partie?'],
      encourage: ['Kopf hoch. Eine Farbe bedienen kann jeder, und du kannst mehr.']
    },
    jonas: {
      welcome: ['Guten Abend. Schön, dass der vierte Platz besetzt ist.', 'Setz dich. Ich spiele ruhig, auch wenn die Reizung laut wird.'],
      bid: ['Ich sage, was das Blatt hergibt. Nicht mehr.', 'Passen. Mehr ist heute nicht drin.'],
      contract: ['Der Kontrakt steht. Mal sehen, wer ihn nach Hause bringt.', 'Abgemacht. Ausspiel kommt gleich.'],
      dummy: ['Der Strohmann liegt. Jetzt wird es übersichtlich.', 'Offene Karten. Das mag ich, da rechnet es sich.'],
      trick: ['Unser Stich. Bitte sehr.', 'Der geht an die andere Seite. Macht nichts.'],
      handWin: ['Erfüllt. Sauber gereizt, sauber gespielt.', 'Das Blatt haben wir. Nicht überschwänglich, nur richtig.'],
      handLose: ['Knapp daneben. Oder auch nicht knapp.', 'Sie haben es gemacht. Respekt, und weiter.'],
      matchWin: ['Die Partie ist unsere. Danke für die Runde.', 'Gewonnen. Ich bestelle nichts, ich nicke nur.'],
      matchLose: ['Sie waren besser heute. Das kommt vor.', 'Verloren. Die nächste Reizung wird vorsichtiger.'],
      encourage: ['Nur ruhig. Ein Stich ist kein Urteil.']
    },
    ruediger: {
      welcome: ['Guten Abend. Die Plätze sind korrekt: du Süden, Margarethe Norden.', 'Bitte, nimm Platz. Gezählt wird in Punkten, nicht in Geld.'],
      bid: ['Das Gebot ist ausreichend. Sonst hätte ich geschwiegen.', 'Passen. Ein unzureichendes Gebot gibt es an diesem Tisch nicht.'],
      contract: ['Kontrakt festgestellt. Alleinspieler und Strohmann stehen fest.', 'Die Reizung ist geschlossen. Drei Passen, wie es sich gehört.'],
      dummy: ['Der Strohmann wird nach dem Ausspiel aufgedeckt. So ist es richtig.', 'Offene Karten des Partners. Bitte nur legale Züge.'],
      trick: ['Stich für uns. Die Farbe war bedient.', 'Der Stich wechselt die Seite. Notiert.'],
      handWin: ['Kontrakt erfüllt. Die Punkte stehen über oder unter dem Strich, je nachdem.', 'Gewonnen, und zwar nach Rechnung, nicht nach Gefühl.'],
      handLose: ['Nicht erfüllt. Die Strafe ist notiert.', 'Zu wenig Stiche. Das Blatt ist abgeschlossen.'],
      matchWin: ['Partie gewonnen. Der Rubber oder die vier Blätter, je nach Einstellung.', 'Wir führen. Das lässt sich nachrechnen.'],
      matchLose: ['Die andere Seite ist vorn. Korrekt ausgezählt.', 'Verloren. Eine neue Partie beginnt bei null, wenn du willst.'],
      encourage: ['Bedienen ist Pflicht. Der Rest ist Übung.']
    }
  };

  var CHAT = [
    { keys: ['hallo', 'guten', 'abend', 'moin', 'servus', 'hi '], kind: 'greet' },
    { keys: ['reizen', 'reizung', 'kontrakt', 'kontra', 'rekontra', 'stayman', 'blackwood', 'sans atout', 'strohmann', 'alleinspieler'], kind: 'rules' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'figuren'], kind: 'rules' },
    { keys: ['gut', 'super', 'toll', 'bravo', 'stark', 'sauber'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'mies'], kind: 'anger' },
    { keys: ['kaffee', 'tee', 'wein', 'wasser'], kind: 'drink' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'ciao', 'gute nacht'], kind: 'bye' }
  ];

  var REPLIES = {
    margarethe: {
      greet: ['Guten Abend, Schätzchen. Die Karten sind schon neugierig.', 'Willkommen am Tisch. Ich sitze dir gegenüber, das bleibt so.'],
      rules: ['Fünf Oberfarben, 1 Sans Atout mit 15 bis 17. Stayman ist 2 Kreuz, Blackwood ist 4 Sans Atout.', 'Bedienen ist Pflicht. Der Strohmann liegt erst nach dem Ausspiel offen, und du spielst ihn, wenn du Alleinspieler bist.'],
      praise: ['Danke. Ich nehme Komplimente entgegen, auch die verdienten.', 'So spielt man mit einer Partnerin, nicht gegen sie.'],
      anger: ['Nicht die Stimme heben, Schätzchen. Die Karten hören das nicht.', 'Ärger schreibt keine Punkte. Das nächste Blatt schon.'],
      drink: ['Ein Tee, bitte. Jonas trinkt langsam, Rüdiger prüft die Rechnung.'],
      thanks: ['Gern, Schätzchen. Partner bleiben höflich.'],
      bye: ['Schon? Dann gute Nacht. Der Rubber läuft nicht davon.', 'Auf Wiedersehen. Ich mische beim nächsten Mal wieder.'],
      default: ['Mhm.', 'Ich höre dich. Und ich sehe mein Blatt.', 'Wie bitte?']
    },
    jonas: {
      greet: ['Guten Abend. Schön, dich zu sehen.', 'Hallo. Wir können anfangen, sobald der Geber so weit ist.'],
      rules: ['Ein Gebot muss höher sein: Kreuz, Karo, Herz, Pik, Sans Atout. Kontra nur gegen die andere Seite.', 'Im Rubber werden Spiele unter dem Strich gezählt. Chicago ist vier Blätter mit fester Gefahr.'],
      praise: ['Danke. Das sah gut aus, und es war auch gut.', 'Freundlich gesagt. Ich spiele trotzdem weiter in Ruhe.'],
      anger: ['Lass es gut sein. Ein Stich kommt zurück oder auch nicht.', 'Ich reg mich nicht auf. Das überlässt du sonst mir, und ich tue es nicht.'],
      drink: ['Wasser reicht. Die Reizung ist schon anregend genug.'],
      thanks: ['Gern geschehen.', 'Nichts zu danken. Wir sitzen am selben Tisch.'],
      bye: ['Schlaf gut.', 'Bis zum nächsten Blatt. Ich räume nichts um.'],
      default: ['Verstehe.', 'Ich passe im Gespräch nicht so oft wie im Spiel.', 'Sag es noch einmal, wenn es zum Blatt gehört.']
    },
    ruediger: {
      greet: ['Guten Abend. Bitte, nimm Platz.', 'Willkommen. Die Besetzung ist vollständig.'],
      rules: ['Rubber: 100 Punkte unter dem Strich sind ein Spiel. Zwei Spiele gewinnen die Partie, 700 wenn die Gegner gefährdet sind, sonst 500.', 'Chicago: Blatt eins niemand, Blatt zwei und drei die Geberseite, ab Blatt vier beide. Ein Teilpunkt bringt 50 dazu.'],
      praise: ['Zur Kenntnis genommen. Und, ja, das war korrekt.', 'Danke. Lob ändert die Punktezettel nicht, es ist trotzdem angenehm.'],
      anger: ['Bitte sachlich. Die Regeln bleiben, auch wenn das Blatt nicht gefällt.', 'Einen Moment. Schimpfen ist kein Gebot.'],
      drink: ['Kaffee, schwarz, nach dem Rubber. Vorher lenkt er nur ab.'],
      thanks: ['Gern. Das war korrekt.', 'Bitte. So gehört sich das.'],
      bye: ['Auf Wiedersehen.', 'Gute Nacht. Die Punkteliste bleibt stehen, bis du sie zurücksetzt.'],
      default: ['Einen Moment.', 'Notiert.', 'Ich habe zugehört.']
    }
  };

  var seated = ['jonas', 'margarethe', 'ruediger'];


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
      if (CHAT[i].keys.some(function (key) { return t.indexOf(key) !== -1; })) return CHAT[i].kind;
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
  function setSeated(ids) {
    var next = (ids || []).filter(function (id) { return LINES[id] || id; });
    if (next.length) seated = next.slice();
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
    seated = ['jonas', 'margarethe', 'ruediger'];
  }

  async function askAI(character, context) {
    context = context || {};
    var message = String(context.message || '');
    function canned() {
      var text = cannedReply(character, message);
      remember(message, character, text);
      return text;
    }
    if (!LINES[character] && !(REPLIES[character])) return canned();
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
    if (!lineText) return null;
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

  function nameOf(id) {
    if (CHARACTERS[id]) return CHARACTERS[id].short.toLowerCase();
    var lineup = root.SpielpartnerLineup;
    if (lineup && typeof lineup.avatar === 'function') {
      var person = lineup.avatar(id);
      if (person && person.name) return String(person.name).toLowerCase();
    }
    return String(id || '').toLowerCase();
  }

  function responders(text, rng) {
    var t = String(text || '').toLowerCase();
    var named = seated.filter(function (id) {
      var name = nameOf(id);
      return name && t.indexOf(name) !== -1;
    });
    if (named.length) return named.slice(0, 2);
    var kind = classify(text);
    if (kind === 'greet' || kind === 'bye') return seated.slice(0, 2);
    var order = seated.slice();
    return [order[Math.floor((rng || Math.random)() * order.length)]];
  }

  var api = {
    CHARACTERS: CHARACTERS,
    LINES: LINES,
    REPLIES: REPLIES,
    line: line,
    cannedReply: cannedReply,
    classify: classify,
    askAI: askAI,
    speakAI: speakAI,
    responders: responders,
    setSeated: setSeated,
    probe: probe,
    disableLive: disableLive,
    resetForTests: resetForTests
  };
  root.BridgeTalk = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);

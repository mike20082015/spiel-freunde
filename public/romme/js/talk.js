/*
 * Tischgespräche beim Rommé.
 * Horst, Oma Hilde und Margarethe fragen /api/sf/chat und sprechen über /api/sf/tts.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RommeTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Rommé, und bestimmt wieder nur Gurken auf der Hand.'],
      gameStart: ['Dreizehn Karten. Ick zähl schon mal die Schlechtpunkte.', 'Los, bevor der Kaffee kalt wird. Meiner is eh kalt.'],
      draw: ['Mal sehn, wat der Talon hergibt.', 'Noch eene. Vielleicht diesmal keene Lusche.'],
      take: ['Die Ablage nehm ick. Weg da.', 'Na also, die lag da ja nur rum.'],
      meld: ['So, det leg ick hin. Keene Diskussion.', 'Vierzig Augen. Weiter im Text.'],
      layoff: ['Die häng ick noch dran.', 'Passt. Und nu is Ruhe.'],
      swap: ['Joker raus, echte Karte rein. So macht man det.', 'Tausch. Der Joker arbeitet weiter.'],
      goOut: ['Rommé. Zählt mal schön eure Reste.', 'Aus. Ick hab keene Karte mehr, ihr schon.'],
      handRomme: ['Hand-Rommé. Doppelt so bitter, wa?', 'Alles auf einmal. Das tut euch jetzt doppelt weh.'],
      thinking: ['Momentchen. Ick sortier.', 'Nich drängeln.'],
      roundWin: ['Jewonnen. Wer hat hier die wenigsten Punkte?', 'Na? Die Schlechtpunkte liegen woanders.'],
      roundLose: ['Det lag an die Karten.', 'Na toll. Minuspunkte, mein Lieblingsfach.'],
      encourage: ['Kopf hoch. Nächste Runde knallt et.', 'Is doch bloß Papier.'],
      sessionSelf: ['Ha. Abend jewonnen. Erzähl det aber keinem.', 'Niedrigste Summe, und die hab ick. Zufall, klar.'],
      sessionHuman: ['Na jut, du liegst vorn. Genieß det leise.', 'Glückwunsch. Ick sag det nich oft.'],
    },
    margarethe: {
      welcome: ['Setz dich, Schätzchen. Die Karten sind frisch gemischt.'],
      gameStart: ['Rommé, wie auf der Kreuzfahrt, nur ohne Orchester.', 'Vierzig Augen zum Anfang. Mit Stil, bitte.'],
      draw: ['Eine Karte, hübsch verpackt.', 'Mal sehen, was der Talon für uns übrig hat.'],
      take: ['Die Ablage nehme ich mit, natürlich.', 'Oh, die lag ja schon so ordentlich da.'],
      meld: ['So legt man das in besseren Kreisen.', 'Bitte sehr. Die Erstmeldung sitzt.'],
      layoff: ['Die lege ich noch an. Ganz beiläufig.', 'Ein kleiner Anhang, mehr nicht.'],
      swap: ['Der Joker darf gehen. Die echte Karte bleibt.', 'Tausch mit Anstand.'],
      goOut: ['Rommé, Schätzchen. Die Punkte, bitte.', 'Ich bin fertig. Ihr dürft zählen.'],
      handRomme: ['Hand-Rommé. Die anderen zählen doppelt. Wie ungezogen von mir.', 'Alles auf einmal. Applaus ist erlaubt.'],
      thinking: ['Einen Augenblick, ich sortiere die Farben.', 'Geduld, Schätzchen.'],
      roundWin: ['Die wenigsten Minuspunkte. Ich bin aber auch begabt.', 'Siehste. Haltung zahlt sich aus.'],
      roundLose: ['Ach, die Karten. Nicht wir.', 'Ich trage die Minuspunkte mit Fassung.'],
      encourage: ['Kopf hoch. Die nächste Runde glänzt wieder.', 'Nicht ärgern. Perlen bleiben Perlen.'],
      sessionSelf: ['Natürlich die niedrigste Summe. So gehört sich das.', 'Ein Abend nach meinem Geschmack.'],
      sessionHuman: ['Du liegst vorn, Schätzchen. Trag es mit Würde.', 'Bravo. Das war unser Tisch.'],
    },
    'oma-hilde': {
      welcome: [
        'Na, Kind, setz dich. Ich hab den Tisch schon freigemacht.',
        'Schön, dass du da bist. Die Karten kennen mich schon.',
      ],
      gameStart: [
        'Dreizehn Karten, wie früher am Küchentisch.',
        'Herauskommen ab vierzig. Das schaff ich auch ohne Brille.',
        'Horst, nicht so laut. Die Nachbarn zählen mit.',
      ],
      draw: [
        'Eine kleine Karte noch. Mal sehen.',
        'Der Talon ist heute gut zu mir. Oder auch nicht.',
        'Ich zieh leise. Die Joker sollen schlafen.',
      ],
      take: [
        'Die Ablage nehm ich, die brauch ich gleich.',
        'Ach, die lag ja schon so ordentlich da.',
      ],
      meld: [
        'So, die leg ich hin. Passt wie ein Deckchen.',
        'Vierzig Augen. Mehr wollte ich gar nicht.',
        'Ein Satz und eine Reihe. Ganz ruhig.',
      ],
      layoff: [
        'Die häng ich noch dran, ganz vorsichtig.',
        'Anlegen darf ich jetzt. Oma vergisst das nicht.',
      ],
      swap: [
        'Den Joker tausch ich aus. Er soll nicht ewig liegen.',
        'Echte Karte rein, Joker wieder an die Arbeit.',
      ],
      goOut: [
        'Ich bin fertig, Kind. Zählt in Ruhe.',
        'Rommé. Wer möchte noch ein Plätzchen?',
      ],
      handRomme: [
        'Hand-Rommé. Das wollte ich nicht so laut sagen.',
        'Alles auf einmal. Die Minuspunkte zählen jetzt doppelt, tut mir leid.',
      ],
      thinking: [
        'Einen Moment. Ich such die Reihe.',
        'Hmm. Ass vorne oder hinten, das kenn ich noch.',
      ],
      roundWin: [
        'Oh. Die wenigsten Punkte. Das sag ich ganz leise.',
        'Na so was. Heute lagen die Reste bei den anderen.',
      ],
      roundLose: [
        'Macht nichts. Der Kuchen ist trotzdem da.',
        'Minuspunkte? Dann gibt es erst recht Kaffee.',
      ],
      encourage: [
        'Kopf hoch, Kind. Die nächste Hand wird freundlicher.',
        'Nicht schlimm. Ich hab auch mal mit lauter Buben angefangen.',
      ],
      sessionSelf: [
        'Ach Kind, das war nur Übung. Aber die niedrigste Summe hab ich schon.',
      ],
      sessionHuman: [
        'Du hast den Abend? Wie hübsch. Ich freu mich richtig.',
      ],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'na ', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark', 'lob'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair'], kind: 'anger' },
    { keys: ['bier', 'kaffee', 'keks', 'plätz', 'plaetz', 'kuchen', 'tee'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'rommé', 'romme', 'joker', 'vierzig'], kind: 'rules' },
    { keys: ['berlin', 'vermieter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff'], kind: 'margaretheTopic' },
    { keys: ['oma', 'hilde', 'strick', 'brille', 'enkel'], kind: 'hildeTopic' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao'], kind: 'bye' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Leg lieber aus.', 'N Abend. Vierzig Augen, dann reden wir.'],
      luck: ['Glück? Det is Sortieren.', 'Wenn du Glück hast, hab ick lauter Luschen.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Rommé.', 'Meckern is mein Job.'],
      drink: ['N Kaffee wär jetze jut. Schwarz.', 'Hilde backt, ick zähl die Punkte.'],
      rules: ['Erst vierzig Augen, dann anlegen. Joker zählt wie die Karte, die er vertritt.', 'Schalt die Tipps ein. Und wirf den Joker nich einfach weg.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an.', 'Berlin is laut. Hier wird et laut, wenn ick auslege.'],
      margaretheTopic: ['Jetze kommt wieder die Kreuzfahrt.'],
      hildeTopic: ['Oma legt leise an. Det is det Gefährliche.', 'Hilde tauscht den Joker und lächelt dazu.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg?', 'Na denn. Komm wieder, wenn de ne Reihe hast.'],
      default: ['Wat?', 'Red nich, leg aus.', 'Aha. Und weiter?'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen.', 'Hallo. Die Karten warten schon.'],
      luck: ['Glück hat, wer die Farben sortiert.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant.', 'Danke, Schätzchen.'],
      anger: ['Contenance, Schätzchen.', 'Wir sind hier nicht auf dem Fischmarkt.'],
      drink: ['Ein Kaffee für Hilde, Fassung für uns.', 'Nach der Runde, nicht über die Karten.'],
      rules: ['Zum ersten Auslegen brauchst du vierzig Augen. Danach darfst du anlegen.', 'Ein Satz ist gleiche Werte, eine Reihe dieselbe Farbe. Das Ass darf vorne oder hinten liegen.'],
      horstTopic: ['Horst, bitte nicht schon wieder der Vermieter.'],
      margaretheTopic: ['Auf See hat mir der Steward die Karten gemischt. Hier mache ich das selbst.', 'Meine Perlen? Die zählen nicht mit. Die Könige schon.'],
      hildeTopic: ['Oma Hilde lächelt, und plötzlich ist die Reihe komplett.', 'Sie trinkt Kaffee und gewinnt. Beides sehr ordentlich.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Gute Nacht.', 'Bis bald. Die Joker laufen nicht weg.'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Spiel dabei weiter.', 'Ach was.'],
    },
    'oma-hilde': {
      greet: ['Hallo, Kind. Schön, dass du kommst.', 'Guten Abend. Die Karten sind schon warm vom Mischen.'],
      luck: ['Ein bisschen Glück beim Ziehen darf sein.', 'Glück ist, wenn der Joker die Lücke füllt.'],
      praise: ['Das ist lieb. Ich geb mir nur Mühe.', 'Danke, Kind.'],
      anger: ['Nicht ärgern. Es ist nur Papier.', 'Atme mal durch. Ich denk an Kaffee, du an die Reihe.'],
      drink: ['Kaffee ist da, sobald die Hand zu ist.', 'Plätzchen gibt es nach dem Rommé. Versprochen.'],
      rules: ['Drei gleiche oder drei in einer Farbe hintereinander. Zum ersten Mal mindestens vierzig.', 'Danach darfst du anlegen. Der Joker steht für die fehlende Karte und muss, wenn du ihn tauschst, gleich wieder raus.'],
      horstTopic: ['Horst brummt nur. Innen ist er weich wie Kuchen.', 'Lass ihn meckern. Er legt trotzdem korrekt aus.'],
      margaretheTopic: ['Margarethe erzählt so hübsch. Ich hör zu und pass auf die Ablage auf.'],
      hildeTopic: ['Ich? Ich pass auf, dass niemand unter vierzig herauskommt.', 'Oma Hilde gewinnt nicht laut. Sie gewinnt beim Aufräumen.'],
      thanks: ['Gern, Kind.', 'Ach, dafür nicht.'],
      bye: ['Schlaf gut. Die Reihen laufen nicht weg.', 'Bis bald. Ich lass dir ein Plätzchen übrig.'],
      default: ['Ja, Kind?', 'Erzähl nur. Ich sortier derweil die Farben.', 'Hmm. So ist das manchmal.', 'Ich nick mal. Und leg gleich an.'],
    },
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
    const random = rng || Math.random;
    return arr[Math.floor(random() * arr.length)];
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
  function countLines(character) {
    const bag = LINES[character] || {};
    const replies = REPLIES[character] || {};
    let n = 0;
    Object.keys(bag).forEach((key) => { n += bag[key].length; });
    Object.keys(replies).forEach((key) => { n += replies[key].length; });
    return n;
  }
  function classify(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    for (let i = 0; i < CHAT.length; i++) {
      if (CHAT[i].keys.some((key) => t.includes(key))) return CHAT[i].kind;
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

  const PATHS = {
    chat: ['/api/sf/chat', '/api/chat', '/api/default/chat'],
    tts: ['/api/sf/tts', '/api/tts', '/api/default/tts'],
  };
  const history = [];
  let live = null;
  let base = 0;
  let failures = 0;
  let probeP = null;

  function globalObj() {
    return typeof globalThis !== 'undefined' ? globalThis : root;
  }
  function doFetch(url, options) {
    const g = globalObj();
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
  function endpoint(kind) {
    return PATHS[kind][base] || PATHS[kind][0];
  }
  function pushHistory(role, text) {
    const t = String(text || '').trim();
    if (!t) return;
    if (role !== 'du' && role !== 'horst' && role !== 'margarethe') return;
    const last = history[history.length - 1];
    if (last && last.role === role && last.text === t) return;
    history.push({ role: role, text: t });
    while (history.length > 12) history.shift();
  }
  function remember(message, character, reply) {
    let seen = false;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'du') { seen = history[i].text === message; break; }
    }
    if (!seen) pushHistory('du', message);
    pushHistory(character, reply);
  }
  async function runProbe() {
    for (let i = 0; i < PATHS.chat.length; i++) {
      try {
        const res = await doFetch(PATHS.chat[i], { method: 'GET', cache: 'no-store', signal: abortSignal(4000) });
        if (!res || !res.ok) continue;
        const data = await res.json();
        if (data && data.ok === true) {
          base = i;
          live = true;
          failures = 0;
          return true;
        }
      } catch (e) { /* nächster Pfad */ }
    }
    live = false;
    return false;
  }
  function probe() {
    if (live === true) return Promise.resolve(true);
    if (live === false) return Promise.resolve(false);
    if (!probeP) probeP = runProbe().finally(() => { probeP = null; });
    return probeP;
  }
  function disableLive() {
    live = false;
    probeP = null;
  }
  function resetForTests() {
    live = null;
    base = 0;
    failures = 0;
    probeP = null;
    history.length = 0;
  }
  const LIVE = { horst: 1, margarethe: 1, 'oma-hilde': 1 };
  function cannedNow(character, message) {
    const text = cannedReply(character, message);
    remember(message, character, text);
    return text;
  }
  async function askAI(character, context) {
    context = context || {};
    const message = String(context.message || '');
    if (!LIVE[character]) return cannedNow(character, message);
    if (live === false) return cannedNow(character, message);
    const up = await probe();
    if (!up) return cannedNow(character, message);
    try {
      const prior = (Array.isArray(context.history) ? context.history : history.slice(-6))
        .filter((h) => h && (h.role === 'du' || LIVE[h.role]));
      const res = await doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          character: character,
          message: message,
          game: context.game || null,
          history: prior,
        }),
        signal: abortSignal(11500),
      });
      if (!res || !res.ok) throw new Error('status');
      const data = await res.json();
      const text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text || /nicht erreichbar|gateway timeout/i.test(text)) throw new Error('leer');
      failures = 0;
      remember(message, character, text);
      return text;
    } catch (e) {
      failures += 1;
      if (failures >= 2) live = false;
      return cannedNow(character, message);
    }
  }
  async function speakAI(character, text) {
    const lineText = String(text || '').trim();
    if (!lineText) return null;
    if (!LIVE[character]) return null;
    if (live === false) return null;
    const up = await probe();
    if (!up) return null;
    try {
      const res = await doFetch(endpoint('tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: character, text: lineText }),
        signal: abortSignal(12000),
      });
      if (!res || !res.ok || typeof res.blob !== 'function') throw new Error('status');
      const blob = await res.blob();
      if (!blob || !blob.size) throw new Error('leer');
      const g = globalObj();
      const URLRef = (g && g.URL) || (typeof URL !== 'undefined' ? URL : null);
      if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
      return URLRef.createObjectURL(blob);
    } catch (e) {
      return null;
    }
  }
  function responders(text, rng) {
    const t = String(text || '').toLowerCase();
    const kind = classify(text);
    const random = rng || Math.random;
    if (kind === 'horstTopic' || /\bhorst\b/.test(t)) return ['horst'];
    if (kind === 'margaretheTopic' || /margarethe|grete/.test(t)) return ['margarethe'];
    if (kind === 'hildeTopic' || /\boma\b|\bhilde\b|kaffee|keks|strick/.test(t)) return ['oma-hilde'];
    if (kind === 'greet' || kind === 'bye') {
      const list = ['margarethe', 'horst'];
      if (random() < 0.45) list.push('oma-hilde');
      return list;
    }
    if (kind === 'drink' && random() < 0.5) return ['oma-hilde'];
    return [random() < 0.5 ? 'horst' : 'margarethe'];
  }

  return {
    LINES: LINES,
    REPLIES: REPLIES,
    line: line,
    countLines: countLines,
    cannedReply: cannedReply,
    classify: classify,
    askAI: askAI,
    speakAI: speakAI,
    responders: responders,
    probe: probe,
    disableLive: disableLive,
    resetForTests: resetForTests,
  };
});

/*
 * Spiel-Freunde Canasta: Tischgespräche.
 * Horst, Oma Hilde und Margarethe fragen zuerst /api/sf/chat und /api/sf/tts.
 * /api/chat und /api/tts bleiben der lokale Server, /api/default/* ein letzter Versuch.
 * Fällt ein Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CanastaTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Setz dich, die Karten werden sonst kalt.'],
      gameStart: ['Na denn. Elf Karten, und bestimmt wieder nur Gurken.', 'Los jetzt, ick hab nich ewig Zeit.', 'Margarethe, halt mir den Rücken frei. Und du ooch.'],
      draw: ['Mal sehn, wat der Talon hergibt.', 'Noch eene. Vielleicht diesmal wat Brauchbares.'],
      takePile: ['Den Stapel nehm ick. Weg da.', 'Na also, die Ablage jehört mir.'],
      meld: ['So, det leg ick hin. Keene Diskussion.', 'Passt. Weiter im Text.'],
      canasta: ['Canasta! Hat det wehjetan?', 'Sieben Stück. Ick sag ja, Können.'],
      freeze: ['Eingefroren. Viel Spaß beim Warten.', 'Wilde Karte drauf. Nu is Ruhe im Karton.'],
      block: ['Schwarze Drei. Der Nächste hat Pech.', 'Block. So mag ick det.'],
      goOut: ['Aus! Feierabend.', 'Ick mach zu. Zählt mal schön.'],
      partnerAsk: ['Hilde, darf ick raus?', 'Oma, ein Wort: raus oder liegen lassen?'],
      answerYes: ['Ja. Mach hinne.', 'Jo. Ick halt die Klappe, du machst zu.'],
      answerNo: ['Nee. Liegen lassen, det is noch nich reif.', 'Nein. Nich jetze.'],
      thinking: ['Momentchen.', 'Nich drängeln, ick zähl.'],
      roundWin: ['Jewonnen. Wie bestellt.', 'Na? Wer hat hier die Punkte?'],
      roundLose: ['Det lag nur an die Karten.', 'Na toll. Und dafür sitz ick hier.'],
      encourage: ['Kopf hoch, det wird schon.', 'Nächste Runde, denn knallt et.'],
      redThree: ['Rote Drei. Die liegt extra.', 'Schon wieder so ne rote. Na jut.'],
      sessionSelf: ['Ha! Runde jewonnen. Ick hab et euch ja jesagt.', 'Det war unsere Runde. Nächste Woche wieder, wa?'],
      sessionHuman: ['Na jut, ihr habt jewonnen. Erzähl det aber keinem.', 'Glückwunsch. Wirklich. Ick sag det nich oft.'],
      sessionOpp: ['Ausgerechnet die beiden. Ick werd nich mehr.'],
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen. Der Tisch ist gedeckt.'],
      gameStart: ['Wir beide gegen die zwei, Schätzchen. Das wird ein Fest.', 'Wie auf meiner letzten Kreuzfahrt, nur ohne Kapitän.', 'Gemütlich, aber bitte mit Stil.'],
      draw: ['Eine Karte, hübsch verpackt.', 'Mal sehen, was der Talon für uns hat.'],
      takePile: ['Die Ablage nehme ich mit, natürlich.', 'Oh, wie aufmerksam von der Ablage.'],
      meld: ['So legt man das in besseren Kreisen.', 'Bitte sehr. Ein kleiner Anfang.'],
      canasta: ['Ein Canasta! Applaus ist erlaubt.', 'Sieben Karten, und alle sitzen richtig.'],
      freeze: ['Eingefroren. Ein wenig Spannung schadet nicht.', 'Die wilde Karte bleibt liegen. Contenance.'],
      block: ['Eine schwarze Drei, ganz unschuldig.', 'Damit ist der Nächste kurz ausgebremst.'],
      goOut: ['Ausgemacht, Schätzchen. Mit Anstand.', 'Ich schließe. Die Punkte, bitte.'],
      partnerAsk: ['Schätzchen, darf ich ausmachen?', 'Ein Wort von Dir: hinaus, oder warte ich?'],
      answerYes: ['Ja, Schätzchen. Mach es hübsch.', 'Nur zu. Ich halte die Canastas fest.'],
      answerNo: ['Noch nicht, Schätzchen. Wir lassen sie zappeln.', 'Nein. Ein wenig Geduld steht uns gut.'],
      thinking: ['Einen Augenblick, ich sortiere.', 'Geduld, Schätzchen.'],
      roundWin: ['Gewonnen. Ich bin aber auch begabt.', 'Siehste, Partnerschaft zahlt sich aus.'],
      roundLose: ['Ach, die Karten. Nicht wir.', 'Wie ärgerlich. Ich trage es mit Fassung.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon.', 'Beim nächsten Mal glänzen wir wieder.'],
      redThree: ['Eine rote Drei, wie eine kleine Brosche.', 'Die legen wir beiseite, hübsch extra.'],
      sessionSelf: ['Natürlich haben wir gewonnen. Applaus, bitte.', 'Eine Dame gewinnt mit ihrem Partner. So gehört sich das.'],
      sessionHuman: ['Bravo, Schätzchen! Das war unser Abend.', 'Du und ich, das ist doch ein Paar.'],
      sessionOpp: ['Horst und Oma Hilde? Das schreibe ich nicht ins Tagebuch.'],
    },
    hilde: {
      welcome: [
        'Na, Kind, setz dich. Ich hab schon Kaffee in der Kanne gedacht.',
        'Schön, dass du da bist. Die Karten kennen mich schon.',
      ],
      gameStart: [
        'Elf Karten, wie früher am Küchentisch.',
        'Ich stricke gleich weiter, sobald die Runde zu ist.',
        'Horst, nicht so laut. Die Nachbarn schlafen vielleicht.',
      ],
      draw: [
        'Eine kleine Karte noch. Mal sehen.',
        'Der Talon ist heute gut zu mir. Oder auch nicht.',
      ],
      takePile: [
        'Den Stapel nehm ich mit, ganz leise.',
        'Ach, der lag ja schon so ordentlich da.',
      ],
      meld: [
        'Die leg ich dazu. Passt wie ein Deckchen.',
        'So, ein kleiner Satz. Mehr nicht.',
      ],
      canasta: [
        'Ein Canasta. Nicht erschrecken, das passiert mir manchmal.',
        'Sieben. Ich zähl sie lieber zweimal, aber es stimmt.',
      ],
      freeze: [
        'Eingefroren. Tut mir fast leid.',
        'Die wilde Karte bleibt liegen. Holt euch erst Kekse.',
      ],
      block: [
        'Eine schwarze Drei. Nur damit keiner hetzt.',
        'Kurz gesperrt. Ich mein es nicht böse.',
      ],
      goOut: [
        'Ich mach mal zu. Zählt in Ruhe.',
        'Aus. Wer möchte noch ein Plätzchen?',
      ],
      partnerAsk: [
        'Horst, darf ich ausmachen?',
        'Sag nur ja oder nein, ich wart.',
      ],
      answerYes: [
        'Ja, Horst. Mach nur zu.',
        'Ja. Ich halt die Karten fest.',
      ],
      answerNo: [
        'Noch nicht, Horst. Ein bisschen Zucker oben drauf.',
        'Nein, lass sie noch ein Weilchen liegen.',
      ],
      thinking: [
        'Einen Moment, Kind. Ich such die Brille.',
        'Hmm. Die Reihenfolge kenn ich noch.',
      ],
      roundWin: [
        'Oh. Schon wieder wir. Das wollte ich nicht so laut sagen.',
        'Na so was. Die Punkte sind auf unserer Seite.',
      ],
      roundLose: [
        'Macht nichts. Der Kuchen ist trotzdem da.',
        'Verloren? Dann gibt es erst recht Kaffee.',
      ],
      encourage: [
        'Kopf hoch, Kind. Die nächste Runde wird freundlicher.',
        'Nicht schlimm. Ich hab auch mal mit fünfzehn angefangen.',
      ],
      redThree: [
        'Eine rote Drei. Die legt man extra, wie die guten Tassen.',
        'Rot und beiseite. So hat es meine Mutter auch gemacht.',
      ],
      sessionSelf: ['Ach Kind, das war nur ein bisschen Übung. Aber gewonnen haben wir schon.'],
      sessionHuman: ['Ihr habt gewonnen? Wie hübsch. Ich freu mich richtig.'],
      sessionOpp: ['Na, diesmal ihr. Nächstes Mal back ich trotzdem.'],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'na ', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark', 'lob'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair'], kind: 'anger' },
    { keys: ['bier', 'wein', 'sekt', 'kaffee', 'keks', 'plätz', 'plaetz', 'kuchen', 'prost', 'durst'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'canasta', 'joker'], kind: 'rules' },
    { keys: ['berlin', 'vermieter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff'], kind: 'margaretheTopic' },
    { keys: ['oma', 'hilde', 'strick', 'brille', 'enkel'], kind: 'hildeTopic' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao'], kind: 'bye' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Spiel lieber.', 'N Abend. Wat gibts?'],
      luck: ['Glück? Det is Können.', 'Wenn du Glück hast, hab ick Pech.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Canasta.', 'Meckern is mein Job.'],
      drink: ['N Molle wär jetze jut.', 'Bier, kalt. Hilde trinkt ihren Kaffee.'],
      rules: ['Erst die Punkte fürs erste Auslegen, dann den Stapel. Und schalt die Tipps ein.', 'Sieben Karten, ein Canasta. Wilde zählen mit, höchstens drei.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an.', 'Berlin is laut. Hier is et ooch laut, wenn ick gewinne.'],
      margaretheTopic: ['Jetze kommt wieder die Kreuzfahrt.'],
      hildeTopic: ['Hilde gewinnt leise. Det is det Schlimme.', 'Oma backt, und dann nimmt se dir die Ablage weg.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg?', 'Na denn. Komm wieder, wenn de sieben Karten legen kannst.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha. Und weiter?'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen.', 'Hallo. Hast Du meine neuen Perlen bemerkt?'],
      luck: ['Glück hat, wer mit mir spielt.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant.', 'Danke, Schätzchen.'],
      anger: ['Contenance, Schätzchen.', 'Wir sind hier nicht auf dem Fischmarkt.'],
      drink: ['Ein Gläschen Sekt, bitte.', 'Hilde nimmt Kaffee, ich nehme die Punkte.'],
      rules: ['Schalt „Regeln lernen“ ein, dann sagt Dir der Tisch, was geht.', 'Die erste Meldung muss den Mindestwert schaffen. Der Rest eines Stapels zählt nicht mit.'],
      horstTopic: ['Horst, bitte nicht schon wieder der Vermieter.'],
      margaretheTopic: ['In Monaco hat mir der Kapitän die Hand geküsst.', 'Meine Perlen? Ein Geschenk.'],
      hildeTopic: ['Oma Hilde lächelt, und plötzlich liegt ein Canasta da.', 'Sie strickt und gewinnt. Beides sehr ordentlich.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Gute Nacht, Schätzchen.'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Spiel dabei weiter.', 'Ach was.'],
    },
    hilde: {
      greet: ['Hallo, Kind. Schön, dass du kommst.', 'Guten Abend. Die Karten sind schon warm vom Mischen.'],
      luck: ['Glück ist, wenn die Zweien zur richtigen Zeit kommen.', 'Ach, ein bisschen Glück darf sein.'],
      praise: ['Das ist lieb. Ich geb mir nur Mühe.', 'Danke, Kind.'],
      anger: ['Nicht ärgern. Es ist nur Papier.', 'Atme mal durch. Ich schenk dir in Gedanken Kaffee ein.'],
      drink: ['Kaffee ist da, sobald die Runde zu ist.', 'Kekse gibt es nach dem Ausmachen. Versprochen.'],
      rules: ['Gleiche Ränge, mindestens drei, zwei davon echt. Joker und Zweien sind wild.', 'Ausmachen erst mit Canasta. Die roten Dreien legt man gleich beiseite.'],
      horstTopic: ['Horst brummt nur. Innen ist er weich wie Kuchen.'],
      margaretheTopic: ['Margarethe erzählt so hübsch. Ich hör einfach zu und leg die Karten.'],
      hildeTopic: ['Ich? Ich strick und pass auf die Ablage auf.', 'Oma Hilde gewinnt nicht laut. Sie gewinnt beim Aufräumen.'],
      thanks: ['Gern, Kind.'],
      bye: ['Schlaf gut. Die Karten laufen nicht weg.', 'Bis bald. Ich lass dir ein Plätzchen übrig.'],
      default: ['Ja, Kind?', 'Erzähl nur. Ich misch derweil in Gedanken.', 'Hmm. So ist das manchmal.', 'Ich nick mal. Und leg gleich an.'],
    },
  };

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    const random = rng || Math.random;
    return arr[Math.floor(random() * arr.length)];
  }

  function line(character, event, rng) {
    return pick((LINES[character] || {})[event], rng);
  }

  function countLines(character) {
    const bag = LINES[character] || {};
    const replies = REPLIES[character] || {};
    let n = 0;
    Object.keys(bag).forEach((k) => { n += bag[k].length; });
    Object.keys(replies).forEach((k) => { n += replies[k].length; });
    return n;
  }

  function classify(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    for (let i = 0; i < CHAT.length; i++) {
      if (CHAT[i].keys.some((k) => t.includes(k))) return CHAT[i].kind;
    }
    return 'default';
  }

  function cannedReply(character, text, rng) {
    const kind = classify(text);
    const pool = (REPLIES[character] && (REPLIES[character][kind] || REPLIES[character].default)) || ['Ja.'];
    return pick(pool, rng);
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
    return undefined;
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

  const LIVE = { horst: 1, margarethe: 1, hilde: 1 };
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
        signal: abortSignal(9000),
      });
      if (!res || !res.ok) throw new Error('status');
      const data = await res.json();
      const text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) throw new Error('leer');
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
    if (kind === 'hildeTopic' || /\boma\b|\bhilde\b|kaffee|keks|strick/.test(t)) return ['hilde'];
    if (kind === 'greet' || kind === 'bye') {
      const list = ['margarethe', 'horst'];
      if (random() < 0.45) list.push('hilde');
      return list;
    }
    if (kind === 'drink' && random() < 0.5) return ['hilde'];
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

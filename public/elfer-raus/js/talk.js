/*
 * Spiel-Freunde Elfer raus: Tischgespräche.
 * Oma Hilde, Lena und Jonas fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ElferRausTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    hilde: {
      welcome: ['Na, Kind. Elfer raus, der Kaffee steht, und die Elf wartet.', 'Setz dich. Wir bauen von der Elf nach oben und nach unten.'],
      gameStart: ['Ganz ruhig. Wer eine Elf hat, legt sie in die Mitte.', 'Neue Runde. Bis zu drei Karten, dann wird nachgezogen.'],
      play: ['Die lege ich. Passt genau an die Reihe.', 'So, die gehört dahin. Oma hat hingeschaut.'],
      eleven: ['Elf raus. Die Farbe ist offen.', 'Die Elf kommt in die Mitte, dann kann die Reihe wachsen.'],
      draw: ['Ich zieh nach. Bis zu drei, mehr nicht.', 'Der Talon gibt mir neue Zahlen. Mal sehen.'],
      win: ['Leere Hand. Siehste, leise geht das auch.', 'Ich bin raus. Die Restkarten bleiben bei euch, ganz ohne Geld.'],
      lose: ['Macht nichts. Meine Zahlen zählen als Punkte, nicht als Ärger.', 'Die Elf war heute woanders. Nächste Runde.'],
      stall: ['Keiner kann mehr. Dann zählen wir, was noch auf der Hand liegt.', 'Der Talon ist leer. Wir schreiben die Reste auf.'],
      encourage: ['Nicht ärgern. Eine Zahl daneben ist noch kein Abend.', 'Kopf hoch, Kind. Die nächste Elf kommt bestimmt.'],
    },
    lena: {
      welcome: ['Moin. Elfer raus ist genau richtig zum Reden: vier Farben, von der Elf weg.', 'Moin. Ich lege, was passt, und ziehe höchstens drei nach.'],
      gameStart: ['Die Reihen sind noch zu. Wer die 11 hat, fängt die Farbe an.', 'Los. Nach oben und nach unten, eine Zahl nach der anderen.'],
      play: ['Die passt. Ich leg sie, bevor sie alt wird.', 'Angelegt. Jetzt ist das Ende der Reihe ein Stück weiter.'],
      eleven: ['11! Die Farbe ist offen, jetzt kann jeder anbauen.', 'Elf raus. Das ist der Start, nicht das Ziel.'],
      draw: ['Ich zieh. Bis zu drei Karten, und wenn eine passt, lege ich sie noch.', 'Nachziehen. Die Hand soll wieder voll werden, nicht überquellen.'],
      win: ['Leer. Die Runde geht an mich, und ich bleib trotzdem nett.', 'Keine Karte mehr. So soll Elfer raus enden.'],
      lose: ['Deine leere Hand, meine Restpunkte. Respekt.', 'Gut, das war deins. Die Zahlen nehm ich mit.'],
      stall: ['Niemand kann legen und der Talon ist leer. Dann werten wir die Reste.', 'Stillstand. Wer am wenigsten übrig hat, steht vorn.'],
      encourage: ['Kopf hoch. Eine blockierte Reihe löst sich oft eine Karte später.', 'Du spielst das richtig. Die 11 kommt, wenn sie kommt.'],
    },
    jonas: {
      welcome: ['Schön, dass du da bist. Vier Farben, und jede beginnt bei der Elf.', 'Guten Abend. Wir legen in Ruhe, bis zu drei, und niemand zahlt Geld.'],
      gameStart: ['Die Mitte ist frei. Die erste 11 setzt die Farbe.', 'Ruhig bleiben. Lücken gibt es nicht, nur den direkten Nachbarn.'],
      play: ['Die lege ich an. Sie sitzt genau am offenen Ende.', 'Passt. Ich halte die Reihe sauber.'],
      eleven: ['Elf. Die Farbe darf jetzt in beide Richtungen.', '11 auf den Tisch. Danach 12 oder 10, nicht beides auf einmal in derselben Lücke.'],
      draw: ['Ich ziehe nach, höchstens drei, und nur bis die Hand wieder voll ist.', 'Eine neue Karte. Wenn sie passt, kommt sie noch in diesem Zug.'],
      win: ['Leere Hand. Das saß, und ich lächle trotzdem.', 'Ich bin raus. Die Punkte, falls wir welche schreiben, bleiben klein.'],
      lose: ['Sauber gespielt. Meine Restkarten nehm ich ohne Murren.', 'Deine Runde. Die nächste Elf lege ich selbst.'],
      stall: ['Keine Züge mehr. Wir zählen, was liegen geblieben ist.', 'Der Stapel ist leer und die Reihen stehen. Das ist eine Wertung, kein Streit.'],
      encourage: ['Nicht schlecht. Beim nächsten Ende der Reihe klappt es.', 'Bleib dran. Elfer raus belohnt die Geduld.'],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten', 'hi ', 'hey', 'oma'], kind: 'greet' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'elf', 'elfer'], kind: 'rules' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo'], kind: 'praise' },
    { keys: ['mist', 'ärger', 'aerger', 'mies'], kind: 'anger' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'ciao'], kind: 'bye' },
    { keys: ['hilde', 'oma'], kind: 'hilde' },
    { keys: ['lena'], kind: 'lena' },
    { keys: ['jonas'], kind: 'jonas' },
  ];

  const REPLIES = {
    hilde: {
      greet: ['Na, Kind. Schön, dass du schreibst.', 'Setz dich. Die Elf läuft nicht davon.'],
      rules: ['Vier Farben, je von 1 bis 20. Die 11 kommt in die Mitte, dann eins nach oben und eins nach unten.', 'Du legst bis zu drei passende Karten und ziehst bis zu drei nach. Wer zuerst leer ist, gewinnt. Strafpunkte gibt es nur, wenn wir sie eingeschaltet haben. Kein Geld.'],
      praise: ['Das ist lieb, Kind.', 'Danke. Ich strick das Lob gleich mit ein.'],
      anger: ['Nicht schimpfen. Es ist eine Zahl, kein Unglück.', 'Ruhig bleiben. Oma hat schon schlechtere Reihen gesehen.'],
      thanks: ['Gern, mein Kind.'],
      bye: ['Schlaf gut. Der Kuchen bleibt stehen, die Karten auch.'],
      hilde: ['Ich bin die Hilde. Leise Hand, wache Augen.', 'Oma passt auf die Elfen auf.'],
      lena: ['Lena legt flink. Ich nicke und trink einen Schluck.', 'Die junge Dame kennt die Zahlen. Das freut mich.'],
      jonas: ['Jonas bleibt höflich, auch wenn die 12 fehlt.', 'Er lächelt und legt trotzdem die richtige Karte.'],
      default: ['So, so.', 'Erzähl nur. Ich lege nebenbei.', 'Gemütlich bleiben.'],
    },
    lena: {
      greet: ['Moin. Elfer raus und ein Chat, das passt zusammen.', 'Moin. Wenn du die Regel willst, frag einfach nach der Elf.'],
      rules: ['Jede Farbe startet bei 11 und wächst nach 12, 13 und nach 10, 9. Lücken sind verboten.', 'Pro Zug bis zu drei Karten, danach bis zu drei nachziehen, nicht über die Handgröße hinaus. Eine gezogene passende Karte darfst du noch legen. Wer leer ist, gewinnt. Punkte sind nur die andere Wertung. Einsatz gibt es keinen.'],
      praise: ['Danke. Das merk ich mir.', 'Oh, lieb. Nächste Reihe gehört dir.'],
      anger: ['Atmen. Eine blockierte 14 ist kein Drama.', 'Ärger legt keine Karte. Eine 11 schon.'],
      thanks: ['Gern. Sag Bescheid, wenn eine Farbe klemmt.'],
      bye: ['Bis dann. Die Reihen bleiben liegen.', 'Ciao. Nicht über einer fehlenden 10 grübeln.'],
      hilde: ['Oma Hilde sieht die Reihe, bevor ich sie ausspreche.', 'Sie spielt leise und liegt am Ende oft vorn.'],
      lena: ['Ich bin Lena. Ich lege, was direkt passt, und ziehe nicht aus Langeweile.', 'Frag mich. Ich hab die vier Farben im Kopf.'],
      jonas: ['Jonas bleibt ruhig, wenn ich schon die nächste Zahl suche.', 'Er hält die Tür auf und die Reihe sauber.'],
      default: ['Erzähl. Ich schau auf die offenen Enden.', 'Klingt gut. Welche Farbe klemmt?', 'Alles gut, solange niemand Geld setzt.'],
    },
    jonas: {
      greet: ['Guten Abend. Schön, dich am Tisch zu lesen.', 'Hallo. Die Elf ist der Anfang, das Gespräch auch.'],
      rules: ['Vier Farben, Nummern 1 bis 20. Nur die 11 öffnet eine Reihe, danach nur der direkte Nachbar nach oben oder unten.', 'Bis zu drei legen, bis zu drei ziehen. Die leere Hand gewinnt die Runde. Wer Strafpunkte will, zählt die Restzahlen bis zum Ziel. Es wird nichts gesetzt.'],
      praise: ['Danke. Das ist freundlich gesagt.', 'Ich nehm das Kompliment mit an die nächste Reihe.'],
      anger: ['Verstehe den Ärger. Die Reihe bleibt trotzdem bei der nächsten Zahl.', 'Nicht schlimm. Wir spielen weiter, in Ruhe.'],
      thanks: ['Gern geschehen.'],
      bye: ['Schlaf gut. Die Farben warten bis morgen.', 'Bis bald. Ich halte dir einen Platz frei.'],
      hilde: ['Oma Hilde legt, als hätte sie die Reihe schon gestrickt.', 'Bei ihr wird es leise, und dann ist die Hand leer.'],
      lena: ['Lena ist schnell und fair. Gute Nachbarin an der Reihe.', 'Sie erklärt die 11, ohne die Stimme zu heben.'],
      jonas: ['Ich bin Jonas. Ich lege ungern die falsche Nachbarzahl.', 'Wenn du eine Farbe suchst, sag sie. Ich schau mit.'],
      default: ['Verstehe.', 'Erzähl weiter. Ich lege, wenn ich dran bin.', 'Interessant. Welche Zahl fehlt dir?'],
    },
  };

  const LIVE = { hilde: 1, lena: 1, jonas: 1 };
  const PATHS = {
    chat: ['/api/sf/chat', '/api/chat', '/api/default/chat'],
    tts: ['/api/sf/tts', '/api/tts', '/api/default/tts'],
  };
  const history = [];
  let live = null;
  let base = 0;
  let failures = 0;
  let probeP = null;

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    const random = rng || Math.random;
    return arr[Math.floor(random() * arr.length)];
  }
  function line(character, event, rng) { return pick((LINES[character] || {})[event], rng); }
  function countLines(character) {
    const bag = LINES[character] || {};
    const replies = REPLIES[character] || {};
    let n = 0;
    Object.keys(bag).forEach(function (k) { n += bag[k].length; });
    Object.keys(replies).forEach(function (k) { n += replies[k].length; });
    return n;
  }
  function classify(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    for (let i = 0; i < CHAT.length; i++) {
      if (CHAT[i].keys.some(function (k) { return t.includes(k); })) return CHAT[i].kind;
    }
    return 'default';
  }
  function cannedReply(character, text, rng) {
    const kind = classify(text);
    const pool = (REPLIES[character] && (REPLIES[character][kind] || REPLIES[character].default)) || ['Ja.'];
    return pick(pool, rng);
  }
  function globalObj() { return typeof globalThis !== 'undefined' ? globalThis : root; }
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
  function endpoint(kind) { return PATHS[kind][base] || PATHS[kind][0]; }
  function pushHistory(role, text) {
    const t = String(text || '').trim();
    if (!t || (role !== 'du' && !LIVE[role])) return;
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
  function resetForTests() { live = null; base = 0; failures = 0; probeP = null; history.length = 0; }
  function cannedNow(character, message) {
    const text = cannedReply(character, message);
    remember(message, character, text);
    return text;
  }
  async function askAI(character, context) {
    context = context || {};
    const message = String(context.message || '');
    if (!LIVE[character] || live === false) return cannedNow(character, message);
    const up = await probe();
    if (!up) return cannedNow(character, message);
    try {
      const prior = (Array.isArray(context.history) ? context.history : history.slice(-6))
        .filter(function (h) { return h && (h.role === 'du' || LIVE[h.role]); });
      const res = await doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: character, message: message, game: context.game || 'Elfer raus', history: prior }),
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
    if (!lineText || !LIVE[character] || live === false) return null;
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
    } catch (e) { return null; }
  }
  function responders(text, rng) {
    const t = String(text || '').toLowerCase();
    const random = rng || Math.random;
    if (/oma|\bhilde\b/.test(t)) return ['hilde'];
    if (/\blena\b/.test(t)) return ['lena'];
    if (/\bjonas\b/.test(t)) return ['jonas'];
    if (classify(text) === 'greet' || classify(text) === 'bye') return ['hilde', 'lena', 'jonas'];
    return [random() < 0.34 ? 'lena' : (random() < 0.5 ? 'hilde' : 'jonas')];
  }

  return {
    LINES: LINES, REPLIES: REPLIES, line: line, countLines: countLines, cannedReply: cannedReply,
    classify: classify, askAI: askAI, speakAI: speakAI, responders: responders, probe: probe,
    disableLive: disableLive, resetForTests: resetForTests,
  };
});

/*
 * Spiel-Freunde Schwimmen: Tischgespräche.
 * Horst, Lena und Chantal fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchwimmenTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Schwimmen, drei Karten, und keiner setzt Geld.', 'Setz dich. Ick klopf, wenn ick will.'],
      gameStart: ['Drei Leben. Wer absäuft, is selber schuld.', 'Mitte liegt. Nu tausch, oder lass et.'],
      swap: ['Eine Karte. Mehr brauch ick nich.', 'Tausch. Die Mitte war mir zu freundlich.'],
      swapAll: ['Alle drei. Ick nehm den ganzen Haufen.', 'Komplett getauscht. So einfach is det.'],
      schieben: ['Schieben. Die Mitte darf neu kommen.', 'Weg damit. Drei neue, und nich meckern.'],
      knock: ['Ick klopf. Letzte Runde, dann wird gezählt.', 'Klopfen. Wer jetzt noch träumt, verliert ein Leben.'],
      thirty: ['Einunddreißig. Aus, vorbei, die Farbe stimmt.', '31. Da könnt ihr die Karten hinlegen.'],
      feuer: ['Feuer. Drei Asse. Das war det.', 'Feuer! Und ick hab se nich gemalt.'],
      win: ['Noch dabei. Wie bestellt.', 'Leben behalten. So soll det sein.'],
      lose: ['Ein Leben weniger. Na toll.', 'Ick schwimm gleich. Liegt nur an die Karten.'],
      encourage: ['Kopf hoch. Drei Karten, kein Weltuntergang.', 'Nächste Runde, denn knallt et.'],
      close: ['Zeigt her. Die niedrigste Hand zahlt ein Leben, kein Geld.'],
    },
    lena: {
      welcome: ['Hi. Schwimmen ist fair: drei Karten, drei Leben, kein Einsatz.', 'Moin. Ich tausch nur, wenn die Mitte wirklich besser ist.'],
      gameStart: ['Neue Runde. Augen nur in einer Farbe, das vergesse ich nie.', 'Los. 31 oder Feuer, und der Tisch hält die Luft an.'],
      swap: ['Eine Karte getauscht. Mal sehen, ob die Farbe jetzt trägt.', 'Tausch. Besser eine sichere Zehn als drei bunte Reste.'],
      swapAll: ['Alle drei. Die Mitte war einfach die bessere Hand.', 'Kompletttausch. Manchmal ist das der ganze Zug.'],
      schieben: ['Ich schieb die Mitte weg. Einmal darf ich das.', 'Neue Mitte. Die alte hat mir nicht gepasst.'],
      knock: ['Ich klopfe. Wer noch kann, tauscht einmal, dann zählen wir.', 'Klopfen. Ich glaube, meine Farbe reicht.'],
      thirty: ['31! Eine Farbe, fertig, Runde vorbei.', 'Einunddreißig. Das zeige ich sofort, wie es sich gehört.'],
      feuer: ['Feuer, drei Asse. Das schlägt alles.', 'Feuer! Tut mir fast leid, aber die Asse lügen nicht.'],
      win: ['Leben behalten. So mag ich das.', 'Noch dabei. Nächstes Mal darfst du klopfen.'],
      lose: ['Ein Leben weg. Gut, das war knapp daneben.', 'Ich schwimme noch nicht. Aber aufgepasst hab ich.'],
      encourage: ['Kopf hoch. Schwimmen verzeiht eine schlechte Hand.', 'Drei Leben sind ein Polster. Nutze es.'],
      close: ['Aufdecken. Die kleinste Hand gibt ein Leben ab, und es bleibt ein Spiel.'],
    },
    chantal: {
      welcome: ['Hömma, da biste ja. Schwimmen, und heute wird gelacht, ne.', 'Rück den Stuhl ran. Drei Karten, und dat Herz darf laut sein.'],
      gameStart: ['Los jetzt. Wer mauert, verschenkt die Mitte.', 'Neue Runde. Ich hab Bock auf Feuer, mal ehrlich.'],
      swap: ['Eine Karte, zack. So wird dat Blatt hübsch.', 'Getauscht. Die alte konnte weg, ne.'],
      swapAll: ['Alle drei! Ich nehm die Mitte, die Mitte nimmt mich.', 'Komplett. Dat nennt man Vertrauen, hömma.'],
      schieben: ['Schieben! Die Mitte war mir zu lahm.', 'Weg mit den drei. Neue Karten, neues Glück.'],
      knock: ['Ich klopf. Letzter Tausch, dann sehen wir, wer schwimmt.', 'Klopfen, ey. Ich fühl mich gut, und dat reicht.'],
      thirty: ['31! Farbe sitzt, Runde aus, ich grinse.', 'Einunddreißig. Hömma, dat war laut und richtig.'],
      feuer: ['Feuer! Drei Asse, der Tisch gehört kurz mir.', 'Feuer, ne. Da kannste klopfen, wie du willst.'],
      win: ['Leben noch da. Dat hat gesessen.', 'Ich bleib sitzen. Nächste Runde bist du dran mit dem Glück.'],
      lose: ['Och, ein Leben. War halt nich meine Farbe.', 'Ich schwimm noch nicht. Aber knapp war dat.'],
      encourage: ['Kopf hoch, ne. Wir sind doch ne Runde.', 'Ein Leben ist kein Abend. Tausch einfach weiter.'],
      close: ['Karten her. Wer unten liegt, gibt ein Leben, und danach gibt es Kaffee.'],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten', 'hi ', 'hey', 'hömma', 'hoemma'], kind: 'greet' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'klopfen', 'feuer', 'schwimmen'], kind: 'rules' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo'], kind: 'praise' },
    { keys: ['mist', 'ärger', 'aerger', 'mies'], kind: 'anger' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'ciao'], kind: 'bye' },
    { keys: ['horst', 'berlin'], kind: 'horst' },
    { keys: ['lena'], kind: 'lena' },
    { keys: ['chantal'], kind: 'chantal' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Drei Karten, dann reden wir.', 'N Abend. Wat liegt in der Mitte?'],
      rules: ['Eine Farbe zählt. Ass 11, Figuren und Zehn je 10. Drilling is 30½, 31 und drei Asse machen sofort Schluss.', 'Tauschen, alle drei, einmal schieben, oder klopfen. Drei Leben, dann Schwimmen. Kein Geld.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab. Is bloß Schwimmen.', 'Meckern is mein Job, spielen is deiner.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Na denn. Komm wieder, bevor de absäufst.'],
      horst: ['Ick bin schon da. Die Mütze bleibt auf.'],
      lena: ['Die Lena rechnet die Farbe schneller als ick.', 'Studentin, ja. Feuer erkennt se trotzdem.'],
      chantal: ['Chantal lacht, und dann liegt das Ass bei ihr.', 'Laut, aber die Karten stimmen.'],
      default: ['Wat?', 'Red nich, tausch.', 'Aha. Und die Mitte?'],
    },
    lena: {
      greet: ['Hey. Schön, dass du da bist. Die Mitte liegt schon.', 'Hi. Ich erklär dir 31, wenn du willst, ganz ohne Drama.'],
      rules: ['Nur eine Farbe zählt. Ass 11, Zehn, Bube, Dame, König je 10, der Rest wie draufsteht. Drei gleiche sind 30½.', 'Du kannst eine Karte tauschen, alle drei, einmal schieben oder klopfen. Danach hat jeder noch einen Zug. 31 und Feuer, das sind drei Asse, beenden sofort. Drei Leben, dann ein Mal Schwimmen. Es gibt kein Geld.'],
      praise: ['Danke. Das hör ich gern.', 'Lieb. Ich merk mir das für die nächste Mitte.'],
      anger: ['Atmen. Es ist ein Leben, kein Vermögen.', 'Ärger tauscht keine Karte. Du schon.'],
      thanks: ['Gern. Sag Bescheid, wenn die 31 unklar ist.'],
      bye: ['Bis dann. Die drei Leben warten.', 'Ciao. Nicht mit Feuer im Kopf einschlafen.'],
      horst: ['Horst meckert und klopft meistens zur richtigen Zeit.', 'Seine Schnauze ist laut, seine Rechnung stimmt oft.'],
      lena: ['Ich bin Lena. Ich tausch ungern aus Gewohnheit.', 'Frag mich ruhig, ich hab die Augen im Kopf.'],
      chantal: ['Chantal schiebt mit Schwung. Ich schau erst auf die Farbe.', 'Sie lacht, ich zähle. Beides darf sein.'],
      default: ['Erzähl, ich schau nebenbei auf die Mitte.', 'Klingt gut. Welche Farbe hast du?', 'Solange niemand Geld auf den Tisch legt, bin ich dabei.'],
    },
    chantal: {
      greet: ['Hömma, moin. Setz dich, die Karten sind warm.', 'Na du. Drei Leben, ein Tisch, und ich in der Mitte vom Lachen.'],
      rules: ['Farbe zählen, Ass elf, Bilder zehn. Drei gleiche sind dreißigeinhalb. 31 und drei Asse sind sofort vorbei.', 'Eine tauschen, alle tauschen, schieben oder klopfen. Verlierer gibt ein Leben ab. Beim vierten Mal bist du raus. Geld bleibt in der Tasche, ne.'],
      praise: ['Dat freut mich, ey.', 'Danke. Ich geb die Runde aus, in Worten.'],
      anger: ['Reg dich nich auf. Ist nur Papier und ein Leben aus Pappe.', 'Hömma, durchatmen. Dann klopfste eben später.'],
      thanks: ['Schon gut, ne. Nichts zu danken.'],
      bye: ['Machs gut. Und nimm deine Leben mit.', 'Bis bald. Die Mitte läuft nich weg.'],
      horst: ['Der Horst brummt nur. Innen is er weich, ne.', 'Berliner Mütze, lautes Herz. Passt an den Tisch.'],
      lena: ['Lena zählt leise und gewinnt laut. Ich mag das.', 'Sie erklärt, ich feiere. Gute Arbeitsteilung.'],
      chantal: ['Ich? Chantal. Laut, herzlich, und ich schieb die Mitte, wenn sie mich nervt.', 'Frag mich, ich sag, was ich sehe. Meistens die Asse der anderen.'],
      default: ['Wat denn?', 'Erzähl. Ich misch derweil in Gedanken.', 'Alles easy. Drei Karten, mehr braucht dat nich.'],
    },
  };

  const LIVE = { horst: 1, lena: 1, chantal: 1 };
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
  function line(character, event, rng) {
    return pick((LINES[character] || {})[event], rng);
  }
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
    try {
      var ctrl = new AbortController();
      setTimeout(function () { try { ctrl.abort(); } catch (err) { /* schon weg */ } }, ms);
      return ctrl.signal;
    } catch (e2) { return undefined; }
  }
  function endpoint(kind) { return PATHS[kind][base] || PATHS[kind][0]; }
  function pushHistory(role, text) {
    const t = String(text || '').trim();
    if (!t) return;
    if (role !== 'du' && !LIVE[role]) return;
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
  function resetForTests() {
    live = null; base = 0; failures = 0; probeP = null; history.length = 0;
  }
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
        .filter(function (h) { return h && (h.role === 'du' || LIVE[h.role]); });
      const res = await doFetch(endpoint('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          character: character,
          message: message,
          game: context.game || 'Schwimmen',
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
    if (/\bhorst\b/.test(t)) return ['horst'];
    if (/\blena\b/.test(t)) return ['lena'];
    if (/chantal/.test(t)) return ['chantal'];
    if (classify(text) === 'greet' || classify(text) === 'bye') return ['lena', 'chantal', 'horst'];
    return [random() < 0.34 ? 'lena' : (random() < 0.5 ? 'horst' : 'chantal')];
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

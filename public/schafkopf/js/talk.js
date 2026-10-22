/*
 * Spiel-Freunde Schafkopf: Tischgespräche.
 * Horst, Sepp und Margarethe fragen zuerst /api/sf/chat und /api/sf/tts.
 * /api/chat und /api/tts bleiben der lokale Server, /api/default/* ein letzter Versuch.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchafkopfTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Setz dich, die Karten werden sonst warm.'],
      gameStart: ['Na denn. Acht Karten, und bestimmt wieder nur Gurken.', 'Los jetzt, ick hab nich ewig Zeit.'],
      bid: ['Ick würde spielen. Mal sehen, wer meckert.', 'Weiter. Diesmal nicht.'],
      sauspiel: ['Rufspiel. Such dir deine Sau, aber leise.', 'Na toll, jetzt wird wieder gerufen.'],
      solo: ['Solo. Alle gegen mir. So mag ick det.', 'Alleene. Wie immer, wenn et drauf ankommt.'],
      wenz: ['Wenz. Nur die Unter, merkt euch det.', 'Wenz. Und wehe, einer schmiert falsch.'],
      stoss: ['Stoß! Doppelt, weil ick et kann.', 'Spritze. Nu wird et teuer.'],
      retour: ['Retour. Noch doller.', 'Retour. Ick lass mir doch nicht verdoppeln.'],
      win: ['Jewonnen. Wie bestellt.', 'Na? Wer hat hier die Augen?'],
      lose: ['Det lag nur an die Karten.', 'Na toll. Und dafür sitz ick hier.'],
      schneider: ['Schneider. Tut weh, wa?', 'Schneider. Hätte schlimmer kommen können. Schwarz.'],
      ramsch: ['Ramsch. Jeder für sich, und ick pass auf.', 'Alle weiter, also Ramsch. Schön blöd.'],
      throw: ['Zusammengeworfen. Nochmal, und diesmal richtig.', 'Nix gespielt. Der Nächste gibt.'],
      encourage: ['Kopf hoch, det wird schon.', 'Nächstes Spiel, denn knallt et.'],
      trick: ['Der Stich is meiner.', 'Weg damit.'],
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen. Der Stammtisch ist gedeckt.'],
      gameStart: ['Vier am Tisch, wie in einem besseren Lokal.', 'Gemütlich, aber bitte mit Stil.'],
      bid: ['Ich würde spielen. Es steht mir.', 'Weiter. Ich spare mich für den großen Auftritt.'],
      sauspiel: ['Ein Rufspiel. Der Partner bleibt unser kleines Geheimnis.', 'Die Sau ist gerufen. Wie charmant.'],
      solo: ['Solo. Heute glänze ich allein.', 'Ein Solo, Schätzchen. Applaus darf sein.'],
      wenz: ['Ein Wenz. Nur die Unter, ganz schnörkellos.', 'Wenz. Das ist kühn, und Kühnheit kleidet.'],
      stoss: ['Stoß. Ein wenig Spannung steht uns gut.', 'Ich verdopple. Contenance, bitte.'],
      retour: ['Retour. Noch eine Stufe feiner.', 'Retour, Schätzchen. Wir bleiben standhaft.'],
      win: ['Gewonnen. Ich bin aber auch begabt.', 'Die Augen sitzen auf der richtigen Seite.'],
      lose: ['Ach, die Karten. Nicht wir.', 'Wie ärgerlich. Ich trage es mit Fassung.'],
      schneider: ['Schneider. Das Kleid sitzt eng.', 'Schneider. Unangenehm, aber ehrlich.'],
      ramsch: ['Ramsch. Jeder für sich, wie auf einer schlechten Kreuzfahrt.', 'Alle weiter. Dann eben Ramsch, mit Anstand.'],
      throw: ['Zusammengeworfen. Die nächste Runde wird hübscher.', 'Nichts gespielt. Schade um die Frisur.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon.', 'Beim nächsten Spiel glänzen wir wieder.'],
      trick: ['Der Stich bleibt hier.', 'Bitte sehr.'],
    },
    sepp: {
      welcome: [
        'Servus, setz di her. A Maß steht scho.',
        'Grüß di. Der Stammtisch is frei, die Karten san warm.',
      ],
      gameStart: [
        'Acht Karten, und koa Hetzen. Basst scho.',
        'So, gemischt is. Wer a Sauspiel hat, der sagts.',
        'I geb, und die Brezn bleibt in der Mitte.',
      ],
      bid: [
        'I waar scho dabei. Mal schaun, was d’andern herm.',
        'I pass. Heit net, des Blatt is a Semmel ohne Butter.',
      ],
      sauspiel: [
        'Sauspiel. Die Sau bleibt gheim, bis sie fallt.',
        'Ruf i a Farb. Und der Partner druckst sich erst amal.',
      ],
      solo: [
        'Solo. I ganz alloa, ihr drei derfet zahlen.',
        'A Solo, Jessas. Da wirds stad am Tisch.',
      ],
      wenz: [
        'Wenz. Nur die Unter, und sunst nix.',
        'A Wenz is wia a kurzes Bier: schnell und ehrlich.',
      ],
      stoss: [
        'Stoß! Des verdopplt sich, mein Lieber.',
        'I geb an Stoß. Wer ko, der ko.',
      ],
      retour: [
        'Retour. No amal drüber, und es bleibt dabei.',
        'Retour, servus. I lass mi net so leicht erschrecken.',
      ],
      win: [
        'Gewonnen. Die Maß geht aufs Blatt, net aufs Geld.',
        'Ha, die Augen sitzen bei uns. I hob’s gspielt.',
      ],
      lose: [
        'Verloren. Macht nix, die nächste Runde is schon im Glas.',
        'Jessas, des war nix. I zahl in Punkten, net in Euro.',
      ],
      schneider: [
        'Schneider. Des zwickt, aber es is erlaubt.',
        'Schneiderfrei wär schöner gwesn. Nächstes Mal.',
      ],
      ramsch: [
        'Ramsch. Jeder für sich, und der mit die meisten Augen zahlt.',
        'Alle weiter, also Ramsch. I pass auf mei Blatt auf.',
      ],
      throw: [
        'Zammgworfen. Neu mischen, und koa Drama.',
        'Nix gspielt. Der Nächste gibt, i hol derweil a Brezn.',
      ],
      encourage: [
        'Kopf hoch. A schlechts Blatt is no lang koa schlechter Mensch.',
        'Basst scho. Beim nächsten Mal sitzt die Sau bei dir.',
      ],
      trick: [
        'Der Stich bleibt da. Gemütlich weiter.',
        'Weg mit dem Stich, bevor er kalt wird.',
      ],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'grüß', 'gruess', 'pfiad', 'pfiat'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark', 'basst', 'passt scho'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair', 'jessas'], kind: 'anger' },
    { keys: ['bier', 'wein', 'maß', 'mass', 'brezn', 'prost', 'durst', 'radler'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'schafkopf', 'sauspiel', 'wenz', 'solo'], kind: 'rules' },
    { keys: ['berlin', 'vermieter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff'], kind: 'margaretheTopic' },
    { keys: ['sepp', 'wirt', 'stammtisch', 'bayern', 'bayer'], kind: 'seppTopic' },
    { keys: ['danke', 'merci', 'vergelt'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao', 'pfüat', 'pfuat'], kind: 'bye' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Spiel lieber.', 'N Abend. Wat gibts?'],
      luck: ['Glück? Det is Können.', 'Wenn du Glück hast, hab ick die Sau nich.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Schafkopf.', 'Meckern is mein Job.'],
      drink: ['N Molle wär jetze jut. Sepp, du bist dran.', 'Bier, kalt. Ohne Schirmchen.'],
      rules: ['61 Augen, und du hast jewonnen. Stoß verdoppelt.', 'Erst Farbe bedienen. Trumpf is ne eigene Farbe.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an.', 'Berlin is weit. Hier riecht’s nach Brezn.'],
      margaretheTopic: ['Jetze kommt wieder die Kreuzfahrt.'],
      seppTopic: ['Sepp schenkt ein und gewinnt nebenbei. Unverschämt.', 'Der Wirt lacht leise. Det is det Gefährliche.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg?', 'Na denn. Komm wieder, wenn de ’ne Sau rufen kannst.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha. Und weiter?'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen.', 'Servus. Sagt man das hier so?'],
      luck: ['Glück hat, wer mit Stil verliert. Gewinnen ist trotzdem schöner.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant.', 'Danke, Schätzchen.'],
      anger: ['Contenance, Schätzchen.', 'Wir sind hier nicht auf dem Viktualienmarkt.'],
      drink: ['Ein kleines Glas, bitte. Sepp weiß schon.', 'Ich nehme die Punkte, die Maß überlasse ich dem Tisch.'],
      rules: ['Mit 61 Augen gewinnt die Spielerpartei. Die Gegenseite schon mit 60.', 'Die gerufene Sau muss kommen, wenn die Farbe angespielt wird.'],
      horstTopic: ['Horst, bitte nicht schon wieder der Vermieter.'],
      margaretheTopic: ['In Monaco hat mir der Kapitän die Hand geküsst. Hier reicht mir ein Solo.', 'Meine Perlen? Ein Geschenk. Die Punkte habe ich mir selbst geholt.'],
      seppTopic: ['Sepp führt das Lokal und manchmal auch das Blatt.', 'Der Wirt lächelt. Danach liegt der Stich bei ihm.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Gute Nacht, Schätzchen.', 'Pfüat di, sagt man doch. Oder so ähnlich.'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Spiel dabei weiter.', 'Ach was.'],
    },
    sepp: {
      greet: ['Servus, setz di. Die Karten kenn di scho.', 'Grüß di. Magst a Maß oder gleich a Sauspiel?'],
      luck: ['Glück is, wenn die Sau beim Rechten sitzt.', 'A bisserl Glück darf sein. Können is aber besser.'],
      praise: ['Des freut mi. I geb mir Mühe, und die Brezn auch.', 'Danke. Beim nächsten Stich sagst es nochmal.'],
      anger: ['Reg di net auf. Es is nur Papier und a bisserl Ehre.', 'Jessas. Durchschnaufen, dann gehts weiter.'],
      drink: ['A Maß is im Kopf schon eingeschenkt. Zahlen tust in Punkten.', 'Brezn liegt da. Zugreifen, aber den Stich lass liegen.'],
      rules: ['61 Augen für die Spieler, 60 für die Gegner. Stoß macht doppelt, Retour vierfach.', 'Ober und Unter san immer Trumpf, im Rufspiel dazu die ganzen Herz.'],
      horstTopic: ['Der Horst brummt nur. Innen is er weicher als a Knödel.', 'Berliner Schnauze, bayerische Karten. Geht scho.'],
      margaretheTopic: ['Die Margarethe verzählt ihre Perlen und dann die Augen. Beides stimmt.', 'Sie erzählt von der Kreuzfahrt, i hör zu und spiel die Zehn.'],
      seppTopic: ['I? I bin der Wirt. I schenk ein und i zahl in Punkten, nie in bar.', 'Sepp merkt sich die Sau. Und wer klopft.'],
      thanks: ['Gern gschehn. No a Stich?', 'Basst scho. Nichts zu danken.'],
      bye: ['Pfüat di. Die Karten laufen net davon.', 'Servus, bis bald. Die Maß bleibt stehen.'],
      default: ['Ja, mein Lieber?', 'Erzähl nur. I misch derweil in Gedanken.', 'Hmm. So is das am Stammtisch.', 'I nick. Und leg gleich a Karte.'],
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
  const LIVE = { horst: 1, margarethe: 1, sepp: 1 };
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
    if (kind === 'seppTopic' || /\bsepp\b|\bwirt\b|maß|mass|brezn/.test(t)) return ['sepp'];
    if (kind === 'greet' || kind === 'bye') return ['sepp', 'margarethe', 'horst'];
    if (kind === 'drink') return ['sepp'];
    return [random() < 0.34 ? 'sepp' : (random() < 0.5 ? 'horst' : 'margarethe')];
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

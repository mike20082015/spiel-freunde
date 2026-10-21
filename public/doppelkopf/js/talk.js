/*
 * Spiel-Freunde Doppelkopf: Tischgespräche.
 * Horst, Rüdiger und Margarethe fragen zuerst /api/sf/chat und /api/sf/tts.
 * /api/chat und /api/tts bleiben der lokale Server, /api/default/* ein letzter Versuch.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DoppelkopfTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Doppelkopf, und bestimmt wieder ohne Fuchs.'],
      gameStart: ['Zwölf Karten. Ick seh schon, det wird nix.', 'Los jetzt, die Dulle wartet nich.'],
      bid: ['Gesund. Diesmal halt ick den Mund.', 'Vorbehalt. Mal sehen, wer meckert.'],
      re: ['Re! Und wehe, der Partner pennt.', 'Re. Die Alten spielen.'],
      kontra: ['Kontra. Die Damen sitzen falsch.', 'Kontra. Ick hab keene Kreuz-Dame, und trotzdem Mut.'],
      solo: ['Solo. Alle gegen mir. So mag ick det.', 'Alleene. Wie immer, wenn et drauf ankommt.'],
      hochzeit: ['Hochzeit. Such dir einen, aber zügig.', 'Hochzeit. Drei Stiche, dann is klar, wer mit mir muss.'],
      armut: ['Armut. Wer nimmt den Kram mit?', 'Armut. Ick hab fast nix, und ick sag et auch.'],
      win: ['Jewonnen. Wie bestellt.', 'Na? Wer hat hier die Augen?'],
      lose: ['Det lag nur an die Karten.', 'Na toll. Und dafür sitz ick hier.'],
      schweinchen: ['Schweinchen! Die Füchse stehn jetzt ganz oben.', 'Schweinchen. Nu wird et eng.'],
      trick: ['Der Stich is meiner.', 'Weg damit.'],
      encourage: ['Kopf hoch, det wird schon.', 'Nächstes Spiel, denn knallt et.'],
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen. Die Dullen sind schon ungeduldig.'],
      gameStart: ['Vier am Tisch, doppelt gemischt. Wie in besseren Kreisen.', 'Gemütlich, aber bitte mit Stil.'],
      bid: ['Gesund. Ich spare mich für den großen Auftritt.', 'Vorbehalt. Es steht mir.'],
      re: ['Re. Die Alten, und ich bin dabei.', 'Re, Schätzchen. Haltung bewahren.'],
      kontra: ['Kontra. Ganz leise, aber bestimmt.', 'Kontra. Die Kreuz-Damen gehören heute nicht zu mir.'],
      solo: ['Solo. Heute glänze ich allein.', 'Ein Solo, Schätzchen. Applaus darf sein.'],
      hochzeit: ['Hochzeit. Der erste fremde Stich wird mein Partner.', 'Hochzeit. Drei Stiche Zeit, dann ist die Gesellschaft klar.'],
      armut: ['Armut. Wie unangenehm, aber ehrlich.', 'Armut. Wer nimmt die Karten mit Anstand an?'],
      win: ['Gewonnen. Ich bin aber auch begabt.', 'Die Augen sitzen auf der richtigen Seite.'],
      lose: ['Ach, die Karten. Nicht wir.', 'Wie ärgerlich. Ich trage es mit Fassung.'],
      schweinchen: ['Schweinchen. Die Füchse tragen heute Hermelin.', 'Schweinchen. Wie apart, und wie gefährlich.'],
      trick: ['Der Stich bleibt hier.', 'Bitte sehr.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon.', 'Beim nächsten Spiel glänzen wir wieder.'],
    },
    ruediger: {
      welcome: [
        'Hömma, setz dich. Dat Pils is kalt, die Karten sind warm.',
        'Na endlich. Rüdiger hat schon gemischt, zweimal, wie sich dat gehört.',
      ],
      gameStart: [
        'Zwölf Karten, zweimal dat Blatt. Und keiner weiß, wer mit wem spielt.',
        'So, gegeben. Wer beide Kreuz-Damen hat, der sag et oder er schweigt auf eigene Gefahr.',
        'Vorhand fängt an. Und nich drängeln, ne.',
      ],
      bid: [
        'Gesund. Dat Blatt is mittelprächtig, da spiel ich normal.',
        'Vorbehalt. Hömma, ich hab da wat im Ärmel, aber noch nich gezeigt.',
      ],
      re: [
        'Re! Die Alten sind wach. Kumpel, jetzt wird geliefert.',
        'Re. Kreuz-Dame im Haus, und ich sag et laut, dat es jeder hört.',
      ],
      kontra: [
        'Kontra. Ohne Dame, aber mit Meinung.',
        'Kontra, hömma. Die anderen sollen sich mal anstrengen.',
      ],
      solo: [
        'Solo. Ich ganz alleine, ihr drei dürft zugucken und Punkte abgeben.',
        'Ein Solo, dat hat Wumms. Nicht erschrecken, ne.',
      ],
      hochzeit: [
        'Hochzeit! Beide Damen, und der erste fremde Stich wird mein Partner.',
        'Hochzeit. Drei Stiche Zeit. Wer sticht, der gehört zu mir.',
      ],
      armut: [
        'Armut. Hömma, mehr als drei Trümpfe sind dat nich. Wer nimmt mit?',
        'Armut auf dem Tisch. Tauschen, ansagen, und dann sind wir Re.',
      ],
      win: [
        'Gewonnen. Dat Pils geht auf die Punkte, nich auf den Geldbeutel.',
        'Ha, die Augen sitzen bei uns. Ich hab et doch gesagt.',
      ],
      lose: [
        'Verloren. Macht nix, die nächste Runde is schon im Glas.',
        'Dat war nix. Ich zahl in Punkten, nie in Euro, ne.',
      ],
      schweinchen: [
        'Schweinchen! Beide Füchse, und die stehen jetzt über den Dullen.',
        'Hömma, Schweinchen. Der Fuchs ist heut der Chef im Ring.',
      ],
      trick: [
        'Der Stich bleibt hier. Gemütlich weiter.',
        'Weg mit dem Stich, bevor das Pils schal wird.',
      ],
      encourage: [
        'Kopf hoch. Ein dünnes Blatt ist noch lange kein dünner Abend.',
        'Passt schon. Beim nächsten Mal sitzt die Dulle bei dir.',
      ],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'hömma', 'hoemma', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair'], kind: 'anger' },
    { keys: ['bier', 'pils', 'alt ', 'kölsch', 'koelsch', 'prost', 'durst'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'doppelkopf', 'dulle', 're ', 'kontra', 'hochzeit'], kind: 'rules' },
    { keys: ['berlin', 'vermieter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff'], kind: 'margaretheTopic' },
    { keys: ['rüdiger', 'ruediger', 'ruhr', 'rhein', 'pott'], kind: 'ruedigerTopic' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao'], kind: 'bye' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Spiel lieber.', 'N Abend. Wat gibts?'],
      luck: ['Glück? Det is Können.', 'Wenn du Glück hast, hab ick die zweite Dulle nich.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Doppelkopf.', 'Meckern is mein Job.'],
      drink: ['N Molle wär jetze jut.', 'Bier, kalt. Ohne Schirmchen.'],
      rules: ['121 Augen für Re, 120 reichen Kontra, solange keiner was ansagt.', 'Trumpf is Dulle, Damen, Buben, dann Karo. Und bedienen musst du.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an.', 'Berlin is weit. Hier riecht’s nach Pils.'],
      margaretheTopic: ['Jetze kommt wieder die Kreuzfahrt.'],
      ruedigerTopic: ['Rüdiger lacht, und danach liegt der Fuchs bei ihm. Unverschämt.', 'Der aus dem Pott redet viel. Spielt aber sauber.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg?', 'Na denn. Komm wieder, wenn de ’ne Dulle halten kannst.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha. Und weiter?'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen.', 'Wie nett, dass du vorbeischaust.'],
      luck: ['Glück hat, wer mit Stil verliert. Gewinnen ist trotzdem schöner.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant.', 'Danke, Schätzchen.'],
      anger: ['Contenance, Schätzchen.', 'Wir sind hier nicht auf dem Jahrmarkt.'],
      drink: ['Ein kleines Glas, bitte. Die Punkte nehme ich nüchtern.', 'Ich lasse das Pils dem Tisch und behalte die Augen.'],
      rules: ['Ohne Ansage braucht Re 121 Augen. Sagt nur Kontra, reichen Re schon 120.', 'Re und Kontra sagst du, solange du noch elf Karten hast. Absagen kommen danach.'],
      horstTopic: ['Horst, bitte nicht schon wieder der Vermieter.'],
      margaretheTopic: ['In Monaco hat mir der Kapitän die Hand geküsst. Hier reicht mir ein Solo.', 'Meine Perlen? Ein Geschenk. Die Punkte habe ich mir selbst geholt.'],
      ruedigerTopic: ['Rüdiger bringt den Rhein mit an den Tisch, und manchmal den Fuchs.', 'Er lacht laut und gibt leise die richtige Karte.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Gute Nacht, Schätzchen.', 'Bis bald. Die Dullen laufen nicht davon.'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Spiel dabei weiter.', 'Ach was.'],
    },
    ruediger: {
      greet: ['Hömma, da bist du ja. Die Karten kennen dich schon.', 'Na, rein in die gute Stube. Doppelkopf wartet nich.'],
      luck: ['Glück is, wenn die zweite Dulle beim Richtigen sitzt.', 'Ein bisschen Dusel darf sein. Können is aber besser, ne.'],
      praise: ['Dat freut mich. Ich geb mir Mühe, und das Pils auch.', 'Danke, Kumpel. Beim nächsten Stich sagst du et nochmal.'],
      anger: ['Reg dich nich auf. Es is nur Papier und ein bisschen Ehre.', 'Hömma, durchatmen. Dann geht et weiter.'],
      drink: ['Ein Pils is im Kopf schon eingeschenkt. Zahlen tust du in Punkten.', 'Kölsch oder Alt, such dir wat aus. Den Stich lässt du liegen.'],
      rules: ['121 für Re, 120 für Kontra, wenn keiner Re oder Kontra sagt. Ansagen machen et teurer.', 'Dulle, Damen, Buben, Karo. Bedienen musst du, stechen musst du nich.'],
      horstTopic: ['Der Horst brummt nur. Innen is er weicher als ein Brötchen.', 'Berliner Schnauze, rheinisches Blatt. Geht schon, ne.'],
      margaretheTopic: ['Die Margarethe zählt Perlen und dann Augen. Beides stimmt.', 'Sie erzählt von der Kreuzfahrt, ich hör zu und spiel die Zehn.'],
      ruedigerTopic: ['Ich? Ich bin der aus dem Pott mit rheinischem Herzen. Ich korrigier freundlich und gewinn danach.', 'Rüdiger merkt sich die Dulle. Und wer Re gesagt hat.'],
      thanks: ['Gern geschehen. Noch ein Stich?', 'Passt schon. Nichts zu danken, ne.'],
      bye: ['Mach et gut. Die Karten laufen nich davon.', 'Bis bald. Das Pils bleibt stehen.'],
      default: ['Ja, Kumpel?', 'Erzähl nur. Ich misch derweil in Gedanken.', 'Hmm. So is dat am Tisch.', 'Ich nick. Und leg gleich eine Karte.'],
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
  const LIVE = { horst: 1, margarethe: 1, ruediger: 1 };
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
  /*
   * "Re" sind zwei Buchstaben. Die Stimme liest sie als R und E.
   * "Reh" spricht das Wort. Blase, Log und Ansagenamen bleiben "Re".
   */
  function spokenText(text) {
    return String(text == null ? '' : text).replace(/(^|[^\p{L}\p{N}])Re(?=$|[^\p{L}\p{N}])/gu, '$1Reh');
  }
  function responders(text, rng) {
    const t = String(text || '').toLowerCase();
    const kind = classify(text);
    const random = rng || Math.random;
    if (kind === 'horstTopic' || /\bhorst\b/.test(t)) return ['horst'];
    if (kind === 'margaretheTopic' || /margarethe|grete/.test(t)) return ['margarethe'];
    if (kind === 'ruedigerTopic' || /rüdiger|ruediger/.test(t)) return ['ruediger'];
    if (kind === 'greet' || kind === 'bye') return ['ruediger', 'margarethe', 'horst'];
    if (kind === 'drink') return ['ruediger'];
    return [random() < 0.34 ? 'ruediger' : (random() < 0.5 ? 'horst' : 'margarethe')];
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
    spokenText: spokenText,
    responders: responders,
    probe: probe,
    disableLive: disableLive,
    resetForTests: resetForTests,
  };
});

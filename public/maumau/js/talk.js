/*
 * Spiel-Freunde Mau-Mau: Tischgespräche.
 * Horst, Lena, Rüdiger und Margarethe fragen zuerst /api/sf/chat und /api/sf/tts.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MauMauTalk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = {
    horst: {
      welcome: ['Na endlich. Mau-Mau, und bestimmt wieder ohne Sieben.'],
      gameStart: ['Fünf Karten. Ick seh schon, det wird nix.', 'Los jetzt, der Stapel wartet nich.'],
      seven: ['Zwei ziehen. Und nich meckern.', 'Sieben. Nu wird die Hand schwer.'],
      eight: ['Aussetzen. Setz dich, ick mach det hier.', 'Acht. Einmal Pause für dich.'],
      wish: ['Ick wünsch mir, wat ick hab. So einfach is det.', 'Farbe is gesagt. Nu komm klar.'],
      mau: ['Mau. Letzte Karte, merkt euch det.', 'Mau. Gleich is Feierabend.'],
      maumau: ['Mau-Mau. Aus, vorbei, ick hab keene mehr.', 'Mau-Mau. Wer hat hier aufgepasst?'],
      forgot: ['Vergessen! Eine Strafkarte, und weiter.', 'Haste nich Mau gesagt. Zieh.'],
      win: ['Jewonnen. Wie bestellt.', 'Na? Wer hat hier die Karten los?'],
      lose: ['Det lag nur an die Karten.', 'Na toll. Und dafür sitz ick hier.'],
      draw: ['Ziehen. Immer ick.', 'Der Talon mag mich heute nich.'],
      encourage: ['Kopf hoch, det wird schon.', 'Nächste Runde, denn knallt et.'],
      penalty: ['Strafkarten. Selber schuld.', 'Zieh, und beim nächsten Mal den Mund aufmachen.'],
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen. Die Karten sind schon ungeduldig.'],
      gameStart: ['Mau-Mau, ganz gemütlich. Aber bitte mit Stil.', 'Fünf Karten, ein Stapel, und ich in der Mitte.'],
      seven: ['Zwei Karten, Schätzchen. Haltung bewahren.', 'Eine Sieben. Wie unangenehm für den Nächsten.'],
      eight: ['Aussetzen. Ein Atemzug, dann geht es weiter.', 'Die Acht gönnt dir eine Pause.'],
      wish: ['Ich wünsche mir die Farbe, die mir steht.', 'Farbe gesagt. Bitte passend, ja?'],
      mau: ['Mau. Meine vorletzte, und ich sage es laut.', 'Mau. Gleich ist der Auftritt vorbei.'],
      maumau: ['Mau-Mau. Leer, und das mit Anstand.', 'Mau-Mau. Ich bin fertig, ihr dürft klatschen.'],
      forgot: ['Das war kein Mau, Schätzchen. Eine Strafkarte.', 'Vergessen. So geht das in besseren Kreisen nicht.'],
      win: ['Gewonnen. Ich bin aber auch begabt.', 'Keine Karte mehr. Wie geplant.'],
      lose: ['Ach, die Karten. Nicht wir.', 'Wie ärgerlich. Ich trage es mit Fassung.'],
      draw: ['Ich ziehe. Manchmal muss auch eine Dame warten.', 'Eine Karte vom Talon. Hoffentlich mit Stil.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon.', 'Beim nächsten Spiel glänzen wir wieder.'],
      penalty: ['Strafkarten. Wer nicht ruft, der zieht.', 'Eine Karte Strafe, und wir bleiben freundlich.'],
    },
    lena: {
      welcome: [
        'Hey, schön dass du da bist. Ich hab zwischen zwei Vorlesungen noch eine Runde.',
        'Moin! Mau-Mau ist genau das Richtige, mein Kopf ist vom Lernen schon voll.',
        'Moin! Setz dich, der Kaffee ist noch warm und die Karten auch.',
      ],
      gameStart: [
        'Fünf Karten, los geht’s. Ich spiel schnell, die Bahn wartet nicht.',
        'Gemischt. Wer zuerst leer ist, hat gewonnen, ganz ohne Drama.',
        'Neue Runde. Ich hab heute Glück, das spür ich schon.',
      ],
      seven: [
        'Sieben! Zwei ziehen, tut mir fast leid.',
        'Zwei Karten für dich. Ich musste eben auch ziehen, also sind wir quitt.',
        'Sieben, und wenn du auch eine hast, schieb sie ruhig weiter.',
      ],
      eight: [
        'Acht, du setzt aus. Hol schon mal Luft.',
        'Kleine Pause für dich. Ich leg derweil weiter.',
        'Aussetzen. Nicht schlimm, die nächste Karte kommt bestimmt.',
      ],
      wish: [
        'Ich wünsch mir die Farbe, von der ich am meisten hab. Clever, oder?',
        'Farbe ist gewählt. Mal sehen, wer mitkommt.',
        'Wunschfarbe! So wechsel ich das Blatt, ohne zu mogeln.',
      ],
      mau: [
        'Mau! Eine Karte noch, ich sag’s laut, bevor Horst meckert.',
        'Mau. Letzte Karte, und ja, ich hab’s nicht vergessen.',
        'Mau! Gleich bin ich raus, drückt mir die Daumen.',
      ],
      maumau: [
        'Mau-Mau! Leer, fertig, ich darf grinsen.',
        'Mau-Mau. Das war die letzte, und ich hab sie angesagt.',
        'Mau-Mau! Wer hätte das gedacht, die Studentin räumt ab.',
      ],
      forgot: [
        'Oh, das Mau hab ich gehört… nicht. Eine Strafkarte, ganz freundlich.',
        'Du hast’s vergessen. Passiert mir in der Prüfung auch, hier gibt’s nur eine Karte.',
        'Strafkarte! Nächstes Mal einfach Mau rufen, ist kein Hexenwerk.',
      ],
      win: [
        'Gewonnen! Ich lad niemanden ein, aber ich freu mich.',
        'Leere Hand, voller Punkt. So mag ich das.',
        'Geschafft! Die Runde geht an mich, und ich bleib trotzdem nett.',
      ],
      lose: [
        'Verloren, okay. Die nächste Runde hol ich mir zurück.',
        'Meine Restkarten wiegen heute schwer. Macht nichts.',
        'Autsch, die Punkte. Dafür war’s lustig.',
      ],
      draw: [
        'Ich zieh eine. Hoffentlich passt sie sofort.',
        'Talon, sei lieb zu mir. Ich hab morgen früh Seminar.',
        'Eine Karte mehr. Mein Blatt wird zum Skript.',
      ],
      encourage: [
        'Kopf hoch, das wird schon. Mau-Mau verzeiht fast alles.',
        'Nächste Runde sitzt die Sieben bei dir, versprochen ist das nicht, aber möglich.',
        'Du spielst gut. Einmal ziehen ist noch lange kein Abend.',
      ],
      penalty: [
        'Strafkarten auf die Hand, und wir lachen trotzdem.',
        'Ziehen und weiterspielen. So sind die Regeln, und die gelten für mich auch.',
      ],
    },
    ruediger: {
      welcome: ['Hömma, setz dich. Mau-Mau, fünf Karten, und keiner schummelt.'],
      gameStart: ['Gegeben. Links fängt an, und die Sieben bleibt eine Sieben.'],
      seven: ['Zwei ziehen. Steht so, und ich sag et nur einmal.'],
      eight: ['Acht, aussetzen. Ganz ruhig, ne.'],
      wish: ['Farbe gewünscht. Bitte die richtige, nicht die bequeme.'],
      mau: ['Mau. Ordnungsgemäß angesagt.'],
      maumau: ['Mau-Mau. Die Hand ist leer, das Protokoll auch.'],
      forgot: ['Nicht angesagt. Eine Strafkarte, hömma, ganz sachlich.'],
      win: ['Gewonnen. Dat Pils bleibt im Kopf, die Punkte auf der Liste.'],
      lose: ['Verloren. Nächste Runde, dieselbe Regel.'],
      draw: ['Ich zieh. Manchmal ist der Talon die einzige ehrliche Antwort.'],
      encourage: ['Kopf hoch. Ein dünnes Blatt ist noch kein dünner Abend.'],
      penalty: ['Strafe gezogen. Weiter im Uhrzeigersinn, oder wohin die Richtung gerade zeigt.'],
    },
  };

  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'hey', 'hömma', 'hoemma', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair'], kind: 'anger' },
    { keys: ['bier', 'pils', 'kaffee', 'tee', 'prost', 'durst'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'mau', 'bube', 'sieben'], kind: 'rules' },
    { keys: ['berlin', 'vermieter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff'], kind: 'margaretheTopic' },
    { keys: ['lena', 'uni', 'vorlesung', 'lernen', 'seminar'], kind: 'lenaTopic' },
    { keys: ['rüdiger', 'ruediger', 'ruhr', 'rhein', 'pott'], kind: 'ruedigerTopic' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao'], kind: 'bye' },
  ];

  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Spiel lieber.', 'N Abend. Wat gibts?'],
      luck: ['Glück? Det is Können.', 'Wenn du Glück hast, liegt die Sieben bei mir.'],
      praise: ['Na, wenigstens eener merkt et.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Mau-Mau.', 'Meckern is mein Job.'],
      drink: ['N Molle wär jetze jut.', 'Kaffee kann Margarethe trinken.'],
      rules: ['Farbe oder Wert, sonst ziehen. Sieben zieht zwei, Acht setzt aus, Bube wünscht.', 'Mau bei der vorletzten, Mau-Mau bei der letzten. Sonst eine Strafkarte.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an.', 'Berlin is weit. Hier liegt ein Stapel.'],
      margaretheTopic: ['Jetze kommt wieder die Kreuzfahrt.'],
      lenaTopic: ['Die Lena lernt und gewinnt trotzdem. Unverschämt.', 'Studentin, ja. Kartensinn hat se trotzdem.'],
      ruedigerTopic: ['Rüdiger erklärt die Regel, und danach liegt das Ass bei ihm.', 'Der aus dem Pott redet viel. Spielt aber sauber.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg?', 'Na denn. Komm wieder, wenn de Mau sagen kannst.'],
      default: ['Wat?', 'Red nich, spiel.', 'Aha. Und weiter?'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen.', 'Wie nett, dass du vorbeischaust.'],
      luck: ['Glück hat, wer mit Stil verliert. Gewinnen ist trotzdem schöner.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant.', 'Danke, Schätzchen.'],
      anger: ['Contenance, Schätzchen.', 'Wir sind hier nicht auf dem Jahrmarkt.'],
      drink: ['Ein kleiner Kaffee, bitte. Die Punkte nehme ich wach.', 'Ich lasse das Pils dem Tisch.'],
      rules: ['Du legst Farbe oder Wert. Die Sieben gibt zwei Karten, die Acht eine Pause, der Bube einen Wunsch.', 'Bei der vorletzten Karte sagst du Mau, bei der letzten Mau-Mau.'],
      horstTopic: ['Horst, bitte nicht schon wieder der Vermieter.'],
      margaretheTopic: ['In Monaco hat mir der Kapitän die Hand geküsst. Hier reicht mir ein Mau-Mau.', 'Meine Perlen? Ein Geschenk. Die Punkte habe ich mir selbst geholt.'],
      lenaTopic: ['Lena ist jung und schnell. Ich bin älter und treffe trotzdem.', 'Sie lernt, ich lege. Beides darf glänzen.'],
      ruedigerTopic: ['Rüdiger bringt den Rhein mit an den Tisch, und manchmal die Sieben.', 'Er lacht laut und gibt leise die richtige Karte.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Gute Nacht, Schätzchen.', 'Bis bald. Der Stapel läuft nicht davon.'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Spiel dabei weiter.', 'Ach was.'],
    },
    lena: {
      greet: ['Moin! Schön, dass du schreibst und nicht nur ziehst.', 'Moin! Ich bin Lena, ich studier und ich lege Karten, in der Reihenfolge.'],
      luck: ['Ein bisschen Glück darf sein. Die Sieben ist trotzdem Können.', 'Zufall mischt, den Rest machen wir.'],
      praise: ['Danke! Das hör ich gern, auch zwischen zwei Seminaren.', 'Oh, lieb. Ich merk mir das für die nächste Runde.'],
      anger: ['Atmen. Es ist nur Mau-Mau, kein Test.', 'Ärger bringt keine Karte weg. Eine Sieben schon.'],
      drink: ['Kaffee, schwarz, und eine Karte, die passt. Mehr brauch ich nicht.', 'Durst hab ich, Zeit auch. Der Stapel hat keins von beidem.'],
      rules: ['Leg Farbe oder denselben Wert. Passt nichts, ziehst du eine und darfst sie sofort legen, wenn sie passt.', 'Sieben: zwei ziehen, stapelbar. Acht: aussetzen. Bube: Wunschfarbe, und er passt auf alles, nur nicht auf einen Buben.', 'Vorletzte Karte: Mau. Letzte: Mau-Mau. Vergessen kostet eine Strafkarte. Punkte gibt’s für das, was liegen bleibt.'],
      horstTopic: ['Horst meckert, und darunter ist er in Ordnung. Das sagt er nur nie.', 'Berliner Schnauze, studentische Geduld. Geht schon.'],
      margaretheTopic: ['Margarethe erzählt von der Kreuzfahrt, ich nick und leg die Zehn.', 'Ihre Perlen klimpern, meine Karten werden weniger. Beides fein.'],
      lenaTopic: ['Ich? Lena. Jung, gut gelaunt, und ich vergesse Mau nur selten.', 'Studium, WG, Mau-Mau. Die Prioritäten sortier ich nach dem Stapel.'],
      ruedigerTopic: ['Rüdiger kennt die Fußnote. Ich kenn die Sieben. Zusammen sind wir gefährlich.', 'Er korrigiert höflich, ich lache und lege.'],
      thanks: ['Gern! Nächste Karte gehört dir.', 'Nichts zu danken. Sag einfach Mau, wenn’s soweit ist.'],
      bye: ['Bis bald! Lern du auch ein bisschen, ich mach das schon.', 'Ciao! Der Stapel bleibt liegen, versprochen.'],
      default: ['Erzähl, ich leg nebenbei.', 'Klingt gut. Welche Farbe hast du denn grade?', 'Ich hör zu. Und ich zähl meine Karten.', 'Hmm. Solang niemand schummelt, bin ich dabei.'],
    },
    ruediger: {
      greet: ['Hömma, da bist du ja. Die Karten kennen dich schon.', 'Na, rein in die gute Stube. Mau-Mau wartet nich.'],
      luck: ['Glück is, wenn die Sieben beim Richtigen sitzt.', 'Ein bisschen Dusel darf sein. Können is aber besser, ne.'],
      praise: ['Dat freut mich. Ich geb mir Mühe.', 'Danke, Kumpel. Beim nächsten Stich, äh, bei der nächsten Karte.'],
      anger: ['Reg dich nich auf. Es is nur Papier.', 'Hömma, durchatmen. Dann geht et weiter.'],
      drink: ['Ein Pils is im Kopf schon eingeschenkt. Zahlen tust du in Punkten.', 'Kaffee für Lena, Punkte für die Liste.'],
      rules: ['Farbe oder Wert. Sieben zieht zwei, Acht setzt aus, Bube wünscht und liegt auf allem, außer auf dem Buben.', 'Mau, Mau-Mau, eine Strafkarte. Und die Restkarten werden gezählt.'],
      horstTopic: ['Der Horst brummt nur. Innen is er weicher als ein Brötchen.', 'Berliner Schnauze, rheinisches Blatt. Geht schon, ne.'],
      margaretheTopic: ['Die Margarethe zählt Perlen und dann Augen. Beides stimmt.', 'Sie erzählt von der Kreuzfahrt, ich hör zu und spiel die Zehn.'],
      lenaTopic: ['Lena lernt und legt. Beides pünktlich, ne.', 'Die Studentin vergisst das Mau seltener, als man denkt.'],
      ruedigerTopic: ['Ich? Ich bin der aus dem Pott mit rheinischem Herzen. Ich korrigier freundlich und gewinn danach.', 'Rüdiger merkt sich, wer ziehen musste.'],
      thanks: ['Gern geschehen. Noch eine Karte?', 'Passt schon. Nichts zu danken, ne.'],
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
    if (!probeP) probeP = runProbe().finally(function () { probeP = null; });
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
  const LIVE = { horst: 1, margarethe: 1, lena: 1, ruediger: 1 };
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
    if (kind === 'lenaTopic' || /\blena\b/.test(t)) return ['lena'];
    if (kind === 'ruedigerTopic' || /rüdiger|ruediger/.test(t)) return ['ruediger'];
    if (kind === 'greet' || kind === 'bye') return ['lena', 'margarethe', 'horst'];
    return [random() < 0.34 ? 'lena' : (random() < 0.5 ? 'horst' : 'margarethe')];
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

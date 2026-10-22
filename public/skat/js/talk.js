/*
 * Spiel-Freunde Skat: Tischgespräche
 * Kurze Sprüche je Figur und Ereignis, plus Stichwort-Antworten auf den Chat.
 * askAI() und speakAI() fragen zuerst /api/sf/chat und /api/sf/tts (App Platform).
 * /api/chat und /api/tts bleiben der lokale Server, /api/default/* ein letzter Versuch.
 * Die Schlüssel bleiben auf dem Server.
 * Fällt der Aufruf aus, gelten wieder die festen Sprüche und die Browserstimme.
 */
(function (root) {
  'use strict';

  const CHARACTERS = {
    horst: {
      id: 'horst', name: 'Horst Kaluppke', short: 'Horst', role: 'Der Stinkstiefel aus Berlin',
      avatar: 'assets/avatar-berliner-foto.jpg',
    },
    margarethe: {
      id: 'margarethe', name: 'Margarethe von Hohenfels', short: 'Margarethe', role: 'Die reiche Witwe',
      avatar: 'assets/avatar-witwe-foto.jpg',
    },
  };

  const LINES = {
    horst: {
      welcome: ['Na endlich. Ick dachte schon, wa spielen heute zu zweit.'],
      gameStart: ['Na denn, misch ick ma mit. Wat soll ick sonst machen.', 'Los jetzt, ick hab nich ewig Zeit.', 'Wieder so ne Gurkenhand, wetten?', 'Mein Vermieter nervt, und jetze ooch noch Skat. Na schön.'],
      bidHigh: ['Det reizen wa mal hoch, wa?', 'Na, traust dir wat?', 'Ick geh mit. Wat solls.'],
      passBid: ['Weg. Mit dem Blatt spielt nich mal mein Wellensittich.', 'Passe. Kiek ma, wat ick hier für Mist hab.'],
      declare: ['So, jetze wird gespielt. Ohne Gejammer.', 'Det Ding hol ick mir.', 'Ick sag an, ihr leidet.'],
      bigTrick: ['Zack! Det is meiner.', 'Wat dachtest du denn? Volle Hütte!', 'Na also, geht doch.', 'Die Augen nehm ick gerne.'],
      partnerSchmier: ['Danke für die Augen, Schätzken. Äh, Margarethe.', 'Na endlich mal wat Vernünftiges.'],
      weakPlay: ['Mensch, streng dich mal mehr an!', 'Wat war DET denn für ne Karte?', 'Det hätte meine Oma besser jespielt.', 'Ick fass et nich.'],
      thinking: ['Momentchen, ick überleg.', 'Hmm. Wat mach ick denn jetze.', 'Nich drängeln!'],
      selfWins: ['Jewonnen. Wie immer, wenn man mich lässt.', 'Na? Hat det wehjetan?', 'Det war Handarbeit, meine Damen und Herren.'],
      selfLoses: ['Det lag nur an die Karten.', 'Na toll. Und dafür bin ick extra wach jeblieben?', 'Wat für ne Pleite.'],
      humanWins: ['Glück jehabt. Mehr nich.', 'Na jut, det war nich schlecht. Erzähl det aber keinem.', 'Wat, schon wieder du?'],
      humanLoses: ['Tja. Det haste dir selbst einjebrockt.', 'Ha! Det kommt davon.', 'Hab ick doch jesagt.'],
      overbid: ['Überreizt! Wer soll det denn bezahlen?', 'Zu hoch jepokert, wa?'],
      schneider: ['Schneider! Det tut weh, wa?', 'Im Schneider, wie bei mir uff de Straße im Januar.'],
      schwarz: ['Schwarz! Ick werd verrückt.'],
      ramsch: ['Ramsch. Na wunderbar, keener traut sich wat.', 'Jetze heißt et: bloß keene Augen.'],
      bock: ['Bock! Jetze zählt et doppelt, passt uff.'],
      passedIn: ['Alle weg? Na, dann mischen wa neu.'],
      sessionSelfWins: ['Ha! Runde jewonnen. Ick hab et euch ja jesagt.', 'Det war meine Runde. Nächste Woche wieder, wa?'],
      sessionHumanWins: ['Na jut, du hast jewonnen. Aber nur, weil ick müde bin.', 'Glückwunsch. Wirklich. Ick sag det nich oft.'],
      sessionOtherWins: ['Ausgerechnet die Perlenkette jewinnt. Ick werd nich mehr.'],
      weakPlayKind: ['Na, macht nix. Det lernste noch.', 'Hätte schlimmer kommen können. Weiter jeht et.'],
      encourage: ['Kopf hoch, det wird schon.'],
    },
    margarethe: {
      welcome: ['Ach, da bist Du ja, Schätzchen! Setz Dich.'],
      gameStart: ['Schätzchen, gib Dir Mühe, ich möchte heute glänzen.', 'Auf meiner letzten Kreuzfahrt habe ich jeden Abend gewonnen.', 'Ach, wie gemütlich. Fast wie im Salon.', 'Mögen die Karten mir gewogen sein. Wie immer.'],
      bidHigh: ['Ich gehe mit, Schätzchen. Ich gehe immer mit.', 'Nur nicht so zaghaft!', 'Höher, höher! Das macht doch Spaß.'],
      passBid: ['Ich passe. Eine Dame weiß, wann sie sich zurückhält.', 'Diesmal überlasse ich Euch die Bühne.'],
      declare: ['Seht genau hin, so spielt man in besseren Kreisen.', 'Das wird ein Fest.', 'Meine Perlen und ich sind bereit.'],
      bigTrick: ['Oh, wie hübsch. Die nehme ich.', 'Herrlich! Wie ein Champagnerfrühstück.', 'Das war natürlich Absicht, Schätzchen.'],
      partnerSchmier: ['Oh, danke, Horst. Wie aufmerksam.', 'So gefällt mir das!'],
      weakPlay: ['Schätzchen, so spielt man doch nicht in besseren Kreisen.', 'Huch. Das war aber mutig.', 'Na, das bleibt unter uns, ja?', 'Mein seliger Gatte hätte die Stirn gerunzelt.'],
      thinking: ['Einen Augenblick, ich sortiere meine Gedanken.', 'Hmm, welche nehme ich nur?', 'Geduld, Schätzchen.'],
      selfWins: ['Gewonnen! Ich bin aber auch begabt.', 'Applaus ist erlaubt.', 'Wie erwartet. Ich sollte Unterricht geben.'],
      selfLoses: ['Das waren die Karten, nicht ich.', 'Ach, wie ärgerlich. Aber ich trage es mit Fassung.', 'Unerhört!'],
      humanWins: ['Bravo, Schätzchen! Fast so gut wie ich.', 'Das war elegant. Ich bin beeindruckt.', 'Na sieh mal einer an.'],
      humanLoses: ['Ach Schätzchen, nächstes Mal klappt es.', 'Nicht traurig sein, nicht jeder ist ein Naturtalent.', 'Tja, Hochmut kommt vor dem Fall.'],
      overbid: ['Überreizt! Wie unvorsichtig.', 'Da hat sich wohl jemand übernommen.'],
      schneider: ['Schneider! Das ist ja beinahe unhöflich.', 'Im Schneider? Wie peinlich.'],
      schwarz: ['Schwarz! Ich brauche ein Gläschen Sekt.'],
      ramsch: ['Ramsch, wie in einer Hafenkneipe.', 'Nun gut, dann sammle ich eben nichts.'],
      bock: ['Bock! Wie aufregend.'],
      passedIn: ['Alle gepasst? Wie langweilig.'],
      sessionSelfWins: ['Natürlich habe ich gewonnen, Schätzchen. Applaus, bitte!', 'Eine Dame gewinnt mit Stil.'],
      sessionHumanWins: ['Bravo, Schätzchen! Ich gratuliere Dir von Herzen. Fast.', 'Du hast gewonnen? Wie entzückend. Beim nächsten Mal bin ich dran.'],
      sessionOtherWins: ['Horst hat gewonnen? Das schreibe ich nicht in mein Tagebuch.'],
      weakPlayKind: ['Macht nichts, Schätzchen, wir haben alle mal angefangen.', 'Ach, nicht schlimm. Beim nächsten Mal weißt Du es.'],
      encourage: ['Kopf hoch, Schätzchen, das wird schon!'],
    },
  };

  // Chat: Stichwörter -> Antworten
  const CHAT = [
    { keys: ['hallo', 'moin', 'servus', 'guten abend', 'guten tag', 'hi ', 'na ', 'grüß', 'gruess'], kind: 'greet' },
    { keys: ['glück', 'glueck', 'dusel', 'zufall', 'schwein gehabt'], kind: 'luck' },
    { keys: ['gut gespielt', 'super', 'toll', 'klasse', 'bravo', 'respekt', 'stark', 'lob', 'schön gespielt'], kind: 'praise' },
    { keys: ['mist', 'verdammt', 'scheiß', 'scheiss', 'mann!', 'ärger', 'aerger', 'blöd', 'bloed', 'mies', 'unfair', 'betrug', 'schummel'], kind: 'anger' },
    { keys: ['bier', 'wein', 'sekt', 'kaffee', 'prost', 'durst'], kind: 'drink' },
    { keys: ['regel', 'wie geht', 'erklär', 'erklaer', 'hilfe', 'tipp'], kind: 'rules' },
    { keys: ['berlin', 'vermieter', 'wetter'], kind: 'horstTopic' },
    { keys: ['kreuzfahrt', 'perle', 'schiff', 'reise', 'urlaub'], kind: 'margaretheTopic' },
    { keys: ['danke', 'merci'], kind: 'thanks' },
    { keys: ['tschüss', 'tschuess', 'gute nacht', 'bis bald', 'ciao'], kind: 'bye' },
  ];
  const REPLIES = {
    horst: {
      greet: ['Ja ja, hallo. Spiel lieber.', 'N Abend. Wat gibts?'],
      luck: ['Glück? Det is Können, Kollege!', 'Wenn du Glück hast, hab ick Pech. So isset.'],
      praise: ['Na, wenigstens eener, der et merkt.', 'Danke. Aber übertreib ma nich.'],
      anger: ['Nu reg dich ab, is doch bloß Skat.', 'Meckern is mein Job, nich deiner!'],
      drink: ['N Molle wär jetze jut.', 'Bier, aber kalt. Und schnell.'],
      rules: ['Bedienen musste! Det is det Wichtigste. Und schalt ma die Tipps ein.', 'Buben sind immer Trumpf, außer beim Null. Merk dir det.'],
      horstTopic: ['Fang mir bloß nich mit meinem Vermieter an!', 'Berlin is die schönste Stadt. Und die lauteste.'],
      margaretheTopic: ['Ach, jetze erzählt se wieder von ihrem Dampfer.'],
      thanks: ['Jaja, schon jut.'],
      bye: ['Wat, schon weg? Feigling.', 'Na denn, tschüss. Komm wieder, wenn de spielen kannst.'],
      default: ['Wat?', 'Red nich, spiel!', 'Aha. Und weiter?', 'Det interessiert hier keenen.'],
    },
    margarethe: {
      greet: ['Guten Abend, Schätzchen! Schön, dass Du da bist.', 'Hallo, mein Lieber. Hast Du meine neuen Perlen bemerkt?'],
      luck: ['Glück hat nur, wer es verdient. Also ich.', 'Ach, Glück ist eine Frage der Haltung.'],
      praise: ['Oh, wie charmant von Dir!', 'Danke, Schätzchen. Man tut, was man kann.'],
      anger: ['Aber, aber! Wir sind doch hier nicht auf dem Fischmarkt.', 'Contenance, Schätzchen, Contenance.'],
      drink: ['Ein Gläschen Champagner, bitte. Gut gekühlt.', 'Für mich einen Sekt, Horst trinkt ja sowieso Bier.'],
      rules: ['Schalte doch "Regeln lernen" ein, dann zeigt Dir der Tisch, was erlaubt ist.', 'Erst bedienen, dann stechen. So einfach ist das.'],
      horstTopic: ['Horst, bitte nicht schon wieder Dein Vermieter.'],
      margaretheTopic: ['Ach, die Kreuzfahrt! In Monaco hat mir der Kapitän persönlich die Hand geküsst.', 'Meine Perlen? Ein Geschenk meines seligen Gatten.'],
      thanks: ['Gern geschehen, Schätzchen.'],
      bye: ['Schon? Wie schade. Gute Nacht, Schätzchen!'],
      default: ['Wie bitte, Schätzchen?', 'Interessant. Erzähl weiter, aber spiel dabei.', 'Ach was.', 'Hm, wie amüsant.'],
    },
  };


  /* Kurze Ansagen beim Reizen und Ansagen (Sprachausgabe). Anzeige bleibt "18", "Passe" usw. */
  const NUMBER_WORDS = {
    18: 'Achtzehn', 20: 'Zwanzig', 22: 'Zweiundzwanzig', 23: 'Dreiundzwanzig', 24: 'Vierundzwanzig', 27: 'Siebenundzwanzig',
    30: 'Dreißig', 33: 'Dreiunddreißig', 35: 'Fünfunddreißig', 36: 'Sechsunddreißig', 40: 'Vierzig', 44: 'Vierundvierzig',
    45: 'Fünfundvierzig', 46: 'Sechsundvierzig', 48: 'Achtundvierzig', 50: 'Fünfzig', 54: 'Vierundfünfzig', 55: 'Fünfundfünfzig',
    59: 'Neunundfünfzig', 60: 'Sechzig', 63: 'Dreiundsechzig', 66: 'Sechsundsechzig', 70: 'Siebzig', 72: 'Zweiundsiebzig',
    77: 'Siebenundsiebzig', 80: 'Achtzig', 81: 'Einundachtzig', 84: 'Vierundachtzig', 88: 'Achtundachtzig', 90: 'Neunzig', 96: 'Sechsundneunzig',
  };
  const GAME_CALLS = ['Kreuz', 'Pik', 'Herz', 'Karo', 'Grand', 'Null', 'Kreuz Hand', 'Pik Hand', 'Herz Hand', 'Karo Hand', 'Grand Hand', 'Null Hand', 'Null Ouvert', 'Null Ouvert Hand'];
  const CALL_STYLE = {
    horst: { pass: 'Weg.', hold: 'Jo.', open: 'Na jut, ick spiele.' },
    margarethe: { pass: 'Ich passe.', hold: 'Ja.', open: 'Dann spiele ich eben.' },
  };
  /* Jede andere Figur bekommt dieselben deutschen Wörter. Die Anzeige bleibt "18" und "Passe". */
  const DEFAULT_CALL = { pass: 'Ich passe.', hold: 'Ja.', open: 'Ich spiele.' };
  function callStyle(character) {
    return CALL_STYLE[character] || DEFAULT_CALL;
  }
  // Liefert den Sprechtext für eine Ansage: token 'pass' | 'hold' | 'open' | Zahl | Spielname
  function callText(character, token) {
    const st = callStyle(character);
    if (st && Object.prototype.hasOwnProperty.call(st, token) && st[token]) return st[token];
    const numeric = typeof token === 'string' && /^\d+$/.test(token) ? Number(token) : token;
    if (NUMBER_WORDS[numeric]) return NUMBER_WORDS[numeric] + '.';
    if (GAME_CALLS.includes(token)) return token + '!';
    return null;
  }
  /*
   * "Re" sind zwei Buchstaben. ElevenLabs und die Browserstimme lesen sie als R und E.
   * "Reh" ist dasselbe deutsche Wort (wie das Tier). Nur der Sprechtext wird ersetzt.
   * Anzeige, Chat und Punkte bleiben "Re". Kontra, Rekontra, Schneider, Bock, Retour bleiben Wörter.
   */
  function spokenText(text) {
    return String(text == null ? '' : text).replace(/(^|[^\p{L}\p{N}])Re(?=$|[^\p{L}\p{N}])/gu, '$1Reh');
  }
  function allCalls(character) {
    const out = [];
    const st = callStyle(character);
    for (const k of Object.keys(st)) out.push({ id: 'c-' + k, text: st[k] });
    for (const n of Object.keys(NUMBER_WORDS)) out.push({ id: 'c-' + n, text: NUMBER_WORDS[n] + '.' });
    GAME_CALLS.forEach((g, i) => out.push({ id: 'c-game-' + i, text: g + '!' }));
    return out;
  }
  // Alle festen Sätze einer Figur mit stabiler ID (für die vorab erzeugten MP3s)
  function allLines(character) {
    const out = [];
    for (const ev of Object.keys(LINES[character])) LINES[character][ev].forEach((t, i) => out.push({ id: 'l-' + ev + '-' + i, text: t }));
    for (const k of Object.keys(REPLIES[character])) REPLIES[character][k].forEach((t, i) => out.push({ id: 'r-' + k + '-' + i, text: t }));
    return out.concat(allCalls(character));
  }

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor((rng || Math.random)() * arr.length)];
  }

  function line(character, event, rng) {
    return pick((LINES[character] || {})[event], rng);
  }

  function classify(text) {
    const t = ' ' + text.toLowerCase() + ' ';
    for (const c of CHAT) if (c.keys.some((k) => t.includes(k))) return c.kind;
    return 'default';
  }

  function cannedReply(character, text, rng) {
    const kind = classify(text);
    const pool = REPLIES[character][kind] || REPLIES[character].default;
    return pick(pool, rng);
  }

  /*
   * Freies Tischgespräch. context: { message, game: { phase, declarer, game, scores }, history }
   * Zuerst GET /api/sf/chat. Ohne Paketnamen antwortet App Platform mit 400
   * ("Incomplete web function path"), deshalb kommt /api/chat erst danach (lokaler Server).
   * /api/default/chat bleibt ein letzter, harmloser Versuch für einen älteren Stand.
   * Klappt das nicht, bleibt der feste Spruch, für den Rest des Besuchs ohne weitere Versuche.
   */
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

  async function askAI(character, context) {
    context = context || {};
    const message = String(context.message || '');
    const canned = () => {
      const text = cannedReply(character, message);
      remember(message, character, text);
      return text;
    };
    if (character !== 'horst' && character !== 'margarethe') return canned();
    if (live === false) return canned();
    const up = await probe();
    if (!up) return canned();
    try {
      const prior = Array.isArray(context.history) ? context.history : history.slice(-6);
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
      return canned();
    }
  }

  /*
   * Nur für Sätze ohne fertige MP3 (voice.js prüft das vorher).
   * Rückgabe: Objekt-URL auf das MPEG, oder null. Dann nimmt voice.js die Browserstimme.
   * Der Schlüssel bleibt auf dem Server.
   */
  async function speakAI(character, text) {
    const line = String(text || '').trim();
    if (!line) return null;
    if (character !== 'horst' && character !== 'margarethe') return null;
    if (live === false) return null;
    const up = await probe();
    if (!up) return null;
    try {
      const res = await doFetch(endpoint('tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ character: character, text: line }),
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

  // Wer antwortet auf eine Chatnachricht? Bei Themen die passende Figur, sonst eine oder beide.
  function responders(text, rng) {
    const t = text.toLowerCase();
    const kind = classify(text);
    if (kind === 'horstTopic' || /horst/.test(t)) return ['horst'];
    if (kind === 'margaretheTopic' || /margarethe|grete/.test(t)) return ['margarethe'];
    if (kind === 'greet' || kind === 'bye') return ['margarethe', 'horst'];
    return [(rng || Math.random)() < 0.5 ? 'horst' : 'margarethe'];
  }

  root.SkatTalk = {
    CHARACTERS, LINES, REPLIES, line, cannedReply, classify, askAI, speakAI, responders, callText, spokenText, allLines, allCalls, NUMBER_WORDS, GAME_CALLS,
    probe, disableLive, resetForTests,
  };
})(typeof self !== 'undefined' ? self : this);

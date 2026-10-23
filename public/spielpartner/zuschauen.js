/* Zuschauen & Lernen: der eigene Platz spielt mit, die Runde erklärt sich.
   Läuft im Browser (window.SpielpartnerZuschauen) und in Node (require). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpielpartnerZuschauen = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var DAUER = { langsam: 1700, normal: 980, schnell: 420 };
  var state = {
    aktiv: false,
    modus: 'laufen',
    tempo: 'normal',
    stimme: false,
    sprich: null,
    beiStart: null,
    beiUebernahme: null,
    warten: null,
    timer: null,
    dock: null
  };

  function aktiv() { return state.aktiv; }

  var EINER = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
  var ZEHNER = ['', 'zehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
  function zahlWort(n) {
    n = Number(n);
    if (!isFinite(n) || n < 0 || n > 9999 || Math.floor(n) !== n) return '';
    if (n < 10) return EINER[n];
    if (n < 20) {
      if (n === 11) return 'elf';
      if (n === 12) return 'zwölf';
      if (n === 16) return 'sechzehn';
      if (n === 17) return 'siebzehn';
      return EINER[n - 10] + 'zehn';
    }
    if (n < 100) {
      var z = Math.floor(n / 10);
      var e = n % 10;
      if (!e) return ZEHNER[z];
      return (e === 1 ? 'ein' : EINER[e]) + 'und' + ZEHNER[z];
    }
    if (n < 1000) {
      var h = Math.floor(n / 100);
      var rest = n % 100;
      var head = (h === 1 ? 'ein' : EINER[h]) + 'hundert';
      return rest ? head + zahlWort(rest) : head;
    }
    var t = Math.floor(n / 1000);
    var restT = n % 1000;
    var tausend = (t === 1 ? 'ein' : EINER[t]) + 'tausend';
    return restT ? tausend + zahlWort(restT) : tausend;
  }
  function fuerSprache(text) {
    var s = String(text == null ? '' : text).replace(/Sans Atout/g, 'ohne Trumpf');
    s = s.replace(/(^|[^\p{L}\p{N}])(\d{1,4})(?=$|[^\p{L}\p{N}])/gu, function (full, pre, digits) {
      var word = zahlWort(digits);
      return word ? pre + word : full;
    });
    return s.replace(/(^|[^\p{L}\p{N}])Re(?=$|[^\p{L}\p{N}])/gu, '$1Reh');
  }

  function ersterSatz(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length > 180) s = s.slice(0, 177).replace(/\s+\S*$/, '') + '.';
    return s;
  }

  function satz(teile) {
    return teile.filter(Boolean).join(' ');
  }

  function v(name, dritte, zweite) {
    if (name === 'Du') return 'Du ' + (zweite || dritte);
    return name + ' ' + dritte;
  }

  function erklaere(spiel, info) {
    var i = info || {};
    var wer = i.name || 'Jemand';
    var karte = i.karte || 'eine Karte';
    var extra = i.regel ? ' ' + i.regel : '';

    if (spiel === 'skat') {
      if (i.art === 'reiz' && i.passe) return v(wer, 'passt') + '. Wer passt, ist aus dem Reizen und spielt dieses Blatt nicht allein.';
      if (i.art === 'reiz' && i.hoeren) return v(wer, 'sagt', 'sagst') + ' Ja zu ' + i.wert + '. Das heißt: der Wert wird gehalten, das Spiel ist mindestens ' + i.wert + ' wert.';
      if (i.art === 'reiz') return v(wer, 'sagt', 'sagst') + ' ' + i.wert + '. Beim Reizen steigt der Wert. Wer am Ende übrig bleibt, spielt allein.';
      if (i.art === 'skat' && i.hand) return v(wer, 'lässt') + ' den Skat liegen und ' + (wer === 'Du' ? 'sagst' : 'sagt') + ' ' + i.spiel + ' aus der Hand. Die beiden verdeckten Karten zählen trotzdem zum Alleinspieler.';
      if (i.art === 'skat') return v(wer, 'nimmt', 'nimmst') + ' den Skat auf, ' + (wer === 'Du' ? 'drückst' : 'drückt') + ' zwei Karten und ' + (wer === 'Du' ? 'sagst' : 'sagt') + ' ' + i.spiel + '. Gedrückte Karten gehören zum Alleinspieler.';
      if (i.art === 'kontra' && i.ja) return v(wer, 'sagt', 'sagst') + ' Kontra. Die Gegenseite traut sich den Sieg zu, der Spielwert wird schärfer.';
      if (i.art === 'kontra') return v(wer, 'sagt', 'sagst') + ' kein Kontra. Das Spiel läuft mit einfachem Wert weiter.';
      if (i.art === 're' && i.ja) return v(wer, 'sagt', 'sagst') + ' Re. Das ist die Antwort auf Kontra: der Alleinspieler bleibt bei der Ansage.';
      if (i.art === 're') return v(wer, 'lässt') + ' das Re aus. Kontra bleibt stehen, es kommt keine weitere Stufe.';
      if (i.art === 'karte' && i.raus && i.trumpf) return v(wer, 'kommt', 'kommst') + ' mit ' + karte + ' heraus. Trumpf ist angespielt, wer Trumpf hat, muss ihn bedienen.';
      if (i.art === 'karte' && i.raus) return v(wer, 'kommt', 'kommst') + ' mit ' + karte + ' heraus. Diese Farbe ist angesagt, wer sie hat, muss bedienen.';
      if (i.art === 'karte' && i.bedienen && i.trumpf) return v(wer, 'legt', 'legst') + ' ' + karte + '. Trumpf bedienen: es liegt Trumpf, also kommt ein Trumpf.';
      if (i.art === 'karte' && i.bedienen) return v(wer, 'legt', 'legst') + ' ' + karte + '. Farbzwang: die angespielte Farbe ist noch auf der Hand, also wird sie bedient.';
      if (i.art === 'karte' && i.stechen) return v(wer, 'hat', 'hast') + ' die Farbe nicht und ' + (wer === 'Du' ? 'stichst' : 'sticht') + ' mit ' + karte + '. Wer nicht bedienen kann, darf einen Trumpf legen.';
      if (i.art === 'karte' && i.abwerfen) return v(wer, 'hat', 'hast') + ' die Farbe nicht und ' + (wer === 'Du' ? 'wirfst' : 'wirft') + ' ' + karte + ' ab. Ohne passenden Trumpf bleibt eine andere Karte.';
      if (i.art === 'karte') return v(wer, 'spielt', 'spielst') + ' ' + karte + '.';
    }

    if (spiel === 'maumau') {
      if (i.art === 'maumau') return v(wer, 'sagt', 'sagst') + ' Mau-Mau und ' + (wer === 'Du' ? 'bist' : 'ist') + ' raus. Die letzte Karte passt auf den Ablegestapel.';
      if (i.art === 'mau') return v(wer, 'sagt', 'sagst') + ' Mau. Nur noch eine Karte auf der Hand, das wird laut gesagt, bevor der Nächste legt.';
      if (i.art === 'wunsch') return v(wer, 'wünscht', 'wünschst') + ' ' + (i.farbe || 'eine Farbe') + '. Ein Bube darf die Farbe wechseln, der Nächste muss die neue Farbe bedienen.';
      if (i.art === 'sieben') return v(wer, 'legt', 'legst') + ' ' + karte + '. Eine Sieben zwingt den Nächsten, Karten zu ziehen, außer er hält selbst eine Sieben.';
      if (i.art === 'acht') return v(wer, 'legt', 'legst') + ' ' + karte + '. Eine Acht setzt den Nächsten aus.';
      if (i.art === 'bube') return v(wer, 'legt', 'legst') + ' ' + karte + '. Der Bube passt auf jede Karte und wünscht danach eine neue Farbe.';
      if (i.art === 'legen') return v(wer, 'legt', 'legst') + ' ' + karte + '. Es gilt die Farbe oder der Rang der obersten Karte. Was passt, darf auf den Stapel.';
      if (i.art === 'ziehen') return v(wer, 'zieht', 'ziehst') + ' eine Karte. Es lag nichts Passendes, also kommt eine vom Talon.';
      if (i.art === 'strafe') return v(wer, 'bemerkt', 'bemerkst') + ' das fehlende Mau. Wer Mau vergisst, zieht Strafkarten.';
      if (i.art === 'verzeihen') return v(wer, 'lässt') + ' die Strafe aus. Beide Wege sind erlaubt: erinnern oder nachsehen.';
    }

    if (spiel === 'canasta') {
      if (i.art === 'nehmen') return v(wer, 'nimmt', 'nimmst') + ' den Ablagestapel. Das geht, wenn die oberste Karte an eine Meldung passt und der Stapel nicht gesperrt ist.';
      if (i.art === 'talon') return v(wer, 'zieht', 'ziehst') + ' vom Talon. Eine verdeckte Karte, danach darf gemeldet oder abgeworfen werden.';
      if (i.art === 'canasta') return v(wer, 'schließt') + ' eine Canasta. Sieben Karten eines Rangs, höchstens drei davon wild.';
      if (i.art === 'meld') return v(wer, 'meldet', 'meldest') + ' ' + (i.rang || 'einen Rang') + '. Eine Meldung sind mindestens drei gleiche Karten. Joker und Zweien sind wild und helfen mit.';
      if (i.art === 'anlegen') return v(wer, 'legt', 'legst') + ' an eine Meldung an. Gleiche Karten wachsen, bis sieben zusammen eine Canasta sind.';
      if (i.art === 'abwerfen' && i.wild) return v(wer, 'wirft', 'wirfst') + ' ' + karte + ' ab. Eine wilde Karte friert die Ablage ein, bis jemand sie mit einem natürlichen Paar auftaut.';
      if (i.art === 'abwerfen' && i.sperre) return v(wer, 'wirft', 'wirfst') + ' eine schwarze Drei ab. Sie sperrt den Stapel für den nächsten Spieler.';
      if (i.art === 'abwerfen') return v(wer, 'wirft', 'wirfst') + ' ' + karte + ' ab und beendet den Zug. Die oberste Karte der Ablage sehen alle.';
      if (i.art === 'aus') return v(wer, 'macht', 'machst') + ' aus. Die Hand ist leer, vorher braucht das Team die nötigen Canastas.';
      if (i.art === 'frage') return v(wer, 'fragt', 'fragst') + ' den Partner, ob ausgemacht werden darf. Ohne Ja bleibt die Hand liegen.';
      if (i.art === 'antwort') return v(wer, 'sagt', 'sagst') + (i.ja ? ' Ja. Der Partner darf ausmachen.' : ' Nein. Die Runde geht weiter.');
    }

    if (spiel === 'romme') {
      if (i.art === 'meld') return v(wer, 'meldet', 'meldest') + ' Karten. Beim Rommé liegen Folgen einer Farbe oder gleiche Ränge offen, mindestens drei Karten.';
      if (i.art === 'anlegen') return v(wer, 'legt', 'legst') + ' an eine Meldung an. Eine passende Karte verlängert die Folge oder den gleichen Rang.';
      if (i.art === 'nehmen') return v(wer, 'nimmt', 'nimmst') + ' die Ablage. Die oberste Karte wird gebraucht, der Rest der Ablage kommt mit auf die Hand.';
      if (i.art === 'ziehen') return v(wer, 'zieht', 'ziehst') + ' vom Talon. Wer die Ablage nicht nehmen will, bekommt eine verdeckte Karte.';
      if (i.art === 'abwerfen') return v(wer, 'wirft', 'wirfst') + ' ' + karte + ' ab. Damit ist der Zug zu Ende, die Karte liegt offen für den Nächsten.';
    }

    if (spiel === 'doppelkopf') {
      if (i.art === 'vorbehalt' && i.text === 'gesund') return v(wer, 'sagt', 'sagst') + ' gesund. Kein Sonderweg, es bleibt beim normalen Doppelkopf: Kreuz-Damen suchen die Re-Partei.';
      if (i.art === 'vorbehalt' && i.text === 'hochzeit') return v(wer, 'sagt', 'sagst') + ' Hochzeit. Beide Kreuz-Damen liegen auf einer Hand, der Partner findet sich über die ersten Stiche.';
      if (i.art === 'vorbehalt' && i.text === 'armut') return v(wer, 'sagt', 'sagst') + ' Armut. Wenig Trumpf, die Karten dürfen mit einem Mitspieler getauscht werden, der annimmt.';
      if (i.art === 'vorbehalt') return v(wer, 'behält', 'behältst') + ' ein Solo vor. Allein gegen die drei anderen, die Farbe oder die Bilderkarten sind Trumpf.';
      if (i.art === 'ansage' && i.text === 'Re') return v(wer, 'sagt', 'sagst') + ' Re. Das ist die Antwort auf Kontra, die Re-Partei bleibt bei ihrem Spiel.';
      if (i.art === 'ansage' && i.text === 'Kontra') return v(wer, 'sagt', 'sagst') + ' Kontra. Die Gegenseite kündigt an, dass sie die Re-Partei aufhalten will.';
      if (i.art === 'ansage') return v(wer, 'sagt', 'sagst') + ' ' + (i.text || 'eine Ansage') + '. Ansagen legen fest, wie klar das Blatt gewonnen werden soll.' + extra;
    }

    if (spiel === 'schafkopf') {
      if (i.art === 'klopfen') return wer + (i.ja ? (wer === 'Du' ? ' klopfst. Damit bleibt ein Solo oder ein Wenz im Spiel.' : ' klopft. Damit bleibt ein Solo oder ein Wenz im Spiel.') : (wer === 'Du' ? ' gibst weiter. Es wird kein Solo aus der Hand erzwungen.' : ' gibt weiter. Es wird kein Solo aus der Hand erzwungen.'));
      if (i.art === 'mitgehen' && i.ja) return v(wer, 'will', 'willst') + ' mitspielen. Danach wird Sauspiel, Wenz oder Solo gewählt.';
      if (i.art === 'mitgehen') return v(wer, 'passt') + '. Wer passt, überlässt die Wahl den anderen.';
      if (i.art === 'spiel') return v(wer, 'spielt', 'spielst') + ' ' + (i.text || 'ein Spiel') + '. Beim Sauspiel sucht ein Ass den Partner, Wenz und Solo laufen allein.';
      if (i.art === 'ansage') return v(wer, 'sagt', 'sagst') + ' ' + (i.text || 'eine Stufe') + '. Stoß und Retour machen das Spiel klarer, die Punkte der Runde steigen.';
    }

    if (spiel === 'schnapsen') {
      if (i.art === 'tausch') return v(wer, 'tauscht', 'tauschst') + ' den Trumpf-Unter gegen die offene Trumpfkarte. Das geht, solange der Talon noch Karten hat.';
      if (i.art === 'ansage') return v(wer, 'sagt', 'sagst') + ' ' + (i.text || 'Zwanzig') + '. König und Ober einer Farbe sind zwanzig, im Trumpf vierzig. Ohne eigenen Stich bleibt die Ansage erst liegen.';
      if (i.art === 'zudrehen') return v(wer, 'dreht', 'drehst') + ' zu. Der Talon ist zu, ab jetzt gilt Farbzwang, und wer kann, muss stechen.';
      if (i.art === 'frei') return v(wer, 'legt', 'legst') + ' ' + karte + '. Der Talon ist noch offen, da darfst du jede Karte spielen. Farbzwang kommt erst nach dem Zudrehen oder bei leerem Talon.';
      if (i.art === 'bedienen') return v(wer, 'bedient', 'bedienst') + ' mit ' + karte + '. Der Talon ist zu: Farbe bedienen und stechen, wenn eine höhere Karte da ist.';
      if (i.art === 'trumpf') return v(wer, 'legt', 'legst') + ' ' + karte + '. Die Farbe fehlt. Trumpf bedienen und nach Möglichkeit überstechen.';
      if (i.art === 'abwerfen') return v(wer, 'wirft', 'wirfst') + ' ' + karte + ' ab. Farbe und stechender Trumpf fehlen, also kommt eine andere Karte.';
    }

    if (spiel === 'jass') {
      if (i.art === 'trumpfwahl') return v(wer, 'wählt', 'wählst') + ' ' + (i.trumpf || 'Trumpf') + '. Eine Farbe sticht, Obenabe und Undenufe drehen nur die Reihenfolge der Karten.';
      if (i.art === 'schieben') return v(wer, 'schiebt', 'schiebst') + '. Der Partner sucht den Trumpf aus.';
    }

    if (spiel === 'watten') {
      if (i.art === 'schlag') return v(wer, 'nennt', 'nennst') + ' den Schlag ' + (i.text || '') + '. Der Schlag steht in dieser Runde über den anderen Rängen.' + extra;
      if (i.art === 'tausch') return v(wer, 'tauscht', 'tauschst') + ' Karten. Vor dem Ansagen darfst du blinde Karten gegen neue vom Talon tauschen.';
      if (i.art === 'trumpfwahl') return v(wer, 'macht', 'machst') + ' ' + (i.trumpf || 'eine Farbe') + ' zu Trumpf. Diese Farbe sticht die anderen.';
      if (i.art === 'bieten') return v(wer, 'bietet', 'bietest') + ' höher. Wer mithält, spielt die Runde um mehr Punkte. Gezählt werden Punkte, nichts weiter.';
      if (i.art === 'halten') return v(wer, 'hält', 'hältst') + ' mit. Das Spiel läuft um die genannte Stufe.';
      if (i.art === 'gehen') return v(wer, 'geht', 'gehst') + '. Das höhere Bieten bleibt aus, es gilt die bisherige Stufe.';
      if (i.art === 'karte') return v(wer, 'legt', 'legst') + ' ' + karte + '. Im Watten gibt es keinen Farbzwang. Drei Stiche gewinnen das Spiel. Liegt die Haube vorn, dann Trumpf oder ein Kritischer.';
    }

    if (spiel === 'bridge') {
      if (i.art === 'reiz') return v(wer, 'reizt') + '. ' + (i.text || 'Passen.') + ' Die Reizung steigt in Stufen. Wer am höchsten bleibt, spielt den Kontrakt, der Partner legt als Strohmann auf.';
      if (i.art === 'ansage') return v(wer, 'sagt', 'sagst') + ' ' + (i.text || 'die Ansage') + '.' + extra;
    }

    if (spiel === 'schwimmen') {
      if (i.art === 'tausch') return v(wer, 'tauscht', 'tauschst') + ' ' + karte + '. Eine eigene Karte gegen eine offene Karte in der Mitte, so wird das Blatt kleiner.';
      if (i.art === 'alle') return v(wer, 'tauscht', 'tauschst') + ' alle drei Karten. Die Mitte und die Hand wechseln den Platz.';
      if (i.art === 'klopfen') return v(wer, 'klopft', 'klopfst') + '. Das Blatt passt. Die anderen dürfen noch einmal tauschen, dann wird aufgedeckt.';
      if (i.art === 'aufdecken') return v(wer, 'deckt', 'deckst') + ' auf. Die kleinere Augenzahl gewinnt, 31 ist das volle Blatt aus einer Farbe.';
      if (i.art === 'schieben') return v(wer, 'schiebt', 'schiebst') + ' die Mitte weiter. Kein Tausch in diesem Zug, der Nächste ist dran.';
    }

    if (spiel === 'elfer') {
      if (i.art === 'legen') return v(wer, 'legt', 'legst') + ' ' + karte + '. Die Reihen wachsen vom Buben nach oben und nach unten. Nur die nächste Karte der Farbe passt an.';
      if (i.art === 'ziehen') return v(wer, 'kommt', 'kommst') + ' nicht an. Passt keine Karte an eine Reihe, wird gezogen oder der Zug weitergegeben.';
    }

    if (i.art === 'raus' && i.trumpf) return v(wer, 'kommt', 'kommst') + ' mit ' + karte + ' heraus. Trumpf ist angespielt, wer kann, bedient Trumpf.' + extra;
    if (i.art === 'raus') return v(wer, 'kommt', 'kommst') + ' mit ' + karte + ' heraus. Die Farbe ist angesagt.' + extra;
    if (i.art === 'bedienen' && i.trumpf) return v(wer, 'bedient', 'bedienst') + ' mit ' + karte + '. Trumpf bedienen: Trumpf liegt, also kommt Trumpf.' + extra;
    if (i.art === 'bedienen') return v(wer, 'bedient', 'bedienst') + ' mit ' + karte + '. Farbzwang: die angespielte Farbe muss gelegt werden, solange du sie hast.' + extra;
    if (i.art === 'stechen') return v(wer, 'sticht', 'stichst') + ' mit ' + karte + '. Die Farbe fehlt, ein Trumpf darf den Stich holen.' + extra;
    if (i.art === 'abwerfen') return v(wer, 'wirft', 'wirfst') + ' ' + karte + ' ab. Die Farbe fehlt, und es wird kein Trumpf gelegt.' + extra;
    if (i.art === 'ansage') return v(wer, 'sagt', 'sagst') + ' ' + (i.text || 'die Ansage') + '.' + extra;
    if (i.art === 'trumpfwahl') return v(wer, 'wählt', 'wählst') + ' ' + (i.trumpf || 'Trumpf') + '. Diese Farbe sticht die anderen.' + extra;
    return satz([v(wer, 'ist', 'bist') + ' am Zug.', extra]);
  }

  function el(id) { return document.getElementById(id); }

  function malen() {
    var dock = state.dock;
    if (!dock) return;
    dock.querySelectorAll('[data-tempo]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-tempo') === state.tempo));
    });
    var pause = el('zuschauen-pause');
    if (pause) pause.textContent = state.modus === 'pause' ? 'Weiter' : 'Pause';
    var stimme = el('zuschauen-stimme');
    if (stimme) stimme.setAttribute('aria-pressed', String(!!state.stimme));
    dock.classList.toggle('ist-pause', state.modus === 'pause');
    dock.classList.toggle('ist-selbst', !state.aktiv);
  }

  function wecken() {
    var fn = state.warten;
    if (!fn) return;
    state.warten = null;
    fn();
  }

  function takt() {
    if (!state.aktiv) return Promise.resolve();
    return new Promise(function (resolve) {
      function fertig() {
        state.warten = null;
        state.timer = null;
        malen();
        resolve();
      }
      function arm() {
        if (!state.aktiv) { fertig(); return; }
        if (state.modus === 'pause') {
          state.warten = arm;
          malen();
          return;
        }
        var schritt = state.modus === 'schritt';
        var ms = DAUER[state.tempo] || DAUER.normal;
        if (schritt) ms = Math.min(ms, 380);
        state.timer = setTimeout(function () {
          state.timer = null;
          if (schritt) state.modus = 'pause';
          fertig();
        }, ms);
      }
      state.warten = arm;
      arm();
    });
  }

  function kommentar(text, opts) {
    opts = opts || {};
    var node = el('zuschauen-text');
    if (node && text) node.textContent = text;
    if (!text || opts.still || !state.stimme || typeof state.sprich !== 'function') return;
    try { state.sprich(opts.platz, fuerSprache(ersterSatz(text))); }
    catch (err) { /* eine Stimme darf die Runde nicht anhalten */ }
  }

  function setTempo(name) {
    if (!DAUER[name]) return;
    state.tempo = name;
    malen();
  }

  function pause() {
    if (!state.aktiv) return;
    if (state.modus === 'pause') {
      state.modus = 'laufen';
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      wecken();
    } else {
      state.modus = 'pause';
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      if (state.warten) {
        var fn = state.warten;
        state.warten = null;
        fn();
      }
    }
    malen();
  }

  function einZug() {
    if (!state.aktiv) return;
    state.modus = 'schritt';
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    wecken();
    malen();
  }

  function uebernehmen() {
    if (!state.aktiv && state.dock && !state.dock.hidden) return;
    state.aktiv = false;
    state.modus = 'laufen';
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    var fn = state.beiUebernahme;
    if (typeof fn === 'function') {
      try { fn(); }
      catch (err) { /* die Runde fängt den Rest selbst */ }
    }
    wecken();
    kommentar('Du spielst selbst weiter. Dein Platz gehört wieder dir, die anderen bleiben verdeckt.', { still: true });
    var kicker = el('zuschauen-kicker');
    if (kicker) kicker.textContent = 'Du spielst';
    malen();
  }

  function probeSpent() {
    try {
      var host = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
      var Acc = host && host.SpielpartnerAccount;
      var store = null;
      try { store = typeof localStorage !== 'undefined' ? localStorage : null; }
      catch (err) { store = null; }
      if (!Acc || !store || typeof Acc.probeUsed !== 'function') return false;
      if (!Acc.probeUsed(store)) return false;
      if (typeof Acc.readSession === 'function' && Acc.readSession(store, Date.now())) return false;
      return true;
    } catch (err) {
      return false;
    }
  }

  function nachRunde(fn) {
    if (!state.aktiv) return;
    if (probeSpent()) {
      state.aktiv = false;
      state.modus = 'laufen';
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      if (state.dock) state.dock.hidden = true;
      try {
        if (typeof document !== 'undefined' && document.body) document.body.classList.remove('zuschauen-an');
      } catch (err) { /* ohne Seite */ }
      return;
    }
    kommentar('Die Runde ist zu Ende. Gleich geht die nächste, damit du noch ein paar Beispiele siehst.', { still: true });
    takt().then(function () {
      if (state.aktiv && typeof fn === 'function') fn();
    });
  }

  function dockBauen() {
    if (state.dock) return state.dock;
    var dock = document.createElement('aside');
    dock.className = 'zuschauen-dock';
    dock.id = 'zuschauen-dock';
    dock.hidden = true;
    dock.setAttribute('aria-label', 'Zuschauen und Lernen');
    dock.innerHTML =
      '<p class="zuschauen-kicker" id="zuschauen-kicker">Zuschauen & Lernen</p>' +
      '<p class="zuschauen-text" id="zuschauen-text" aria-live="polite"></p>' +
      '<div class="zuschauen-tempo" role="group" aria-label="Tempo">' +
        '<button type="button" data-tempo="langsam">Langsam</button>' +
        '<button type="button" data-tempo="normal">Normal</button>' +
        '<button type="button" data-tempo="schnell">Schnell</button>' +
      '</div>' +
      '<div class="zuschauen-aktionen">' +
        '<button type="button" id="zuschauen-pause">Pause</button>' +
        '<button type="button" id="zuschauen-schritt">Ein Zug</button>' +
        '<button type="button" id="zuschauen-stimme" aria-pressed="false">Vorsprechen</button>' +
        '<button type="button" class="zuschauen-selbst" id="zuschauen-selbst">Selbst weiterspielen</button>' +
      '</div>';
    document.body.appendChild(dock);
    dock.addEventListener('click', function (ev) {
      var tempo = ev.target.closest('[data-tempo]');
      if (tempo) { setTempo(tempo.getAttribute('data-tempo')); return; }
      if (ev.target.id === 'zuschauen-pause') pause();
      else if (ev.target.id === 'zuschauen-schritt') einZug();
      else if (ev.target.id === 'zuschauen-stimme') {
        state.stimme = !state.stimme;
        malen();
        if (state.stimme) {
          var aktuell = el('zuschauen-text');
          if (aktuell && aktuell.textContent) kommentar(aktuell.textContent, { platz: 1 });
        }
      } else if (ev.target.id === 'zuschauen-selbst') uebernehmen();
    });
    state.dock = dock;
    malen();
    return dock;
  }

  function zeigDock() {
    var dock = dockBauen();
    dock.hidden = false;
    dock.classList.remove('ist-selbst');
    var kicker = el('zuschauen-kicker');
    if (kicker) kicker.textContent = 'Zuschauen & Lernen';
    document.body.classList.add('zuschauen-an');
    malen();
  }

  function mount(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return;
    state.sprich = opts.sprich || null;
    state.beiStart = opts.start || null;
    state.beiUebernahme = opts.uebernehmen || null;
    var intro = el('intro');
    var startBtn = el('btn-start');
    if (!intro || !startBtn || el('btn-zuschauen')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-zuschauen';
    btn.className = 'zuschauen-start';
    btn.textContent = 'Zuschauen & Lernen';
    var hinweis = document.createElement('p');
    hinweis.className = 'zuschauen-hinweis';
    hinweis.textContent = 'Die Runde spielt sich selbst. Deine Karten liegen offen, die anderen bleiben verdeckt. Bei jedem Zug steht dabei, warum er so kommt.';
    startBtn.insertAdjacentElement('beforebegin', btn);
    btn.insertAdjacentElement('afterend', hinweis);
    btn.addEventListener('click', function () {
      if (state.aktiv) return;
      state.aktiv = true;
      state.modus = 'laufen';
      state.tempo = state.tempo || 'normal';
      zeigDock();
      kommentar('Du schaust zu. Dein Platz wird mitgespielt. Langsam, normal oder schnell, und jederzeit selbst weiter.', { still: true });
      var ok = true;
      if (typeof state.beiStart === 'function') {
        try { ok = state.beiStart(); }
        catch (err) { ok = false; }
      }
      if (ok === false) {
        state.aktiv = false;
        if (state.dock) state.dock.hidden = true;
        document.body.classList.remove('zuschauen-an');
      }
    });
  }

  return {
    mount: mount,
    aktiv: aktiv,
    takt: takt,
    kommentar: kommentar,
    nachRunde: nachRunde,
    uebernehmen: uebernehmen,
    erklaere: erklaere,
    fuerSprache: fuerSprache,
    setTempo: setTempo
  };
});

/*
 * Persönliche Begrüßung von Horst, einmal nach der ersten Anmeldung.
 * Die Karte merkt sich die Spieler-Kennung. Eine spätere Anmeldung
 * bleibt still. Horst spricht den Gruß mit seiner Stimme. Blockiert
 * der Browser den Ton, liegt ein Tipp bereit. Ein kleiner Schalter
 * macht ihn leise.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerWillkommen = api;
  if (typeof document !== 'undefined') api.ensureCss();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SEEN_KEY = 'sf-horst-willkommen';
  var OPEN_KEY = 'sf-horst-offen';
  var SESSION_KEY = 'sf-account';
  var FRESH_MS = 72 * 60 * 60 * 1000;
  var FLAGS = ['created', 'isNew', 'newAccount', 'firstLogin', 'signup'];
  var TTS = ['/api/sf/tts', '/api/tts', '/api/default/tts'];
  var MALE = /(male|mann|markus|stefan|hans|yannick|conrad|klaus|jonas|florian|killian|bernd|daniel)/i;

  var TEAM = [
    { name: 'Margarethe', src: '/media/spielpartner/margarethe.jpg' },
    { name: 'Lena', src: '/media/spielpartner/lena.jpg' },
    { name: 'Sepp', src: '/media/spielpartner/sepp.jpg' },
    { name: 'Oma Hilde', src: '/media/spielpartner/oma-hilde.jpg' },
    { name: 'Chantal', src: '/media/spielpartner/chantal.jpg' },
    { name: 'Urs', src: '/media/spielpartner/urs.jpg' },
    { name: 'Vreni', src: '/media/spielpartner/vreni.jpg' },
    { name: 'Jonas', src: '/media/spielpartner/jonas.jpg' },
    { name: 'Ömer', src: '/media/spielpartner/oemer.jpg' },
    { name: 'Rüdiger', src: '/media/spielpartner/ruediger.jpg' }
  ];

  function nowOf(now) {
    return now == null ? Date.now() : now;
  }

  function storageOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* privat */ }
    return null;
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function greeting(name) {
    var clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) return 'Willkommen bei Spiel-Freunde! Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.';
    return 'Willkommen bei Spiel-Freunde, ' + clean + '! Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.';
  }

  function hintText() {
    return 'Neu am Tisch? Zuschauen & Lernen spielt eine Runde vor und sagt in einem kurzen Satz, warum eine Karte kommt.';
  }

  function playerOf(session) {
    if (session && session.player && (session.player.displayName || session.player.id)) return session.player;
    if (session && session.me && session.me.player) return session.me.player;
    return null;
  }

  function playerKey(session) {
    var player = playerOf(session);
    if (!player) return '';
    if (player.id) return String(player.id);
    if (player.email) return String(player.email).trim().toLowerCase();
    return '';
  }

  function displayName(session) {
    var player = playerOf(session);
    return player && player.displayName ? String(player.displayName).trim() : '';
  }

  function flagged(obj) {
    if (!obj || typeof obj !== 'object') return false;
    for (var i = 0; i < FLAGS.length; i++) {
      if (obj[FLAGS[i]] === true) return true;
    }
    return false;
  }

  function timeOf(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      var parsed = Date.parse(value);
      if (isFinite(parsed)) return parsed;
    }
    return null;
  }

  function createdAtOf(session, body) {
    var spots = [
      body && body.player && body.player.createdAt,
      body && body.createdAt,
      session && session.me && session.me.player && session.me.player.createdAt,
      session && session.player && session.player.createdAt,
      session && session.me && session.me.createdAt
    ];
    for (var i = 0; i < spots.length; i++) {
      var found = timeOf(spots[i]);
      if (found != null) return found;
    }
    return null;
  }

  function fresh(session, body, now) {
    var moment = nowOf(now);
    if (flagged(body) || flagged(body && body.player) || flagged(session && session.player) || flagged(session && session.me) || flagged(session && session.me && session.me.player)) {
      return true;
    }
    var created = createdAtOf(session, body);
    if (created == null) return false;
    if (created > moment + 5 * 60 * 1000) return false;
    return moment - created <= FRESH_MS;
  }

  function seenId(storage) {
    try { return storage.getItem(SEEN_KEY) || ''; }
    catch (err) { return ''; }
  }

  function openId(storage) {
    try { return storage.getItem(OPEN_KEY) || ''; }
    catch (err) { return ''; }
  }

  function note(storage, session, body, now) {
    storage = storageOf(storage);
    if (!storage || !session) return false;
    var key = playerKey(session);
    if (!key) return false;
    if (seenId(storage) === key) {
      try { storage.removeItem(OPEN_KEY); } catch (err) { /* privat */ }
      return false;
    }
    if (!fresh(session, body, now)) return false;
    try { storage.setItem(OPEN_KEY, key); }
    catch (err) { return false; }
    return true;
  }

  function ack(storage, key) {
    storage = storageOf(storage);
    if (!storage) return;
    var id = key || openId(storage);
    try {
      if (id) storage.setItem(SEEN_KEY, id);
      storage.removeItem(OPEN_KEY);
    } catch (err) { /* privat */ }
  }

  function readRawSession(storage, now) {
    var account = typeof window !== 'undefined' ? window.SpielpartnerAccount : null;
    if (account && typeof account.readSession === 'function') {
      try { return account.readSession(storage, now); }
      catch (err) { /* selbst lesen */ }
    }
    try {
      var raw = JSON.parse(storage.getItem(SESSION_KEY));
      if (!raw || typeof raw !== 'object' || !raw.token) return null;
      var exp = timeOf(raw.expiresAt);
      if (exp != null && !(nowOf(now) < exp)) return null;
      return raw;
    } catch (err) {
      return null;
    }
  }

  function faces(list) {
    return list.map(function (person) {
      return '<img src="' + person.src + '" alt="' + escapeText(person.name) + '" width="64" height="64">';
    }).join('');
  }

  function markup(name) {
    var clean = String(name || '').replace(/\s+/g, ' ').trim();
    var title = clean
      ? 'Willkommen bei Spiel-Freunde, ' + escapeText(clean) + '!'
      : 'Willkommen bei Spiel-Freunde!';
    var left = TEAM.slice(0, 5);
    var right = TEAM.slice(5);
    return '<div class="sf-willkommen" id="sf-willkommen" role="dialog" aria-modal="true" aria-labelledby="sf-willkommen-title">' +
      '<div class="sf-willkommen-card">' +
      '<button type="button" class="sf-willkommen-mute" data-mute aria-pressed="false">Ton aus</button>' +
      '<p class="sf-willkommen-kicker">Horst sagt Hallo</p>' +
      '<div class="sf-willkommen-hero">' +
      '<div class="sf-willkommen-side">' + faces(left) + '</div>' +
      '<img class="sf-willkommen-horst" src="/media/spielpartner/horst.jpg" alt="Horst Kaluppke" width="180" height="180">' +
      '<div class="sf-willkommen-side">' + faces(right) + '</div>' +
      '</div>' +
      '<h2 id="sf-willkommen-title">' + title + '</h2>' +
      '<p class="sf-willkommen-lead">Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.</p>' +
      '<button type="button" class="sf-willkommen-play" data-play hidden>Horst begrüßt Dich</button>' +
      '<button type="button" class="sf-willkommen-go" data-go>Los geht\'s</button>' +
      '<p class="sf-willkommen-hint">' + escapeText(hintText()) + '</p>' +
      '</div></div>';
  }

  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-sf-willkommen-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/spielpartner/willkommen.css';
    link.setAttribute('data-sf-willkommen-css', '');
    document.head.appendChild(link);
  }

  function horstTone() {
    var voices = typeof window !== 'undefined' ? window.SpielpartnerStimmen : null;
    if (voices && typeof voices.synth === 'function') {
      var tone = voices.synth('horst');
      if (tone) return tone;
    }
    return { pitch: 0.65, rate: 0.95, male: true };
  }

  function userActive() {
    try {
      var nav = typeof navigator !== 'undefined' ? navigator : null;
      var gate = nav && nav.userActivation;
      return !!(gate && gate.isActive);
    } catch (err) {
      return false;
    }
  }

  function abortSignal(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    } catch (err) { /* älterer Browser */ }
    return undefined;
  }

  function fetchTts(text) {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (!g || typeof g.fetch !== 'function') return Promise.resolve(null);
    var chain = Promise.resolve(null);
    TTS.forEach(function (path) {
      chain = chain.then(function (url) {
        if (url) return url;
        return g.fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ character: 'horst', text: text }),
          signal: abortSignal(4000)
        }).then(function (res) {
          if (!res || !res.ok || typeof res.blob !== 'function') return null;
          return res.blob();
        }).then(function (blob) {
          if (!blob || !blob.size || !g.URL || typeof g.URL.createObjectURL !== 'function') return null;
          return g.URL.createObjectURL(blob);
        }).catch(function () { return null; });
      });
    });
    return chain;
  }

  function voiceUrl(text) {
    var voices = typeof window !== 'undefined' ? window.SpielpartnerStimmen : null;
    if (voices && typeof voices.speak === 'function') {
      return Promise.resolve(voices.speak('horst', text)).then(function (url) {
        return url || fetchTts(text);
      }).catch(function () { return fetchTts(text); });
    }
    return fetchTts(text);
  }

  function pickVoice() {
    var synth = window.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return null;
    var all = synth.getVoices() || [];
    var german = all.filter(function (voice) { return /^de(-|_|$)/i.test(voice.lang); });
    if (!german.length) return null;
    return german.find(function (voice) { return MALE.test(voice.name); }) || german[0];
  }

  function show(storage, now) {
    if (typeof document === 'undefined' || !document.body) return false;
    storage = storageOf(storage);
    if (!storage) return false;
    var session = readRawSession(storage, now);
    var key = playerKey(session);
    if (!session || !key || openId(storage) !== key) return false;
    if (document.getElementById('sf-willkommen')) return true;
    ensureCss();
    var name = displayName(session);
    document.body.insertAdjacentHTML('beforeend', markup(name));
    document.body.classList.add('sf-willkommen-offen');
    bind(storage, key, name);
    return true;
  }

  function bind(storage, key, name) {
    var root = document.getElementById('sf-willkommen');
    if (!root) return;
    var card = root.querySelector('.sf-willkommen-card');
    var play = root.querySelector('[data-play]');
    var mute = root.querySelector('[data-mute]');
    var go = root.querySelector('[data-go]');
    var spoken = greeting(name);
    var muted = false;
    var audio = null;
    var round = 0;

    function stop() {
      round += 1;
      if (audio) {
        try { audio.pause(); } catch (err) { /* schon aus */ }
        audio = null;
      }
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (err) { /* fehlt */ }
      root.classList.remove('ist-spricht');
    }

    function revealPrompt() {
      if (play) play.hidden = false;
    }

    function hidePrompt() {
      if (play) play.hidden = true;
    }

    function markSpeaking() {
      root.classList.add('ist-spricht');
    }

    function playUrl(url, ticket) {
      var el;
      try { el = new Audio(url); }
      catch (err) { revealPrompt(); return Promise.resolve(false); }
      el.setAttribute('playsinline', '');
      el.preload = 'auto';
      audio = el;
      var started = el.play();
      if (!started || typeof started.then !== 'function') {
        if (ticket !== round || muted) return Promise.resolve(false);
        hidePrompt();
        markSpeaking();
        return Promise.resolve(true);
      }
      return started.then(function () {
        if (ticket !== round || muted) {
          try { el.pause(); } catch (err) { /* egal */ }
          return false;
        }
        hidePrompt();
        markSpeaking();
        el.addEventListener('ended', function () {
          if (audio === el) root.classList.remove('ist-spricht');
        });
        return true;
      }).catch(function () {
        if (ticket === round) revealPrompt();
        return false;
      });
    }

    function playSynth(ticket) {
      var synth = window.speechSynthesis;
      if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
        revealPrompt();
        return false;
      }
      var utter = new window.SpeechSynthesisUtterance(spoken);
      var tone = horstTone();
      utter.lang = 'de-DE';
      utter.pitch = tone.pitch;
      utter.rate = tone.rate;
      var voice = pickVoice();
      if (voice) utter.voice = voice;
      utter.onend = function () {
        if (ticket === round) root.classList.remove('ist-spricht');
      };
      utter.onerror = function () {
        if (ticket === round) {
          root.classList.remove('ist-spricht');
          revealPrompt();
        }
      };
      try {
        synth.cancel();
        synth.speak(utter);
      } catch (err) {
        revealPrompt();
        return false;
      }
      if (ticket !== round || muted) return false;
      hidePrompt();
      markSpeaking();
      return true;
    }

    function begruessen(fromTap) {
      if (muted) return Promise.resolve(false);
      stop();
      var ticket = round;
      var tapped = !!fromTap || userActive();
      if (!tapped) revealPrompt();
      return voiceUrl(spoken).then(function (url) {
        if (ticket !== round || muted) return false;
        if (url) {
          return playUrl(url, ticket).then(function (ok) {
            if (ok || ticket !== round || muted) return ok;
            if (!tapped) return false;
            return playSynth(ticket);
          });
        }
        if (!tapped) {
          revealPrompt();
          return false;
        }
        return playSynth(ticket);
      }).catch(function () {
        if (ticket === round) revealPrompt();
        return false;
      });
    }

    function paintMute() {
      if (!mute) return;
      mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
      mute.textContent = muted ? 'Ton an' : 'Ton aus';
    }

    if (mute) {
      mute.addEventListener('click', function () {
        muted = !muted;
        paintMute();
        if (muted) stop();
        else begruessen(true);
      });
    }
    if (play) {
      play.addEventListener('click', function () {
        if (muted) {
          muted = false;
          paintMute();
        }
        begruessen(true);
      });
    }
    if (go) {
      go.addEventListener('click', function () {
        stop();
        ack(storage, key);
        root.remove();
        document.body.classList.remove('sf-willkommen-offen');
        var modal = document.getElementById('modal-signup');
        if (modal) modal.hidden = true;
        var path = '';
        try { path = window.location && window.location.pathname ? window.location.pathname : ''; }
        catch (err) { path = ''; }
        if (path.indexOf('/anmelden') !== 0) return;
        var href = '/skat/';
        try {
          var account = window.SpielpartnerAccount;
          if (account && typeof account.returnPath === 'function') href = account.returnPath(storage) || href;
        } catch (err) { /* Tisch bleibt Skat */ }
        try { window.location.assign(href); }
        catch (err) { /* bleibt auf der Seite */ }
      });
    }
    try {
      var focus = play && !play.hidden ? play : go;
      if (focus && typeof focus.focus === 'function') focus.focus();
    } catch (err) { /* egal */ }
    begruessen(false);
  }

  return {
    SEEN_KEY: SEEN_KEY,
    OPEN_KEY: OPEN_KEY,
    FRESH_MS: FRESH_MS,
    greeting: greeting,
    hintText: hintText,
    fresh: fresh,
    playerKey: playerKey,
    note: note,
    ack: ack,
    markup: markup,
    ensureCss: ensureCss,
    show: show
  };
});

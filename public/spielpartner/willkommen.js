/*
 * Persönliche Begrüßung von Horst, einmal nach der ersten Anmeldung.
 * Die Karte merkt sich die Spieler-Kennung. Eine spätere Anmeldung
 * bleibt still. Horst spricht mit derselben Stimme wie am Tisch.
 * Kommt dieser Ton nicht an, bleibt der Text stehen. Die Stimme des
 * Browsers springt nicht ein. Vor dem Namen liegt eine kurze Pause.
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
  var PAUSE_VOR_DEM_NAMEN = 700;

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

  function cleanName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  function lines(name) {
    var clean = cleanName(name);
    return [
      'Willkommen bei Spiel-Freunde.',
      clean ? 'Schön, dass Du da bist, ' + clean + '!' : 'Schön, dass Du da bist!',
      'Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.'
    ];
  }

  function greeting(name) {
    return lines(name).join(' ');
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
    var said = lines(name);
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
      '<h2 id="sf-willkommen-title">' + escapeText(said[0]) + '</h2>' +
      '<p class="sf-willkommen-name">' + escapeText(said[1]) + '</p>' +
      '<p class="sf-willkommen-lead">' + escapeText(said[2]) + '</p>' +
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

  function abortSignal(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    } catch (err) { /* älterer Browser */ }
    return undefined;
  }

  /*
   * Dieselbe Anfrage wie die freie Stimme am Tisch: POST an /api/sf/tts,
   * danach /api/tts und /api/default/tts, Körper { character: 'horst', text }.
   * Die Stimme wählt der Server. Drei Sätze, dazwischen eine Pause vor dem Namen.
   */
  function clipAt(path, text) {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (!g || typeof g.fetch !== 'function') return Promise.resolve(null);
    return g.fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ character: 'horst', text: text }),
      signal: abortSignal(12000)
    }).then(function (res) {
      if (!res || !res.ok || typeof res.blob !== 'function') return null;
      return res.blob();
    }).then(function (blob) {
      if (!blob || !blob.size || !g.URL || typeof g.URL.createObjectURL !== 'function') return null;
      return g.URL.createObjectURL(blob);
    }).catch(function () { return null; });
  }

  function dropUrls(urls) {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (!g || !g.URL || typeof g.URL.revokeObjectURL !== 'function') return;
    (urls || []).forEach(function (url) {
      if (!url) return;
      try { g.URL.revokeObjectURL(url); } catch (err) { /* schon weg */ }
    });
  }

  function loadClips(parts) {
    function atPath(index) {
      if (index >= TTS.length) return Promise.resolve(null);
      return Promise.all(parts.map(function (text) {
        return clipAt(TTS[index], text);
      })).then(function (urls) {
        if (urls.every(Boolean)) return urls;
        dropUrls(urls);
        return atPath(index + 1);
      });
    }
    return atPath(0);
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
    var parts = lines(name);
    var muted = false;
    var audio = null;
    var round = 0;
    var clips = null;
    var loading = null;

    function stop() {
      round += 1;
      if (audio) {
        try { audio.pause(); } catch (err) { /* schon aus */ }
        audio = null;
      }
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

    function textOnly() {
      hidePrompt();
      if (mute) mute.hidden = true;
      root.classList.add('ist-still');
    }

    function playClip(url, ticket) {
      return new Promise(function (resolve) {
        var el;
        var settled = false;
        function finish(ok) {
          if (settled) return;
          settled = true;
          if (audio === el) audio = null;
          resolve(!!ok);
        }
        try { el = new Audio(url); }
        catch (err) { finish(false); return; }
        el.setAttribute('playsinline', '');
        el.preload = 'auto';
        audio = el;
        el.addEventListener('ended', function () { finish(ticket === round && !muted); });
        el.addEventListener('error', function () { finish(false); });
        var started;
        try { started = el.play(); }
        catch (err) { finish(false); return; }
        if (started && typeof started.then === 'function') {
          started.then(function () {
            if (ticket !== round || muted) {
              try { el.pause(); } catch (err) { /* egal */ }
              finish(false);
              return;
            }
            hidePrompt();
            markSpeaking();
          }, function () { finish(false); });
          return;
        }
        if (ticket !== round || muted) { finish(false); return; }
        hidePrompt();
        markSpeaking();
      });
    }

    function wait(ms, ticket) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(ticket === round && !muted); }, ms);
      });
    }

    function playParts(urls, ticket) {
      var index = 0;
      function next() {
        if (ticket !== round || muted) return Promise.resolve(false);
        if (index >= urls.length) {
          root.classList.remove('ist-spricht');
          return Promise.resolve(true);
        }
        var gap = index === 1 ? PAUSE_VOR_DEM_NAMEN : 0;
        var pending = gap ? wait(gap, ticket) : Promise.resolve(true);
        var current = index;
        index += 1;
        return pending.then(function (go) {
          if (!go) return false;
          return playClip(urls[current], ticket).then(function (ok) {
            if (!ok) return false;
            return next();
          });
        });
      }
      return next();
    }

    function ensureClips() {
      if (clips) return Promise.resolve(clips);
      if (!loading) {
        loading = loadClips(parts).then(function (urls) {
          loading = null;
          clips = urls;
          return urls;
        }, function () {
          loading = null;
          clips = null;
          return null;
        });
      }
      return loading;
    }

    function begruessen() {
      if (muted) return Promise.resolve(false);
      stop();
      var ticket = round;
      return ensureClips().then(function (urls) {
        if (ticket !== round || muted) return false;
        if (!urls) {
          textOnly();
          return false;
        }
        if (mute) mute.hidden = false;
        return playParts(urls, ticket).then(function (ok) {
          if (ticket !== round || muted) return ok;
          if (ok) hidePrompt();
          else revealPrompt();
          return ok;
        });
      }).catch(function () {
        if (ticket === round) textOnly();
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
        else begruessen();
      });
    }
    if (play) {
      play.addEventListener('click', function () {
        if (muted) {
          muted = false;
          paintMute();
        }
        begruessen();
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
    begruessen();
  }

  return {
    SEEN_KEY: SEEN_KEY,
    OPEN_KEY: OPEN_KEY,
    FRESH_MS: FRESH_MS,
    PAUSE_VOR_DEM_NAMEN: PAUSE_VOR_DEM_NAMEN,
    lines: lines,
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

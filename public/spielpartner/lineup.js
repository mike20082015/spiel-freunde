/*
 * Besetzung je Spiel, nur in diesem Browser.
 * Jedes Spiel behält seine Standard-Runde. Eine gespeicherte Reihe
 * ersetzt die Gegnerplätze, der Mensch bleibt Süden.
 * Oma Hilde heißt im Speicher hilde. Am Rommé-Tisch bleibt die Figur oma-hilde,
 * damit die festen Sprüche dort weiter greifen.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerLineup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var KEY = 'sf-spielpartner-lineup';
  var SKIP = { von: 1, van: 1, de: 1, der: 1, den: 1, und: 1, zu: 1 };

  var AVATARS = [
    { id: 'horst', slug: 'horst', name: 'Horst', full: 'Horst Kaluppke', line: 'Grantig, treu und eiskalt im Spiel.', tier: 'standard', male: true },
    { id: 'margarethe', slug: 'margarethe', name: 'Margarethe', full: 'Margarethe von Hohenfels', line: 'Charmant, riskant, immer ein bisschen zu laut für die Perlen.', tier: 'standard', male: false },
    { id: 'urs', slug: 'urs', name: 'Urs', full: 'Urs Gerber', line: 'Ruhig, trocken, mit einem Lächeln in den Mundwinkeln.', tier: 'premium', male: true },
    { id: 'vreni', slug: 'vreni', name: 'Vreni', full: 'Vreni Meier', line: 'Witzig, wach, lässt sich nichts vormachen.', tier: 'premium', male: false },
    { id: 'sepp', slug: 'sepp', name: 'Sepp', full: 'Sepp Huber', line: 'Gemütlich, bodenständig, sagt was er denkt.', tier: 'premium', male: true },
    { id: 'hilde', slug: 'oma-hilde', name: 'Oma Hilde', full: 'Oma Hilde', line: 'Weich im Ton, wach mit den Karten.', tier: 'premium', male: false },
    { id: 'lena', slug: 'lena', name: 'Lena', full: 'Lena Berger', line: 'Frisch, direkt, fair im Sieg und in der Niederlage.', tier: 'premium', male: false },
    { id: 'jonas', slug: 'jonas', name: 'Jonas', full: 'Jonas Rehm', line: 'Charmant, etwas eitel, spielt mit Ruhe.', tier: 'premium', male: true },
    { id: 'oemer', slug: 'oemer', name: 'Ömer', full: 'Ömer Aydin', line: 'Gastfreundlich, warm, lacht zuerst.', tier: 'premium', male: true },
    { id: 'ruediger', slug: 'ruediger', name: 'Rüdiger', full: 'Rüdiger Falk', line: 'Genau, förmlich, unbestechlich.', tier: 'premium', male: true },
    { id: 'chantal', slug: 'chantal', name: 'Chantal', full: 'Chantal Kowalski', line: 'Laut, herzlich, immer auf der Seite der Runde.', tier: 'premium', male: false }
  ];

  var GAMES = [
    { id: 'skat', label: 'Skat', href: '/skat/', opponents: 2, defaults: ['horst', 'margarethe'] },
    { id: 'canasta', label: 'Canasta', href: '/canasta/', opponents: 3, defaults: ['horst', 'margarethe', 'hilde'] },
    { id: 'schafkopf', label: 'Schafkopf', href: '/schafkopf/', opponents: 3, defaults: ['horst', 'sepp', 'margarethe'] },
    { id: 'jass', label: 'Jass', href: '/jass/', opponents: 3, defaults: ['vreni', 'urs', 'horst'] },
    { id: 'doppelkopf', label: 'Doppelkopf', href: '/doppelkopf/', opponents: 3, defaults: ['horst', 'ruediger', 'margarethe'] },
    {
      id: 'maumau',
      label: 'Mau-Mau',
      href: '/maumau/',
      opponents: 2,
      defaults: ['horst', 'margarethe'],
      byCount: {
        2: ['horst', 'margarethe'],
        3: ['horst', 'lena', 'margarethe'],
        4: ['horst', 'lena', 'ruediger', 'margarethe']
      }
    },
    { id: 'romme', label: 'Rommé', href: '/romme/', opponents: 3, defaults: ['horst', 'margarethe', 'hilde'] },
    { id: 'schnapsen', label: 'Schnapsen', href: '/schnapsen/', opponents: 1, defaults: ['sepp'] },
    { id: 'watten', label: 'Watten', href: '/watten/', opponents: 3, defaults: ['horst', 'sepp', 'hilde'] },
    { id: 'bridge', label: 'Bridge', href: '/bridge/', opponents: 3, defaults: ['jonas', 'margarethe', 'ruediger'] }
  ];

  function gameById(id) {
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
    return null;
  }

  function canonical(id) {
    if (id === 'oma-hilde') return 'hilde';
    return id;
  }

  function talkId(game, id) {
    var canon = canonical(id);
    if (game === 'romme' && canon === 'hilde') return 'oma-hilde';
    return canon;
  }

  function avatar(id) {
    var canon = canonical(id);
    for (var i = 0; i < AVATARS.length; i++) if (AVATARS[i].id === canon) return AVATARS[i];
    return null;
  }

  function portrait(person) {
    var item = typeof person === 'string' ? avatar(person) : person;
    return item && item.slug ? '/media/spielpartner/' + item.slug + '.jpg' : '';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var keep = [];
    for (var i = 0; i < parts.length; i++) {
      var word = parts[i].replace(/^[^0-9A-Za-zÄÖÜäöüß]+|[^0-9A-Za-zÄÖÜäöüß]+$/g, '');
      if (!word || SKIP[word.toLowerCase()]) continue;
      keep.push(word);
    }
    if (!keep.length) return '?';
    var first = keep[0].charAt(0);
    var last = keep.length > 1 ? keep[keep.length - 1].charAt(0) : '';
    return (first + last).toLocaleUpperCase('de-DE');
  }

  function countOf(game, count) {
    var g = gameById(game);
    if (!g) return 0;
    if (g.byCount) {
      var n = count === 2 || count === 3 || count === 4 ? count : g.opponents;
      return n;
    }
    return g.defaults.length;
  }

  function defaults(game, count) {
    var g = gameById(game);
    if (!g) return [];
    if (g.byCount) {
      var n = countOf(game, count);
      return (g.byCount[n] || g.defaults).slice();
    }
    return g.defaults.slice();
  }

  function places(count) {
    if (count === 4) return ['Links', 'Gegenüber links', 'Gegenüber rechts', 'Rechts'];
    if (count === 3) return ['Links', 'Gegenüber', 'Rechts'];
    if (count === 2) return ['Links', 'Rechts'];
    if (count === 1) return ['Gegenüber'];
    var out = [];
    for (var i = 0; i < count; i++) out.push('Platz ' + (i + 1));
    return out;
  }

  function emptyBag() {
    return { v: 1, games: {} };
  }

  function loadBag(storage) {
    if (!storage || typeof storage.getItem !== 'function') return emptyBag();
    try {
      var raw = JSON.parse(storage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyBag();
      var games = raw.games && typeof raw.games === 'object' && !Array.isArray(raw.games) ? raw.games : {};
      return { v: 1, games: games };
    } catch (err) {
      return emptyBag();
    }
  }

  function writeBag(storage, bag) {
    storage.setItem(KEY, JSON.stringify({ v: 1, games: bag.games }));
  }

  function listOk(ids, count) {
    if (!Array.isArray(ids) || ids.length !== count) return false;
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      var canon = canonical(ids[i]);
      if (!avatar(canon) || seen[canon]) return false;
      seen[canon] = 1;
    }
    return true;
  }

  function storedIds(bag, game, count) {
    var slot = bag.games[game];
    var g = gameById(game);
    if (!g) return null;
    if (g.byCount) {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return null;
      var list = slot[String(count)];
      return listOk(list, count) ? list.map(canonical) : null;
    }
    return listOk(slot, count) ? slot.map(canonical) : null;
  }

  function maySit(person, entitlement, storage, now) {
    if (!person) return false;
    if (person.tier !== 'premium') return true;
    if (!entitlement || typeof entitlement.isUnlocked !== 'function' || !storage) return false;
    var state = entitlement.load(storage);
    var rounds = typeof entitlement.roundsUsed === 'function' ? entitlement.roundsUsed(storage, now) : 0;
    return entitlement.isUnlocked('premium', state, now, rounds);
  }

  function gate(ids, game, count, opts) {
    var base = defaults(game, count);
    var ent = opts && opts.entitlement;
    if (!ent) return ids.slice();
    var now = opts.now == null ? Date.now() : opts.now;
    var storage = opts.storage;
    var out = ids.slice();
    for (var i = 0; i < out.length; i++) {
      var person = avatar(out[i]);
      var keepDefault = out[i] === base[i];
      if (!maySit(person, ent, storage, now) && !keepDefault) out[i] = base[i];
    }
    if (!listOk(out, count)) return base.slice();
    return out;
  }

  function resolveIds(storage, game, count, opts) {
    var n = countOf(game, count);
    if (!n) return [];
    var bag = loadBag(storage);
    var saved = storedIds(bag, game, n);
    var ids = saved ? saved.slice() : defaults(game, n);
    var options = Object.assign({ storage: storage }, opts || {});
    return gate(ids, game, n, options);
  }

  function save(storage, game, ids, opts) {
    var n = ids && ids.length ? countOf(game, ids.length) : 0;
    if (!n || !listOk(ids, n)) return null;
    var clean = ids.map(canonical);
    var options = Object.assign({ storage: storage }, opts || {});
    if (opts && opts.entitlement) {
      var checked = gate(clean, game, n, options);
      if (checked.join('|') !== clean.join('|')) return null;
    }
    var bag = loadBag(storage);
    var g = gameById(game);
    if (g.byCount) {
      var prev = bag.games[game];
      var slot = prev && typeof prev === 'object' && !Array.isArray(prev) ? Object.assign({}, prev) : {};
      slot[String(n)] = clean;
      bag.games[game] = slot;
    } else bag.games[game] = clean;
    try { writeBag(storage, bag); }
    catch (err) { return null; }
    return clean.slice();
  }

  function reset(storage, game) {
    var bag = loadBag(storage);
    delete bag.games[game];
    try { writeBag(storage, bag); }
    catch (err) { /* privat */ }
    return defaults(game);
  }

  function isDefault(storage, game, count) {
    var n = countOf(game, count);
    var now = resolveIds(storage, game, n);
    var base = defaults(game, n);
    return now.join('|') === base.join('|');
  }

  function assignSeat(seat, game, id) {
    var person = avatar(id);
    if (!seat || !person) return null;
    var tid = talkId(game, person.id);
    if (seat.id !== tid) {
      seat.id = tid;
      seat.slug = person.slug;
      seat.full = person.full;
      seat.initials = initials(person.full);
      seat.portrait = portrait(person);
    }
    seat.name = person.name;
    seat.voice = true;
    return person;
  }

  function dress(seats, game, storage, count, opts) {
    if (!seats || !seats.length) return [];
    var opponents = [];
    for (var i = 0; i < seats.length; i++) {
      if (seats[i] && seats[i].id !== 'du') opponents.push(seats[i]);
    }
    var n = count || opponents.length;
    var host = typeof globalThis !== 'undefined' ? globalThis : this;
    var options = Object.assign({
      entitlement: host && host.SpielpartnerEntitlement,
      storage: storage,
      now: Date.now()
    }, opts || {});
    var ids = resolveIds(storage, game, n, options);
    var talk = [];
    for (var j = 0; j < opponents.length && j < ids.length; j++) {
      assignSeat(opponents[j], game, ids[j]);
      talk.push(opponents[j].id);
    }
    var voices = host && host.SpielpartnerStimmen;
    if (voices && typeof voices.setSeated === 'function') voices.setSeated(talk);
    return talk;
  }

  function paintSeat(wrap, person) {
    if (!wrap || !person || typeof document === 'undefined') return;
    var ini = wrap.querySelector('.ini');
    if (ini) ini.textContent = person.initials || initials(person.full || person.name);
    if (!person.portrait) {
      var gone = wrap.querySelector('img.ava');
      if (gone) gone.remove();
      return;
    }
    var img = wrap.querySelector('img.ava');
    if (!img) {
      img = document.createElement('img');
      img.className = 'ava';
      img.addEventListener('error', function () { img.remove(); });
      wrap.insertBefore(img, wrap.firstChild);
    }
    img.alt = person.full || person.name || '';
    if (img.getAttribute('src') !== person.portrait) img.src = person.portrait;
  }

  return {
    KEY: KEY,
    AVATARS: AVATARS,
    GAMES: GAMES,
    gameById: gameById,
    canonical: canonical,
    talkId: talkId,
    avatar: avatar,
    portrait: portrait,
    initials: initials,
    defaults: defaults,
    places: places,
    countOf: countOf,
    loadBag: loadBag,
    resolveIds: resolveIds,
    save: save,
    reset: reset,
    isDefault: isDefault,
    maySit: maySit,
    assignSeat: assignSeat,
    dress: dress,
    paintSeat: paintSeat,
    listOk: listOk
  };
});

/* Besetzung je Spiel. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const L = require('../../public/spielpartner/lineup.js');
const Stimmen = require('../../public/spielpartner/stimmen.js');
const E = require('../../public/spielpartner/entitlement.js');
const H = require('../../api/lib/handlers.js');

const GAMES = ['skat', 'canasta', 'schafkopf', 'jass', 'doppelkopf', 'maumau', 'romme', 'schwimmen', 'elfer-raus', 'schnapsen', 'watten', 'bridge'];
const START = Date.UTC(2026, 5, 1);

function memory() {
  const bag = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null; },
    setItem(key, value) { bag[key] = String(value); },
    removeItem(key) { delete bag[key]; }
  };
}

test('jedes Spiel behält seine Standard-Besetzung', () => {
  assert.deepEqual(L.defaults('skat'), ['horst', 'margarethe']);
  assert.deepEqual(L.defaults('jass'), ['vreni', 'urs', 'horst']);
  assert.deepEqual(L.defaults('schafkopf'), ['horst', 'sepp', 'margarethe']);
  assert.deepEqual(L.defaults('canasta'), ['horst', 'margarethe', 'hilde']);
  assert.deepEqual(L.defaults('doppelkopf'), ['horst', 'ruediger', 'margarethe']);
  assert.deepEqual(L.defaults('maumau', 2), ['horst', 'margarethe']);
  assert.deepEqual(L.defaults('maumau', 3), ['horst', 'lena', 'margarethe']);
  assert.deepEqual(L.defaults('maumau', 4), ['horst', 'lena', 'ruediger', 'margarethe']);
  assert.deepEqual(L.defaults('maumau', 1), ['horst', 'margarethe']);
  assert.deepEqual(L.defaults('romme'), ['horst', 'margarethe', 'hilde']);
  assert.deepEqual(L.defaults('schwimmen'), ['horst', 'lena', 'chantal']);
  assert.deepEqual(L.defaults('schwimmen', 1), ['horst']);
  assert.deepEqual(L.defaults('schwimmen', 2), ['horst', 'chantal']);
  assert.deepEqual(L.defaults('schwimmen', 4), ['horst', 'lena', 'jonas', 'chantal']);
  assert.deepEqual(L.defaults('elfer-raus'), ['hilde', 'lena', 'jonas']);
  assert.deepEqual(L.defaults('elfer-raus', 1), ['hilde']);
  assert.deepEqual(L.defaults('elfer-raus', 2), ['hilde', 'lena']);
  assert.deepEqual(L.defaults('elfer-raus', 4), ['hilde', 'lena', 'jonas', 'horst']);
  assert.equal(L.talkId('schwimmen', 'hilde'), 'hilde');
  assert.equal(L.talkId('elfer-raus', 'hilde'), 'hilde');
  assert.deepEqual(L.defaults('schnapsen'), ['sepp']);
  assert.deepEqual(L.defaults('watten'), ['horst', 'sepp', 'hilde']);
  assert.deepEqual(L.places(1), ['Gegenüber']);
  assert.deepEqual(L.defaults('bridge'), ['jonas', 'margarethe', 'ruediger']);
  assert.equal(L.talkId('romme', 'hilde'), 'oma-hilde');
  assert.equal(L.talkId('canasta', 'oma-hilde'), 'hilde');
  assert.equal(L.canonical('oma-hilde'), 'hilde');
});

test('die Wahl bleibt je Spiel im Speicher und lässt sich zurücksetzen', () => {
  const store = memory();
  assert.deepEqual(L.resolveIds(store, 'skat', 2), ['horst', 'margarethe']);
  assert.deepEqual(L.save(store, 'skat', ['chantal', 'sepp']), ['chantal', 'sepp']);
  assert.deepEqual(L.resolveIds(store, 'skat', 2), ['chantal', 'sepp']);
  assert.deepEqual(L.resolveIds(store, 'jass', 3), ['vreni', 'urs', 'horst']);
  assert.equal(L.save(store, 'skat', ['chantal', 'chantal']), null);
  assert.equal(L.save(store, 'skat', ['fremd', 'sepp']), null);
  assert.deepEqual(L.resolveIds(store, 'skat', 2), ['chantal', 'sepp']);
  store.setItem(L.KEY, '{');
  assert.deepEqual(L.resolveIds(store, 'skat', 2), ['horst', 'margarethe']);
  L.save(store, 'skat', ['jonas', 'oemer']);
  L.save(store, 'maumau', ['lena', 'urs']);
  L.save(store, 'maumau', ['chantal', 'sepp', 'horst']);
  assert.deepEqual(L.resolveIds(store, 'maumau', 2), ['lena', 'urs']);
  assert.deepEqual(L.resolveIds(store, 'maumau', 3), ['chantal', 'sepp', 'horst']);
  assert.deepEqual(L.reset(store, 'skat'), ['horst', 'margarethe']);
  assert.equal(L.isDefault(store, 'skat', 2), true);
  assert.deepEqual(L.resolveIds(store, 'maumau', 3), ['chantal', 'sepp', 'horst']);
});

test('Premium sitzt nur mit Anspruch, die Standard-Runde bleibt', () => {
  const store = E.memoryStorage();
  const chantal = L.avatar('chantal');
  const horst = L.avatar('horst');
  assert.equal(L.maySit(horst, E, store, START), true);
  assert.equal(L.maySit(chantal, E, store, START), false);
  E.startTrial(store, START);
  assert.equal(L.maySit(chantal, E, store, START), true);
  const during = L.save(store, 'skat', ['chantal', 'sepp'], { entitlement: E, storage: store, now: START });
  assert.deepEqual(during, ['chantal', 'sepp']);
  const later = START + 20 * 24 * 60 * 60 * 1000;
  assert.equal(L.maySit(chantal, E, store, later), false);
  assert.equal(L.save(store, 'jass', ['chantal', 'sepp', 'horst'], { entitlement: E, storage: store, now: later }), null);
  assert.deepEqual(L.resolveIds(store, 'skat', 2, { entitlement: E, storage: store, now: later }), ['horst', 'margarethe']);
  assert.deepEqual(L.resolveIds(store, 'jass', 3, { entitlement: E, storage: store, now: later }), ['vreni', 'urs', 'horst']);
});

test('Rommé behält Oma Hilde als oma-hilde, ein Tausch setzt die neue Figur', () => {
  const seats = [
    { seat: 0, id: 'du', name: 'Du' },
    { seat: 1, id: 'horst', name: 'Horst', full: 'Horst Kaluppke', slug: 'horst', voice: true, initials: 'HK', portrait: '/media/spielpartner/horst.jpg' },
    { seat: 2, id: 'margarethe', name: 'Margarethe', full: 'Margarethe von Hohenfels', slug: 'margarethe', voice: true, initials: 'MH', portrait: '/media/spielpartner/margarethe.jpg' },
    { seat: 3, id: 'oma-hilde', name: 'Oma Hilde', full: 'Oma Hilde', slug: 'oma-hilde', voice: false, initials: 'OH', portrait: '/media/spielpartner/oma-hilde.jpg' }
  ];
  const store = memory();
  assert.deepEqual(L.dress(seats, 'romme', store), ['horst', 'margarethe', 'oma-hilde']);
  assert.equal(seats[3].id, 'oma-hilde');
  assert.equal(seats[3].voice, true);
  assert.equal(seats[3].portrait, '/media/spielpartner/oma-hilde.jpg');
  L.save(store, 'romme', ['chantal', 'sepp', 'hilde']);
  L.dress(seats, 'romme', store);
  assert.equal(seats[1].id, 'chantal');
  assert.equal(seats[1].name, 'Chantal');
  assert.equal(seats[1].portrait, '/media/spielpartner/chantal.jpg');
  assert.equal(seats[2].id, 'sepp');
  assert.equal(seats[3].id, 'oma-hilde');
  assert.equal(Stimmen.line('chantal', 'welcome').length > 0, true);
  assert.equal(typeof Stimmen.line('sepp', 'sauspiel'), 'string');
  assert.equal(Stimmen.known('oma-hilde'), true);
  assert.equal(Stimmen.voiced('hilde'), true);
});

test('Chat und TTS kennen jede Stimme am Tisch', () => {
  ['horst', 'margarethe', 'urs', 'vreni', 'sepp', 'hilde', 'oma-hilde', 'lena', 'jonas', 'oemer', 'ruediger', 'chantal'].forEach((id) => {
    assert.equal(H.validateChat({ character: id, message: 'Hallo' }).ok, true, id);
    assert.equal(H.validateTts({ character: id, text: 'Hallo' }).ok, true, id);
    assert.match(H.PERSONA[id], /Verdeckte Karten/);
  });
  assert.equal(H.validateChat({ character: 'fremd', message: 'Hallo' }).ok, false);
  assert.equal(H.PERSONA['oma-hilde'], H.PERSONA.hilde);
  const chantal = H.buildTtsRequest({ character: 'chantal', text: 'Hömma.' }, {
    ELEVENLABS_API_KEY: 'test-eleven',
    VOICE_CHANTAL: 'ChantalVoice01'
  });
  assert.match(chantal.url, /ChantalVoice01/);
  const hilde = H.buildTtsRequest({ character: 'oma-hilde', text: 'Na.' }, {
    ELEVENLABS_API_KEY: 'test-eleven',
    VOICE_HILDE: 'HildeVoice0001'
  });
  assert.match(hilde.url, /HildeVoice0001/);
  assert.doesNotMatch(JSON.stringify(H.PERSONA), /grok|elevenlabs|openai|x\.?ai/i);
});

test('die Auswahl setzt genau so viele Partner, wie das Spiel braucht', () => {
  assert.equal(L.countOf('skat', 2), 2);
  assert.equal(L.countOf('doppelkopf', 3), 3);
  assert.equal(L.countOf('canasta', 3), 3);
  assert.equal(L.countOf('romme', 3), 3);
  assert.equal(L.countOf('schnapsen', 1), 1);
  assert.equal(L.countOf('maumau', 1), 2);
  assert.equal(L.countOf('maumau', 2), 2);
  assert.equal(L.countOf('maumau', 3), 3);
  assert.equal(L.countOf('maumau', 4), 4);
  assert.deepEqual(Object.keys(L.gameById('maumau').byCount).sort(), ['2', '3', '4']);
  assert.equal(L.countOf('schwimmen', 1), 1);
  assert.equal(L.countOf('schwimmen', 4), 4);
  assert.equal(L.countOf('elfer-raus', 4), 4);

  const empty = L.previewLineup([], 'skat', 2);
  assert.equal(empty.ready, false);
  assert.equal(empty.count, 2);

  const swapped = L.previewLineup(['margarethe', 'horst'], 'skat', 2);
  assert.equal(swapped.ready, true);
  assert.deepEqual(swapped.slots, ['margarethe', 'horst']);

  const store = E.memoryStorage();
  const later = START + 20 * 24 * 60 * 60 * 1000;
  assert.equal(L.previewLineup(['sepp', 'lena'], 'skat', 2, { entitlement: E, storage: store, now: later }), null);
  E.startTrial(store, START);
  const picked = L.previewLineup(['sepp', 'lena'], 'skat', 2, { entitlement: E, storage: store, now: START });
  assert.deepEqual(picked.slots, ['sepp', 'lena']);
  assert.equal(L.save(store, 'skat', picked.slots, { entitlement: E, storage: store, now: START }).join('|'), 'sepp|lena');

  const pinned = L.previewLineup(['horst', 'vreni', 'urs'], 'jass', 3, { entitlement: E, storage: E.memoryStorage(), now: later });
  assert.deepEqual(pinned.slots, ['vreni', 'urs', 'horst']);
  const partial = L.previewLineup(['ruediger'], 'doppelkopf', 3, { entitlement: E, storage: E.memoryStorage(), now: later });
  assert.equal(partial.ready, false);
  assert.deepEqual(partial.picks, [{ id: 'ruediger', seat: 1 }]);
  assert.deepEqual(L.previewLineup(['sepp'], 'schnapsen', 1, { entitlement: E, storage: E.memoryStorage(), now: later }).slots, ['sepp']);
  assert.equal(L.previewLineup(['lena', 'horst', 'sepp', 'hilde'], 'maumau', 3, { entitlement: E, storage: store, now: START }), null);
  const three = L.previewLineup(['lena', 'horst', 'sepp'], 'maumau', 3, { entitlement: E, storage: store, now: START });
  assert.equal(three.ready, true);
  assert.deepEqual(three.slots, ['lena', 'horst', 'sepp']);
});

test('alle Tische laden dasselbe Fenster', () => {
  const runde = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/runde.js'), 'utf8');
  assert.match(runde, /Spielpartner/);
  assert.match(runde, /Auswahl löschen/);
  assert.match(runde, /draft = \[\]/);
  assert.match(runde, /Übernehmen/);
  assert.match(runde, /apply\.disabled/);
  assert.match(runde, /intro-partners/);
  assert.match(runde, /partner-foot/);
  assert.match(runde, /previewLineup/);
  assert.match(runde, /Standard-Besetzung/);
  assert.match(runde, /Stimme hören/);
  assert.match(runde, /laufende Runde wird abgebrochen/);
  assert.match(runde, /SpielpartnerPaywall/);
  assert.doesNotMatch(runde, /data-seat/);
  const skat = fs.readFileSync(path.join(__dirname, '../../public/skat/js/app.js'), 'utf8');
  assert.match(skat, /intro-line/);
  assert.match(skat, /esc\(NAMES\[1\]\)/);
  assert.doesNotMatch(skat, /<th>Horst<\/th>/);
  GAMES.forEach((game) => {
    const page = fs.readFileSync(path.join(__dirname, '../../public', game, 'index.html'), 'utf8');
    assert.match(page, /\/spielpartner\/lineup\.js/, game);
    assert.match(page, /\/spielpartner\/stimmen\.js/, game);
    assert.match(page, /\/spielpartner\/runde\.js/, game);
    assert.match(page, /\/spielpartner\/runde\.css/, game);
    const app = fs.readFileSync(path.join(__dirname, '../../public', game, 'js/app.js'), 'utf8');
    assert.match(app, /SpielpartnerRunde\.mount/, game);
    assert.equal(page.includes('Michael'), false, game);
  });
});

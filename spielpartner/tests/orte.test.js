/* Ort des Tisches: gleiche Wahl in allen Spielen, gemerkt pro Spieler. */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Orte = require('../../public/assets/orte.js');
const Sprueche = require('../../public/assets/sprueche.js');

const root = path.join(__dirname, '../..');
const GAMES = ['skat', 'doppelkopf', 'bridge', 'jass', 'watten', 'schnapsen', 'romme', 'canasta', 'maumau', 'schafkopf', 'schwimmen', 'elfer-raus'];
const NAMES = [
  'Wie bisher',
  'Gemütlicher Stammtisch',
  'Gemütliche Eckkneipe',
  'Wohnzimmer mit Kamin',
  'Biergarten',
  'Strand in Rayong bei Sonnenuntergang',
  'Terrasse am Abend',
  'Berghütte in den Anden'
];

function mem() {
  const box = new Map();
  return {
    getItem(key) { return box.has(key) ? box.get(key) : null; },
    setItem(key, value) { box.set(key, String(value)); },
    removeItem(key) { box.delete(key); }
  };
}

function session(storage, playerId, extra) {
  storage.setItem('sf-account', JSON.stringify(Object.assign({
    token: 'tok',
    player: { id: playerId, displayName: 'Mia' },
    me: { player: { id: playerId, displayName: 'Mia' } }
  }, extra || {})));
}

function docWith(ort) {
  const attrs = {};
  return {
    documentElement: {
      dataset: {},
      getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
      setAttribute(name, value) { attrs[name] = value; this.dataset.ort = value; },
      removeAttribute(name) { delete attrs[name]; delete this.dataset.ort; }
    }
  };
}

test('die Orte haben deutsche Namen und bleiben freundlich', () => {
  assert.deepEqual(Orte.ORTE.map((ort) => ort.name), NAMES);
  assert.equal(Orte.ORTE[0].id, '');
  const blob = JSON.stringify(Orte.ORTE) + fs.readFileSync(path.join(root, 'public/assets/orte.js'), 'utf8')
    + fs.readFileSync(path.join(root, 'public/assets/orte.css'), 'utf8');
  assert.doesNotMatch(blob, /—|–/);
  assert.doesNotMatch(blob, /grok|openai|eleven|chatgpt|politik|partei|einkommen/i);
  assert.ok(Orte.ORTE.length >= 6);
});

test('ohne Wahl bleibt der bisherige Look', () => {
  const storage = mem();
  const doc = docWith();
  assert.equal(Orte.read(storage), '');
  assert.equal(Orte.apply(Orte.read(storage), doc), '');
  assert.equal(doc.documentElement.getAttribute('data-ort'), null);
  Orte.write(storage, 'rayong');
  Orte.write(storage, 'unbekannt');
  assert.equal(Orte.read(storage), '');
  Orte.apply('nope', doc);
  assert.equal(doc.documentElement.getAttribute('data-ort'), null);
});

test('ein Gast merkt sich den Ort nur für sich', () => {
  const storage = mem();
  assert.equal(Orte.storageKey(storage), 'sf-ort');
  assert.equal(Orte.write(storage, 'biergarten'), 'biergarten');
  assert.equal(storage.getItem('sf-ort'), 'biergarten');
  assert.equal(Orte.read(storage), 'biergarten');
  const doc = docWith();
  Orte.apply(Orte.read(storage), doc);
  assert.equal(doc.documentElement.getAttribute('data-ort'), 'biergarten');
});

test('ein Spieler hat eine eigene Wahl, auch nach dem Profilabruf', () => {
  const storage = mem();
  session(storage, 'spieler-1');
  storage.setItem('sf-ort', 'kneipe');
  assert.equal(Orte.storageKey(storage), 'sf-ort-spieler-1');
  Orte.write(storage, 'terrasse');
  assert.equal(storage.getItem('sf-ort-spieler-1'), 'terrasse');
  assert.equal(storage.getItem('sf-ort'), 'kneipe');
  const raw = JSON.parse(storage.getItem('sf-account'));
  assert.equal(raw.ort, 'terrasse');
  assert.equal(raw.me.ort, 'terrasse');
  raw.me = { player: { id: 'spieler-1', displayName: 'Mia' } };
  storage.setItem('sf-account', JSON.stringify(raw));
  assert.equal(Orte.read(storage), 'terrasse');
  storage.removeItem('sf-ort-spieler-1');
  assert.equal(JSON.parse(storage.getItem('sf-account')).ort, 'terrasse');
  assert.equal(Orte.read(storage), 'terrasse');
});

test('zwei Spieler behalten getrennte Orte', () => {
  const storage = mem();
  session(storage, 'aaa');
  Orte.write(storage, 'anden');
  session(storage, 'bbb');
  Orte.write(storage, 'wohnzimmer');
  session(storage, 'aaa');
  assert.equal(Orte.read(storage), 'anden');
  session(storage, 'bbb');
  assert.equal(Orte.read(storage), 'wohnzimmer');
});

test('jedes Spiel bindet die Ortswahl ein', () => {
  const css = fs.readFileSync(path.join(root, 'public/assets/orte.css'), 'utf8');
  NAMES.slice(1).forEach((name) => {
    const ort = Orte.ORTE.find((item) => item.name === name);
    assert.match(css, new RegExp('html\\[data-ort="' + ort.id + '"\\]'));
    assert.match(css, /rgba\(1[268],\s*10,\s*[68],\s*\.[4-7]/);
  });
  GAMES.forEach((game) => {
    const html = fs.readFileSync(path.join(root, 'public', game, 'index.html'), 'utf8');
    assert.match(html, /href="\/assets\/orte\.css"/, game);
    assert.match(html, /src="\/assets\/orte\.js"/, game);
    assert.match(html, /id="btn-settings"/, game);
    assert.doesNotMatch(html, /data-ort=/, game);
    assert.doesNotMatch(html, /—/, game);
  });
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/index.html'), 'utf8');
  assert.match(tisch, /href="\/assets\/orte\.css"/);
  assert.match(tisch, /src="\/assets\/orte\.js"/);
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /sf-pwa-v9/);
});

const INSIDE = '2026-10-30T18:00:00+07:00';
const LAST = '2026-11-05T23:59:59+07:00';
const AFTER = '2026-11-06T00:00:00+07:00';
const BEFORE = '2026-10-21T23:59:59+07:00';

test('der Halloween-Tisch hat ein festes Zeitfenster in Bangkok', () => {
  assert.equal(Orte.SEASON_ZONE, 'Asia/Bangkok');
  assert.equal(Orte.SEASONS.length, 1);
  const halloween = Orte.SEASONS[0];
  assert.equal(halloween.id, 'halloween');
  assert.equal(halloween.name, 'Halloween-Tisch');
  assert.equal(halloween.badge, 'Nur bis 5. November');
  assert.equal(halloween.from, '2026-10-22T00:00:00+07:00');
  assert.equal(halloween.until, '2026-11-05T23:59:59+07:00');
  assert.equal(Orte.seasonOpen('halloween', INSIDE), true);
  assert.equal(Orte.seasonOpen('halloween', LAST), true);
  assert.equal(Orte.seasonOpen('halloween', halloween.from), true);
  assert.equal(Orte.seasonOpen('halloween', AFTER), false);
  assert.equal(Orte.seasonOpen('halloween', BEFORE), false);
  const open = Orte.catalog(INSIDE).map((ort) => ort.id);
  assert.equal(open[1], 'halloween');
  assert.equal(Orte.catalog(AFTER).some((ort) => ort.id === 'halloween'), false);
  assert.equal(Orte.catalog(BEFORE).some((ort) => ort.id === 'halloween'), false);
  const css = fs.readFileSync(path.join(root, 'public/assets/orte.css'), 'utf8');
  assert.match(css, /html\[data-ort="halloween"\]/);
  assert.match(css, /ort-badge/);
  assert.match(css, /ort-candle/);
  assert.match(css, /prefers-reduced-motion/);
  const blob = JSON.stringify(Orte.SEASONS) + css;
  assert.doesNotMatch(blob, /—|–/);
  assert.doesNotMatch(blob, /blut|horror|grusel|zombie|leiche/i);
});

test('ein abgelaufener Halloween-Tisch fällt auf den normalen Look zurück', () => {
  const storage = mem();
  assert.equal(Orte.write(storage, 'halloween', INSIDE), 'halloween');
  assert.equal(Orte.read(storage, INSIDE), 'halloween');
  const doc = docWith();
  assert.equal(Orte.apply('halloween', doc, INSIDE), 'halloween');
  assert.equal(doc.documentElement.getAttribute('data-ort'), 'halloween');
  assert.equal(Orte.read(storage, AFTER), '');
  assert.equal(storage.getItem('sf-ort'), '');
  assert.equal(Orte.apply('halloween', doc, AFTER), '');
  assert.equal(doc.documentElement.getAttribute('data-ort'), null);
  assert.equal(Orte.write(storage, 'halloween', AFTER), '');
  session(storage, 'spieler-1');
  Orte.write(storage, 'halloween', INSIDE);
  assert.equal(Orte.read(storage, AFTER), '');
  assert.equal(storage.getItem('sf-ort-spieler-1'), '');
  assert.equal(JSON.parse(storage.getItem('sf-account')).ort, '');
});

test('zur Halloween-Zeit kommen ein paar freundliche Saisonzeilen dazu', () => {
  const ids = Sprueche.characters;
  const seasonal = [];
  for (const id of ids) {
    const lines = Sprueche.seasonLines(id, 'halloween');
    assert.equal(lines.length, 2, id);
    seasonal.push(...lines);
    for (const line of lines) {
      assert.doesNotMatch(line, /—|–/);
      assert.doesNotMatch(line, /grok|openai|eleven|chatgpt|politik|partei|einkommen|blut|horror|grusel|zombie/i, line);
    }
  }
  assert.equal(new Set(seasonal).size, seasonal.length);
  Sprueche.reset({ store: mem(), wipe: true });
  const during = new Set();
  for (let i = 0; i < 40; i++) during.add(Sprueche.line('horst', 'welcome', [], Math.random, INSIDE));
  assert.ok([...during].some((line) => seasonal.includes(line)));
  Sprueche.reset({ store: mem(), wipe: true });
  for (let i = 0; i < 40; i++) {
    const line = Sprueche.line('horst', 'welcome', [], Math.random, AFTER);
    assert.equal(seasonal.includes(line), false, line);
  }
});

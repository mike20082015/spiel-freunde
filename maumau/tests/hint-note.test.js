/* Hinweise nach einem ungültigen Zug. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HintNote = require('../../public/assets/hint-note.js');

function fakeBox() {
  const classes = new Set();
  return {
    hidden: true,
    textContent: '',
    offsetWidth: 12,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
}

function harness() {
  const box = fakeBox();
  const timers = [];
  let token = 'runde-1|play|0';
  const expired = [];
  const notes = HintNote.create({
    box: () => box,
    token: () => token,
    schedule: (fn, ms) => {
      const id = timers.length + 1;
      timers.push({ id: id, fn: fn, ms: ms, dead: false });
      return id;
    },
    cancel: (id) => {
      const found = timers.find((t) => t.id === id);
      if (found) found.dead = true;
    },
    onExpire: () => expired.push(notes.active()),
  });
  return { box: box, timers: timers, notes: notes, expired: expired, setToken: (value) => { token = value; } };
}

test('Hinweis erscheint und verschwindet nach 2,5 Sekunden', () => {
  const h = harness();
  h.notes.show('Die Karte passt nicht. Farbe oder Wert, sonst ziehen.');
  assert.equal(HintNote.MS, 2500);
  assert.equal(h.notes.MS, 2500);
  assert.equal(h.box.hidden, false);
  assert.equal(h.box.textContent, 'Die Karte passt nicht. Farbe oder Wert, sonst ziehen.');
  assert.equal(h.box.classList.contains('shake'), true);
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 2500);
  assert.equal(h.notes.hold(h.box), true);
  h.timers[0].fn();
  assert.equal(h.notes.active(), '');
  assert.equal(h.notes.hold(h.box), false);
  assert.deepEqual(h.expired, ['']);
});

test('Gültiger Zug, Ziehen, Zugwechsel und neue Runde löschen den Hinweis sofort', () => {
  const h = harness();
  h.notes.show('Die Karte passt nicht.');
  h.setToken('runde-1|play|0');
  assert.equal(h.notes.sync(), false);
  assert.equal(h.notes.active(), 'Die Karte passt nicht.');

  h.setToken('runde-1|play|1');
  assert.equal(h.notes.sync(), true);
  assert.equal(h.notes.active(), '');
  assert.equal(h.timers[0].dead, true);
  h.timers[0].fn();
  assert.deepEqual(h.expired, []);

  h.notes.show('nochmal');
  assert.equal(h.notes.clear(), true);
  assert.equal(h.notes.active(), '');
  assert.equal(h.timers[1].dead, true);
  h.timers[1].fn();
  assert.deepEqual(h.expired, []);
});

test('Ein neuer Hinweis ersetzt den alten Timer', () => {
  const h = harness();
  h.notes.show('erster');
  h.notes.show('zweiter');
  assert.equal(h.timers[0].dead, true);
  assert.equal(h.box.textContent, 'zweiter');
  h.timers[0].fn();
  assert.equal(h.notes.active(), 'zweiter');
  h.timers[1].fn();
  assert.equal(h.notes.active(), '');
  assert.deepEqual(h.expired, ['']);
});

const root = path.join(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('Mau-Mau hängt den Hinweis nicht mehr an der Wackelklasse fest', () => {
  const app = read('public/maumau/js/app.js');
  const page = read('public/maumau/index.html');
  assert.match(page, /\/assets\/hint-note\.js/);
  assert.match(app, /HintNote\.create/);
  assert.match(app, /notes\.sync\(\)/);
  assert.match(app, /commitNote\(\)/);
  assert.doesNotMatch(app, /contains\('shake'\)/);
  assert.match(app, /Die Karte passt nicht\. Farbe oder Wert, sonst ziehen\./);
});

test('Schafkopf, Jass und Canasta lassen denselben Hinweis nicht kleben', () => {
  const schafkopf = read('public/schafkopf/js/app.js');
  const jass = read('public/jass/js/app.js');
  const canasta = read('public/canasta/js/app.js');
  assert.match(read('public/schafkopf/index.html'), /\/assets\/hint-note\.js/);
  assert.match(read('public/jass/index.html'), /\/assets\/hint-note\.js/);
  assert.match(read('public/canasta/index.html'), /\/assets\/hint-note\.js/);
  assert.match(schafkopf, /HintNote\.create/);
  assert.match(schafkopf, /notes\.sync\(\)/);
  assert.doesNotMatch(schafkopf, /indexOf\('nicht'\)/);
  assert.match(jass, /HintNote\.create/);
  assert.match(jass, /notes\.show\('Die Karte ist nicht erlaubt\.'\)/);
  assert.match(jass, /notes\.sync\(\)/);
  assert.match(canasta, /HintNote\.create/);
  assert.match(canasta, /notes\.sync\(\)/);
  assert.doesNotMatch(canasta, /S\.error/);
});

test('Doppelkopf, Elfer raus und Schwimmen haben denselben klebenden Hinweis nicht mehr', () => {
  ['doppelkopf', 'elfer-raus', 'schwimmen'].forEach((game) => {
    const app = read('public/' + game + '/js/app.js');
    const page = read('public/' + game + '/index.html');
    assert.match(page, /\/assets\/hint-note\.js/, game);
    assert.match(app, /HintNote\.create/, game);
    assert.match(app, /notes\.sync\(\)/, game);
    assert.doesNotMatch(app, /contains\('shake'\)/, game);
    assert.doesNotMatch(app, /indexOf\('nicht'\)/, game);
  });
});

test('Skat zeigt beim ungültigen Zug keinen festklebenden Fehlertext', () => {
  const app = read('public/skat/js/app.js');
  assert.doesNotMatch(app, /contains\('shake'\)/);
  assert.doesNotMatch(app, /indexOf\('nicht'\)/);
  assert.match(app, /\$\('hint-box'\)\.hidden = true/);
});

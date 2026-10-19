/* Tisch und Startseite. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/elfer-raus/js/seats.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du, Oma Hilde, Lena, Jonas, Bilder mit Initialen', () => {
  const table = seats.layout(3);
  assert.deepEqual(table.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(table[1].id, 'hilde');
  assert.equal(table[1].slug, 'oma-hilde');
  assert.equal(table[1].name, 'Oma Hilde');
  assert.equal(table[1].portrait, '/media/spielpartner/oma-hilde.jpg');
  assert.equal(table[2].id, 'lena');
  assert.equal(table[2].portrait, '/media/spielpartner/lena.jpg');
  assert.equal(table[3].id, 'jonas');
  assert.equal(table[3].portrait, '/media/spielpartner/jonas.jpg');
  assert.equal(table[1].voice, true);
  assert.equal(table[2].voice, true);
  assert.equal(table[3].voice, true);
  assert.equal(seats.initials('Oma Hilde'), 'OH');
  assert.equal(seats.initials('Lena Berger'), 'LB');
  assert.equal(seats.initials('Jonas Rehm'), 'JR');
  assert.deepEqual(seats.layout(4).map((s) => s.id), ['du', 'hilde', 'lena', 'jonas', 'horst']);
});

test('Startseite zeigt Elfer raus als Neu und behält die anderen Spiele', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /preview-badge">Vorschau</);
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Elfer raus<\/h3>/);
  assert.match(html, /href="\/elfer-raus\/">Elfer raus spielen</);
  assert.match(html, /href="\/elfer-raus\/">Elfer raus</);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Schnapsen', 'Watten', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
});

test('Der Tisch ruft Avatar, Rundenzähler und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/elfer-raus/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/elfer-raus/index.html'), 'utf8');
  assert.match(app, /SpielFreundeAvatar/);
  assert.match(app, /playerSeat/);
  assert.match(app, /SpielpartnerRounds\.gate\(/);
  assert.match(app, /SpielpartnerRounds\.finish\(/);
  assert.match(page, /\/spielpartner\/entitlement\.js/);
  assert.match(page, /\/spielpartner\/offer\.js/);
  assert.match(page, /\/spielpartner\/checkout\.js/);
  assert.match(page, /\/spielpartner\/paywall\.js/);
  assert.match(page, /\/spielpartner\/rounds\.js/);
  assert.match(page, /id="modal-paywall"/);
  assert.match(page, /Ein Angebot der Interconsult LLC/);
  assert.match(page, /preview-badge">Vorschau</);
  assert.equal(page.includes('Michael'), false);
});

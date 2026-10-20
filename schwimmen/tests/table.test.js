/* Tisch und Startseite. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/schwimmen/js/seats.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du, Horst, Lena, Chantal, Bilder mit Initialen', () => {
  const table = seats.layout(3);
  assert.deepEqual(table.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(table[1].id, 'horst');
  assert.equal(table[1].portrait, '/media/spielpartner/horst.jpg');
  assert.equal(table[2].id, 'lena');
  assert.equal(table[2].portrait, '/media/spielpartner/lena.jpg');
  assert.equal(table[3].id, 'chantal');
  assert.equal(table[3].portrait, '/media/spielpartner/chantal.jpg');
  assert.equal(table[1].voice, true);
  assert.equal(table[2].voice, true);
  assert.equal(table[3].voice, true);
  assert.equal(seats.initials('Horst Kaluppke'), 'HK');
  assert.equal(seats.initials('Lena Berger'), 'LB');
  assert.equal(seats.initials('Chantal Kowalski'), 'CK');
  assert.deepEqual(seats.layout(4).map((s) => s.id), ['du', 'horst', 'lena', 'jonas', 'chantal']);
});

test('Startseite zeigt Schwimmen als Neu und behält die anderen Spiele', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.doesNotMatch(html, /preview-badge/);
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Schwimmen<\/h3>/);
  assert.match(html, /href="\/schwimmen\/">Schwimmen spielen</);
  assert.match(html, /href="\/schwimmen\/">Schwimmen</);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Schnapsen', 'Watten', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
});

test('Der Tisch ruft Avatar, Rundenzähler und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/schwimmen/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/schwimmen/index.html'), 'utf8');
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
  assert.doesNotMatch(page, /preview-badge/);
  assert.equal(page.includes('Michael'), false);
});

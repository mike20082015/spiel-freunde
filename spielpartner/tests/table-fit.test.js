/* Tablet-Tisch: eigene Karten bleiben im Bild. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'public/assets/table-fit.css'), 'utf8');

const games = [
  'skat', 'canasta', 'romme', 'maumau', 'jass', 'schafkopf', 'doppelkopf',
  'bridge', 'schnapsen', 'watten', 'schwimmen', 'elfer-raus', 'tisch',
];

test('table-fit uses the dynamic viewport and the safe area', () => {
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /100dvh - 4\.5rem - env\(safe-area-inset-bottom/);
  assert.match(css, /env\(safe-area-inset-left/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.match(css, /min-width:\s*561px/);
});

test('the player hand fits 13 cards, including a bridge suit gap', () => {
  assert.match(css, /\.me > \.hand \.card\.suit-gap\{margin-left:calc\(var\(--cw\) \* -0\.24\)\}/);
  assert.match(css, /--fit-div:\s*10\.2/);
});

test('every card table loads the fit stylesheet after the report bar', () => {
  for (const game of games) {
    const html = fs.readFileSync(path.join(root, 'public', game, 'index.html'), 'utf8');
    assert.match(html, /viewport-fit=cover/, game);
    const reports = html.indexOf('/spielpartner/reports.css');
    const fit = html.indexOf('/assets/table-fit.css');
    assert.ok(reports > -1 && fit > reports, game + ' links table-fit.css after reports.css');
  }
});

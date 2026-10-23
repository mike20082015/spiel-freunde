/* Skat-Stich: nur die neue Karte fliegt, der Stich ruht, der Ring wartet. */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'public/skat/js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/skat/css/skat.css'), 'utf8');

test('liegende Stichkarten werden nicht neu eingesetzt', () => {
  const center = app.slice(app.indexOf('function renderCenter'), app.indexOf('function humanLegal'));
  assert.doesNotMatch(center, /tr\.innerHTML\s*=/);
  assert.match(center, /trickFlight === x\.card \? ' arriving'/);
  assert.match(center, /classList\.remove\('arriving'\)/);
  assert.match(app, /C\.backEl\(\)/);
});

test('der Ring bleibt auf der Karte, die gerade fliegt', () => {
  const active = app.slice(app.indexOf('function isActive'), app.indexOf('function renderCenter'));
  assert.match(active, /S\.ringHold != null/);
  const play = app.slice(app.indexOf('async function doPlay'), app.indexOf('function team'));
  assert.match(play, /S\.ringHold = p/);
  assert.match(play, /S\.ringHold = null/);
  assert.match(play, /await hold\(FLIGHT_MS\)/);
  const ringClear = play.indexOf('S.ringHold = null');
  const rest = play.indexOf('await hold(TRICK_REST_MS)');
  assert.ok(ringClear > 0 && ringClear < rest, 'der Ring wandert nach der Landung, vor der Ruhe');
});

test('ein fertiger Stich ruht und wird dann eingesammelt', () => {
  assert.match(app, /const TRICK_REST_MS = 1000/);
  assert.match(app, /const COLLECT_MS = 420/);
  const play = app.slice(app.indexOf('async function doPlay'), app.indexOf('function team'));
  const rest = play.indexOf('await hold(TRICK_REST_MS)');
  const collect = play.indexOf('S.collectTo = info.winner');
  const clear = play.indexOf('S.displayTrick = []');
  assert.ok(rest > 0 && rest < collect && collect < clear);
  assert.doesNotMatch(play, /sleep\(320\)|sleep\(180\)/);
  assert.match(play, /if \(fly\) await hold\(COLLECT_MS\)/);
  assert.match(play, /motionReduced\(\)/);
});

test('der Einflug startet sichtbar und ohne Wiederholung', () => {
  assert.match(css, /\.trick \.card\.arriving\.p0\{animation:in0 \.36s ease-out\}/);
  assert.match(css, /\.trick \.card\.arriving\.p1\{animation:in1 \.36s ease-out\}/);
  assert.match(css, /\.trick \.card\.arriving\.p2\{animation:in2 \.36s ease-out\}/);
  assert.doesNotMatch(css, /\.trick \.p[012]\{[^}]*animation:/);
  const frames = css.slice(css.indexOf('@keyframes in0'), css.indexOf('.trick.collect-0'));
  assert.doesNotMatch(frames, /opacity:\s*0/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.st-main\{[^}]*min-height:2\.9em/);
});

/* Sitze, Sprüche und die erlaubten Funktions-Variablen. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/jass/js/seats.js');
const talk = require('../../public/jass/js/talk.js').JassTalk;

const ALLOWED = [
  'XAI_API_KEY', 'ELEVENLABS_API_KEY', 'XAI_MODEL', 'VOICE_HORST', 'VOICE_MARGARETHE',
  'ELEVEN_MODEL', 'DAILY_LIMIT', 'XAI_IMAGE_MODEL', 'AVATAR_DAILY_LIMIT', 'VOICE_URS', 'VOICE_VRENI',
  'VOICE_SEPP', 'VOICE_HILDE', 'VOICE_LENA', 'VOICE_JONAS', 'VOICE_OEMER', 'VOICE_RUEDIGER', 'VOICE_CHANTAL',
];

test('Sitze: Du, Vreni, Urs, Horst, Bilder mit Initialen', () => {
  assert.deepEqual(seats.seats.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(seats.seats[1].portrait, '/media/spielpartner/vreni.jpg');
  assert.equal(seats.seats[2].portrait, '/media/spielpartner/urs.jpg');
  assert.equal(seats.initials('Urs Gerber'), 'UG');
  assert.equal(seats.initials('Vreni Meier'), 'VM');
  assert.equal(seats.initials('Horst Kaluppke'), 'HK');
});

test('Sprüche bleiben am Tisch und nennen keinen Anbieter', () => {
  assert.equal(talk.classify('Hoi zusammen'), 'greet');
  assert.ok(talk.line('urs', 'welcome'));
  assert.ok(talk.line('vreni', 'stoeck'));
  assert.ok(talk.cannedReply('horst', 'wie geht der Puur'));
  const blob = JSON.stringify(talk.LINES) + JSON.stringify(talk.REPLIES);
  assert.doesNotMatch(blob, /grok|elevenlabs|openai|x\.?ai/i);
  assert.deepEqual(talk.responders('Hallo Urs'), ['urs']);
});

test('project.yml nutzt nur Variablen aus der App-Spec', () => {
  const yml = fs.readFileSync(path.join(__dirname, '../../api/project.yml'), 'utf8');
  const used = new Set();
  for (const match of yml.matchAll(/\$\{([A-Z0-9_]+)\}/g)) used.add(match[1]);
  for (const name of used) assert.ok(ALLOWED.includes(name), name);
  assert.ok(used.has('VOICE_URS'));
  assert.ok(used.has('VOICE_VRENI'));
  const lib = fs.readFileSync(path.join(__dirname, '../../api/lib/handlers.js'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '../../api/packages/sf/chat/handlers.js'), 'utf8');
  const tts = fs.readFileSync(path.join(__dirname, '../../api/packages/sf/tts/handlers.js'), 'utf8');
  assert.equal(chat, lib);
  assert.equal(tts, lib);
});

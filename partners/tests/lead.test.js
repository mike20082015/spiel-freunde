/* Partnerseiten. Aufruf: node --test partners/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const lead = require('../lead.js');

const root = path.join(__dirname, '../..');
const publicDir = path.join(root, 'public');
const configPath = path.join(root, 'partners/partners.json');

function loadMap(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window;
}

test('michael führt auf die Startseite, ein ref wird zum Partnerlink, Unbekanntes fällt zurück', () => {
  const config = {
    fallbackHref: 'https://spiel-freunde.com/',
    partners: {
      michael: { href: 'https://spiel-freunde.com/' },
      anna: { ref: 'anna42' }
    }
  };
  const reserved = new Set(['skat', 'tisch', 'anmelden', 'spielpartner']);
  assert.deepStrictEqual(lead.resolve('michael', config, reserved), {
    slug: 'michael',
    href: 'https://spiel-freunde.com/',
    known: true,
    ref: ''
  });
  assert.deepStrictEqual(lead.resolve('anna', config, reserved), {
    slug: 'anna',
    href: 'https://spiel-freunde.com/?ref=anna42',
    known: true,
    ref: 'anna42'
  });
  assert.deepStrictEqual(lead.resolve('niemand', config, reserved), {
    slug: 'niemand',
    href: 'https://spiel-freunde.com/',
    known: false,
    ref: ''
  });
  assert.deepStrictEqual(lead.resolve('skat', config, reserved).href, 'https://spiel-freunde.com/');
  assert.equal(lead.resolve('skat', config, reserved).known, false);
  assert.equal(lead.resolve('Michael', config, reserved).slug, 'michael');
});

test('ungültige Slugs und Codes werden abgelehnt', () => {
  assert.throws(() => lead.normalizeConfig({ partners: { Skat: { ref: 'x' } } }), /klein/);
  assert.throws(() => lead.normalizeConfig({ partners: { anna: { ref: '***' } } }), /ref/);
  assert.throws(() => lead.normalizeConfig({ partners: { anna: { href: 'https://spiel-freunde.com/', ref: 'anna' } } }), /entweder/);
  assert.throws(() => lead.normalizeConfig({ partners: { anna: { href: 'https://example.com/' } } }), /spiel-freunde.com/);
  assert.throws(() => lead.normalizeConfig({ partners: { '../skat': { ref: 'x' } } }), /klein/);
  assert.equal(lead.cleanRef('partner_1'), 'partner_1');
  assert.equal(lead.cleanRef(''), '');
});

test('bestehende Routen sind reserviert, michael nicht', () => {
  const reserved = lead.reservedSlugs(publicDir);
  ['skat', 'tisch', 'anmelden', 'spielpartner', 'mein-avatar', 'partnerprogramm', 'jass', 'canasta', 'bridge', 'api', 'assets', 'media', 'index', 'impressum', 'datenschutz', '404'].forEach((name) => {
    assert.equal(reserved.has(name), true, name);
  });
  assert.equal(reserved.has('michael'), false);
});

test('die Seite nennt den Satz, den Film und die Rechtstexte, ohne Ton von allein und ohne Anbieter', () => {
  const html = lead.renderPage({
    slug: 'anna',
    href: 'https://spiel-freunde.com/?ref=anna42',
    ref: 'anna42'
  });
  assert.match(html, new RegExp(lead.HEADLINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, new RegExp(lead.SUBLINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /Jetzt kostenlos spielen/);
  assert.match(html, /href="https:\/\/spiel-freunde.com\/\?ref=anna42"/);
  assert.match(html, /data-partner-ref="anna42"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /property="og:image" content="https:\/\/spiel-freunde.com\/media\/promo\/spiel-freunde-promo-v1-poster.jpg"/);
  assert.match(html, /og:image:width" content="1280"/);
  assert.match(html, /og:image:height" content="720"/);
  assert.match(html, /summary_large_image/);
  assert.match(html, /rel="canonical" href="https:\/\/spiel-freunde.com\/anna\/"/);
  const video = html.match(/<video\b[^>]*>/)[0];
  assert.match(video, /\bcontrols\b/);
  assert.match(video, /\bplaysinline\b/);
  assert.match(video, /\bmuted\b/);
  assert.match(video, /poster="\/media\/promo\/spiel-freunde-promo-v1-poster.jpg"/);
  assert.match(video, /data-wide="\/media\/promo\/promo-web.mp4"/);
  assert.match(video, /data-tall="\/media\/promo\/promo-web-vertical.mp4"/);
  assert.doesNotMatch(video, /\bautoplay\b/);
  assert.match(html, />Ton an</);
  assert.match(html, /Ein Angebot der Interconsult LLC/);
  assert.match(html, /href="\/impressum\.html"/);
  assert.match(html, /href="\/datenschutz\.html"/);
  assert.match(html, /href="\/agb\.html"/);
  assert.match(html, /href="\/widerruf\.html"/);
  assert.match(html, /href="\/partnerprogramm\/"/);
  assert.match(html, /entitlement\.js/);
  assert.equal(html.includes('—'), false);
  ['OpenAI', 'ElevenLabs', 'xAI', 'Grok', 'Claude', 'Anthropic', 'ChatGPT', 'Gemini'].forEach((name) => {
    assert.equal(html.includes(name), false, name);
  });
  assert.equal(/passiv|garantiert|Einkommen|Provision|verdienen/i.test(html), false);
  const script = fs.readFileSync(path.join(publicDir, 'assets/partner-lead.js'), 'utf8');
  const mutedAt = script.indexOf('video.muted = true');
  const playAt = script.indexOf('video.play()');
  assert.ok(mutedAt >= 0 && playAt > mutedAt);
});

test('sync legt Ordner nur für Partner an und lässt /skat/ in Ruhe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-partner-'));
  fs.mkdirSync(path.join(dir, 'skat'));
  fs.writeFileSync(path.join(dir, 'skat', 'index.html'), '<p>Skat bleibt</p>');
  fs.mkdirSync(path.join(dir, 'anmelden'));
  fs.writeFileSync(path.join(dir, 'anmelden', 'index.html'), '<p>Anmeldung</p>');
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>Home</p>');
  fs.writeFileSync(path.join(dir, '404.html'), '<div id="partner-fallback" hidden>\n<!-- partner-fallback:start -->\n<!-- partner-fallback:end -->\n</div>\n<script src="/spielpartner/entitlement.js"></script>\n');
  const config = {
    fallbackHref: 'https://spiel-freunde.com/',
    partners: {
      michael: { href: 'https://spiel-freunde.com/' },
      anna: { ref: 'anna42' }
    }
  };
  lead.sync({ publicDir: dir, config: config, fallbackFile: path.join(dir, '404.html') });
  assert.equal(fs.readFileSync(path.join(dir, 'skat/index.html'), 'utf8'), '<p>Skat bleibt</p>');
  assert.equal(fs.readFileSync(path.join(dir, 'anmelden/index.html'), 'utf8'), '<p>Anmeldung</p>');
  const michael = fs.readFileSync(path.join(dir, 'michael/index.html'), 'utf8');
  assert.match(michael, /href="https:\/\/spiel-freunde.com\/"/);
  assert.equal(michael.includes('data-partner-ref'), false);
  assert.match(fs.readFileSync(path.join(dir, 'anna/index.html'), 'utf8'), /href="https:\/\/spiel-freunde.com\/\?ref=anna42"/);
  const map = loadMap(fs.readFileSync(path.join(dir, 'assets/partner-map.js'), 'utf8'));
  assert.equal(map.SPIEL_FREUNDE_PARTNER.michael, 'https://spiel-freunde.com/');
  assert.equal(map.SPIEL_FREUNDE_PARTNER.anna, 'https://spiel-freunde.com/?ref=anna42');
  assert.ok(map.SPIEL_FREUNDE_PARTNER_RESERVED.includes('skat'));
  assert.ok(map.SPIEL_FREUNDE_PARTNER_RESERVED.includes('anmelden'));
  assert.equal(map.SPIEL_FREUNDE_PARTNER_RESERVED.includes('michael'), false);
  const fallback = fs.readFileSync(path.join(dir, '404.html'), 'utf8');
  assert.match(fallback, /href="https:\/\/spiel-freunde.com\/"/);
  assert.match(fallback, new RegExp(lead.HEADLINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  lead.sync({
    publicDir: dir,
    config: { partners: { michael: { href: 'https://spiel-freunde.com/' } } },
    fallbackFile: path.join(dir, '404.html')
  });
  assert.equal(fs.existsSync(path.join(dir, 'anna')), false);
  assert.equal(fs.existsSync(path.join(dir, 'michael/index.html')), true);
  assert.throws(() => lead.sync({
    publicDir: dir,
    config: { partners: { skat: { ref: 'skat1' } } }
  }), /schon eine Seite/);
  assert.equal(fs.readFileSync(path.join(dir, 'skat/index.html'), 'utf8'), '<p>Skat bleibt</p>');
});

test('die ausgelieferten Dateien entsprechen partners.json', () => {
  const config = lead.readConfig(configPath);
  assert.equal(config.partners.michael.href, 'https://spiel-freunde.com/');
  assert.equal(config.fallbackHref, 'https://spiel-freunde.com/');
  const page = fs.readFileSync(path.join(publicDir, 'michael/index.html'), 'utf8');
  assert.equal(page, lead.pageFor('michael', config));
  assert.equal(
    fs.readFileSync(path.join(publicDir, 'assets/partner-map.js'), 'utf8'),
    lead.renderMap(publicDir, config)
  );
  const notFound = fs.readFileSync(path.join(publicDir, '404.html'), 'utf8');
  assert.match(notFound, /Diese Seite gibt es nicht/);
  assert.match(notFound, /noindex/);
  const start = notFound.indexOf(lead.FALLBACK_START);
  const end = notFound.indexOf(lead.FALLBACK_END);
  assert.equal(notFound.slice(start + lead.FALLBACK_START.length, end).trim(), lead.renderFallback(config).trim());
  ['promo-web.mp4', 'promo-web-vertical.mp4', 'spiel-freunde-promo-v1-poster.jpg'].forEach((name) => {
    const file = path.join(publicDir, 'media/promo', name);
    assert.ok(fs.statSync(file).size > 10000, name);
  });
});

/*
 * Partnerseiten: Slug zu Affiliate-Link, HTML für /<slug>/.
 * Läuft in Node (require). Der Browser liest nur die erzeugten Dateien.
 *
 * Empfehlung: ?ref= speichert entitlement.js 90 Tage und schickt den Code
 * an Anmeldung und Kasse. Eine öffentliche Schnittstelle, die einen Slug
 * auflöst, gibt es unter der LeadMonster-Basis nicht. Die Zuordnung steht
 * in partners.json. href ist ein fertiger Link (Inhaber). ref wird zu
 * https://spiel-freunde.com/?ref=<code>.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = 'https://spiel-freunde.com';
const FALLBACK_HREF = SITE + '/';
const POSTER_PATH = '/media/promo/spiel-freunde-promo-v1-poster.jpg';
const VIDEO_WIDE = '/media/promo/promo-web.mp4';
const VIDEO_TALL = '/media/promo/promo-web-vertical.mp4';
const OG_IMAGE_PATH = '/media/promo/spiel-freunde-og.jpg';
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_IMAGE_ALT = 'Spiel-Freunde. Die schönsten Kartenspiele aus Deutschland, Österreich und der Schweiz digital neu interpretiert';

const HEADLINE = 'Die schönsten Kartenspiele aus Deutschland, Österreich und der Schweiz: digital neu interpretiert.';
const SUBLINE = 'Spiel Skat, Jass und Canasta mit Spielpartnern, die mit Dir reden.';
const BUTTON = 'Jetzt kostenlos spielen';
const TITLE = 'Spiel-Freunde: Die schönsten Kartenspiele aus Deutschland, Österreich und der Schweiz';
const OG_TITLE = HEADLINE;
const DESCRIPTION = SUBLINE;

const MARKER = 'data-partner-lead="1"';
const FALLBACK_START = '<!-- partner-fallback:start -->';
const FALLBACK_END = '<!-- partner-fallback:end -->';

const EXTRA_RESERVED = ['api', 'health'];
const TOP_KEYS = ['fallbackHref', 'partners'];
const ENTRY_KEYS = ['href', 'ref'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanRef(value) {
  if (value == null) return '';
  const code = String(value).trim();
  if (!code || code.length > 80) return '';
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return '';
  return code;
}

function cleanSlug(value) {
  const slug = String(value || '').trim();
  if (!slug || slug.length > 48) return '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '';
  return slug;
}

function assertSiteUrl(value, label) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch (err) { throw new Error(label + ' ist keine Adresse'); }
  if (url.protocol !== 'https:' || url.hostname !== 'spiel-freunde.com') {
    throw new Error(label + ' muss https://spiel-freunde.com sein');
  }
  return url.toString();
}

function readConfig(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normalizeConfig(raw);
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('partners.json');
  Object.keys(raw).forEach((key) => {
    if (TOP_KEYS.indexOf(key) === -1) throw new Error('Unbekanntes Feld ' + key);
  });
  const fallbackHref = raw.fallbackHref == null || raw.fallbackHref === ''
    ? FALLBACK_HREF
    : assertSiteUrl(raw.fallbackHref, 'fallbackHref');
  const partners = raw.partners;
  if (!partners || typeof partners !== 'object' || Array.isArray(partners)) throw new Error('partners');
  const clean = {};
  Object.keys(partners).forEach((key) => {
    const slug = cleanSlug(key);
    if (!slug || slug !== key) throw new Error('Slug "' + key + '" klein schreiben, nur Buchstaben, Ziffern und Bindestriche');
    const entry = partners[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Eintrag ' + slug);
    Object.keys(entry).forEach((field) => {
      if (ENTRY_KEYS.indexOf(field) === -1) throw new Error('Unbekanntes Feld ' + slug + '.' + field);
    });
    const hasHref = entry.href != null && String(entry.href).trim() !== '';
    const hasRef = entry.ref != null && String(entry.ref).trim() !== '';
    if (hasHref && hasRef) throw new Error(slug + ': entweder href oder ref');
    if (hasHref) {
      clean[slug] = { href: assertSiteUrl(entry.href, slug + '.href') };
    } else if (hasRef) {
      const ref = cleanRef(entry.ref);
      if (!ref) throw new Error(slug + ': ref ungültig');
      clean[slug] = { ref: ref };
    } else {
      clean[slug] = {};
    }
  });
  return { fallbackHref: fallbackHref, partners: clean };
}

function hasMarker(publicDir, name) {
  const index = path.join(publicDir, name, 'index.html');
  if (!fs.existsSync(index)) return false;
  return fs.readFileSync(index, 'utf8').includes(MARKER);
}

function reservedSlugs(publicDir) {
  const names = new Set(EXTRA_RESERVED);
  if (!publicDir || !fs.existsSync(publicDir)) return names;
  fs.readdirSync(publicDir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name.startsWith('.')) return;
    if (entry.isDirectory()) {
      if (!hasMarker(publicDir, entry.name)) names.add(entry.name);
      return;
    }
    if (entry.name.endsWith('.html')) names.add(entry.name.slice(0, -'.html'.length));
  });
  return names;
}

function affiliateHref(entry, fallbackHref) {
  const fallback = fallbackHref || FALLBACK_HREF;
  if (!entry) return fallback;
  if (entry.href) return entry.href;
  if (entry.ref) return SITE + '/?ref=' + encodeURIComponent(entry.ref);
  return fallback;
}

function refOf(entry, href) {
  if (entry && entry.ref) return entry.ref;
  try {
    return cleanRef(new URL(href).searchParams.get('ref'));
  } catch (err) {
    return '';
  }
}

function resolve(slug, config, reserved) {
  const normalized = normalizeConfig(config || { partners: {} });
  const clean = cleanSlug(String(slug || '').trim().toLowerCase());
  if (!clean || (reserved && reserved.has(clean))) {
    return { slug: clean, href: normalized.fallbackHref, known: false, ref: '' };
  }
  const entry = normalized.partners[clean];
  if (!entry) return { slug: clean, href: normalized.fallbackHref, known: false, ref: '' };
  const href = affiliateHref(entry, normalized.fallbackHref);
  return { slug: clean, href: href, known: true, ref: refOf(entry, href) };
}

function videoBlock(preload) {
  return [
    '    <div class="lead-frame" id="lead-frame">',
    '      <video id="lead-video" controls playsinline webkit-playsinline muted preload="' + preload + '"',
    '        poster="' + POSTER_PATH + '"',
    '        data-wide="' + VIDEO_WIDE + '"',
    '        data-tall="' + VIDEO_TALL + '"',
    '        src="' + VIDEO_WIDE + '"',
    '        aria-label="Film: Die schönsten Kartenspiele aus Deutschland, Österreich und der Schweiz"></video>',
    '      <button type="button" class="lead-sound" id="lead-sound">Ton an</button>',
    '    </div>'
  ].join('\n');
}

function renderMain(opts) {
  const href = escapeHtml(opts.href);
  const preload = opts.preload || 'none';
  return [
    videoBlock(preload),
    '    <div class="lead-copy">',
    '      <h1>' + HEADLINE + '</h1>',
    '      <p class="lead-sub">' + SUBLINE + '</p>',
    '      <a class="btn btn-gold btn-lg lead-play lead-go" href="' + href + '">' + BUTTON + '</a>',
    '    </div>'
  ].join('\n');
}

function renderPage(opts) {
  const href = opts.href;
  const slug = opts.slug;
  const ref = opts.ref || '';
  const canonical = SITE + '/' + slug + '/';
  const refAttr = ref ? ' data-partner-ref="' + escapeHtml(ref) + '"' : '';
  const image = SITE + OG_IMAGE_PATH;
  return [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>' + escapeHtml(TITLE) + '</title>',
    '<meta name="description" content="' + escapeHtml(DESCRIPTION) + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="de_DE">',
    '<meta property="og:site_name" content="Spiel-Freunde">',
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">',
    '<meta property="og:title" content="' + escapeHtml(OG_TITLE) + '">',
    '<meta property="og:description" content="' + escapeHtml(DESCRIPTION) + '">',
    '<meta property="og:image" content="' + image + '">',
    '<meta property="og:image:secure_url" content="' + image + '">',
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="' + OG_IMAGE_WIDTH + '">',
    '<meta property="og:image:height" content="' + OG_IMAGE_HEIGHT + '">',
    '<meta property="og:image:alt" content="' + escapeHtml(OG_IMAGE_ALT) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeHtml(OG_TITLE) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(DESCRIPTION) + '">',
    '<meta name="twitter:image" content="' + image + '">',
    '<meta name="theme-color" content="#24160c">',
    '<link rel="manifest" href="/manifest.json">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Spiel-Freunde">',
    '<link rel="icon" href="/assets/variante-a-favicon-dunkel.svg" type="image/svg+xml">',
    '<link rel="icon" href="/assets/variante-a-favicon-dunkel-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="/assets/pwa/apple-touch-icon.png">',
    '<link rel="preload" as="image" href="' + POSTER_PATH + '">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="/assets/style.css">',
    '<link rel="stylesheet" href="/assets/partner-lead.css">',
    '<link rel="stylesheet" href="/assets/pwa.css">',
    '<script>(function(){try{if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)document.documentElement.classList.add("sf-standalone")}catch(e){}})();</script>',
    '<script src="/assets/pwa.js" defer></script>',
    '</head>',
    '<body class="partner-page" ' + MARKER + ' data-partner-slug="' + escapeHtml(slug) + '"' + refAttr + '>',
    '<header class="lead-bar">',
    '  <a class="logo lead-go" href="' + escapeHtml(href) + '" aria-label="Spiel-Freunde Startseite"><img src="/assets/variante-a-lockup-dunkel-web.svg" alt="Spiel-Freunde" width="796" height="175"></a>',
    '</header>',
    '<main class="lead-page">',
    renderMain({ href: href, preload: 'none' }),
    '</main>',
    '<footer class="foot">',
    '  <div class="wrap foot-bottom">',
    '    <span>Ein Angebot der Interconsult LLC</span>',
    '    <span><a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a> · <a href="/agb.html">AGB</a> · <a href="/widerruf.html">Widerruf</a> · <a href="/partnerprogramm/">Partnerprogramm</a> · <a class="foot-en" href="/english/">Technology</a> · <a class="foot-tech" href="/german/">Technik</a></span>',
    '    <span>Kein Glücksspiel. Nur Spaß.</span>',
    '    <a class="powered" href="https://lead-monster.net" target="_blank" rel="noopener">powered by lead-monster.net</a>',
    '  </div>',
    '</footer>',
    '<script src="/spielpartner/entitlement.js"></script>',
    '<script src="/assets/partner-lead.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function renderFallback(config) {
  const normalized = normalizeConfig(config || { partners: {} });
  return renderMain({ href: normalized.fallbackHref, preload: 'none' });
}

function renderMap(publicDir, config) {
  const normalized = normalizeConfig(config);
  const reserved = Array.from(reservedSlugs(publicDir)).sort();
  const partners = {};
  Object.keys(normalized.partners).sort().forEach((slug) => {
    partners[slug] = affiliateHref(normalized.partners[slug], normalized.fallbackHref);
  });
  return [
    '/* Erzeugt von node partners/build.js. Nicht von Hand ändern. */',
    'window.SPIEL_FREUNDE_PARTNER = ' + JSON.stringify(partners, null, 2) + ';',
    'window.SPIEL_FREUNDE_PARTNER_RESERVED = ' + JSON.stringify(reserved) + ';',
    ''
  ].join('\n');
}

function injectFallback(html, inner) {
  const start = html.indexOf(FALLBACK_START);
  const end = html.indexOf(FALLBACK_END);
  if (start < 0 || end < start) throw new Error('404.html ohne Markierung für die Partnerseite');
  return html.slice(0, start + FALLBACK_START.length) + '\n' + inner + '\n' + html.slice(end);
}

function pageFor(slug, config) {
  const normalized = normalizeConfig(config);
  const entry = normalized.partners[slug];
  if (!entry) throw new Error('Unbekannter Slug ' + slug);
  const href = affiliateHref(entry, normalized.fallbackHref);
  return renderPage({
    slug: slug,
    href: href,
    ref: refOf(entry, href)
  });
}

function sync(options) {
  const publicDir = options.publicDir;
  const config = normalizeConfig(options.config);
  const reserved = reservedSlugs(publicDir);
  const slugs = Object.keys(config.partners);
  slugs.forEach((slug) => {
    if (reserved.has(slug)) throw new Error('Slug "' + slug + '" ist schon eine Seite');
  });

  fs.readdirSync(publicDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory() || !hasMarker(publicDir, entry.name)) return;
    if (Object.prototype.hasOwnProperty.call(config.partners, entry.name)) return;
    const dir = path.join(publicDir, entry.name);
    const files = fs.readdirSync(dir);
    if (files.length !== 1 || files[0] !== 'index.html') {
      throw new Error(entry.name + ' enthält mehr als die Partnerseite');
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  slugs.forEach((slug) => {
    const dir = path.join(publicDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageFor(slug, config));
  });

  const assets = path.join(publicDir, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, 'partner-map.js'), renderMap(publicDir, config));

  if (options.fallbackFile) {
    const current = fs.readFileSync(options.fallbackFile, 'utf8');
    const next = injectFallback(current, renderFallback(config));
    if (next !== current) fs.writeFileSync(options.fallbackFile, next);
  }

  return slugs.slice().sort();
}

module.exports = {
  SITE: SITE,
  FALLBACK_HREF: FALLBACK_HREF,
  HEADLINE: HEADLINE,
  SUBLINE: SUBLINE,
  BUTTON: BUTTON,
  TITLE: TITLE,
  OG_TITLE: OG_TITLE,
  DESCRIPTION: DESCRIPTION,
  POSTER_PATH: POSTER_PATH,
  VIDEO_WIDE: VIDEO_WIDE,
  VIDEO_TALL: VIDEO_TALL,
  MARKER: MARKER,
  FALLBACK_START: FALLBACK_START,
  FALLBACK_END: FALLBACK_END,
  cleanRef: cleanRef,
  cleanSlug: cleanSlug,
  readConfig: readConfig,
  normalizeConfig: normalizeConfig,
  reservedSlugs: reservedSlugs,
  affiliateHref: affiliateHref,
  resolve: resolve,
  renderPage: renderPage,
  renderFallback: renderFallback,
  renderMap: renderMap,
  pageFor: pageFor,
  sync: sync
};

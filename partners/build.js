#!/usr/bin/env node
/*
 * Erzeugt public/<slug>/index.html aus partners/partners.json.
 * Aufruf aus dem Repository: node partners/build.js
 * Kein Build auf App Platform. Die Seiten werden mit committed.
 */
'use strict';

const path = require('path');
const lead = require('./lead.js');

const root = path.join(__dirname, '..');
const configPath = path.join(__dirname, 'partners.json');

try {
  const config = lead.readConfig(configPath);
  const slugs = lead.sync({
    publicDir: path.join(root, 'public'),
    config: config,
    fallbackFile: path.join(root, 'public', '404.html')
  });
  console.log('Partnerseiten: ' + (slugs.length ? slugs.join(', ') : '(keine)'));
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}

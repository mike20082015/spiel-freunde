'use strict';

/*
 * Ergebnisablage für Tische.
 * Jetzt: Speicher, optional JSON-Zeilen in TISCH_DATA_DIR.
 * Später (Turnier, K.-o.): dieselbe Schnittstelle gegen eine Datenbank tauschen.
 * add() bekommt fertige Datensätze ohne Karten und ohne Sitz-Tokens.
 * list() liefert Kopien ohne das Feld access.
 */

const fs = require('fs');
const path = require('path');

function strip(row) {
  const copy = Object.assign({}, row);
  delete copy.access;
  return copy;
}

function createResultStore(dir) {
  const rows = [];
  let file = null;
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'results.jsonl');
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try { rows.push(JSON.parse(line)); } catch (e) { /* kaputte Zeile überspringen */ }
      }
    }
  }

  function add(row) {
    rows.push(row);
    if (file) fs.appendFileSync(file, JSON.stringify(row) + '\n');
    return row;
  }

  function list(filter) {
    const f = filter || {};
    return rows.filter((row) => {
      if (f.kind && row.kind !== f.kind) return false;
      if (f.tableId && row.tableId !== f.tableId) return false;
      if (f.code && row.code !== f.code) return false;
      if (f.tournamentId && row.tournamentId !== f.tournamentId) return false;
      if (f.roundId && row.roundId !== f.roundId) return false;
      return true;
    }).map(strip);
  }

  function findAuthorized(code, tokenHash) {
    if (!code || !tokenHash) return [];
    return rows.filter((row) => row.code === code && Array.isArray(row.access) && row.access.indexOf(tokenHash) !== -1).map(strip);
  }

  return { add, list, findAuthorized };
}

module.exports = { createResultStore };

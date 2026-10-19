#!/bin/bash
# Skat-Prototyp starten (macOS: Doppelklick, Linux: ./start.command)
# Startet einen kleinen Webserver auf http://localhost:8000 und öffnet den Browser.
# Nötig für die Spracheingabe (Mikrofon), die von file:// aus nicht funktioniert.
cd "$(dirname "$0")/../public"
PORT=8000
URL="http://localhost:$PORT/skat/"
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "Python 3 wird benötigt: https://www.python.org/downloads/"; read -r -p "Enter zum Schließen"; exit 1; fi
( sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") ) &
echo "Skat läuft auf $URL  (Fenster offen lassen, Strg+C beendet)"
"$PY" -m http.server "$PORT" --bind 127.0.0.1

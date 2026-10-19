# Spiel-Freunde: Skat-Prototyp

Spielbarer Skat im Browser: Du gegen Horst Kaluppke und Margarethe von Hohenfels, im Stammtisch-Look der Startseite.
Kein Build-Schritt, keine Abhängigkeiten, läuft offline (Schriften liegen lokal in `assets/fonts`).

## Starten

Am einfachsten per Doppelklick auf ein Startskript in diesem Ordner (braucht Python 3, öffnet den Browser auf http://localhost:8000/skat/):

* macOS: `start.command` (beim ersten Mal ggf. Rechtsklick, Öffnen)
* Windows: `start.bat`
* Linux: `./start.sh`

Die Skripte starten den Server im Ordner `public/` der Website, nicht nur für Skat.

Oder von Hand, im Repository:

```bash
cd public
python3 -m http.server 8000
# Browser: http://localhost:8000/ und http://localhost:8000/skat/
```

`public/skat/index.html` läuft auch direkt per Doppelklick (file://): Spiel, Chat und die vorab erzeugten Stimmen funktionieren,
**die Spracheingabe (Mikrofon) aber nicht**. Chrome erlaubt SpeechRecognition nur auf https oder http://localhost.

Nützliche URL-Parameter: `?fresh=1` (Punkteliste löschen), `?speed=fast|normal|slow`, `?seed=123` (reproduzierbares Mischen, nur für Tests),
`?autostart=1` (Begrüßung überspringen; dann gibt es Ton erst nach dem ersten Klick).

## Stimmen, Mitreden, Ziel, Spielstärke

* **Stimmen:** Horst (ElevenLabs-Stimme „Markus Deutsch“, rau, älter) und Margarethe („Elinor“, elegant-herb) sprechen alle festen Sprüche,
  Chat-Antworten und Reizansagen. 248 MP3s (mono, 64 kbit/s, zusammen 5,7 MB) liegen in `assets/voice/<figur>/<id>.mp3`,
  die Zuordnung Satz zu Datei steht in `js/voice-manifest.js`. Sätze ohne MP3 (z. B. „Kreuz Hand, Schneider angesagt!“)
  spricht die Browser-Sprachausgabe (de-DE, Horst tiefer, Margarethe höher). Es redet immer nur eine Figur (Warteschlange),
  ihr Bild leuchtet und zeigt Schallwellen, die Sprechblase bleibt bis zum Ende stehen.
  Ton startet erst nach dem Klick auf „Platz nehmen“ (Autoplay-Regeln der Browser).
  Die Wiedergabe lädt Begrüßung und häufige Ansagen schon beim Öffnen, holt den nächsten Satz der Warteschlange vor
  und spielt dekodierte Puffer über die Web Audio API ab (Cache im Browser, kleiner Audio-Pool als Ersatz).
  Zwischen zwei Sätzen gibt es keine extra Pause mehr.
* **Ton:** Knopf in der Oberleiste oder Einstellungen (an/aus, Lautstärke). Standard: an.
* **Mitreden:** „Nur Chat (schreiben)“ (Standard) oder „Mit Stimme (Mikrofon)“. Im Stimm-Modus erscheint neben dem Chatfeld ein
  Mikrofon-Knopf: klicken zum Starten und Stoppen oder gedrückt halten. Zwischenergebnisse stehen kursiv im Eingabefeld, der erkannte
  Satz geht als normale Chatnachricht raus, Horst und Margarethe antworten (gesprochen). Das Mikrofon startet nur auf Knopfdruck.
* **Spielen bis:** ohne Limit (Standard), 301, 501 oder eigenes Ziel (51 bis 2001). Fortschrittsbalken in der Punkteliste.
  Wer nach einem Spiel das Ziel erreicht und allein vorn liegt, gewinnt (bei Gleichstand an der Spitze wird weitergespielt).
  Dann folgt eine Siegerehrung mit Platzierung und Sprüchen beider Figuren, „Neue Runde“ leert die Punkteliste.
* **Spielstärke:** Anfänger, Kneipe (Standard), Turnier. Steht in der Oberleiste, gilt ab dem nächsten Spiel.
  * Anfänger: reizt vorsichtig und sprunghaft, spielt kaum Grand/Null, nimmt in etwa 25 % der Züge eine plausible, schwächere Karte,
    schmiert nicht immer, drückt nicht immer optimal. Die Figuren sind freundlicher („Macht nichts, Schätzchen ...“).
  * Kneipe: die bisherige Heuristik (Karten zählen, Fehlfarben aus Nicht-Bedienen ableiten, Trumpf ziehen, schmieren, kurzer/langer Weg).
  * Turnier: Kneipen-Heuristik plus Monte-Carlo-Suche bei jeder Karte: Die unbekannten Karten werden zwölf- bis vierzehnmal passend zu
    allem Öffentlichen neu verteilt (gespielte Karten, abgeleitete Fehlfarben, offene Null-Ouvert-Karten, plausible Trumpfzahl des
    Alleinspielers), jede erlaubte Karte wird darin zu Ende gespielt, die beste im Schnitt gewinnt. Echte verdeckte Karten sieht die KI nie.
* Alles wird in `localStorage` gespeichert (`sf-skat-settings`, `sf-skat-match`).

### Browser-Unterstützung Spracheingabe (Web Speech API, SpeechRecognition)

| Browser | Spracheingabe | Hinweis |
|---|---|---|
| Chrome (Desktop, Android) | ja | nur https oder http://localhost; Chrome schickt das Audio zur Erkennung an Google, braucht also Internet |
| Edge | ja | wie Chrome |
| Safari (macOS, iOS) | teilweise | `webkitSpeechRecognition` ab Safari 14.1, nutzt Siri; manchmal unzuverlässig |
| Firefox | nein | Knopf erscheint nicht, stattdessen ein Hinweis; Chat geht normal |
| alle, von file:// | meist nein | Startskript verwenden |

Die Sprachausgabe (MP3) funktioniert in allen aktuellen Browsern, auch offline. Die Browser-Sprachausgabe für dynamische Sätze
hängt von den installierten deutschen Stimmen ab.

### Produktion (TODO-Hooks in `js/talk.js`)

* `askAI(character, context)`: später serverseitiger Grok-Endpunkt für echte Antworten.
* `speakAI(character, text)`: später serverseitiges ElevenLabs TTS (z. B. `POST /api/tts`, Antwort Audio). Der ElevenLabs-Schlüssel
  liegt nur auf dem Server, nie im Browser, nie als `VITE_` oder andere Frontend-Variable. Optional ElevenLabs Scribe auf dem Server
  als Spracherkennung statt Web Speech API (dann auch Firefox).

## Dateien

| Datei | Inhalt |
|---|---|
| `public/skat/index.html` | Seite, Dialoge |
| `public/skat/css/skat.css`, `css/fonts.css` | Look (Holz, Bernstein, Weinrot, Creme), lokale Schriften Fraunces/Inter/Caveat |
| `public/skat/js/engine.js` | Regel-Engine (Browser und Node): Geben, Reizen, Skat, Ansage, Bedienen, Stich, Spielwert, Abrechnung, Ramsch, Bock |
| `public/skat/js/ai.js` | Heuristische KI (Reizen, Hand/Skat, Drücken, Ansage, Kartenspiel). Bekommt nur die Spielersicht, schummelt nie |
| `public/skat/js/talk.js` | Sprüche je Figur und Ereignis, Chat-Stichwörter, Reizansagen, `askAI()` und `speakAI()` als TODO-Hooks |
| `public/skat/js/voice.js` | Stimmen: Warteschlange, Vorladen, Web-Audio-Puffer, Audio-Pool, Fallback Browser-Sprachausgabe |
| `public/skat/js/voice-manifest.js`, `public/skat/assets/voice/` | Vorab erzeugte ElevenLabs-Aufnahmen (Satz zu Datei) |
| `skat/start.command`, `start.bat`, `start.sh` | Startskripte (lokaler Webserver auf `public/`, nötig fürs Mikrofon). Werden nicht veröffentlicht. |
| `public/skat/js/cards.js` | Kartenbild mit CSS/SVG (Turnierbild vierfarbig oder klassisch zweifarbig) |
| `public/skat/js/app.js` | Oberfläche und Spielablauf |
| `skat/tests/engine.test.js` | Regeltests (`cd skat && node --test tests/`) |
| `skat/tests/simulate.js` | KI-gegen-KI-Simulation (`node tests/simulate.js 200`) |
| `skat/tests/ai-strength.js` | KI gegen Zufall und Vergleich der Stufen Anfänger, Kneipe, Turnier |
| `skat/tools/shoot.py` | Screenshots mit Playwright (`python3 tools/shoot.py`), Server auf `public/` |
| `skat/tools/verify_voice.py` | Browser-Checks für Stimmen, Mitreden, Ziel, Spielstärke plus Screenshots |

## Tests

```bash
cd skat
node --test tests/             # 25 Tests: Regeln, Rundenziel, Spielstärken, 2 x 200 simulierte Spiele
node tests/simulate.js 200     # Statistik je Regelvariante
node tests/ai-strength.js 500  # KI gegen Zufall und Stufenvergleich (Turnier >= Kneipe > Anfänger)
python3 tools/verify_voice.py  # 21 Browser-Checks (headless Chrome)
```

## Regeln im Prototyp

* Offizielle Skatordnung: 32 Karten, Geben 3-Skat-4-3, Vorhand/Mittelhand/Hinterhand rotieren, Reizen 18, 20, 22, 23, 24, 27, 30 ...
* Hand oder Skat aufnehmen, zwei Karten drücken, Ansage Farbspiel, Grand, Null, Null Hand, Null Ouvert, Null Ouvert Hand.
* Schneider/Schwarz ansagen bei Handspielen. Spitzen mit/ohne über Hand plus Skat. Überreizt: verloren, Wert = nächstes Vielfaches des Grundwerts.
* Abrechnung: gewonnen + Spielwert, verloren minus doppelter Spielwert (vereinfachte Seeger-Fabian-Liste ohne 50er-Zuschläge).
* Kneipenskat (Einstellungen): Passen alle, wird Ramsch gespielt (meiste Augen verliert, Jungfrau verdoppelt, Durchmarsch +120).
  Nach einem verlorenen Grand: 3 Bockspiele (doppelt), danach 3 Ramschspiele.
* Nicht eingebaut: Kontra/Re, Farb- oder Grand-Ouvert, Schieberamsch, Seeger-Zuschläge.

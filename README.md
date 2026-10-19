# Spiel-Freunde

Die besten Kartenspiele aus Deutschland, Österreich und der Schweiz.

Statische Website für [spiel-freunde.com](https://spiel-freunde.com). Deutsch, Du-Form. Kein Build-Schritt, keine Geheimnisse, keine `VITE_`-Variablen. Ein Angebot der Interconsult LLC.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite |
| `/mein-avatar/` | Name und Gesicht für den Tisch. Das Bild bleibt auf dem Gerät |
| `/spielpartner/` | Deine Spielpartner: Horst, Margarethe und die Premium-Runde. 14 Tage Test nur in diesem Browser, plus Link zum eigenen Avatar |
| `/skat/` | Spielbarer Skat-Prototyp: Du gegen Horst und Margarethe |
| `/canasta/` | Spielbares Canasta: Du mit Margarethe gegen Horst und Oma Hilde |
| `/schafkopf/` | Spielbares Schafkopf: Du, Horst, Sepp und Margarethe |
| `/doppelkopf/` | Spielbares Doppelkopf: Du, Horst, Rüdiger und Margarethe |
| `/jass/` | Spielbarer Schieber: Du und Urs gegen Vreni und Horst |

In der Vorschau führen die großen Buttons auf der Startseite nach `/skat/`: „14 Tage kostenlos spielen“, „Jetzt Skat ausprobieren“, „Kostenlos testen“, „Jetzt starten“, „Skat wählen“ und „Alle Spiele wählen“. „Deine Spielpartner“ und die Leiste darunter führen nach `/spielpartner/`. Startseite, Skat, Canasta, Schafkopf, Jass, Doppelkopf, Spielpartner und Mein Avatar tragen ein goldenes Band „Vorschau“.

Veröffentlicht wird nur der Ordner `public/`. Tests, Werkzeuge und die Startskripte bleiben außerhalb.

```
public/                  Startseite, 404, /skat/, /canasta/, /schafkopf/, /jass/, /doppelkopf/ und /mein-avatar/
skat/tests, skat/tools   Regeltests und Browser-Checks, nicht öffentlich
skat/start.sh            lokaler Server, nicht öffentlich
tools/                   Entwurf-Helfer der Startseite, nicht öffentlich
.do/app.yaml             App-Spec für DigitalOcean
```

## Lokal ansehen

```bash
cd public
python3 -m http.server 8000
```

Dann [http://localhost:8000/](http://localhost:8000/) und [http://localhost:8000/skat/](http://localhost:8000/skat/).

Oder im Ordner `skat/` das Startskript (`./start.sh`, `start.bat`, `start.command`). Es öffnet `/skat/`. Für das Mikrofon im Prototyp brauchst Du http://localhost, nicht file://.

## Tests

```bash
cd skat
node --test tests/
node --test ../jass/tests
node --test ../spielpartner/tests
cd ../canasta && node --test tests/
cd ../schafkopf && node --test tests/
cd ../doppelkopf && node --test tests/
```

Die Spiellogik liegt in `public/skat/js/`. Details zum Skat-Prototyp stehen in `skat/README.md`.

## DigitalOcean App Platform

Die Spec liegt in [`.do/app.yaml`](.do/app.yaml). Komponente `web`, Typ Static Site, `output_dir: public`, `environment_slug: html`, kein `build_command`. Index ist `index.html`, die Fehlerseite ist `404.html`. Ein Catch-all ist absichtlich nicht gesetzt: sonst würde die Fehlerseite mit Status 200 ausgeliefert. `error_document` und `catchall_document` dürfen bei DigitalOcean nicht gleichzeitig stehen.

### Wenn Du die App von Hand anlegst

| Feld | Wert |
|---|---|
| Source | GitHub, Repository `mike20082015/spiel-freunde` |
| Branch | `main`, nachdem dieser Stand gemergt ist. Für eine Vorschau vorher den Feature-Branch nehmen. |
| Autodeploy | an, wenn jeder Push auf den Branch live gehen soll |
| Resource type | Static Site |
| Environment / Buildpack | HTML (`html`) |
| Source directory | `/` (Repository-Wurzel) |
| Output directory | `public` |
| Build command | leer lassen |
| Run command | keiner (Static Site) |
| Index document | `index.html` |
| Error document | `404.html` |
| Catch-all document | leer lassen |
| HTTP routes | `/` (Standard, ganze Domain) |
| Region | Frankfurt `fra`, steht so in der Spec. Anders wählen geht beim Anlegen. |
| Environment variables | an der Static Site keine. Schlüssel nur an der Functions-Komponente `api`, siehe unten. Nichts mit `VITE_`. |

Nach dem ersten Deploy die Domain `spiel-freunde.com` in den App-Einstellungen auf die Static Site legen.

### Cache

App Platform setzt bei Static Sites fest etwa **24 Stunden Cache am CDN** und etwa **10 Sekunden im Browser**. Ein Redeploy leert den CDN-Cache. Eigene `Cache-Control`-Header lassen sich an einer Static Site nicht pro Datei setzen (der Schalter für Edge-Cache gilt dort nicht).

Die Stimmen gleichen das aus: `public/skat/js/voice.js` legt die MP3s im Cache Storage unter `sf-skat-voice-v2` ab, dekodiert sie in AudioBuffer und hält einen kleinen Pool von Audio-Elementen bereit. Begrüßung und häufige Ansagen werden beim Öffnen vorgeladen. Sobald ein Satz in der Warteschlange liegt, startet der Download des nächsten. Zwischen zwei Sätzen gibt es keine zusätzliche Pause.

Falls später ein eigener Proxy davor steht, passen diese Header:

| Pfad | Cache-Control |
|---|---|
| `*.html` | `public, max-age=60` |
| `/skat/assets/voice/` | `public, max-age=31536000, immutable` |
| übrige Dateien unter `assets/` und `css/` und `js/` | `public, max-age=86400` |

## Freies Tischgespräch

Horst und Margarethe antworten im Chat über Grok. Sätze ohne fertige MP3 spricht ElevenLabs. Beides läuft in einer **Functions-Komponente** (Gratis-Kontingent). Der Browser sieht keine Schlüssel und keine `VITE_`-Variable.

Die Spiellogik bleibt in `public/skat/js/`. Die Functions liegen in `api/` (`project.yml`, Paket `sf`, Funktionen `chat`, `tts` und `avatar`). Lokal, mit Probebetrieb ohne echte Schlüssel:

```bash
node api/server.js --mock
```

Dann [http://127.0.0.1:8000/skat/](http://127.0.0.1:8000/skat/). Ohne `--mock` liest der Prozess die Variablen aus der Umgebung. `./skat/start.sh` bleibt der stille Python-Server: dort gibt es keine API, der Chat nutzt die festen Sprüche.

### Was Du in DigitalOcean einträgst

App `spiel-freunde`, Region Frankfurt `fra`. Die Static Site bleibt, wie sie ist: in der Spec heißt sie `web`, Quelle `/`, Ausgabe `public`, Branch `main`, Autodeploy an. Wenn die Komponente im Dashboard `spiel-freunde-public` heißt, den Namen angleichen, bevor Du die Spec anwendest. Sonst legt App Platform eine zweite Static Site an.

Neue Komponente, Typ **Function** (kein Web Service):

| Feld | Wert |
|---|---|
| Name | `api` |
| Source | dasselbe GitHub-Repo `mike20082015/spiel-freunde` |
| Branch | `main`, Autodeploy an |
| Source directory | `api` |
| HTTP-Route | `/api` |
| Instanzgröße | keine. Functions haben kein bezahltes Container-Abo. |

Umgebungsvariablen der Komponente `api`, Scope **RUN_AND_BUILD_TIME** (Bau- und Laufzeit). `project.yml` setzt die Platzhalter `${NAME}` beim Bauen ein. Die Werte gehören ins Dashboard, nicht ins Git.

| Name | Typ im Dashboard | Verschlüsselt | Wert |
|---|---|---|---|
| `XAI_API_KEY` | SECRET | ja | Schlüssel aus der xAI-Konsole |
| `ELEVENLABS_API_KEY` | SECRET | ja | Schlüssel aus ElevenLabs |
| `XAI_MODEL` | GENERAL, plain | nein | `grok-4.3` (die alten `grok-4-fast`-Namen leiten seit Mai 2026 dorthin um). Der Aufruf schickt nur `model`, `messages`, `max_tokens` und `temperature`. |
| `XAI_IMAGE_MODEL` | GENERAL, plain | nein | `grok-imagine-image-2.0` für das gezeichnete Gesicht unter `/api/sf/avatar`. |
| `AVATAR_DAILY_LIMIT` | GENERAL, plain | nein | `30` gezeichnete Gesichter je UTC-Tag in dieser Funktion. Dazu höchstens 4 je IP und Stunde. |
| `VOICE_MARGARETHE` | GENERAL, plain | nein | `28LWddKi67H2YN9L2PvK` |
| `VOICE_HORST` | GENERAL, plain | nein | ElevenLabs-Stimmen-ID von Horst. Liegt nicht im Repo. Ohne sie spricht Horst freie Sätze mit der Browserstimme. Die festen MP3s bleiben. |
| `ELEVEN_MODEL` | GENERAL, plain | nein | `eleven_flash_v2_5` (kurz und auf Deutsch; `eleven_turbo_v2_5` geht auch) |
| `DAILY_LIMIT` | GENERAL, plain | nein | `400` Aufrufe je Funktion und UTC-Tag, im Speicher der Instanz |

Die leeren SECRET-Zeilen in `.do/app.yaml` sind Platzhalter. Nach dem Eintragen im Dashboard nicht mit einer Spec überschreiben, in der die Schlüssel wieder leer sind. Wer per `doctl apps update --spec` arbeitet, holt vorher `doctl apps spec get` und übernimmt die verschlüsselten Werte. Diesen Export nicht committen.

Die Variablen müssen stehen, bevor die Functions zum ersten Mal gebaut werden. Danach ein Redeploy. Kontrolle im Browser: `https://<deine-app>.ondigitalocean.app/api/sf/chat` liefert `{"ok":true}`. Fehlt der xAI-Schlüssel, kommt 503, und der Tisch redet mit den festen Sprüchen.

DigitalOcean hängt an die Route noch Paket und Funktion. Mit Route `/api`, Paket `sf` und Funktion `chat` heißt der Pfad `/api/sf/chat` (analog `/api/sf/tts` und `/api/sf/avatar`). Das Paket heißt absichtlich nicht `default`: an das Paket `default` lassen sich keine Umgebungsvariablen hängen, der Bau bricht dann ab. Ein Pfad ohne Paketnamen, etwa `/api/chat`, antwortet mit 400 (`Incomplete web function path`). Der Browser probiert deshalb zuerst `/api/sf/chat` und `/api/sf/tts`, danach `/api/chat` und `/api/tts` (so der lokale Server). Die alten Pfade `/api/default/chat` und `/api/default/tts` bleiben ein letzter, harmloser Versuch. Das Gesicht geht denselben Weg: `/api/sf/avatar`, dann `/api/avatar`, dann `/api/default/avatar`.

Jede Funktion liegt vollständig in ihrem Ordner: `packages/sf/chat/`, `packages/sf/tts/` und `packages/sf/avatar/` enthalten `index.js` und eine Kopie von `lib/handlers.js`. Die Laufzeit packt nur diesen Ordner. `project.yml` setzt `main: index.main` (Datei `index.js`, Export `main`). Ein Dateiname an dieser Stelle sucht einen Export namens `js`, der Aufruf endet dann mit der Plattform-Meldung, bevor der eigene Code antwortet.

### Mein Avatar

Unter `/mein-avatar/` legt jemand den Namen fest und wählt ein echtes Foto (Zuschneiden im Browser, etwa 512 Pixel), ein gezeichnetes Gesicht oder eines der fertigen Bilder. Metadaten liegen im `localStorage`, das Bild in IndexedDB. Auf der Seite steht: „Dein Foto bleibt auf deinem Gerät.“ `window.SpielFreundeAvatar.playerSeat()` liefert Name und Bildadresse für Skat, Canasta und später Jass. Der Schlüssel für das gezeichnete Gesicht bleibt an der Function. Die Seite nennt keinen Anbieter.

### Kosten

Die Functions-Komponente kostet **0 Dollar**, solange das Gratis-Kontingent reicht: 90.000 GiB-Sekunden im Monat je Team, geteilt über alle Functions. Diese Funktionen haben 128 MB. Ein Aufruf von etwa 2 Sekunden verbraucht 0,25 GiB-Sekunden. Darüber liegen 0,0000185 Dollar je GiB-Sekunde. Es kommt kein Web-Service-Container dazu.

xAI und ElevenLabs rechnen getrennt. Grok 4.3 kostet 1,25 Dollar je Million Eingabe-Token und 2,50 Dollar je Million Ausgabe-Token. Ein Tischsatz ist ein Bruchteil davon. ElevenLabs hängt an Eurem Tarif. Das Modell `eleven_flash_v2_5` ist die günstige, kurze Stimme.

### Wenn die API fehlt

Der Browser fragt zuerst `GET /api/sf/chat` und, wenn das nicht antwortet, `GET /api/chat`. Kommt kein `{"ok":true}`, bleiben für diesen Besuch die festen Sprüche und die fertigen MP3s. Zwei fehlgeschlagene Chats hintereinander schalten genauso ab. Ein einzelner Aussetzer fällt nur für diese Zeile auf den Spruchvorrat zurück. Feste Spielsprüche mit MP3 gehen nie an ElevenLabs. Sätze ohne MP3, deren Stimme fehlschlägt, spricht der Browser. `?ai=0` schaltet das freie Gespräch für den Besuch aus. Während einer Antwort steht im Chat „Horst schreibt“ oder „Margarethe schreibt“. Während der Wiedergabe pausiert das Freisprechen wie bisher.

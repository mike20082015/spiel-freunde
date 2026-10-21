# Spiel-Freunde

Die besten Kartenspiele aus Deutschland, Österreich und der Schweiz.

Statische Website für [spiel-freunde.com](https://spiel-freunde.com). Deutsch, Du-Form. Kein Build-Schritt, keine Geheimnisse, keine `VITE_`-Variablen. Ein Angebot der Interconsult LLC.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite |
| `/mein-avatar/` | Name und Gesicht für den Tisch. Das Bild bleibt auf dem Gerät |
| `/spielpartner/` | Deine Spielpartner: Horst, Margarethe und die Premium-Runde. Eine Proberunde ohne Konto, danach 14 Testtage ab der ersten Anmeldung |
| `/anmelden/` | Anmeldelink aus der Mail. Der Zugangsschlüssel bleibt im Browser |
| `/skat/` | Spielbares Skat: Du gegen Horst und Margarethe |
| `/tisch/` | Privater Skat-Tisch für bis zu drei Freunde, mit Einladungscode |
| `/canasta/` | Spielbares Canasta: Du mit Margarethe gegen Horst und Oma Hilde |
| `/schafkopf/` | Spielbares Schafkopf: Du, Horst, Sepp und Margarethe |
| `/doppelkopf/` | Spielbares Doppelkopf: Du, Horst, Rüdiger und Margarethe |
| `/jass/` | Spielbarer Schieber: Du und Urs gegen Vreni und Horst |
| `/maumau/` | Spielbares Mau-Mau: Du, Horst, Margarethe und auf Wunsch Lena |
| `/romme/` | Spielbares Rommé: Du gegen Horst, Margarethe und Oma Hilde |
| `/schwimmen/` | Spielbares Schwimmen (31): Du gegen Horst, Lena und Chantal |
| `/elfer-raus/` | Spielbares Elfer raus: Du gegen Oma Hilde, Lena und Jonas |
| `/schnapsen/` | Spielbares Schnapsen: Du gegen Sepp, Bummerl bis 7 |
| `/watten/` | Spielbares Watten: Du und Sepp gegen Horst und Oma Hilde |
| `/bridge/` | Spielbares Rubber Bridge: Du und Margarethe gegen Jonas und Rüdiger. Chicago als Schalter |
| `/<partner>/` | Kurze Seite zum Teilen, zum Beispiel `/michael/`. Film, ein Satz, Button auf den Partnerlink. Unbekannte Slugs bleiben auf der Fehlerseite und der Button führt auf die Startseite |

Die großen Buttons auf der Startseite führen nach `/skat/`: „14 Tage kostenlos spielen“, „Jetzt Skat ausprobieren“, „Kostenlos testen“, „Jetzt starten“, „Skat wählen“ und „Alle Spiele wählen“. „Deine Spielpartner“ und die Leiste darunter führen nach `/spielpartner/`.

Veröffentlicht wird nur der Ordner `public/`. Tests, Werkzeuge und die Startskripte bleiben außerhalb.

```
public/                  Startseite, 404, /skat/, /canasta/, /schafkopf/, /jass/, /doppelkopf/, /maumau/, /romme/, /schwimmen/, /elfer-raus/, /schnapsen/, /watten/, /bridge/ und /mein-avatar/
skat/tests, skat/tools   Regeltests und Browser-Checks, nicht öffentlich
skat/start.sh            lokaler Server, nicht öffentlich
tools/                   Entwurf-Helfer der Startseite, nicht öffentlich
.do/app.yaml             App-Spec für DigitalOcean
tisch/                    Web-Service für den privaten Tisch, nicht im Static-Site-Ordner
```

## Lokal ansehen

```bash
cd public
python3 -m http.server 8000
```

Dann [http://localhost:8000/](http://localhost:8000/) und [http://localhost:8000/skat/](http://localhost:8000/skat/).

Oder im Ordner `skat/` das Startskript (`./start.sh`, `start.bat`, `start.command`). Es öffnet `/skat/`. Für das Mikrofon brauchst Du http://localhost, nicht file://.

## Tests

```bash
cd tisch && npm test
cd skat
node --test tests/
node --test ../jass/tests
node --test ../spielpartner/tests
cd ../canasta && node --test tests/
cd ../schafkopf && node --test tests/
cd ../doppelkopf && node --test tests/
cd ../maumau && node --test tests/
cd ../romme && node --test tests/
cd ../schwimmen && node --test tests/
cd ../elfer-raus && node --test tests/
cd ../schnapsen && node --test tests/
cd ../watten && node --test tests/
cd ../bridge && node --test tests/
node --test ../partners/tests
```

Die Spiellogik liegt in `public/skat/js/`. Details zum Skat stehen in `skat/README.md`.

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

## Partnerseiten

`https://spiel-freunde.com/michael/` ist die Seite des Inhabers. Dieselbe Vorlage gilt für jeden Slug aus [`partners/partners.json`](partners/partners.json). Oben der Film (16:9, auf schmalen Hochkant-Bildschirmen die senkrechte Fassung), darunter der Satz und der Button „Jetzt kostenlos spielen“. Geteilt wird die Seite mit Titel, Beschreibung und dem Poster unter `/media/promo/`.

Der Empfehlungscode steckt in `?ref=` an der Startseite. `public/spielpartner/entitlement.js` merkt sich den ersten Code 90 Tage (`sf-ref`) und schickt ihn bei der Anmeldung und an der Kasse mit. Die Basis dafür ist `https://lead-monster.net/api/public/spiel-freunde` (`/checkout`, `/license/verify`, `/signup-or-login`). Eine öffentliche Abfrage, die aus einem Slug den Code macht, gibt es dort nicht. Deshalb steht die Zuordnung in der JSON-Datei, nicht in einer neuen Umgebungsvariable und nicht in `.do/app.yaml`.

`michael` hat kein `ref`. Sein Button ist `https://spiel-freunde.com/`. Bei jedem anderen Partner wird aus `ref` der Link `https://spiel-freunde.com/?ref=<code>`. Ein unbekannter Slug, also eine Adresse ohne Ordner und ohne Eintrag, zeigt dieselbe Seite über `404.html`. Der Button führt dann auf `https://spiel-freunde.com/`. Bestehende Ordner (`/skat/`, `/tisch/`, `/anmelden/`, `/spielpartner/` und die übrigen) sind reserviert. Ein Catch-all ist nicht gesetzt, die Fehlerseite bleibt `404.html`.

### Neue Partnerseite anlegen

1. Die Person meldet sich kostenlos im [Partnerprogramm](https://lead-monster.net/partner) an und bekommt einen persönlichen Spiel-Freunde-Link. Der Code ist der Wert hinter `?ref=`.
2. In `partners/partners.json` einen Slug eintragen. Kleinbuchstaben, Ziffern, Bindestriche. Kein vorhandener Routenname.

```json
"anna": { "ref": "anna42" }
```

Daraus wird der Button `https://spiel-freunde.com/?ref=anna42`. Wer keinen Code haben soll, bekommt statt `ref` ein `href` auf `https://spiel-freunde.com/…`. Beides zugleich lehnt das Skript ab.

3. `node partners/build.js` ausführen. Das schreibt `public/<slug>/index.html`, aktualisiert `public/assets/partner-map.js` und den versteckten Block in `404.html`.
4. JSON, erzeugte Seite und Karte committen und auf `main` mergen. App Platform veröffentlicht den Ordner `public/` ohne Build. Danach gilt `https://spiel-freunde.com/<slug>/`.

Wer einen Slug wieder löscht, nimmt den Eintrag aus der JSON und führt das Skript erneut aus. Der Ordner verschwindet, die Adresse fällt auf die Startseite zurück.

## Freies Tischgespräch

Horst und Margarethe antworten im Chat über Grok. Sätze ohne fertige MP3 spricht ElevenLabs. Dieselben Grenzen gelten für Lena, Jonas, Ömer, Oma Hilde (`hilde` und `oma-hilde`), Sepp, Rüdiger und Chantal, dazu Urs und Vreni. Beides läuft in einer **Functions-Komponente** (Gratis-Kontingent). Der Browser sieht keine Schlüssel und keine `VITE_`-Variable.

Die neuen Stimmen haben eine feste Vorgabe im Code. `process.env.VOICE_LENA`, `VOICE_JONAS`, `VOICE_OEMER`, `VOICE_HILDE`, `VOICE_OMA_HILDE`, `VOICE_SEPP`, `VOICE_RUEDIGER` und `VOICE_CHANTAL` überschreiben sie zur Laufzeit, wenn sie gesetzt sind. Diese Namen stehen absichtlich nicht in `api/project.yml`: jeder `${...}`-Platzhalter dort muss in der App-Spec existieren.

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
| `ELEVEN_MODEL` | GENERAL, plain | nein | `eleven_v3` (höhere Qualität, Deutsch über `language_code`; `eleven_flash_v2_5` bleibt der schnelle Ersatz) |
| `DAILY_LIMIT` | GENERAL, plain | nein | `400` Aufrufe je Funktion und UTC-Tag, im Speicher der Instanz |

Die leeren SECRET-Zeilen in `.do/app.yaml` sind Platzhalter. Nach dem Eintragen im Dashboard nicht mit einer Spec überschreiben, in der die Schlüssel wieder leer sind. Wer per `doctl apps update --spec` arbeitet, holt vorher `doctl apps spec get` und übernimmt die verschlüsselten Werte. Diesen Export nicht committen.

Die Variablen müssen stehen, bevor die Functions zum ersten Mal gebaut werden. Danach ein Redeploy. Kontrolle im Browser: `https://<deine-app>.ondigitalocean.app/api/sf/chat` liefert `{"ok":true}`. Fehlt der xAI-Schlüssel, kommt 503, und der Tisch redet mit den festen Sprüchen.

DigitalOcean hängt an die Route noch Paket und Funktion. Mit Route `/api`, Paket `sf` und Funktion `chat` heißt der Pfad `/api/sf/chat` (analog `/api/sf/tts` und `/api/sf/avatar`). Das Paket heißt absichtlich nicht `default`: an das Paket `default` lassen sich keine Umgebungsvariablen hängen, der Bau bricht dann ab. Ein Pfad ohne Paketnamen, etwa `/api/chat`, antwortet mit 400 (`Incomplete web function path`). Der Browser probiert deshalb zuerst `/api/sf/chat` und `/api/sf/tts`, danach `/api/chat` und `/api/tts` (so der lokale Server). Die alten Pfade `/api/default/chat` und `/api/default/tts` bleiben ein letzter, harmloser Versuch. Das Gesicht geht denselben Weg: `/api/sf/avatar`, dann `/api/avatar`, dann `/api/default/avatar`.

Jede Funktion liegt vollständig in ihrem Ordner: `packages/sf/chat/`, `packages/sf/tts/` und `packages/sf/avatar/` enthalten `index.js` und eine Kopie von `lib/handlers.js`. Die Laufzeit packt nur diesen Ordner. `project.yml` setzt `main: index.main` (Datei `index.js`, Export `main`). Ein Dateiname an dieser Stelle sucht einen Export namens `js`, der Aufruf endet dann mit der Plattform-Meldung, bevor der eigene Code antwortet.

### Mein Avatar

Unter `/mein-avatar/` legt jemand den Namen fest und wählt ein echtes Foto (Zuschneiden im Browser, etwa 512 Pixel), ein gezeichnetes Gesicht oder eines der fertigen Bilder. Metadaten liegen im `localStorage`, das Bild in IndexedDB. Auf der Seite steht: „Dein Foto bleibt auf deinem Gerät.“ `window.SpielFreundeAvatar.playerSeat()` liefert Name und Bildadresse für Skat, Canasta und später Jass. Der Schlüssel für das gezeichnete Gesicht bleibt an der Function. Die Seite nennt keinen Anbieter.

### Kosten

Die Functions-Komponente kostet **0 Dollar**, solange das Gratis-Kontingent reicht: 90.000 GiB-Sekunden im Monat je Team, geteilt über alle Functions. Diese Funktionen haben 128 MB. Ein Aufruf von etwa 2 Sekunden verbraucht 0,25 GiB-Sekunden. Darüber liegen 0,0000185 Dollar je GiB-Sekunde. Es kommt kein Web-Service-Container dazu.

xAI und ElevenLabs rechnen getrennt. Grok 4.3 kostet 1,25 Dollar je Million Eingabe-Token und 2,50 Dollar je Million Ausgabe-Token. Ein Tischsatz ist ein Bruchteil davon. ElevenLabs hängt an Eurem Tarif. Das Modell `eleven_v3` spricht die kurzen Sätze auf Deutsch in höherer Qualität. Die Funktion verlangt MP3 mit 44,1 kHz und 192 kbps. Lehnt die Schnittstelle dieses Format ab, bleibt es beim bisherigen MP3 mit 22,05 kHz und 32 kbps.

### Wenn die API fehlt

Der Browser fragt zuerst `GET /api/sf/chat` und, wenn das nicht antwortet, `GET /api/chat`. Kommt kein `{"ok":true}`, bleiben für diesen Besuch die festen Sprüche und die fertigen MP3s. Zwei fehlgeschlagene Chats hintereinander schalten genauso ab. Ein einzelner Aussetzer fällt nur für diese Zeile auf den Spruchvorrat zurück. Feste Spielsprüche mit MP3 gehen nie an ElevenLabs. Sätze ohne MP3, deren Stimme fehlschlägt, spricht der Browser. `?ai=0` schaltet das freie Gespräch für den Besuch aus. Während einer Antwort steht im Chat „Horst schreibt“ oder „Margarethe schreibt“. Während der Wiedergabe pausiert das Freisprechen wie bisher.

## Privater Tisch

Unter `/tisch/` macht jemand einen Skat-Tisch für bis zu drei Freunde auf. Der Gastgeber bekommt einen Code aus sechs Zeichen und einen Link `/tisch/?code=…`. Wer den Link öffnet oder den Code eintippt, setzt sich mit einem Namen dazu. Leere Plätze füllt der Gastgeber mit einem Spielpartner, Horst und Margarethe immer, die übrigen nur bei Test oder Premium in diesem Browser. Ein kurzer Textchat läuft über den Tisch. Die Stimmen der Spielpartner bleiben die vorhandenen: feste MP3s und, wenn nötig, `/api/sf/tts`. Dafür liegt kein Schlüssel im Browser.

Gemischt und gegeben wird nur auf dem Server. Jeder Browser bekommt die Sicht aus `SkatEngine.viewFor`: eigene Karten, öffentliche Stiche, den Skat nur, wenn Du ihn selbst aufgenommen hast. Kontra und Re laufen wie am Solotisch, bevor die erste Karte kommt. Die KI auf einem leeren Platz sieht dieselbe Sicht und schummelt nicht. Sie nutzt `public/skat/js/ai.js`.

### Ablauf im Dienst

Der Dienst liegt in `tisch/` und ist eine **Web-Service-Komponente**, nicht eine Function. Functions haben keinen gemeinsamen Speicher und kein WebSocket. Eine Instanz hält die Tische im RAM, schiebt Änderungen über `/api/tisch/ws` und beantwortet zusätzlich `POST /api/tisch/poll`, falls die Leitung kurz weg ist. Nach einem Neuladen gilt derselbe Platz-Token aus `localStorage`. Ohne Aktion (auch ohne offene Seite, die alle 1,5 Sekunden nachfragt) läuft ein Tisch nach 45 Minuten ab.

Lokal steckt derselbe Dienst in `node api/server.js`, auch mit `--mock`. Auf App Platform ist er getrennt, Route `/api/tisch`, Port 8080, `instance_count: 1`, kleinste Instanz `apps-s-1vcpu-0.5gb`. Das Image baut `tisch/Dockerfile` mit Kontext `/`, weil der Prozess `public/skat/js/engine.js` und `ai.js` braucht. Das steht in `.do/app.yaml`. Die Static Site und die Function `api` bleiben. Es kommt ein bezahlter Container dazu, grob der kleinste Basic-Tarif. Nicht selbst deployen.

### Lizenz

Der Zähler bleibt im Browser, wie am Solotisch. **Der Gastgeber** muss `SpielpartnerRounds.gate()` schaffen, bevor der Server das erste und jedes weitere Spiel gibt. **Jeder Mensch am Tisch** ruft nach einem beendeten Spiel `finish()` auf, damit die drei freien Runden hier mitzählen und der private Tisch kein unbegrenzt nebenbei ist. Test und gültige Lizenz bleiben unbegrenzt. Spielpartner zählen nicht. Der Server kennt keine Lizenz und speichert keinen Schlüssel.

### Turnier später, K.-o., hier nicht gebaut

`createRoom({ tournamentId, roundId, target, seats })` legt einen Tisch programmatisch an. `seats` kommt in der genannten Reihenfolge auf Platz 0, 1 und 2, der Server vergibt die Nummern. `target` ist das Rundenziel, Standard **301**, dieselbe Spanne wie „Spielen bis“ (51 bis 2001, oder ohne Limit). Erreicht jemand das Ziel und liegt allein vorn, wird der Tisch `ended`. Der ResultStore schreibt je Spiel und je Serie einen Satz **ohne Karten und ohne Tokens**: Sieger, Endstand, `externalId`, `playerId`, `tournamentId`, `roundId`. Eine Serie bleibt abfragbar, auch wenn der Tisch danach abläuft.

Ein Platz kann später eine `playerId` aus dem Spiel-Freunde-Konto tragen (LeadMonster, `/api/public/spiel-freunde`, nach `me`). Die setzt nur `createRoom` oder `join` im Prozess, zum Beispiel aus dem Admin-Aufruf, nachdem das Konto woanders geprüft wurde. Die öffentliche Seite nimmt sie nicht an: dort reicht der Anzeigename. Dieser Dienst macht keinen eigenen Login, keine Magic Links und speichert keine E-Mail. In der Live-Sicht sieht jeder nur die eigene `playerId`, die anderen Plätze bleiben beim Namen. Im Ergebnis steht sie am Sieger, damit das Konto später drankommt.

`POST /api/tisch/rooms` und `GET /api/tisch/results?tournamentId=` gehen nur mit `Authorization: Bearer`, und nur wenn `TISCH_ADMIN_TOKEN` in der Umgebung des Dienstes steht. Sonst ist die Route 404. Diesen Namen nicht in `api/project.yml` setzen und nicht ins Frontend legen. `TISCH_DATA_DIR` schreibt die Sätze optional als JSON-Zeilen. Ohne den Ordner bleiben sie im Prozess. Die Platte einer App-Platform-Instanz überlebt kein neues Deploy. Für ein echtes Turnier den ResultStore später gegen eine Datenbank tauschen, weiter nur serverseitig.

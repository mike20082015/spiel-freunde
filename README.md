# Spiel-Freunde

Die besten Kartenspiele aus Deutschland, Österreich und der Schweiz.

Statische Website für [spiel-freunde.com](https://spiel-freunde.com). Deutsch, Du-Form. Kein Build-Schritt, keine Geheimnisse, keine `VITE_`-Variablen. Inhaber: Michael Manns.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite |
| `/skat/` | Spielbarer Skat-Prototyp: Du gegen Horst und Margarethe |

In der Vorschau führen die großen Buttons auf der Startseite nach `/skat/`: „14 Tage kostenlos spielen“, „Jetzt Skat ausprobieren“, „Kostenlos testen“, „Jetzt starten“, „Skat wählen“ und „Alle Spiele wählen“. Beide Seiten tragen ein goldenes Band „Vorschau“.

Veröffentlicht wird nur der Ordner `public/`. Tests, Werkzeuge und die Startskripte bleiben außerhalb.

```
public/                  Startseite, 404 und /skat/
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
| Environment variables | keine. Keine Schlüssel, nichts mit `VITE_`. |

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

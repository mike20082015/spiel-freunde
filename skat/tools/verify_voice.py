"""Browser-Check für Stimmen, Mitreden, Rundenziel und Spielstärke (headless Chrome).
Aufruf: python3 tools/verify_voice.py
Prüft: keine Konsolenfehler, MP3s werden angefragt und abgespielt, Einstellungen bleiben nach Neuladen erhalten,
Mikrofon-Knopf nur im Modus "Mit Stimme", Hinweis bei fehlender Spracherkennung, Siegerehrung bei erreichtem Ziel.
Macht dabei Screenshots in screenshots/."""
import asyncio, subprocess, sys, time, os, json
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("shoot", os.path.join(os.path.dirname(os.path.abspath(__file__)), "shoot.py"))
src = open(spec.origin).read().replace("asyncio.run(main())", "")
shoot = {"__file__": spec.origin}
exec(compile(src, spec.origin, "exec"), shoot)
DRIVE, drive_until = shoot["DRIVE"], shoot["drive_until"]

SKAT_DEV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(os.path.dirname(SKAT_DEV), "public")
OUT = os.path.join(SKAT_DEV, "screenshots")
PORT = 8766
SPY = """() => {
  window.__plays = []; window.__synth = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); return orig.call(this); };
  if (window.speechSynthesis) { const o = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = (u) => { window.__synth.push(u.text); return o(u); }; }
}"""
results = []
def check(name, ok, info=""):
    results.append((name, ok)); print(("OK   " if ok else "FAIL ") + name + (" | " + str(info) if info else ""))

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    errs, mp3req = [], []
    base = f"http://localhost:{PORT}/skat/index.html"
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=user-gesture-required"])
            async def new_page(w, h, extra_init=None):
                ctx = await b.new_context(viewport={"width": w, "height": h})
                await ctx.add_init_script("(" + SPY + ")()")
                if extra_init: await ctx.add_init_script(extra_init)
                pg = await ctx.new_page()
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("requestfailed", lambda r: errs.append("FAILED " + r.url))
                pg.on("response", lambda r: mp3req.append((r.url, r.status)) if "/assets/voice/" in r.url else None)
                return ctx, pg

            ctx, pg = await new_page(1440, 900)
            await pg.goto(base + "?fresh=1&speed=fast&seed=3", wait_until="networkidle")
            check("Begrüßung sichtbar vor dem Start", await pg.is_visible("#intro"))
            check("Standard: Ton an", await pg.get_attribute("#btn-sound", "aria-pressed") == "true")
            check("Standard: Nur Chat, kein Mikrofon-Knopf", await pg.is_hidden("#btn-mic"))
            check("Standard: Spielstärke Kneipe in der Oberleiste", (await pg.inner_text("#level-label")) == "Kneipe")
            check("Vor dem ersten Klick wird nichts abgespielt", await pg.evaluate("() => window.__plays.length") == 0)
            await pg.click("#btn-start")
            await pg.wait_for_timeout(2500)
            plays = await pg.evaluate("() => window.__plays")
            check("Nach dem Start: Begrüßung als MP3 abgespielt", any("/assets/voice/margarethe/l-welcome-0.mp3" in x for x in plays), plays[:3])
            await pg.wait_for_selector(".seat.speaking", timeout=15000)
            check("Sprechende Figur bekommt Leuchtring (.speaking)", True)
            # Chat mit Antwort
            await drive_until(pg, "() => { const st = window.__skat.state; return st && st.phase==='play' && st.turn===0 && document.querySelector('#hand .card.playable'); }", 120)
            n0 = await pg.evaluate("() => window.__plays.length")
            await pg.fill("#chat-input", "Hallo ihr beiden!")
            await pg.press("#chat-input", "Enter")
            new = []
            for _ in range(30):
                await pg.wait_for_timeout(500)
                new = await pg.evaluate(f"() => window.__plays.slice({n0})")
                if any("/r-greet-" in x for x in new): break
            check("Chat-Antwort wird gesprochen (Antwort-MP3)", any("/r-greet-" in x for x in new), new)
            # Mitreden umschalten
            await pg.click("#btn-talk")
            check("Mit Stimme: Mikrofon-Knopf sichtbar", await pg.is_visible("#btn-mic"))
            # Screenshot: sprechende Figur mit Mikrofon
            await pg.evaluate("() => { const s = window.__skat; s.voice.stopAll(); }")
            await pg.wait_for_timeout(300)
            await pg.fill("#chat-input", "Margarethe, wie war die Kreuzfahrt?")
            await pg.press("#chat-input", "Enter")
            await pg.wait_for_selector("#seat-2.speaking", timeout=8000)
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=os.path.join(OUT, "12-sprechende-figur-mikrofon-1440.png"))
            # Einstellungen ändern
            await pg.click("#btn-settings")
            await pg.check("input[name=level][value=turnier]")
            await pg.check("input[name=target][value=custom]")
            await pg.fill("#target-custom", "750")
            await pg.press("#target-custom", "Tab")
            await pg.fill("#opt-volume", "55")
            await pg.dispatch_event("#opt-volume", "change")
            await pg.wait_for_timeout(300)
            await pg.set_viewport_size({"width": 1440, "height": 1100})
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, "13-einstellungen-alle-optionen-1440.png"))
            await pg.set_viewport_size({"width": 1440, "height": 900})
            await pg.click("#modal-settings [data-close]")
            check("Spielstärke sofort in der Oberleiste", (await pg.inner_text("#level-label")) == "Turnier")
            check("Ziel in der Punkteliste", "750" in await pg.inner_text("#target-info"))
            await pg.click("#btn-sound")
            mp3_ok = [u for (u, st) in mp3req if st in (200, 206, 304)]
            check("MP3s wurden vom Server geladen", len(mp3_ok) >= 3, len(mp3_ok))
            # Neu laden: alles gespeichert?
            await pg.goto(base + "?speed=fast&seed=3", wait_until="networkidle")
            s = await pg.evaluate("() => JSON.parse(localStorage.getItem('sf-skat-settings'))")
            check("Gespeichert: level=turnier, target=custom 750, volume 55, talk voice, sound aus",
                  s["level"] == "turnier" and s["target"] == "custom" and s["targetCustom"] == 750 and s["volume"] == 55 and s["talk"] == "voice" and s["sound"] is False, s)
            check("Nach Neuladen: Mikrofon-Knopf da, Ton-Knopf aus", await pg.is_visible("#btn-mic") and await pg.get_attribute("#btn-sound", "aria-pressed") == "false")
            await pg.click("#btn-start")
            await pg.wait_for_timeout(3000)
            check("Ton aus: keine Wiedergabe", await pg.evaluate("() => window.__plays.length + window.__synth.length") == 0)
            check("Turnier-KI aktiv im laufenden Spiel", await pg.evaluate("() => document.getElementById('btn-level').dataset.level") == "turnier")
            await ctx.close()

            # Browser ohne Spracherkennung (z. B. Firefox): Hinweis statt Mikrofon
            ctx, pg = await new_page(1440, 900, "delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
            await pg.goto(base + "?fresh=1&speed=fast", wait_until="networkidle")
            await pg.click("#btn-start")
            await pg.click("#btn-talk")
            check("Ohne Spracherkennung: kein Mikrofon, dafür Hinweis", await pg.is_hidden("#btn-mic") and await pg.is_visible("#mic-hint"), await pg.inner_text("#mic-hint"))
            await ctx.close()

            # Siegerehrung: Ziel 301, Punktestand kurz davor
            ctx, pg = await new_page(1440, 900)
            await pg.goto(base + "?fresh=1&speed=fast&seed=21", wait_until="networkidle")
            await pg.evaluate("""() => { localStorage.setItem('sf-skat-settings', JSON.stringify({ speed: 'fast', target: '301', level: 'kneipe' }));
               localStorage.setItem('sf-skat-match', JSON.stringify({ scores: [290, 270, 280], dealer: 2, queue: [], gameNo: 14, rows: [{ no: 14, label: 'Horst: Kreuz', change: [0, 48, 0], totals: [290, 270, 280] }] })); }""")
            await pg.goto(base + "?speed=fast&seed=21", wait_until="networkidle")
            check("Ziel 301 mit Fortschritt in der Punkteliste", "301" in await pg.inner_text("#target-info"))
            await pg.screenshot(path=os.path.join(OUT, "14-ziel-fortschritt-1440.png"), clip={"x": 1080, "y": 64, "width": 360, "height": 420})
            reached = False
            for g in range(25):
                await drive_until(pg, "() => !document.getElementById('modal-summary').hidden || !document.getElementById('modal-session').hidden", 150)
                if await pg.is_visible("#modal-session"):
                    reached = True; break
                await pg.click("#summary [data-a=next]")
                await pg.wait_for_timeout(300)
                if await pg.is_visible("#modal-session"):
                    reached = True; break
            check("Siegerehrung erscheint, wenn das Ziel erreicht ist", reached)
            if reached:
                await pg.wait_for_timeout(1800)
                await pg.screenshot(path=os.path.join(OUT, "15-siegerehrung-1440.png"))
                await pg.click("#session [data-a=new]")
                await pg.wait_for_timeout(500)
                sc = await pg.evaluate("() => window.__skat.match.scores")
                check("Neue Runde setzt die Punkteliste zurück", sc == [0, 0, 0], sc)
            await ctx.close()

            # Handy: Oberleiste und Mikrofon
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(base + "?fresh=1&speed=fast&seed=3", wait_until="networkidle")
            await pg.evaluate("() => localStorage.setItem('sf-skat-settings', JSON.stringify({ speed: 'fast', talk: 'voice', level: 'anfaenger', target: '501' }))")
            await pg.goto(base + "?fresh=1&speed=fast&seed=3", wait_until="networkidle")
            await pg.screenshot(path=os.path.join(OUT, "16-handy-begruessung-390.png"))
            await pg.tap("#btn-start")
            await drive_until(pg, "() => { const st = window.__skat.state; return st && st.phase==='play' && st.tricks.length>=1 && st.turn===0 && document.querySelector('#hand .card.playable'); }", 120)
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, "17-handy-spiel-390.png"))
            await pg.screenshot(path=os.path.join(OUT, "18-handy-chat-mikrofon-390.png"), full_page=True)
            await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    check("Keine Konsolenfehler", not errs, errs[:5])
    print(f"\n{sum(1 for _, ok in results if ok)}/{len(results)} Checks bestanden")

asyncio.run(main())

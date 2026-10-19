"""Screenshots des Skat-Prototyps mit Playwright (headless Chrome).
Aufruf: python3 tools/shoot.py   (startet selbst einen http.server auf Port 8765)
"""
import asyncio, subprocess, sys, time, os
from playwright.async_api import async_playwright

SKAT_DEV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(os.path.dirname(SKAT_DEV), "public")
OUT = os.path.join(SKAT_DEV, "screenshots")
PORT = 8765
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7

DRIVE = """() => {
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) { document.getElementById('btn-start').click(); return 'start'; }
  const S = window.__skat, st = S.state, E = S.E;
  if (!st) return 'wait';
  const panel = document.getElementById('panel');
  if (!document.getElementById('modal-summary').hidden) return 'summary';
  if (st.phase === 'bidding') {
    const t = E.biddingTurn(st);
    if (t.player !== 0 || panel.hidden) return 'wait';
    const yes = SkatAI.decideBid(E.viewFor(st, 0), t, 'neutral');
    panel.querySelector(yes ? '[data-a=yes]' : '[data-a=no]').click();
    return 'bid';
  }
  if (st.declarer === 0 && st.phase === 'skat' && !panel.hidden) {
    const d = SkatAI.decideSkat(E.viewFor(st, 0), 'neutral');
    panel.querySelector(d.hand ? '[data-a=hand]' : '[data-a=take]').click(); return 'skat';
  }
  if (st.declarer === 0 && st.phase === 'discard' && !panel.hidden) {
    const d = SkatAI.chooseDiscardAndGame(E.viewFor(st, 0), 'neutral');
    window.__plannedGame = d.game;
    for (const c of d.discard) document.querySelector('#hand .card[data-card="' + c + '"]').click();
    document.querySelector('#panel [data-a=ok]').click(); return 'discard';
  }
  if (st.declarer === 0 && st.phase === 'declare' && !panel.hidden) {
    const g = window.__plannedGame || SkatAI.decideSkat(E.viewFor(st, 0), 'neutral').game || {type:'suit',trump:'C'};
    const key = g.type === 'grand' ? 'G' : g.type === 'null' ? (g.ouvert ? 'NO' : 'N') : g.trump;
    document.querySelector('#panel [data-k="' + key + '"]').click();
    document.querySelector('#panel [data-a=ok]').click(); return 'declare';
  }
  if (st.phase === 'play' && st.turn === 0) {
    const el = document.querySelector('#hand .card.playable');
    if (!el) return 'wait';
    const sug = SkatAI.chooseCard(E.viewFor(st, 0), 'neutral').card;
    const target = document.querySelector('#hand .card.playable[data-card="' + sug + '"]') || el;
    target.click(); return 'play';
  }
  return 'wait';
}"""

async def drive_until(pg, cond_js, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            ok = await pg.evaluate(cond_js)
        except Exception:
            ok = False
        if ok:
            return True
        r = await pg.evaluate(DRIVE)
        await pg.wait_for_timeout(250 if r == 'wait' else 400)
    raise RuntimeError("Timeout: " + cond_js)

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    errs = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

            async def new_page(w, h, mobile=False):
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
                pg = await ctx.new_page()
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("requestfailed", lambda r: errs.append("FAILED " + r.url))
                return ctx, pg

            base = f"http://localhost:{PORT}/skat/index.html?fresh=1&speed=fast&seed={SEED}"
            ctx, pg = await new_page(1440, 900)
            await pg.goto(base, wait_until="networkidle")
            # 1) Reizen: warten bis Du beim Reizen dran bist
            await drive_until(pg, "() => { const st = window.__skat.state; const t = st.phase==='bidding' && window.__skat.E.biddingTurn(st); return t && t.player===0 && !document.getElementById('panel').hidden; }")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(OUT, "01-reizen-1440.png"))
            # 2) Spielmitte mit Sprechblase
            await drive_until(pg, "() => { const st = window.__skat.state; return st.phase==='play' && st.tricks.length>=4 && st.turn===0 && document.querySelector('#hand .card.playable'); }")
            await pg.fill("#chat-input", "Hallo zusammen, gut Blatt!")
            await pg.press("#chat-input", "Enter")
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=os.path.join(OUT, "02-spielmitte-sprechblase-1440.png"))
            # 3) Regeln lernen an
            await pg.click("#btn-hint")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, "03-regeln-lernen-1440.png"))
            await pg.click("#btn-hint")
            # 4) Abrechnung
            await drive_until(pg, "() => !document.getElementById('modal-summary').hidden", 120)
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=os.path.join(OUT, "04-abrechnung-1440.png"))
            # 5) Letzter Stich und Einstellungen
            await pg.click("#summary [data-a=next]")
            await pg.wait_for_timeout(400)
            await pg.click("#btn-settings")
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, "05-einstellungen-1440.png"))
            await ctx.close()

            # Tablet und Handy: Spielmitte
            for (w, h, mobile, name) in [(1024, 768, False, "06-tablet-1024x768.png"), (768, 1024, True, "07-tablet-hoch-768x1024.png"), (390, 844, True, "08-handy-390x844.png")]:
                ctx, pg = await new_page(w, h, mobile)
                await pg.goto(base, wait_until="networkidle")
                await drive_until(pg, "() => { const st = window.__skat.state; return st.phase==='play' && st.tricks.length>=2 && st.turn===0 && document.querySelector('#hand .card.playable'); }")
                await pg.wait_for_timeout(600)
                await pg.screenshot(path=os.path.join(OUT, name))
                await ctx.close()
            # Ansage-Dialog: Spiel suchen, in dem Du Alleinspieler wirst (mit Regeln lernen)
            ctx, pg = await new_page(1440, 900)
            await pg.goto(f"http://localhost:{PORT}/skat/index.html?fresh=1&speed=fast&seed=101", wait_until="networkidle")
            await pg.click("#btn-hint")
            found = False
            for g in range(12):
                cond = "() => { const st = window.__skat.state; return (st.declarer===0 && st.phase==='discard' && !document.getElementById('panel').hidden) || !document.getElementById('modal-summary').hidden; }"
                await drive_until(pg, cond, 120)
                if await pg.evaluate("() => window.__skat.state.phase==='discard'"):
                    found = True
                    break
                await pg.click("#summary [data-a=next]")
            if found:
                # zwei Karten wählen wie die KI und den Ansage-Dialog zeigen
                await pg.evaluate("""() => { const S = window.__skat, st = S.state; const d = SkatAI.chooseDiscardAndGame(S.E.viewFor(st,0),'neutral'); window.__plannedGame = d.game;
                   for (const c of d.discard) document.querySelector('#hand .card[data-card="'+c+'"]').click(); }""")
                await pg.wait_for_timeout(400)
                await pg.screenshot(path=os.path.join(OUT, "09-druecken-tipp-1440.png"))
                await pg.click("#panel [data-a=ok]")
                await pg.wait_for_timeout(300)
                g = await pg.evaluate("() => window.__plannedGame")
                key = 'G' if g['type']=='grand' else ('NO' if g.get('ouvert') else 'N') if g['type']=='null' else g['trump']
                await pg.click(f'#panel [data-k="{key}"]')
                await pg.wait_for_timeout(300)
                await pg.screenshot(path=os.path.join(OUT, "10-ansage-1440.png"))
            await ctx.close()

            # Dauertest im Browser: 12 Spiele Kneipenskat am Stück
            ctx, pg = await new_page(1280, 800)
            await pg.goto(f"http://localhost:{PORT}/skat/index.html?fresh=1&speed=fast&seed=5", wait_until="networkidle")
            await pg.evaluate("() => { localStorage.setItem('sf-skat-settings', JSON.stringify({mode:'kneipe',deck:'four',speed:'fast',hints:false})); }")
            await pg.goto(f"http://localhost:{PORT}/skat/index.html?fresh=1&speed=fast&seed=5", wait_until="networkidle")
            for g in range(12):
                await drive_until(pg, "() => !document.getElementById('modal-summary').hidden", 120)
                if g == 11:
                    await pg.screenshot(path=os.path.join(OUT, "11-kneipenskat-nach-12-spielen.png"))
                await pg.click("#summary [data-a=next]")
            rows = await pg.evaluate("() => window.__skat.match.rows.map(r => r.label)")
            print("Browser-Dauertest Kneipenskat:", len(rows), "Spiele:", rows)
            await pg.evaluate("() => { localStorage.removeItem('sf-skat-settings'); }")
            await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    print("Konsolenfehler:", errs if errs else "keine")

asyncio.run(main())

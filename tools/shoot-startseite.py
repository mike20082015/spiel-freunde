"""Screenshots der Startseite mit Playwright (headless Chrome).
Aufruf aus dem Repository: python3 tools/shoot-startseite.py
Startet selbst einen http.server auf public/ (Port 8765).
"""
import asyncio, subprocess, sys, time, os
from playwright.async_api import async_playwright

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
PORT = 8765

async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.6)
    base = f"http://127.0.0.1:{PORT}/"
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
            async def shot(w, h, name, full, mobile=False):
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
                pg = await ctx.new_page()
                errs = []
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(base + ("?static=1" if full else ""), wait_until="networkidle")
                await pg.wait_for_timeout(1200)
                await pg.screenshot(path=os.path.join(OUT, name), full_page=full)
                print(name, errs or "ok")
                await ctx.close()
            await shot(1440, 900, "desktop-hero-1440x900.png", False)
            await shot(1440, 900, "desktop-full-1440.png", True)
            await shot(390, 844, "mobile-full-390.png", True, True)
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())

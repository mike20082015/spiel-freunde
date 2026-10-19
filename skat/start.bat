@echo off
rem Skat-Prototyp starten (Windows: Doppelklick)
rem Startet einen kleinen Webserver auf http://localhost:8000 und oeffnet den Browser.
rem Noetig fuer die Spracheingabe (Mikrofon), die von file:// aus nicht funktioniert.
cd /d "%~dp0..\public"
set PORT=8000
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%/skat/"
echo Skat laeuft auf http://localhost:%PORT%/skat/  (Fenster offen lassen, Strg+C beendet)
%PY% -m http.server %PORT% --bind 127.0.0.1
pause

@echo off
cd /d "%~dp0"
echo Starting Schlaue10 Quiz...
echo.
echo Server wird gestartet...
start /B npm start
echo Warte 3 Sekunden...
timeout /t 3 /nobreak >nul
echo Oeffne Spiel im Browser...
start "" "chrome.exe" --app=http://localhost:5173
echo.
echo Das Spiel sollte sich nun im Browser oeffnen.
echo Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.
pause

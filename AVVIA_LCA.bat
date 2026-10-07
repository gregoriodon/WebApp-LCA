@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  start "LCA GrInnZoVe - server locale" /min py -m http.server 8000 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:8000/index.html"
  exit /b
)
where python >nul 2>&1
if %errorlevel%==0 (
  start "LCA GrInnZoVe - server locale" /min python -m http.server 8000 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:8000/index.html"
  exit /b
)
echo Python non risulta installato.
echo Apro direttamente index.html.
start "" "index.html"
pause

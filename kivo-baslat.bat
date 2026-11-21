@echo off
cd /d "%~dp0"

start "Kivo Backend" cmd /k "cd server && npm run dev"
start "Kivo Frontend" cmd /k "cd client && npm run dev"

rem Sunucular acilsin diye 5 saniye bekle, sonra tuneli baslat
timeout /t 5 /nobreak >nul
start "Kivo Tunel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173"
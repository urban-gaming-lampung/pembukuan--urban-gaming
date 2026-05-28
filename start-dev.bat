@echo off
cd /d "%~dp0"

echo [INFO] Memulai server Vite...
echo ---------------------------------
echo.

if not exist package.json (
  echo [ERROR] package.json tidak ditemukan!
  pause
  exit /b
)

if not exist node_modules (
  echo [INFO] Menginstall dependency...
  call npm install
)

echo.
echo [INFO] Menjalankan npm run dev...
echo ---------------------------------
echo.

call npm run dev -- --open

echo.
echo [INFO] Jika server berhenti, tekan Ctrl+C untuk menutup.
echo.
pause

@echo off
echo [1/4] Menghapus folder lama...
if exist docs (rd /s /q docs)
if exist dist (rd /s /q dist)

echo [2/4] Menjalankan build produksi (Vite + TS)...
call npm run build

echo [3/4] Menyiapkan folder docs untuk GitHub Pages...
:: Mengubah nama folder dist menjadi docs
ren dist docs

:: Opsional: Menambahkan file .nojekyll agar GitHub tidak mengabaikan folder dengan underscore
echo. > docs/.nojekyll

echo [4/4] Selesai! Folder 'docs' siap di-upload ke GitHub.
echo Pastikan di pengaturan GitHub Repository > Pages:
echo Set "Build and deployment" ke "Deploy from a branch" 
echo Dan pilih folder "/docs".
pause
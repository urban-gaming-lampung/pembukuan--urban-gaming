# Pembukuan URBAN — panduan kerja

Aplikasi pembukuan rental PS & usaha jualan URBAN Gaming (Vite + React + TypeScript + Tailwind + Firebase).

## Wajib dibaca sebelum mengubah UI
**`src/ui/DESIGN.md`** — URBAN Design System (UDS): filosofi Apple iOS minimalis, *mobile-first* 390px, token warna / huruf / sudut, komponen `src/ui`, pola halaman, aturan warna surplus / minus, aturan grafik.

- Pakai komponen dari `src/ui` (`Card`, `SectionHeader`, `ListRow`, `LineItem`, `Amount`, `StatTile`, `BarRow`, `SubTabs`, …) dan token Tailwind (`bg-surface`, `text-label-2`, `text-headline`, `rounded-card`, …).
- Jangan menulis warna hex / ukuran huruf / sudut arbitrer di halaman; tambahkan token dulu bila perlu.
- Bahasa UI: Indonesia, huruf kalimat.

## Satu sumber (SSOT)
- Format angka: `src/lib/format.ts` (`rupiah`, `rupiahTanda`, `rpShort`, `persen`, `toInt`).
- Tanggal & hari kerja (ganti hari pukul 06.00): `src/lib/dateLocal.ts`.
- Uang rental / usaha, periode filter: `src/lib/keuangan.ts`. Target harian: `src/lib/laporan.ts`.
- Stok & penjualan POS: `src/lib/stokJualan.ts`, `src/lib/posSales.ts`, `src/lib/barangJualan.ts`.
- Tukar tambah: `src/lib/tukarTambah.ts`. Uang yang berpindah di nota = `bayarNota(s)` (= `total` − `nilaiTukar`, bisa minus = URBAN bayar ke pembeli); `total` tetap omzet; nilai tukar dihitung sebagai belanja stok pada tanggal nota (bukan `owner_expenses`).

## Alur rilis
Setiap perubahan kode: `npx tsc --noEmit -p .` → `npm run build` (menaikkan `src/version.json`) → commit → push ke `main`.
Perubahan data produksi Firestore hanya dengan persetujuan pemilik.

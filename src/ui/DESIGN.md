# URBAN Design System (UDS)

Panduan tampilan aplikasi Pembukuan URBAN. Semua perubahan, penambahan, dan perbaikan UI **wajib** mengikuti dokumen ini supaya setiap fitur terasa simetris.

**Filosofi:** Apple iOS modern, minimalis, *mobile-first* (dirancang di lebar 390px, lalu melebar). Tenang, rapi, banyak ruang, hierarki lewat ukuran & tebal huruf — bukan lewat warna. Warna hanya untuk **makna**.

Rujukan gaya yang sudah ada di aplikasi: tab header (segmented), halaman **USAHA RENTAL**, dan menu **Pengaturan** (daftar bergrup ala iOS).

---

## 1. Lapisan sistem (satu sumber)

| Lapisan | Berkas | Isi |
|---|---|---|
| Token nilai | `src/index.css` (`:root` & `.dark`) | Variabel `--ui-*` untuk warna terang & gelap |
| Token Tailwind | `tailwind.config.js` → `theme.extend` | Nama kelas: `bg-surface`, `text-label-2`, `text-headline`, `rounded-card`, … |
| Token JS | `src/ui/tokens.ts` | Warna grafik (`MARK`), nada (`Nada`), warna ikon, `temaGrafik()` |
| Komponen | `src/ui/*.tsx`, impor dari `src/ui` | Card, SectionHeader, ListRow, Amount, StatTile, BarRow, … |
| Format angka | `src/lib/format.ts` | `rupiah`, `rupiahTanda`, `rpShort`, `persen` |

Aturan: **jangan** menulis hex, ukuran huruf acak (`text-[13.5px]`), atau sudut acak (`rounded-[19px]`) di halaman baru. Pakai token / komponen. Bila butuh nilai baru, tambahkan sebagai token dulu (index.css + tailwind.config.js + dokumen ini).

---

## 2. Warna

Semua warna otomatis berganti di mode gelap (kelas `.dark` di `<html>`).

| Token | Kelas | Terang | Gelap | Untuk |
|---|---|---|---|---|
| canvas | `bg-canvas` | #F2F2F7 | #000000 | Latar halaman |
| surface | `bg-surface` | #FFFFFF | #1C1C1E | Kartu, grup daftar |
| surface-2 | `bg-surface-2` | #F2F2F7 | #2C2C2E | Tile / kotak di dalam kartu |
| fill | `bg-fill` | abu 12% | abu 24% | Track bar, kolom cari, tombol abu, tekan baris |
| label | `text-label` | #000000 | #FFFFFF | Teks utama, angka |
| label-2 | `text-label-2` | #6C6C70 | #AEAEB2 | Teks sekunder, keterangan |
| label-3 | `text-label-3` | #A1A1A6 | #636366 | Placeholder, chevron, nonaktif |
| sep | `border-sep` / `divide-sep` | abu 14% | abu 55% | Garis pemisah tipis |
| edge | `ring-edge` | hitam 5% | putih 7% | Tepi kartu |
| positive | `text-positive` | #047857 | #34D399 | **Surplus**, laba, capai target |
| negative | `text-negative` | #BE123C | #FB7185 | **Minus**, rugi, hapus |
| warning | `text-warning` | #B45309 | #FBBF24 | Peringatan (stok menipis, data kurang) |
| tint | `text-tint` / `bg-tint` | #007AFF | #0A84FF | Aksi, tautan, tombol utama |

Latar lembut: `bg-positive/10`, `bg-negative/10`, dst. (`dark:…/15`). Sudah tersedia lewat `Pill` & `Notice`.

### Warna uang (wajib konsisten)
- **Hasil / selisih / laba** memakai `Amount tone="auto" signed`: hijau `+Rp…` bila surplus, merah `−Rp…` bila minus, hitam bila 0.
- Selalu sertakan **tanda** (+ / −) dan **StatusPill** (ikon + teks SURPLUS / MINUS / IMBANG) — warna tidak boleh jadi satu-satunya penanda.
- Uang masuk / keluar di tile & rincian: angka warna teks biasa, identitas lewat **titik** warna (`MARK.masuk` teal, `MARK.keluar` merah mawar). Nilai keluar diberi awalan `−`.
- Tanda minus memakai karakter tipografi `−` (U+2212), bukan `-`. `rupiahTanda()` sudah mengurusnya.

### Warna grafik (`MARK` di tokens.ts)
| Seri | Warna | Catatan |
|---|---|---|
| masuk | #0D9488 | lolos validator palet (aman buta warna) berpasangan dengan keluar |
| keluar | #E11D48 | |
| tunai / transfer | #0D9488 / #007AFF | lolos validator berdampingan |
| tint | #007AFF / #0A84FF | seri netral satu warna (unit, kasir, kategori, jam) |
| netral | #C7C7CC / #545458 | konteks / "belum capai" |
| modal | #A1A1A6 / #636366 | modal barang di batang proporsi |

### Ikon kotak (squircle)
`IconBadge color=…` — gaya menu Pengaturan: kotak 28px sudut 7px, glyph putih 16px. Warna sistem iOS: blue, green, teal, indigo, orange, red, pink, purple, yellow, gray. Pakai untuk identitas kategori kartu / baris, bukan untuk makna angka.

---

## 3. Tipografi

Huruf = font sistem (SF Pro di iPhone). Skala mengikuti iOS:

| Kelas | Ukuran / baris | Tebal | Untuk |
|---|---|---|---|
| `text-display` | 34 / 40 | bold | Angka utama hero (hasil periode) |
| `text-title1` | 28 / 34 | bold | Angka besar kartu (persen utilisasi) |
| `text-title2` | 22 / 28 | bold | Angka kartu ringkas, judul halaman |
| `text-title3` | 20 / 25 | semibold | Judul `Section` lama |
| `text-headline` | 17 / 22 | semibold | Judul kartu, angka tile |
| `text-body` | 17 / 22 | regular | Teks isian panjang |
| `text-callout` | 16 / 21 | regular | Judul baris daftar, nilai picker |
| `text-subhead` | 15 / 20 | regular | Baris rincian (LineItem, BarRow) |
| `text-footnote` | 13 / 18 | regular | Keterangan kartu, judul seksi (huruf kapital) |
| `text-caption` | 12 / 16 | regular | Sub-teks tile, legenda, catatan kaki |
| `text-caption2` | 11 / 13 | medium | Pill / badge |

- Angka selalu `tabular-nums` (komponen sudah memakainya).
- Huruf kapital hanya untuk: judul seksi (`SectionHeader`), eyebrow, label tab segmented, status pill.
- Tidak memakai `font-black` di komponen baru; cukup `semibold` / `bold`.
- Input teks minimal 16px (mencegah zoom otomatis di iPhone).

---

## 4. Bentuk, jarak, kedalaman

| Token | Nilai | Untuk |
|---|---|---|
| `rounded-card` | 22px | Kartu & grup daftar |
| `rounded-tile` | 14px | Tile di dalam kartu, notice, tooltip |
| `rounded-field` | 12px | Kolom input / cari, tombol sedang |
| `rounded-control` | 10px | Segmen aktif, chip tanggal |
| `rounded-icon` | 7px | IconBadge |
| `shadow-card` + `ring-1 ring-edge` | — | Kartu (sudah ada di `Card` / `kartu`) |
| `shadow-float` | — | Tooltip, popover |

Jarak (kelipatan 4px):
- Tepi halaman 16px (`px-4` di `<main>`).
- Padding kartu 16px (`p-4`); tile 12–14px (`px-3.5 py-3`).
- Antar kartu 12px (`space-y-3` / `gap-3`); di dalam kartu antar blok 12–16px (`mt-3` / `mt-4`).
- Antar grup: `SectionHeader` (16px di atas, 6px di bawah) — judul sejajar dengan isi kartu.
- Grid tile: 2 kolom (`grid-cols-2 gap-2`), 3 kolom hanya untuk angka pendek.
- Target sentuh minimal 44px (baris daftar, tombol, segmen).

---

## 5. Komponen (`import { … } from "../ui"`)

**Tata letak**
- `Card` — kartu standar. `title`, `subtitle`, `icon` + `iconColor`, `accessory` (kanan), `flush` (tanpa padding untuk daftar).
- `SectionHeader` — judul grup di luar kartu (`PER USAHA`, `PEMASUKAN`, …), `accessory` opsional.
- `Eyebrow` — label kecil kapital di atas angka hero ("HASIL · NOVEMBER 2026").
- `ListGroup` + `ListRow` — daftar ala Pengaturan: ikon, judul, subjudul, nilai, chevron; pemisah inset otomatis.
- `LineList` + `LineItem` — rincian angka berpemisah (titik warna, label + catatan kecil di bawah, nilai kanan, `total` untuk baris jumlah, `onClick` → chevron).
- `IconBadge` — ikon kotak berwarna.

**Data**
- `Amount` — rupiah; `signed`, `tone="auto"`, `size` (display…footnote), `short` (1,2 jt), `fitAt` (turun satu ukuran bila panjang).
- `StatTile` — tile ringkasan (label + titik/ikon, nilai, sub; `onClick` → panah). `TileValue` untuk angka non-rupiah.
- `Pill`, `StatusPill` — badge nada; status hasil.
- `BarRow` — batang horizontal gaya Screen Time (`rank` untuk peringkat, `onClick`).
- `Meter` — bar kemajuan (+ `marker` target). `SplitBar` — batang proporsi bertumpuk + legenda.
- `Legend`, `Dot`.

**Umpan balik & kontrol**
- `EmptyState`, `Notice` (info / warning / negative), `Footnote` (catatan kaki halaman).
- `Button` (filled / tinted / gray / plain / destructive; lg 50px, md 44px, sm 32px).
- `SearchField`, `Toggle` (saklar iOS), `SubTabs` (segmented: `size="md"` tab halaman huruf kapital, `size="sm"` pilihan kecil di kartu).

**Grafik**
- `useTemaGrafik()` → warna tick / grid / sumbu / kursor sesuai mode.
- `sumbu(tema.tick)` → properti XAxis / YAxis standar.
- `ChartTip` → tooltip standar (judul, baris titik·label·nilai, baris penutup).

**Khusus analitik** (`src/components/analitik/HeroArus.tsx`)
- `HeroArus` — kartu hasil periode (eyebrow · status, hasil besar berwarna, kalimat, tile masuk/keluar, rasio opsional, rincian sebagai `children`). Dipakai Keseluruhan, Rental, Usaha.
- `KartuBisnis` — kartu ringkas Rental / Usaha berdampingan.

---

## 6. Pola halaman

### Analitik (Keseluruhan · Rental · Usaha) — urutan wajib sama
1. `SubTabs` halaman (Keseluruhan / Rental / Usaha)
2. `Filter` periode (grup daftar: Periode ▸ Bulan / Dari–Sampai)
3. `HeroArus` — hasil periode + rincian masuk / keluar
4. Grup ber-`SectionHeader`: rincian → grafik → daftar peringkat
5. Rekomendasi / catatan (`Notice`)
6. `Footnote` cara hitung

### Daftar & pengaturan
`ListGroup` + `ListRow` (sama dengan menu Pengaturan). Judul grup = `SectionHeader`.

### Lembar (sheet) & dialog
- Sheet bawah: latar `bg-[#f2f2f7] dark:bg-black`, gagang 36×5px, header *Batal — Judul — Simpan* (`text-tint`), isi kartu `rounded-[20px] bg-surface`. Contoh: `StokMasukSheet`.
- Dialog konfirmasi: kartu 320px kaca (`backdrop-blur-xl`), dua tombol bawah berpemisah. Contoh: `KonfirmasiAkun`.

---

## 7. Grafik

- Satu sumbu Y saja; grid putus-putus samar; tanpa garis sumbu.
- Satu warna per tugas: arus uang = masuk/keluar; besaran netral = `tint`; capai/belum target = `masuk`/`netral` + garis target putus-putus.
- Ujung batang membulat 4px di sisi data (batang negatif: `radius={[0,0,4,4]}`), lebar maks 22px.
- Legenda selalu ada bila > 1 seri; angka & label memakai warna teks, bukan warna seri.
- Tooltip memakai `ChartTip`.
- Tidak memakai donut / pelangi untuk perbandingan kategori — pakai `BarRow`.

---

## 8. Bahasa & isi

- Bahasa Indonesia, huruf kalimat ("Uang masuk", bukan "Uang Masuk"); tanpa emoji di judul.
- Rupiah penuh `Rp 1.250.000` untuk angka utama; ringkas `1,2 jt` / `450 rb` (`rpShort`) untuk sumbu & tile padat.
- Persen dengan koma: `7,5%`, `42%` (`persen`).
- Kalimat penjelas singkat di bawah angka utama: apa artinya bagi pemilik.

---

## 9. Jangan

- Kartu bergradasi, glow, bayangan tebal, border tebal berwarna.
- Warna untuk hiasan (judul berwarna, angka biasa berwarna seri).
- Ukuran / sudut / warna arbitrer di luar token.
- Menduplikasi komponen yang sudah ada di `src/ui` (buat varian lewat prop).
- Kartu di dalam kartu (pakai tile `bg-surface-2` atau `LineList`).

---

## 10. Cek sebelum commit

1. Lebar 390px: tidak ada teks terpotong penting, tidak ada geser horizontal.
2. Terang **dan** gelap dicek.
3. Angka sama dengan sebelum perubahan (UI tidak mengubah hitungan).
4. Target sentuh ≥ 44px, input ≥ 16px.
5. `npx tsc --noEmit` lolos, build lolos.

---

## 11. Status pemakaian

| Area | Status |
|---|---|
| Analitik Keseluruhan, Rental, Usaha | ✅ penuh memakai UDS |
| Filter periode, SubTabs, Toggle | ✅ komponen UDS |
| `Section` (kartu lama: Rincian Usaha Rental, History, Monitoring, Pegawai) | ✅ permukaan kartu UDS; isi bertahap |
| Lembar rincian pendapatan / pengeluaran (Analitik Rental) | ⏳ gaya lama, migrasi berikutnya |
| Monitoring, Input, Stok, Pegawai, Pengaturan | ⏳ migrasi bertahap ke komponen UDS |

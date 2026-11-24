# URBAN Design System (UDS v4 — Apple iOS 27 Liquid Glass & Monochrome)

Panduan tampilan aplikasi Pembukuan URBAN berbasis spesifikasi resmi **Apple iOS 27 UI Kit** (`apple design resources/Apple iOS 27 UI Kit.sketch`). Semua perubahan, penambahan, dan perbaikan UI **wajib** mengikuti dokumen ini supaya setiap halaman, kartu, header, kontrol, dan lembar menyatu dalam estetika **Liquid Glass iOS 27** yang jernih, konsentris, dan profesional.

**Filosofi:** **Liquid Frosted Glass, Concentric Margins & Monochrome Action** — Seluruh kartu memakai material kaca *Liquid Glass* (`apple-card` & nested `apple-tile`) dengan `saturate(200%) blur(28px)` dan *specular inner rim*, berpadu dengan sudut konsentris iOS 27 (`26px` kartu / `16px` tile / `34px` alert & sheet), tipografi San Francisco berkontras tinggi, palet warna resmi **System Colors Light & Dark iOS 27** terarah pada ikon/grafik/pill kategori, serta tombol aksi utama **hitam/putih profesional** (`bg-action`).

---

## 1. Lapisan sistem (satu sumber)

| Lapisan | Berkas | Isi |
|---|---|---|
| Token nilai & material | `src/index.css` (`:root` & `.dark`) | Variabel `--ui-*` (`--ui-card`, `--ui-tile`, `--ui-chrome`, `--ui-fill`, `--ui-sep`), `.apple-canvas`, `.apple-card`, `.apple-tile`, `.apple-glass`, `.apple-bar`, `.apple-segmented`, `.ios-slider` |
| Token Tailwind | `tailwind.config.js` → `theme.extend` | Font San Francisco (`font-sans`, `font-display`, `font-mono`), `rounded-sheet` (`34px`), `rounded-card` (`26px`), `rounded-tile` (`16px`), `shadow-card`, `bg-action` |
| Token JS, Layout & Gerak | `src/ui/foundations/` | `tokens.ts` (`BG_IKON`, `AKSEN_TILE`, `MARK`, `PALET_SERI`, `temaGrafik()`), `layout.ts` (`LAYOUT`), `motion.ts` (`MOTION`), `cn.ts` (`cx`) |
| Komponen UI (7 Kelompok) | `src/ui/{chrome,surfaces,controls,presentations,feedback,data}/`, impor dari `src/ui` | `AppShell`, `PageHeader`, `SubTabs`, `Card`/`kartu`/`tile`, `ListGroup`/`ListRow`, `Button`/`IconButton`, `Field`/`Stepper`, `Toggle`, `Sheet`, `AlertDialog`, `ImagePreviewModal`, `Toast`, `EmptyState`/`Spinner`, `StatTile`/`Amount`/`Pill`/`UserAvatar` |
| Format angka | `src/lib/format.ts` | `rupiah`, `rupiahTanda`, `rpShort`, `persen` |

Aturan: **jangan** menulis warna hex acak, ukuran huruf acak (`text-[13.5px]`), kartu solid `bg-white`/`bg-surface` polos, atau sudut acak (`rounded-[19px]`) di halaman. Selalu gunakan token/komponen `src/ui` (`<Card>` atau `kartu` / `tile`).

---

## 2. Warna & Material Apple iOS 27 (Liquid Glass)

Semua material otomatis beradaptasi pada mode terang & gelap (`.dark` di `<html>`), merujuk pada `SharedSwatches`, `Liquid Glass/*`, dan `Materials/*` dari **Apple iOS 27 UI Kit**.

### A. Permukaan, Kaca & Teks (Kanvas Netral)

| Token / Kelas | Kegunaan | Terang | Gelap | Catatan |
|---|---|---|---|---|
| `.apple-canvas` | Latar halaman utama (`Login`, Light Mode `App`) | `#F2F2F7` + glow biru/indigo/mint iOS 27 | `#000000` + glow obsidian iOS 27 | *Catatan: wallpaper Dark Mode di `App.tsx` tampil apa adanya tanpa frost.* |
| `kartu` / `.apple-card` | **Semua kartu & `ListGroup`** | `white/78%` + `saturate(200%) blur(28px)` + bezel/rim specular | `#1C1C1E/74%` + `saturate(200%) blur(28px)` + rim specular | Sudut `26px` (`rounded-card` per *Grouped Table View*), `ring-1 ring-edge shadow-card` |
| `tile` / `.apple-tile` | **Tile nested di dalam kartu** (`StatTile`, kotak info) | `#F6F6FA/74%` + border 8% | `#2C2C2E/64%` + border 10% | Sudut `16px` konsentris (`rounded-tile`: `26px − 10px`), `.apple-tile-interactive` bila klik |
| `.apple-bar` / `.apple-glass` | Kapsul header melayang, sidebar, bottom capsule dock, tooltip | Frosted `80%` + `saturate(200%) blur(28px)` | `#1C1C1E/78%` + `saturate(200%) blur(28px)` | Material chrome navigasi & popover |
| `.apple-segmented` / `.apple-segmented-thumb` | Semua *switch tab* (`SubTabs`, segmented control) | Track kapsul frosted `white/60%` (`Fills/3 Tertiary` di dalam kartu) + thumb kristalin `saturate(200%)` | Track kapsul `#1C1C1E/64%` (`rgba(118,118,128,0.24)` di dalam kartu) + thumb kaca `white 17–27%` | Seluruh *switch tab* berbentuk kapsul penuh (`rounded-full`) berlapis kaca frosted |
| `bg-surface` / `bg-surface-elevated` | Dropdown native `<option>`, input saat fokus, modal khusus | `#FFFFFF` | `#1C1C1E` / `#2C2C2E` | Khusus kontrol buram agar teks menu OS terbaca jelas |
| `fill` (`bg-fill`) | Track bar, kolom cari kapsul, tombol sekunder `gray`/`cancel` | `rgba(118, 118, 128, 0.12)` | `rgba(118, 118, 128, 0.24)` | Apple iOS 27 `Fills/3 Tertiary` (`--ui-fill-1`/`2` untuk track lebih pekat) |
| `label` (`text-label`) | Teks utama & **semua angka nominal normal** | `#000000` | `#FFFFFF` | Kontras tinggi |
| `label-2` (`text-label-2`) | Subjudul, keterangan, judul seksi (`uppercase tracked`) | `#525258` | `#C8C8CE` | Tajam & terbaca ≥ 4,5:1 di atas frosted glass |
| `label-3` (`text-label-3`) | Placeholder, chevron, label micro | `#86868E` | `#8E8E93` | Apple `systemGray`, anti-pudar di dark mode |
| `sep` (`border-sep`) | Garis pemisah tipis hairline | `rgba(0, 0, 0, 0.12)` | `rgba(255, 255, 255, 0.12)` | Official `Separators/*/Non-Opaque` (`sep-opaque`: `#C6C6C8` / `#38383A`) |
| `edge` (`ring-edge`) | Ring hairline luar kartu & tile | hitam 8% | putih 8% | Menyempurnakan tepi kaca |

### B. Nada Makna (Status Finansial — Official Apple iOS 27 System Colors)

| Token | Kelas | Terang | Gelap | Dipakai untuk |
|---|---|---|---|---|
| positive | `text-positive` | `#008932` (`#34C759` fill) | `#30D158` | **Surplus**, laba, naik positif (iOS 27 Green) |
| negative | `text-negative` | `#E0242A` (`#FF383C` fill) | `#FF4245` | **Minus**, rugi, aksi destruktif (`hapus`/`keluar`) (iOS 27 Red) |
| warning | `text-warning` | `#C55300` (`#FF8D28` fill) | `#FF9230` | Peringatan, belum setor, stok menipis (iOS 27 Orange) |
| action | `bg-action` / `text-action-label` | `#111113` / `#FFFFFF` | `#FFFFFF` / `#111113` | **Tombol aksi utama (`Button filled`, Alert primary)** — hitam/putih profesional |
| tint | `text-tint` / `bg-tint` | `#0088FF` | `#0091FF` | Tautan teks, fokus keyboard macOS, tab aktif, indikator Transfer (iOS 27 Blue) |

### C. Sistem Warna Kategori (`WarnaIkon` — "iOS 27 System Colors")

Tersedia **12 warna sistem iOS 27** (`blue` `#0088FF`, `green` `#34C759`, `mint` `#00C8B3`, `teal` `#00C3D0`, `cyan` `#00C0E8`, `indigo` `#6155F5`, `purple` `#CB30E0`, `pink` `#FF2D55`, `orange` `#FF8D28`, `red` `#FF383C`, `yellow` `#FFCC00`, `gray`) lewat prop `accent` / `iconColor` / `color`:
1. **`IconBadge`** (`solid` dengan sheen vertikal ala iOS Settings, atau `tinted` lembut).
2. **`StatTile accent="…"`** (gaya *Apple Health*): memberi **latar tinted jernih (9.5–18%) + hairline ring berwarna + lencana ikon berwarna**, sementara **angka nominal tetap `text-label` hitam/putih** agar mudah dipindai sekilas.
3. **`Card variant="hero" accent="…"`** (gaya *Apple Wallet / Card*): memberi **sapuan radial ambient halus (~15–16%)** di sudut kartu ringkasan utama, bukan blok warna solid.
4. **`Pill color="…"`**: lencana kategori berwarna cerah (mis. PS5 `indigo`, PS4 `blue`, Jajanan `orange`, Usaha `purple`, Cash `green`/`teal`, Transfer `blue`/`cyan`).

### D. Warna uang & grafik (`MARK` di `tokens.ts`)
- **Hasil / selisih / laba** memakai `Amount tone="auto" signed`: hijau `+Rp…` bila surplus, merah `−Rp…` bila minus, hitam/putih bila 0. Selalu disertai `StatusPill` (ikon + teks).
- Uang masuk (`#34C759`) vs keluar (`#FF383C`), Tunai (`#34C759`) vs Transfer (`#0088FF`), multi-seri kategori memakai `PALET_SERI` (`#0088FF`, `#34C759`, `#FF8D28`, `#CB30E0`, `#FF2D55`, `#6155F5`).
- Warna identitas pengguna (chip "aktif" di header & kursor live): `warnaPengguna(email)` dari `WARNA_PENGGUNA` — satu email = satu warna di semua tempat.
- Baris ongkir otomatis (terkunci) di tabel & kartu rincian: `AKSEN_ONGKIR` (`baris`, `latar`, `garis`, `pemisah`).
- Pengecualian hex yang disengaja: render stiker (monitoring kondisi), struk/nota thermal, PDF, pratinjau tema di Pengaturan, dan penampil media Galeri (selalu gelap seperti app Foto).

---

## 3. Tipografi (San Francisco First — `TextStyles`)

Stack `font-sans` & `font-display` mengutamakan `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"` (native San Francisco di iPhone, iPad, Mac) dengan fallback `Inter` untuk Windows/Android, serta `font-mono` memakai `SF Mono` / `ui-monospace` (`tabular-nums`).

| Kelas | Ukuran / baris | Tebal | Untuk |
|---|---|---|---|
| `text-display` | 34 / 41 | bold | Angka utama hero (hasil periode, `01 LargeTitle`) |
| `text-title1` | 28 / 34 | bold | Judul halaman besar (`PageHeader` desktop) |
| `text-title2` | 22 / 28 | bold | Angka kartu ringkas, `PageHeader` mobile |
| `text-title3` | 20 / 25 | semibold | Judul seksi lama |
| `text-headline` | 17 / 22 | semibold | Judul kartu, judul sheet/alert, angka tile |
| `text-body` | 17 / 22 | regular | Teks isian panjang |
| `text-callout` | 16 / 21 | regular | Baris `ListRow`, teks kontrol utama |
| `text-subhead` | 15 / 20 | regular | Baris rincian (`LineItem`, `BarRow`, sidebar item, tombol `md`) |
| `text-footnote` | 13 / 18 | regular | Keterangan kartu, `SectionHeader` (uppercase) |
| `text-caption` | 12 / 16 | regular | Sub-teks tile, legenda, catatan kaki |
| `text-caption2` | 11 / 13 | medium | `Pill`, badge, label sidebar section |

- Angka nominal selalu `tabular-nums`.
- Input teks / pencarian minimal `16px` (mencegah auto-zoom Safari iOS).
- Tidak memakai `font-black` di UI bisnis (cukup `semibold` / `bold`); `.font-pixel` hanya untuk modul mini-game retro (`src/games`).

---

## 4. Bentuk, Jarak, Kedalaman & Gerak (iOS 27 Concentric Geometry)

| Token | Nilai | Untuk |
|---|---|---|
| `rounded-sheet` | 34px | `AlertDialog`, sudut atas Bottom Sheet iPhone (`32px` untuk desktop `Sheet`) |
| `rounded-card` | 26px | Semua kartu kaca (`Card`, `kartu`), `ListGroup`, grup form (*Grouped Table View*) |
| `rounded-tile` | 16px | `StatTile`, `tile`, `Notice`, `ChartTip` (konsentris di dalam kartu `26px`) |
| `rounded-field` | 12px | Input teks/tanggal/select standar |
| `rounded-control` | 10px | Kontrol kompak |
| `rounded-full` | kapsul | `Button` (`lg` 50px, `md` 44px, `sm` 32px), `SubTabs` / segmented control, `SearchField`, `Toggle` (`64×28`, knob pill `38×24`), item aktif `Sidebar` (`44px`), floating bottom dock `Tab Bar`, `AlertDialog` action pills (`48px`) |
| `rounded-icon` | 8px | `IconBadge md` (6px untuk `sm`) |
| Margin kartu | `p-4 sm:p-5` | Padding responsif di `Card` & `Section`; `gap-1` / `p-1` untuk grid tile rapat seperti `Input` |
| Margin header kartu | `mb-3.5 sm:mb-4` | Jarak judul/ikon kartu ke isi; `px-4 sm:px-5` pada `SectionHeader` & `ListRow` agar tepi teks sejajar lurus |
| Jarak antar kartu | `space-y-4 sm:space-y-5` | Celah antar kartu kaca di halaman utama |
| `shadow-card` + `ring-edge` | — | Kedalaman lembut kartu kaca (+ top/bottom specular rim inner shadow) |
| `shadow-float` + `.apple-glass` | — | Header melayang, dock bawah, tooltip, popover, sheet, alert dialog |

- Target sentuh minimum: **44px** (`ListRow` `52px`, `Button md` `44px`, dock tab bar, segmen `md`, tombol alert `48px`, input tanggal/waktu `44px`).
- Tombol yang tampil lebih kecil (ikon 28–36px, `Button sm`, `Stepper`, segmen `sm`) wajib diberi kelas **`hit-44`**: area sentuh diperluas ke 44×44 lewat `::after` tanpa mengubah tampilan (lihat `src/index.css`).
- Transisi: pakai `transition` / `transition-colors` / `transition-transform` / `transition-[width]` sesuai properti yang bergerak — **jangan `transition-all`** (ikut menganimasikan layout & berat di HP).
- Fokus keyboard macOS: `focus-visible:ring-tint`.
- Menghormati `prefers-reduced-motion: reduce`.

---

## 5. Arsitektur 7 Kelompok Komponen (`import { … } from "../ui"`)

Seluruh sistem antarmuka kini dikelompokkan mengikuti taksonomi **Apple iOS 27 UI Kit** melalui satu barrel `src/ui/index.ts`:

1. **`src/ui/foundations/` (Fondasi, Margin & Gerak):**
   - `tokens.ts` — `BG_IKON`, `AKSEN_TILE`, `MARK`, `PALET_SERI`, `temaGrafik()`.
   - `layout.ts` — Konstanta jarak `LAYOUT` (`pagePadding`, `cardPadding`, `stackGap`, `gridGap`, `touchMin`).
   - `motion.ts` — Kelas animasi iOS 27 nyata `MOTION` (`backdrop`, `sheet`, `dialog`, `toast`, `panel`) terhubung ke `@keyframes` di `src/index.css` (plus aturan kompatibilitas `prefers-reduced-motion: reduce`).
   - `cn.ts` — Utilitas penggabung kelas `cx()`.

2. **`src/ui/chrome/` (Navigasi & Shell Adaptif):**
   - `AppShell` (`AppShell.tsx`) — Adaptasi otomatis **iOS 27 vs macOS**:
     - **Mobile (`< md`):** Edge-to-edge translucent Top Bar + **Floating Liquid Glass Capsule Tab Bar** (`rounded-full`, pill seleksi aktif `Fills/2 Secondary`, safe-area inset bottom).
     - **Desktop / macOS (`>= md`):** **Sidebar Source-List translucent di kiri** (`244–260px`) dengan kapsul pilihan `44px` (`rounded-full`) & `IconBadge` berwarna + Toolbar atas mengambang.
   - `PageHeader` (`AppShell.tsx`) — Kepala halaman dengan ikon squircle, *eyebrow*, judul besar (`title2`/`title1`), subjudul, dan slot aksi kanan.
   - `SubTabs` (`SubTabs.tsx`, alias `SegmentedTabs`) — *UISegmentedControl* iOS 27 kapsul frosted glass (`md` `44px` huruf besar untuk sub-halaman, `sm` `34px` untuk filter di dalam kartu).

3. **`src/ui/surfaces/` (Kartu, Permukaan & Daftar — `Card.tsx`):**
   - `Card`, `kartu`, `tile`, `tileInteractive` — Permukaan Liquid Glass (`variant="default" | "hero" | "tinted"`, `accent`, `icon` + `iconColor` + `iconVariant`, `accessory`, `flush`).
   - `SectionHeader`, `Eyebrow`, `IconBadge` (`solid` | `tinted`, `sm` | `md`).
   - `ListGroup` + `ListRow` (tinggi `>= 52px`, pemisah inset `Separators/Non-Opaque`, `iconVariant`, `valueTone`, `chevron`, `destructive`).
   - `LineList` + `LineItem`.

4. **`src/ui/controls/` (Kontrol Interaktif & Form):**
   - `Button.tsx` — `Button` (`filled` hitam/putih solid / `tinted` / `gray` / `plain` / `destructive`, kapsul `rounded-full`, ukuran `lg` 50px / `md` 44px / `sm` 32px, prop `loading`) dan `IconButton` (tombol ikon lingkaran `sm` 32px / `md` 36px / `lg` 44px dengan `label` wajib untuk aksesibilitas).
   - `Field.tsx` — `FieldLabel`, `TextField`, `SelectField`, `TextAreaField` (`44px` `md` / `52px` `lg`, teks `16px` anti auto-zoom iOS Safari).
   - `Stepper.tsx` — `Stepper` (kontrol `+` / `−` kapsul ala iOS 27).
   - `SearchField.tsx` — Kolom cari kapsul dengan tombol bersihkan.
   - `Toggle.tsx` — Saklar iOS 27 `64×28` track + pill knob `38×24`; `ios-slider` (`37×24` di `src/index.css`).

5. **`src/ui/presentations/` (Pop-up, Sheet, Dialog, Preview & Toast):**
   - `Sheet.tsx` — Bottom Sheet (`rounded-t-[34px]`) dengan grabber 36×5px di HP ↔ Centered Sheet (`32px`) di macOS/desktop (`Esc`, `useBodyScrollLock`, `MOTION.backdrop` & `MOTION.sheet`).
   - `AlertDialog.tsx` — Dialog konfirmasi `.apple-sheet` `rounded-[34px]` dengan tombol kapsul `48px` (`cancel` / `primary` `bg-action` hitam-putih / `destructive`). **SSOT Aksi Reset & Destruktif:** semua fungsi **Reset** wajib memakai `AlertDialog` dengan tombol `Batal` (`cancel`) di kiri dan `Reset` (`destructive`) di kanan.
   - `ImagePreviewModal.tsx` — Lightbox SSOT untuk pratinjau foto & bukti transfer (mendukung `Buka penuh` dan aksi `Hapus` opsional).
   - `Toast.tsx` — Kapsul notifikasi mengambang `.apple-sheet` (`info` | `positive` | `warning` | `negative`, `MOTION.toast`); isi kapsulnya `ToastKapsul` (pesan panjang / banyak baris otomatis jadi kartu `rounded-tile`).
   - `Pemberitahuan.tsx` — **pengganti `alert` / `confirm` / `prompt` bawaan browser** (dipasang sekali lewat `<PemberitahuanHost />` di `main.tsx`):
     - `notify(pesan, nada?)` — toast di atas layar, maks. 3 bertumpuk, nada ditebak dari isi bila kosong, emoji dibuang. `window.alert` sudah diarahkan ke sini (`src/lib/nativeAlert.ts`).
     - `await konfirmasi(teks, { judul, ya, batal, bahaya })` → `true`/`false` (AlertDialog; tombol merah otomatis untuk hapus/tolak/coret/timpa).
     - `await tanya(teks, { judul, placeholder, awal, wajib })` → teks / `null` bila batal.
     - Jangan memakai `window.confirm` / `window.prompt` lagi.

6. **`src/ui/feedback/` (Umpan Balik & Pemuat — `Feedback.tsx`):**
   - `EmptyState`, `Notice`, `Footnote`, dan `Spinner`.

7. **`src/ui/data/` (Angka, Visualisasi, Grafik & Identitas):**
   - `DataDisplay.tsx` — `Amount`, `StatTile` (mendukung `accent`, `progress`, `badge`, `onClick`), `TileValue`, `Pill`, `StatusPill`, `Dot`, `Legend`, `BarRow`, `Meter`, `SplitBar`.
   - `Chart.tsx` — `useTemaGrafik()`, `sumbu()`, `ChartTip`.
   - `UserAvatar.tsx` — `UserAvatar` & `getInitials`.

---

## 6. Pola Halaman (iOS & macOS)

1. **Pola Navigasi:** Maksimal **1 lapis navigasi utama** (Sidebar macOS / Bottom Tab Bar iOS) + **1 lapis `SubTabs`** di dalam halaman jika memang ada sub-pandangan (hindari tab pill bertumpuk 3 lapis). Peta navigasi aplikasi (`src/lib/navigasi.ts`):
   - Tab bar admin: **Monitoring · Pembukuan · Stok** (tombol Pengaturan tetap di header mobile & sidebar desktop). Owner / super admin: **Monitoring · Pembukuan · Stok · Analitik · Lainnya** (maks. 5 tab).
   - Segmen per halaman: Monitoring = Status unit · Booking · Kondisi alat (+ Stiker owner); Stok = Jualan · Rental (+ Atur stok owner); Analitik = Keseluruhan · Rental · Usaha.
   - Halaman yang jarang dibuka dikumpulkan di **Lainnya** (daftar `ListGroup` ala iOS → halaman dengan tombol kembali `‹ Lainnya`): Transaksi, Pegawai, Request edit (angka menunggu), Log aktivitas, Pengaturan. Di laptop isinya tampil langsung sebagai grup kedua di sidebar.
   - Pandangan sekunder di dalam halaman (mis. riwayat stok) dibuka sebagai `Sheet`, bukan segmen kedua.
   - Tabel rincian pembukuan (`TableEditor`): mode **Kartu** = daftar ringkas ala iOS (nomor · judul · info · nominal · Cash/TF), ketuk untuk membuka editor di tempat (satu baris terbuka, field jam/angka/harga berpasangan 2 kolom, pembayaran segmented), geser kiri untuk hapus, baris kosong disembunyikan di balik "Tambah transaksi". Mode **Klasik** tetap tabel.
2. **Hierarki Warna dalam Satu Layar:**
   - **Hero Card / Status Utama:** pakai `Card variant="hero"` (atau `StatTile accent="…"` pada ringkasan inti) agar langsung menarik fokus.
   - **Tile Rincian (2–4 kotak):** beri `accent` konsisten per kategori usaha/bayar + ikon berwarna, angka tetap `text-label`.
   - **Daftar & Pengaturan:** pakai `ListGroup` + `ListRow` bersih tanpa tint latar agar mata bisa istirahat.
3. **Desktop Grid:** Pada layar `md`/`lg`, pecah pasangan kartu setara menjadi 2 kolom (`grid-cols-1 lg:grid-cols-2`) atau master-detail supaya ruang macOS termanfaatkan efektif.

---

## 7. Jangan (Anti-Pattern)

- ❌ Kartu solid polos (`bg-white` / `bg-surface` tanpa `.apple-card` / `<Card>`) atau tile buram non-kaca di dalam kartu kaca utama.
- ❌ Kartu bergradasi penuh warna norak, border neon tebal, atau teks angka nominal berwarna-warni acak tanpa makna.
- ❌ Kartu di dalam kartu bersarang penuh (pakai `StatTile` / `tile` atau `LineList` di dalam `Card`).
- ❌ Sheet/modal buatan sendiri dengan `bg-zinc-*` — gunakan `Sheet` atau `AlertDialog`.
- ❌ Tombol aksi utama berwarna biru atau warna mencolok lainnya — gunakan `Button variant="filled"` (`bg-action`, hitam profesional).
- ❌ Ukuran / sudut / warna di luar token `src/ui`.
- ❌ `window.confirm` / `window.prompt` / dialog buatan sendiri untuk konfirmasi — pakai `konfirmasi()` / `tanya()`.
- ❌ Emoji di teks UI (label, judul, toast, empty state). Emoji hanya boleh di isi pesan WhatsApp / caption promosi.
- ❌ Label segmen (`SubTabs`) yang terpotong di HP 360px — pendekkan labelnya (konteks sudah jelas dari halaman induk).

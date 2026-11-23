/**
 * BOOKING SEWA PS — koleksi Firestore `booking_sewa` (SSOT).
 *
 * Alur: BARU (dicatat) → KONFIRMASI (sudah DP / sudah dikonfirmasi lewat WA)
 *       → DIAMBIL (tombol "Mulai sewa": baris masuk Pembukuan › Rincian Sewa) | BATAL.
 *
 * Aturan DP (diubah owner 23 Nov 2026):
 * - DP LANGSUNG tercatat saat diterima: dokumen `owner_incomes/dpbooking_<id>` (Rental, tanggal hari
 *   kerja DP diterima, metode sesuai DP) → ikut Analitik, posisi dana & Transaksi (terkunci).
 *   Ditulis oleh `sinkronDpBooking` dari sesi owner / super admin (staf tidak boleh menulis owner_incomes).
 * - Saat "Mulai sewa": hanya baris sewa = sisa bayar (`_dpBooking` memotong kolom harga);
 *   DP tidak dicatat ulang di Rincian Sewa.
 * - Booking batal + DP dikembalikan (atau booking dihapus) → catatan DP dihapus.
 *   Batal + DP hangus → catatan DP tetap (uangnya memang diterima).
 *
 * Hak akses (firestore.rules): semua staf boleh baca / tambah / ubah / batalkan;
 * HAPUS hanya owner & super admin.
 */
import { useEffect, useState } from "react";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { tanggalHariKerja } from "./dateLocal";
import { auth, db } from "./firebase";
import { pad, toInt } from "./format";
import { rapikanWa, waValid } from "./wa";
import { jamDurasi, jenisUnit, LAMA_DP_BOOKING, type SewaBerjalan } from "./sewa";

export { LAMA_DP_BOOKING };
import { getSewaPrice, type SewaTable } from "./priceLists";
import { salamWaktu, TOLERANSI_KEMBALI_MENIT } from "./pengingatSewa";

export const KOLEKSI_BOOKING = "booking_sewa";

export type StatusBooking = "BARU" | "KONFIRMASI" | "DIAMBIL" | "BATAL";
export type JenisPesanBooking = "KONFIRMASI" | "PENGINGAT";

export type DpBooking = {
  nominal: number;
  metode: "TRANSFER" | "CASH";
  bukti?: string;
  ts: number;
  oleh: string;
};

export type BookingSewa = {
  id: string;
  status: StatusBooking;
  nama: string;
  /** No. WA penyewa (08xx) */
  wa: string;
  /** Jenis sewa — pilihan sama dengan Rincian Sewa (mis. "PS4 + TV", "Hanya TV") */
  jenisPS: string;
  /** Lama sewa — pilihan sama dengan Rincian Sewa (mis. "12 JAM", "3 HARI") */
  lamaSewa: string;
  /** Tanggal ambil (kalender, YYYY-MM-DD) */
  tanggal: string;
  /** Jam ambil HH:mm */
  jam: string;
  antar: boolean;
  /** Alamat / link sharelok bila diantar */
  alamat?: string;
  /** Perkiraan ongkir antar-jemput */
  ongkir?: number;
  dp?: DpBooking | null;
  catatan?: string;
  sumber: "WA" | "MANUAL";
  /** Teks WhatsApp asli yang ditempel (arsip) */
  teksAsli?: string;
  diingatkan?: { ts: number; oleh: string; jenis: JenisPesanBooking }[];
  dibuatOleh: string;
  dibuatTs: number;
  diubahOleh?: string;
  diubahTs?: number;
  batal?: { alasan: string; oleh: string; ts: number; dp: "HANGUS" | "KEMBALI" | null } | null;
  diambil?: { ts: number; oleh: string; tanggal: string } | null;
};

export type IsiBooking = Omit<BookingSewa, "id" | "status" | "dibuatOleh" | "dibuatTs" | "diubahOleh" | "diubahTs" | "diingatkan" | "batal" | "diambil"> & {
  status?: StatusBooking;
};

export const aktif = (b: Pick<BookingSewa, "status">) => b.status === "BARU" || b.status === "KONFIRMASI";

// ---------------------------------------------------------------- waktu

/** Waktu ambil (ms, kalender lokal). null bila tanggal / jam belum lengkap. */
export function mulaiBooking(b: Pick<BookingSewa, "tanggal" | "jam">): number | null {
  const t = String(b.tanggal || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const j = String(b.jam || "").match(/^(\d{1,2})[:.](\d{2})$/);
  if (!t || !j) return null;
  return new Date(+t[1], +t[2] - 1, +t[3], +j[1], +j[2]).getTime();
}

/** Rentang pakai unit [mulai, selesai] (ms). Selesai = mulai + lama sewa. */
export function rentangBooking(b: Pick<BookingSewa, "tanggal" | "jam" | "lamaSewa">): { mulai: number; selesai: number } | null {
  const mulai = mulaiBooking(b);
  const jam = jamDurasi({ lamaSewa: b.lamaSewa });
  if (mulai === null || !jam) return null;
  return { mulai, selesai: mulai + jam * 3600000 };
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const jamTitik = (d: Date) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;
const awalHari = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "Sab, 25 Nov · 22.00" */
export const fmtWaktu = (ms: number) => { const d = new Date(ms); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} · ${jamTitik(d)}`; };

/** Kelompok daftar: lewat jam ambil, hari ini, besok, 7 hari, nanti. */
export type KelompokBooking = "LEWAT" | "HARI_INI" | "BESOK" | "MINGGU_INI" | "NANTI" | "TANPA_JADWAL";
export function kelompokBooking(b: BookingSewa, now: number): KelompokBooking {
  const m = mulaiBooking(b);
  if (m === null) return "TANPA_JADWAL";
  if (m < now - 30 * 60000) return "LEWAT";
  const selisih = Math.round((awalHari(m) - awalHari(now)) / 86400000);
  if (selisih <= 0) return "HARI_INI";
  if (selisih === 1) return "BESOK";
  if (selisih <= 7) return "MINGGU_INI";
  return "NANTI";
}

/** "hari ini pukul 22.00" / "besok pukul 10.00" / "Sabtu, 27 Nov pukul 10.00" */
function waktuRamah(ms: number, now: number) {
  const d = new Date(ms);
  const selisih = Math.round((awalHari(ms) - awalHari(now)) / 86400000);
  if (selisih === 0) return `hari ini pukul ${jamTitik(d)}`;
  if (selisih === 1) return `besok pukul ${jamTitik(d)}`;
  return `${HARI_PANJANG[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} pukul ${jamTitik(d)}`;
}

// ---------------------------------------------------------------- harga

/** Perkiraan harga sewa (tabel harga Edit Rincian) + ongkir. 0 bila unit / durasi tidak ada di tabel. */
export function estimasiHarga(b: Pick<BookingSewa, "jenisPS" | "lamaSewa" | "antar" | "ongkir">, sewa: SewaTable) {
  const dasar = getSewaPrice(sewa, b.jenisPS, b.lamaSewa);
  const ongkir = b.antar ? toInt(b.ongkir) : 0;
  return { dasar, ongkir, total: dasar + ongkir };
}

// ---------------------------------------------------------------- cek bentrok

export type SumberUnit = "PS3" | "PS4" | "PS5" | "TV" | "PORTABEL";
export type Kapasitas = { ps3: number; ps4: number; ps5: number; tv: number; portabel: number };
const KUNCI_KAPASITAS: Record<SumberUnit, keyof Kapasitas> = { PS3: "ps3", PS4: "ps4", PS5: "ps5", TV: "tv", PORTABEL: "portabel" };
export const LABEL_UNIT: Record<SumberUnit, string> = { PS3: "PS3", PS4: "PS4", PS5: "PS5", TV: "TV", PORTABEL: "PS portabel" };

/** Unit fisik yang dipakai satu jenis sewa ("PS4 + TV" = PS4 + TV). */
export function unitDipakai(jenisPS: unknown): SumberUnit[] {
  const u = jenisUnit(jenisPS);
  const out: SumberUnit[] = [];
  if (u.konsol) out.push(u.konsol);
  if (u.tv) out.push("TV");
  if (u.portabel) out.push("PORTABEL");
  return out;
}

/**
 * "penuh" = unit benar-benar kurang menurut jam kembali terjadwal.
 * "mepet" = unit cukup bila sewa sebelumnya kembali tepat waktu; kurang hanya bila penyewa
 * memakai toleransi telat (TOLERANSI_KEMBALI_MENIT) — cukup diingatkan, bukan bentrok.
 */
export type Bentrok = { unit: SumberUnit; kapasitas: number; terpakai: number; penyebab: string[]; jenis: "penuh" | "mepet" };

/**
 * Cek apakah unit untuk booking `b` masih tersedia di rentang waktunya, dengan menghitung
 * booking aktif lain + unit yang sedang disewa (belum kembali).
 * Dihitung dua kali: tanpa toleransi kembali (bentrok "penuh") dan dengan toleransi (bentrok "mepet").
 * Unit dengan kapasitas 0 (belum diatur owner) tidak dicek.
 */
export function cekBentrok(
  b: Pick<BookingSewa, "id" | "jenisPS" | "tanggal" | "jam" | "lamaSewa"> & { id?: string },
  o: { bookings: BookingSewa[]; berjalan: SewaBerjalan[]; kapasitas: Kapasitas; now: number }
): Bentrok[] {
  const r = rentangBooking(b);
  if (!r) return [];
  type Pakai = { mulai: number; selesai: number; unit: SumberUnit[]; label: string };
  const hitung = (tol: number) => {
    const awal = r.mulai;
    const akhir = r.selesai + tol;
    const lain: Pakai[] = [];
    o.bookings.forEach((x) => {
      if (!aktif(x) || x.id === b.id) return;
      const rx = rentangBooking(x);
      if (!rx) return;
      lain.push({ mulai: rx.mulai, selesai: rx.selesai + tol, unit: unitDipakai(x.jenisPS), label: `Booking ${x.nama || "tanpa nama"} · ${fmtWaktu(rx.mulai)}` });
    });
    o.berjalan.forEach((s) => {
      const mulai = s.mulaiMs ?? o.now;
      // Belum kembali: dianggap terpakai minimal sampai sekarang
      const selesai = Math.max((s.endMs ?? o.now) + tol, s.isDone && !s.isVerified ? o.now + tol : 0);
      lain.push({ mulai, selesai, unit: unitDipakai(s.jenis), label: `Sewa jalan ${s.namaPenyewa}${s.endMs ? ` · kembali ${fmtWaktu(s.endMs)}` : ""}` });
    });
    const out = new Map<SumberUnit, { kapasitas: number; terpakai: number; penyebab: string[] }>();
    unitDipakai(b.jenisPS).forEach((unit) => {
      const kapasitas = Number(o.kapasitas[KUNCI_KAPASITAS[unit]]) || 0;
      if (kapasitas <= 0) return;
      const tumpang = lain.filter((p) => p.unit.includes(unit) && p.mulai < akhir && p.selesai > awal);
      if (!tumpang.length) return;
      // Pemakaian maksimum bersamaan di dalam rentang booking (dicek di setiap titik mulai)
      const titik = [awal, ...tumpang.map((p) => Math.max(awal, p.mulai))];
      let maks = 0;
      titik.forEach((t) => {
        const n = tumpang.filter((p) => p.mulai <= t && p.selesai > t).length;
        if (n > maks) maks = n;
      });
      if (maks + 1 > kapasitas) out.set(unit, { kapasitas, terpakai: maks, penyebab: tumpang.map((p) => p.label) });
    });
    return out;
  };

  const penuh = hitung(0);
  const denganToleransi = hitung(TOLERANSI_KEMBALI_MENIT * 60000);
  const hasil: Bentrok[] = [];
  unitDipakai(b.jenisPS).forEach((unit) => {
    const x = penuh.get(unit);
    if (x) { hasil.push({ unit, ...x, jenis: "penuh" }); return; }
    const y = denganToleransi.get(unit);
    if (y) hasil.push({ unit, ...y, jenis: "mepet" });
  });
  return hasil;
}

/** Bentrok yang benar-benar membuat unit kurang (bukan sekadar mepet toleransi). */
export const adaBentrokPenuh = (list: Bentrok[]) => list.some((x) => x.jenis === "penuh");

/** Kalimat peringatan untuk satu bentrok. */
export const teksBentrok = (x: Bentrok) =>
  x.jenis === "penuh"
    ? `${LABEL_UNIT[x.unit]} kurang: ${x.terpakai} dari ${x.kapasitas} unit masih terpakai di jam itu.`
    : `${LABEL_UNIT[x.unit]} mepet: unit sebelumnya kembali dekat jam ambil. Aman bila kembali tepat waktu, tapi penyewa masih boleh telat sampai ${TOLERANSI_KEMBALI_MENIT / 60} jam.`;

// ---------------------------------------------------------------- pesan WhatsApp

const rpRapat = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const sapaan = (nama: string) => {
  const n = String(nama || "").trim().split(/\s+/)[0];
  return n ? `Kak ${n.charAt(0).toUpperCase()}${n.slice(1).toLowerCase()}` : "Kak";
};

/** Pesan WA untuk penyewa: konfirmasi booking tercatat, atau pengingat jadi sewa / tidak. */
export function pesanBooking(b: BookingSewa, jenis: JenisPesanBooking, now = Date.now()): string {
  const m = mulaiBooking(b);
  const kapan = m !== null ? waktuRamah(m, now) : "sesuai jadwal";
  const unit = `*${b.jenisPS} · ${b.lamaSewa.toLowerCase()}*`;
  const cara = b.antar ? "diantar ke alamat Kakak" : "diambil di toko";
  const dp = b.dp && b.dp.nominal > 0 ? `DP ${rpRapat(b.dp.nominal)} sudah kami terima. ` : "";
  const salam = `Selamat ${salamWaktu(new Date(now))} ${sapaan(b.nama)} 🙏🏻`;
  const isi =
    jenis === "KONFIRMASI"
      ? [
          `Booking sewa ${unit} untuk ${kapan} (${cara}) sudah kami catat ✅`,
          `${dp}Jangan lupa siapkan KTP + SIM/STNK untuk jaminan ya kak.`,
        ]
      : [
          `Kami dari URBAN mau mengingatkan booking sewa ${unit} ${kapan} (${cara}).`,
          `${dp}Apakah jadi sewa kak? Mohon balas ya, supaya unitnya kami siapkan 🎮`,
        ];
  return [salam, "", ...isi, "", "Terima kasih 🙏🏻", "URBAN PlayStation Lampung"].join("\n");
}

// ---------------------------------------------------------------- baca teks WhatsApp

export type HasilBaca = {
  isi: Partial<Pick<BookingSewa, "nama" | "wa" | "jenisPS" | "lamaSewa" | "tanggal" | "jam" | "antar" | "alamat">>;
  /** Field yang tidak terbaca / perlu dicek admin */
  kosong: ("nama" | "wa" | "jenisPS" | "lamaSewa" | "tanggal" | "jam" | "antar")[];
  /** Catatan pembacaan (mis. jam tanpa pagi/malam) */
  ragu: string[];
};

const BULAN_ID: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3, mei: 4, jun: 5, juni: 5,
  jul: 6, juli: 6, agu: 7, agt: 7, agus: 7, agustus: 7, sep: 8, sept: 8, september: 8, okt: 9, oktober: 9,
  nov: 10, nop: 10, november: 10, des: 11, desember: 11,
};
const HARI_ID: Record<string, number> = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Isian template yang tidak diubah penyewa: "( tv/ protabel)", "PS3 / PS4 / PS5", "ya/tidak". */
function isianKosong(v: string): boolean {
  const s = v.trim().toLowerCase().replace(/https?:\/\/\S+/g, "").trim();
  if (!s) return !/https?:\/\//i.test(v);
  if (/^\(.*\)$/.test(s)) return true;
  if (/^(ya\s*\/\s*tidak|tidak\s*\/\s*ya)$/.test(s)) return true;
  if ((s.match(/\//g) || []).length >= 2) return true; // daftar pilihan "PS3 / PS4 / PS5"
  if (/^\(contoh/.test(s) || /^contoh/.test(s)) return true;
  return false;
}

/** Jenis sewa dari teks bebas ("PS4 + TV", "booking TV", "ps 3 protabel") → salah satu pilihan tabel harga. */
export function bacaJenis(teks: string, pilihan: string[]): string | undefined {
  const s = teks.toLowerCase();
  const konsol = /ps\s?5|playstation\s?5/.test(s) ? "PS5" : /ps\s?4|playstation\s?4/.test(s) ? "PS4" : /ps\s?3|playstation\s?3/.test(s) ? "PS3" : null;
  const portabel = /p[ro]{2}t[ae]b[ae]l|portable|portabel|protable/.test(s);
  const tv = /\btv\b|televisi/.test(s) && !/tidak\s+(pakai\s+)?tv|tanpa\s+tv|no\s+tv/.test(s);
  const cocok = (o: string) => {
    const u = jenisUnit(o);
    if (!konsol) return tv && !portabel ? u.hanyaTv : false;
    return u.konsol === konsol && u.tv === tv && u.portabel === portabel;
  };
  return pilihan.find((o) => o !== "Hanya Ongkir" && cocok(o));
}

/** Lama sewa dari teks ("3 hari", "12 jam", "sehari") → pilihan tabel harga bila ada. */
export function bacaLama(teks: string, pilihan: string[]): string | undefined {
  const s = teks.toLowerCase();
  let hasil: string | undefined;
  const hari = s.match(/(\d+)\s*(hari|hr)\b/);
  if (hari) hasil = `${+hari[1]} HARI`;
  else if (/sehari|satu\s+hari/.test(s)) hasil = "1 HARI";
  else if (/seminggu/.test(s)) hasil = "7 HARI";
  else {
    // "12 jam" tapi bukan "tanggal 25 jam 10" (jam diikuti angka = jam ambil)
    const jam = s.match(/(?<!tanggal\s|tgl\s|tgl\.\s)\b(\d{1,2})\s*jam\b(?!\s*\d)/);
    if (jam && +jam[1] > 0 && +jam[1] <= 24) hasil = `${+jam[1]} JAM`;
  }
  if (!hasil) return undefined;
  const sama = pilihan.find((o) => o.toUpperCase() === hasil);
  if (sama) return sama;
  if (hasil === "1 HARI") return pilihan.find((o) => o.toUpperCase() === "24 JAM") || hasil;
  if (hasil === "24 JAM") return pilihan.find((o) => o.toUpperCase() === "1 HARI") || hasil;
  return hasil;
}

/** Jam ambil dari teks ("jam 10 malam", "22.00", "pukul 9 pagi") → "HH:mm". */
export function bacaJam(teks: string): { jam?: string; ragu?: string } {
  const s = teks.toLowerCase();
  const pola = s.match(/(?:jam|pukul|pkl|jm)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|wib)?/) || s.match(/\b(\d{1,2})[.:](\d{2})\s*(pagi|siang|sore|malam|wib)?/);
  if (!pola) return {};
  let h = +pola[1];
  const m = pola[2] ? +pola[2] : 0;
  const waktu = pola[3];
  if (h > 24 || m > 59) return {};
  const tegas = waktu && waktu !== "wib";
  if (waktu === "malam") h = h === 12 ? 0 : h >= 6 && h < 12 ? h + 12 : h;
  else if (waktu === "sore") h = h < 12 ? h + 12 : h;
  else if (waktu === "siang") h = h >= 1 && h <= 5 ? h + 12 : h;
  else if (waktu === "pagi") h = h === 12 ? 0 : h;
  // Tanpa pagi/malam: toko buka 10.00–24.00, jadi jam 1–9 dibaca siang/malam (13.00–21.00)
  else if (!pola[2] && h >= 1 && h <= 9) h += 12;
  if (h === 24) h = 0;
  const ragu = !tegas && !pola[2] && h >= 10 && h <= 21 && +pola[1] <= 12
    ? `Jam ambil "${pola[0].trim()}" tanpa pagi/siang/malam — dibaca ${pad(h)}.00, cek lagi.`
    : undefined;
  return { jam: `${pad(h)}:${pad(m)}`, ragu };
}

/** Tanggal ambil dari teks ("tanggal 25", "25 Nov", "25/11", "besok", "sabtu") → YYYY-MM-DD. */
export function bacaTanggal(teks: string, now: Date): string | undefined {
  const s = teks.toLowerCase();
  const hariIni = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const geser = (n: number) => ymd(new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() + n));
  if (/\blusa\b/.test(s)) return geser(2);
  if (/\bbesok\b/.test(s)) return geser(1);
  if (/hari\s+ini|malam\s+ini|sekarang/.test(s)) return geser(0);
  // dd/mm(/yy) atau dd-mm
  const angka = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  // "25 nov", "tanggal 25 november 2026", "tgl 25"
  const bulan = s.match(/\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun[i]?|jul[i]?|agu(?:stus)?|agt|agus|sep(?:t|tember)?|okt(?:ober)?|no[vp](?:ember)?|des(?:ember)?)\b(?:\s+(\d{4}))?/);
  const tglSaja = s.match(/\b(?:tanggal|tgl\.?)\s*(\d{1,2})\b/);
  let d: number | undefined, mo: number | undefined, y: number | undefined;
  if (bulan) { d = +bulan[1]; mo = BULAN_ID[bulan[2]] ?? BULAN_ID[bulan[2].slice(0, 3)]; y = bulan[3] ? +bulan[3] : undefined; }
  else if (angka && +angka[2] <= 12) { d = +angka[1]; mo = +angka[2] - 1; y = angka[3] ? (+angka[3] < 100 ? 2000 + +angka[3] : +angka[3]) : undefined; }
  else if (tglSaja) d = +tglSaja[1];
  if (d !== undefined && d >= 1 && d <= 31) {
    let tahun = y ?? hariIni.getFullYear();
    let bln = mo ?? hariIni.getMonth();
    let hasil = new Date(tahun, bln, d);
    // Tanpa bulan / tahun: tanggal yang sudah lewat = bulan / tahun berikutnya
    if (mo === undefined && hasil < hariIni) hasil = new Date(tahun, bln + 1, d);
    else if (y === undefined && hasil < new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - 7)) hasil = new Date(tahun + 1, bln, d);
    return ymd(hasil);
  }
  // Nama hari: hari itu berikutnya (hari ini bila sama)
  const namaHari = Object.keys(HARI_ID).find((h) => new RegExp(`\\b${h}\\b`).test(s));
  if (namaHari) {
    const target = HARI_ID[namaHari];
    const n = (target - hariIni.getDay() + 7) % 7;
    return geser(n);
  }
  return undefined;
}

/**
 * Baca teks booking dari WhatsApp (template lama / baru, boleh beberapa chat sekaligus).
 * Isian template yang tidak diubah dianggap kosong; info di chat berikutnya ikut dibaca.
 * Hasilnya SELALU dicek admin sebelum disimpan.
 */
export function bacaTeksBooking(teks: string, o: { jenisOptions: string[]; lamaOptions: string[]; now?: Date }): HasilBaca {
  const now = o.now ?? new Date();
  const baris = String(teks || "")
    .split(/\r?\n/)
    // awalan salinan WA: "[15.36, 22/11/2026] Admin: ..."
    .map((l) => l.replace(/^\s*\[\d{1,2}[.:]\d{2}(?:[.:]\d{2})?,\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]{1,40}:\s*/, "").trim())
    .filter(Boolean);

  const field: Record<string, string> = {};
  const bebas: string[] = [];
  const kunci = (label: string): string | null => {
    const l = label.toLowerCase();
    if (/nama/.test(l)) return "nama";
    if (/(no|nomor|nomer)\.?\s*(wa|hp|whatsapp|telp|telepon)|^wa$|whatsapp/.test(l)) return "wa";
    if (/tanggal|tgl|jam\s*ambil|waktu\s*ambil|jadwal/.test(l)) return "waktu";
    if (/pakai\s*tv|tv\s*\/\s*portabel|portabel/.test(l)) return "tambahan";
    if (/jenis/.test(l)) return "jenis";
    if (/lama|durasi/.test(l)) return "lama";
    if (/antar|jemput/.test(l)) return "antar";
    return null;
  };
  baris.forEach((l) => {
    const m = l.match(/^([^:]{2,40}?)\s*:\s*(.*)$/);
    const k = m ? kunci(m[1]) : null;
    if (m && k) {
      const nilai = m[2].trim();
      // "tidak (sertakan sharelok jika ya)" → "tidak"
      const bersih = isianKosong(nilai) ? "" : nilai.replace(/\s*\((sertakan|contoh)[^)]*\)\s*$/i, "").trim();
      if (bersih && !isianKosong(bersih)) field[k] = field[k] ? `${field[k]} ${bersih}` : bersih;
      return;
    }
    // Judul & syarat template bukan info booking
    if (/sewa\s+ps\s+urban|siapkan\s+ktp|syarat\s+jaminan|^anda$/i.test(l)) return;
    bebas.push(l);
  });
  const teksBebas = bebas.join("\n");

  const isi: HasilBaca["isi"] = {};
  const ragu: string[] = [];

  if (field.nama) isi.nama = field.nama.replace(/\s+/g, " ").trim();

  const semuaNomor = `${field.wa || ""}\n${teksBebas}\n${baris.join("\n")}`.match(/(?:\+?62|0)[ -]?8[\d \-.]{7,15}\d/);
  if (semuaNomor) {
    const wa = rapikanWa(semuaNomor[0]);
    if (waValid(wa)) isi.wa = wa;
  }

  const jenis = bacaJenis(`${field.jenis || ""} ${field.tambahan || ""}`, o.jenisOptions) || bacaJenis(teksBebas, o.jenisOptions);
  if (jenis) isi.jenisPS = jenis;

  const lama = (field.lama && bacaLama(field.lama, o.lamaOptions)) || bacaLama(teksBebas, o.lamaOptions);
  if (lama) {
    isi.lamaSewa = lama;
    if (!o.lamaOptions.some((x) => x.toUpperCase() === lama.toUpperCase())) ragu.push(`Lama sewa ${lama.toLowerCase()} tidak ada di daftar harga — harga diisi manual saat mulai sewa.`);
  }

  const sumberWaktu = field.waktu ? `${field.waktu}\n${teksBebas}` : teksBebas;
  const tgl = bacaTanggal(field.waktu || "", now) || bacaTanggal(teksBebas, now);
  if (tgl) isi.tanggal = tgl;
  const j = bacaJam(field.waktu || "").jam ? bacaJam(field.waktu || "") : bacaJam(sumberWaktu);
  if (j.jam) isi.jam = j.jam;
  if (j.ragu) ragu.push(j.ragu);

  const peta = `${field.antar || ""}\n${teksBebas}`.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|(?:www\.)?google\.[a-z.]+\/maps)\S*/i);
  if (peta) { isi.alamat = peta[0]; isi.antar = true; }
  const antarTeks = (field.antar || "").toLowerCase();
  if (/^(ya|iya|yes|antar|diantar)\b/.test(antarTeks)) isi.antar = true;
  else if (/^(tidak|gak|nggak|ga|tdk|no|ambil)\b/.test(antarTeks)) isi.antar = isi.antar ?? false;
  else if (/\b(di\s?ambil|ambil\s+sendiri|ambil\s+di\s+toko)\b/i.test(teksBebas)) isi.antar = isi.antar ?? false;
  else if (/\b(di\s?antar|minta\s+antar|antar\s+ke)\b/i.test(teksBebas)) isi.antar = true;
  if (isi.antar && !isi.alamat && field.antar) {
    const sisa = field.antar.replace(/^(ya|iya|yes)\b[\s,.-]*/i, "").trim();
    if (sisa.length > 3) isi.alamat = sisa;
  }

  const kosong: HasilBaca["kosong"] = [];
  (["nama", "wa", "jenisPS", "lamaSewa", "tanggal", "jam"] as const).forEach((k) => { if (!isi[k]) kosong.push(k); });
  if (isi.antar === undefined) kosong.push("antar");
  return { isi, kosong, ragu };
}

// ---------------------------------------------------------------- Firestore

const email = () => auth.currentUser?.email || "admin";
const bersihkan = <T extends Record<string, any>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Riwayat booking yang dimuat: tanggal ambil mulai sekian hari lalu. */
export const RIWAYAT_BOOKING_HARI = 45;

/** Booking realtime: tanggal ambil ≥ 45 hari lalu (booking aktif + riwayat singkat). */
export function useBookingSewa(aktifkan = true) {
  const [list, setList] = useState<BookingSewa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!aktifkan) return;
    const dari = ymd(new Date(Date.now() - RIWAYAT_BOOKING_HARI * 86400000));
    const q = query(collection(db, KOLEKSI_BOOKING), where("tanggal", ">=", dari), orderBy("tanggal", "asc"), limit(400));
    return onSnapshot(
      q,
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
        setError("");
      },
      (e) => {
        setError(e?.message || String(e));
        setLoading(false);
      }
    );
  }, [aktifkan]);
  return { list, loading, error };
}

/** Kapasitas unit dari Monitoring › Status unit › Atur unit (data/master_unit). */
export function useKapasitasUnit(): Kapasitas {
  const [k, setK] = useState<Kapasitas>({ ps3: 0, ps4: 0, ps5: 0, tv: 0, portabel: 0 });
  useEffect(
    () =>
      onSnapshot(doc(db, "data", "master_unit"), (snap) => {
        const d = snap.data() || {};
        setK({ ps3: +d.ps3 || 0, ps4: +d.ps4 || 0, ps5: +d.ps5 || 0, tv: +d.tv || 0, portabel: +d.portabel || 0 });
      }),
    []
  );
  return k;
}

export async function simpanBooking(isi: IsiBooking, id?: string): Promise<string> {
  const data = bersihkan({
    ...isi,
    nama: String(isi.nama || "").trim(),
    wa: rapikanWa(isi.wa),
    ongkir: isi.antar ? toInt(isi.ongkir) : 0,
    alamat: isi.antar ? String(isi.alamat || "").trim() : "",
    catatan: String(isi.catatan || "").trim(),
    dp: isi.dp && toInt(isi.dp.nominal) > 0 ? { ...isi.dp, nominal: toInt(isi.dp.nominal) } : null,
  });
  if (id) {
    await updateDoc(doc(db, KOLEKSI_BOOKING, id), { ...data, diubahOleh: email(), diubahTs: Date.now() });
    return id;
  }
  const ref = await addDoc(collection(db, KOLEKSI_BOOKING), {
    ...data,
    status: data.status || (data.dp ? "KONFIRMASI" : "BARU"),
    diingatkan: [],
    dibuatOleh: email(),
    dibuatTs: Date.now(),
  });
  return ref.id;
}

export const ubahBooking = (id: string, patch: Partial<BookingSewa>) =>
  updateDoc(doc(db, KOLEKSI_BOOKING, id), { ...bersihkan(patch as any), diubahOleh: email(), diubahTs: Date.now() });

export const catatPesanBooking = (id: string, jenis: JenisPesanBooking) =>
  updateDoc(doc(db, KOLEKSI_BOOKING, id), { diingatkan: arrayUnion({ ts: Date.now(), oleh: email(), jenis }) });

/** Hapus permanen — hanya owner / super admin (dikunci juga di firestore.rules). */
export const hapusBooking = async (id: string) => {
  await deleteDoc(doc(db, KOLEKSI_BOOKING, id));
  // Catatan DP ikut terhapus (hanya owner / super admin yang boleh menghapus booking)
  await deleteDoc(doc(db, KOLEKSI_DP, idDpBooking(id))).catch((e) => console.warn("Hapus catatan DP booking:", e));
};

// ---------------------------------------------------------------- DP → transaksi owner (Analitik)

const KOLEKSI_DP = "owner_incomes";
export const SUMBER_DP_BOOKING = "booking";
export const KATEGORI_DP_BOOKING = "DP Booking Sewa";
export const idDpBooking = (bookingId: string) => `dpbooking_${bookingId}`;

/** DP booking ini harus tercatat sebagai pemasukan? (ada DP, dan tidak batal dengan DP dikembalikan) */
export const dpTercatat = (b: BookingSewa) =>
  !!b.dp && toInt(b.dp.nominal) > 0 && !(b.status === "BATAL" && b.batal?.dp !== "HANGUS");

const dataDp = (b: BookingSewa) => {
  const dp = b.dp!;
  const hangus = b.status === "BATAL" && b.batal?.dp === "HANGUS";
  return {
    nama: `DP booking ${String(b.nama || "").trim() || "tanpa nama"} · ${b.jenisPS || "-"} · ambil ${b.tanggal || "-"}${hangus ? " (hangus)" : ""}`,
    harga: toInt(dp.nominal),
    kategori: KATEGORI_DP_BOOKING,
    tanggal: tanggalHariKerja(Number(dp.ts) || Date.now()),
    bisnis: "RENTAL",
    metode: dp.metode === "CASH" ? "CASH" : "TRANSFER",
    sumber: SUMBER_DP_BOOKING,
    bookingId: b.id,
    buktiTransfer: dp.bukti || "",
  };
};

/**
 * Samakan catatan DP di `owner_incomes` dengan daftar booking (idempoten, ID dokumen tetap).
 * Hanya menyentuh booking yang ada di `list`, jadi booking lama di luar jendela daftar tidak terhapus.
 */
export async function sinkronDpBooking(list: BookingSewa[]): Promise<void> {
  const lama = await getDocs(query(collection(db, KOLEKSI_DP), where("sumber", "==", SUMBER_DP_BOOKING)));
  const lamaMap = new Map(lama.docs.map((d) => [d.id, d.data() as any]));
  const tugas: Promise<unknown>[] = [];
  list.forEach((b) => {
    if (!b?.id) return;
    const id = idDpBooking(b.id);
    const cur = lamaMap.get(id);
    if (!dpTercatat(b)) {
      if (cur) tugas.push(deleteDoc(doc(db, KOLEKSI_DP, id)));
      return;
    }
    const v = dataDp(b);
    const sama = cur && (Object.keys(v) as (keyof typeof v)[]).every((k) => cur[k] === v[k]);
    if (!sama) tugas.push(setDoc(doc(db, KOLEKSI_DP, id), { ...v, timestamp: cur?.timestamp || Number(b.dp!.ts) || Date.now() }));
  });
  await Promise.all(tugas);
}

// ---------------------------------------------------------------- ke Rincian Sewa

/**
 * Baris Rincian Sewa dari booking: baris sewa (sisa bayar; `_dpBooking` memotong harga).
 * DP sudah tercatat sebagai pemasukan sejak diterima (lihat `sinkronDpBooking`).
 */
export function barisSewaDariBooking(
  b: BookingSewa,
  o: { jamSekarang: string; lamaOptions: string[] }
): { sewa: Record<string, any> } {
  const dpNominal = b.dp ? toInt(b.dp.nominal) : 0;
  const lamaAda = o.lamaOptions.some((x) => x.toUpperCase() === String(b.lamaSewa || "").toUpperCase());
  const jamDurasiCustom = !lamaAda ? jamDurasi({ lamaSewa: b.lamaSewa }) : null;
  const sewa: Record<string, any> = {
    jenisPS: b.jenisPS,
    lamaSewa: lamaAda ? b.lamaSewa : jamDurasiCustom ? "Isi Sendiri" : "",
    ...(jamDurasiCustom ? { _customDurasi: String(jamDurasiCustom) } : {}),
    jamMasukSewa: o.jamSekarang,
    ket: b.nama,
    waPenyewa: b.wa,
    isPaid: "",
    isOngkir: b.antar ? "YA" : "TIDAK",
    _ongkir: b.antar && toInt(b.ongkir) > 0 ? toInt(b.ongkir) : "",
    _bayarOngkir: "",
    bayar: "",
    _bookingId: b.id,
    ...(dpNominal > 0 ? { _dpBooking: dpNominal } : {}),
  };
  return { sewa };
}


// ---------------------------------------------------------------- tampilan

/** "3 hari lagi" / "2 jam lagi" / "40 menit lagi" / "lewat 25 menit" */
export function sisaWaktu(ms: number, now: number): string {
  const d = ms - now;
  const a = Math.abs(d);
  const t = a >= 86400000 * 2 ? `${Math.round(a / 86400000)} hari` : a >= 3600000 ? `${Math.round(a / 3600000)} jam` : `${Math.max(1, Math.round(a / 60000))} menit`;
  return d >= 0 ? `${t} lagi` : `lewat ${t}`;
}

/** Pesan WA terakhir yang dikirim (konfirmasi / pengingat). */
export const pesanTerakhir = (b: Pick<BookingSewa, "diingatkan">, jenis?: JenisPesanBooking) =>
  (b.diingatkan || []).filter((x) => !jenis || x.jenis === jenis).sort((a, c) => c.ts - a.ts)[0] || null;

/**
 * Perlu diingatkan: booking aktif yang jam ambilnya ≤ 24 jam lagi (atau sudah lewat) dan
 * belum dikirimi pengingat dalam 12 jam terakhir.
 */
export function perluDiingatkan(b: BookingSewa, now: number): boolean {
  if (!aktif(b)) return false;
  const m = mulaiBooking(b);
  if (m === null || m - now > 86400000 || now - m > 6 * 3600000) return false;
  const p = pesanTerakhir(b, "PENGINGAT");
  return !p || now - p.ts > 12 * 3600000;
}

export const LABEL_STATUS: Record<StatusBooking, string> = {
  BARU: "Belum pasti",
  KONFIRMASI: "Pasti jadi",
  DIAMBIL: "Sudah diambil",
  BATAL: "Batal",
};

export const namaStaf = (email?: string) => String(email || "").split("@")[0] || "admin";

/** Booking yang perlu perhatian sekarang (titik di tab Monitoring): lewat jam ambil, hari ini, atau perlu diingatkan. */
export const jumlahPerhatianBooking = (list: BookingSewa[], now: number) =>
  list.filter((b) => aktif(b) && (["LEWAT", "HARI_INI"].includes(kelompokBooking(b, now)) || perluDiingatkan(b, now))).length;

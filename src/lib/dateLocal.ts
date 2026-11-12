/**
 * TANGGAL & HARI KERJA — satu sumber untuk seluruh aplikasi.
 *
 * Ruko bisa tutup lewat tengah malam, jadi satu "hari kerja" pembukuan berlangsung dari
 * pukul JAM_GANTI_HARI sampai pukul JAM_GANTI_HARI besoknya. Semua yang terjadi dini hari
 * (00:00 – 05:59) — nota POS, absen pulang, jam ambil sewa — milik hari kerja sebelumnya.
 */
import { pad as pad2 } from "./format";

/** Jam pergantian hari kerja (00:00 – 05:59 masih hari kerja kemarin). */
export const JAM_GANTI_HARI = 6;

/**
 * Tanggal YYYY-MM-DD menurut jam LOKAL perangkat (WIB).
 * Jangan pakai `toISOString().slice(0, 10)`: itu jam UTC, jadi jam 00:00–06:59 WIB
 * terbaca sebagai tanggal kemarin.
 */
export const toLocalYmd = (d: Date = new Date()): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** "YYYY-MM-DD" -> Date lokal pukul 00:00 (null bila tidak valid). */
export const dariYmd = (s: string): Date | null => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

/** Jam (0–23) dari teks "HH:MM" / "HH.MM" / "HH" / "HH:MM - …" (null bila tidak terbaca). */
export const jamDariTeks = (s: unknown): { jam: number; menit: number } | null => {
  const m = String(s ?? "").trim().match(/^(\d{1,2})(?:[:.](\d{2}))?(?!\d)/);
  if (!m) return null;
  const jam = Number(m[1]), menit = Number(m[2] || 0);
  return jam <= 23 && menit <= 59 ? { jam, menit } : null;
};

/** Jam dini hari (sebelum JAM_GANTI_HARI) = sesudah tengah malam, masih hari kerja kemarin. */
export const jamDiniHari = (jam: number) => jam >= 0 && jam < JAM_GANTI_HARI;

/** Tanggal hari kerja (YYYY-MM-DD) dari sebuah waktu. */
export const tanggalHariKerja = (ts: number = Date.now()) => toLocalYmd(new Date(ts - JAM_GANTI_HARI * 3600000));

/** Rentang waktu satu hari kerja: tanggal 06:00 s.d. besoknya 05:59:59.999. */
export function rentangHariKerja(tanggal: string): { from: number; to: number } | null {
  const d = dariYmd(tanggal);
  if (!d) return null;
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), JAM_GANTI_HARI).getTime();
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, JAM_GANTI_HARI).getTime() - 1;
  return { from, to };
}

/**
 * Waktu (ms) dari tanggal pembukuan + jam "HH:MM". Jam dini hari (00:00 – 05:59) jatuh
 * pada tanggal kalender BESOKNYA (masih hari kerja yang sama).
 */
export function waktuHariKerja(tanggal: string, jamTeks: unknown): number | null {
  const d = dariYmd(tanggal);
  const j = jamDariTeks(jamTeks);
  if (!d || !j) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (jamDiniHari(j.jam) ? 1 : 0), j.jam, j.menit).getTime();
}

/**
 * Urutan menit dalam satu hari kerja (untuk mengurutkan jam absen / buka / tutup):
 * 06:00 – 23:59 apa adanya, 00:00 – 05:59 sesudah 23:59. -1 bila tidak terbaca.
 */
export const menitHariKerja = (s: unknown): number => {
  const j = jamDariTeks(String(s ?? "").split(" - ")[0]);
  if (!j) return -1;
  return (jamDiniHari(j.jam) ? 24 + j.jam : j.jam) * 60 + j.menit;
};

/**
 * Filter "Pilih Bulan" tidak punya pilihan tahun. Bulan yang belum terjadi tahun ini
 * berarti bulan itu di tahun lalu (mis. Januari 2027 pilih Desember → Desember 2026).
 */
export const resolveMonthYear = (month: number | string, now: Date = new Date()): number =>
  Number(month) > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();

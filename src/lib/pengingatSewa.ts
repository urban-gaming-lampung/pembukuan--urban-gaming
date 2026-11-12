/**
 * PENGINGAT PENGEMBALIAN UNIT SEWA (WhatsApp penyewa)
 *
 * Aturan URBAN:
 * - Batas pengembalian = waktu sewa habis + 1 jam (toleransi).
 * - Lewat batas: biaya sewa tambahan per jam; keterlambatan > 10 menit dihitung 1 jam.
 * - Tarif per jam: PS3 5rb · PS4 7rb · PS5 15rb · Hanya TV 5rb (paket + TV / portable ikut konsolnya).
 * - No. WA penyewa wajib diisi di Rincian SEWA PS (mulai WA_WAJIB_SEJAK).
 */
import type { HistoryItem } from "./types";
import { pad } from "./format";
import { waValid } from "./wa";
import { isHanyaOngkir, isItemTambahan, isPelunasanSewa, jenisUnit, waBaris } from "./sewa";

export const TOLERANSI_KEMBALI_MENIT = 60;
export const TOLERANSI_TELAT_MENIT = 10;
/** Pembukuan mulai tanggal ini wajib mengisi No. WA penyewa (pembukuan lama tetap bisa diedit). */
export const WA_WAJIB_SEJAK = "2026-11-13";
/** Tombol "Ingatkan" mulai tampil di kartu status unit sekian menit sebelum sewa habis. */
export const INGATKAN_SEBELUM_MENIT = 30;

// ---------- No. WA penyewa ----------
/** Baris yang WAJIB punya No. WA: sewa unit berdurasi (bukan ongkir saja, pelunasan, atau item tambahan). */
export function wajibWaPenyewa(r: any, tanggal: string): boolean {
  if (!tanggal || tanggal < WA_WAJIB_SEJAK) return false;
  return !isHanyaOngkir(r) && !isPelunasanSewa(r) && !isItemTambahan(r);
}

/** Kunci nama penyewa untuk mencocokkan riwayat ("  Budi  Santoso" = "budi santoso"). */
export const kunciNama = (n: unknown) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");

/** Nama penyewa -> No. WA terakhir dari riwayat pembukuan (untuk saran isi cepat). */
export function petaWaPenyewa(history: HistoryItem[] | undefined, rowsSekarang: any[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  const catat = (r: any) => {
    const wa = waBaris(r);
    if (wa && waValid(wa) && kunciNama(r.ket)) out[kunciNama(r.ket)] = wa;
  };
  [...(history || [])]
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
    .forEach((h) => (h.rowsSewa || []).forEach(catat));
  rowsSekarang.forEach(catat);
  return out;
}

// ---------- Tarif keterlambatan ----------
/** Tarif sewa tambahan per jam (null = tidak diketahui, mis. unit di luar PS3/PS4/PS5/TV). */
export function tarifTelatPerJam(jenis: unknown): number | null {
  const u = jenisUnit(jenis);
  if (u.konsol === "PS5") return 15000;
  if (u.konsol === "PS4") return 7000;
  if (u.konsol === "PS3") return 5000;
  if (u.hanyaTv) return 5000;
  return null;
}

// ---------- Teks waktu ----------
/** Salam sesuai jam kirim. */
export function salamWaktu(d: Date): "pagi" | "siang" | "sore" | "malam" {
  const h = d.getHours();
  if (h >= 4 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
}
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const jamTitik = (d: Date) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;
/** "pukul 22.30", "besok pukul 10.00", "kemarin pukul 23.00", "Sabtu, 14 Nov pukul 10.00" */
export function waktuRelatif(ts: number, now: number): string {
  const d = new Date(ts);
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(ts); b.setHours(0, 0, 0, 0);
  const selisih = Math.round((b.getTime() - a.getTime()) / 86400000);
  const jamKini = new Date(now).getHours();
  if (selisih === 0) return `pukul ${jamTitik(d)}`;
  // Lewat tengah malam: "malam ini pukul 00.30" / "tadi malam pukul 22.58" lebih mudah dipahami
  if (selisih === 1 && d.getHours() < 4 && jamKini >= 18) return `malam ini pukul ${jamTitik(d)}`;
  if (selisih === -1 && d.getHours() >= 18 && jamKini < 4) return `tadi malam pukul ${jamTitik(d)}`;
  if (selisih === 1) return `besok pukul ${jamTitik(d)}`;
  if (selisih === -1) return `kemarin pukul ${jamTitik(d)}`;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} pukul ${jamTitik(d)}`;
}
export const batasKembali = (endMs: number) => endMs + TOLERANSI_KEMBALI_MENIT * 60000;

const rpRapat = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

/** Pesan WhatsApp pengingat pengembalian unit. */
export function pesanPengingat(o: { nama?: string; jenis: string; endMs: number; now?: number; noNota?: string }): string {
  const now = o.now ?? Date.now();
  const batas = batasKembali(o.endMs);
  const nama = String(o.nama || "").trim();
  const sapaan = nama && nama.toLowerCase() !== "tanpa nama" ? `Kak ${nama}` : "Kak";
  const tarif = tarifTelatPerJam(o.jenis);
  const biaya = tarif
    ? `biaya sewa tambahan sebesar *${rpRapat(tarif)}/jam*`
    : "biaya sewa tambahan per jam";
  const unit = `*${o.jenis}*${o.noNota ? ` (nota ${o.noNota})` : ""}`;
  const aturanTelat = `keterlambatan lebih dari ${TOLERANSI_TELAT_MENIT} menit dihitung 1 jam`;
  const isi =
    now <= batas
      ? [
          `Kami dari URBAN ingin konfirmasi, sewa ${unit} habis ${waktuRelatif(o.endMs, now)}, dan maksimal dikembalikan ${waktuRelatif(batas, now)}.`,
          ``,
          `Apabila melebihi batas waktu pengembalian, akan dikenakan ${biaya} (${aturanTelat}).`,
        ]
      : [
          `Kami dari URBAN ingin konfirmasi, sewa ${unit} sudah habis ${waktuRelatif(o.endMs, now)} dan batas pengembalian ${waktuRelatif(batas, now)} sudah terlewati.`,
          ``,
          `Mohon unit segera dikembalikan ya Kak. Sesuai ketentuan, keterlambatan dikenakan ${biaya} (${aturanTelat}).`,
        ];
  return [`Selamat ${salamWaktu(new Date(now))} ${sapaan} 🙏🏻`, ``, ...isi, ``, `Terima kasih 🙏🏻`].join("\n");
}

export type CatatanPengingat = { ts: number; oleh: string };
/** "Diingatkan 21.05 · galang" */
export const labelPengingat = (c?: CatatanPengingat[]) => {
  const t = c && c.length ? c[c.length - 1] : null;
  return t ? `Diingatkan ${jamTitik(new Date(t.ts))} · ${String(t.oleh || "").split("@")[0]}` : "";
};

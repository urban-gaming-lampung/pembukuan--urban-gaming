/**
 * SEWA PS — aturan baris "Rincian Pemasukan SEWA PS" (SSOT).
 * Dipakai tabel sewa, nota sewa, monitoring status unit, pengingat WA, peringatan
 * "waktu sewa habis", validasi simpan, gaji (ongkir pengantar) & analitik.
 */
import { toInt } from "./format";
import { waktuHariKerja, toLocalYmd } from "./dateLocal";
import { getSewaPrice, SewaTable } from "./priceLists";
import { rapikanWa } from "./wa";
import type { HistoryItem } from "./types";

/** Baris sewa dari form / history (kolom tambahan `_...` ikut tersimpan). */
type Baris = Record<string, any>;

// ---------- Jenis baris ----------
export const isPelunasanSewa = (r: Baris | null | undefined) => String(r?.lamaSewa ?? "").trim() === "PELUNASAN";
export const isHanyaOngkir = (r: Baris | null | undefined) => String(r?.jenisPS ?? "").trim().toLowerCase() === "hanya ongkir";
/** Item tambahan berharga tetap tanpa durasi (mis. "Tambah Sewa Stik PS4"): lama sewa "-". */
export const isItemTambahan = (r: Baris | null | undefined) => String(r?.lamaSewa ?? "").trim() === "-" && !isHanyaOngkir(r);
/** Baris tanpa unit yang keluar: hanya ongkir, item tambahan, atau pelunasan. */
export const tanpaUnitKeluar = (r: Baris | null | undefined) => isHanyaOngkir(r) || isItemTambahan(r) || isPelunasanSewa(r);

/** No. WA penyewa sebuah baris (kolom No. WA Penyewa; data lama dari nota sewa), bentuk 08xx. */
export const waBaris = (r: Baris | null | undefined): string => rapikanWa(r?.waPenyewa || r?._waPenyewa || "");

// ---------- Durasi & waktu ----------
/** Lama sewa dalam jam (null bila baris tidak berdurasi / tidak terbaca). */
export function jamDurasi(r: Baris | null | undefined): number | null {
  if (String(r?.lamaSewa ?? "") === "Isi Sendiri") {
    const n = parseFloat(String(r?._customDurasi ?? "").replace(",", "."));
    return n > 0 ? n : null;
  }
  const s = String(r?.lamaSewa ?? "").toUpperCase();
  const hari = s.match(/(\d+)\s*HARI/);
  if (hari) return Number(hari[1]) * 24 || null;
  const jam = s.match(/(\d+)\s*JAM/);
  if (jam) return Number(jam[1]) || null;
  if (/SEHARI|SEMALAM|HARI/.test(s)) return 24;
  return null;
}

/** Label durasi untuk pelanggan: "12 JAM", "2 HARI", "6 Jam", "1,5 Jam". */
export function labelDurasi(r: Baris | null | undefined): string {
  if (String(r?.lamaSewa ?? "") !== "Isi Sendiri") return String(r?.lamaSewa || "");
  const j = jamDurasi(r);
  return j ? `${String(j).replace(".", ",")} Jam` : "";
}

/**
 * Waktu ambil & waktu sewa habis (ms) sebuah baris pada tanggal pembukuannya.
 * Jam ambil dini hari (00:00 – 05:59) = sesudah tengah malam (hari kerja yang sama).
 */
export function waktuSewa(r: Baris | null | undefined, tanggal: string): { mulai: number; selesai: number; jam: number } | null {
  const jam = jamDurasi(r);
  const mulai = waktuHariKerja(tanggal, r?.jamMasukSewa);
  if (!jam || mulai === null) return null;
  return { mulai, selesai: mulai + jam * 3600000, jam };
}

// ---------- Jenis unit ----------
export type KelasKonsol = "PS5" | "PS4" | "PS3";
/**
 * Jenis unit dari teks "Jenis Sewa": konsol (PS tanpa versi dianggap PS3), ikut TV, portable.
 * "PS4 + TV" = PS4 + TV · "PS3 Portable" = PS3 + portable · "Hanya TV" = TV saja.
 */
export function jenisUnit(jenisPS: unknown): { konsol: KelasKonsol | null; tv: boolean; portabel: boolean; hanyaTv: boolean } {
  const s = String(jenisPS ?? "").toLowerCase();
  const tv = s.includes("tv");
  const portabel = /portabel|portable|switch|rog|steam/.test(s);
  const konsol: KelasKonsol | null =
    s.includes("ps5") || s.includes("ps 5") ? "PS5"
    : s.includes("ps4") || s.includes("ps 4") || /pro|fat|slim/.test(s) ? "PS4"
    : s.includes("ps") ? "PS3"
    : null;
  return { konsol, tv, portabel, hanyaTv: tv && !konsol && !portabel };
}

// ---------- Harga & ongkir ----------
/** Ongkir yang dibayar penyewa pada baris (0 bila tanpa ongkir). */
export const ongkirBaris = (r: Baris | null | undefined) => (r?.isOngkir === "YA" ? toInt(r?._ongkir) : 0);

/** Harga sewa dasar (tanpa ongkir) dari tabel harga Edit Rincian, atau harga "Isi Sendiri". */
export function hargaDasarSewa(r: Baris | null | undefined, sewaTable: SewaTable): number {
  if (!r?.jenisPS || isHanyaOngkir(r)) return 0;
  if (r.lamaSewa === "Isi Sendiri") return toInt(r._customBase);
  return getSewaPrice(sewaTable, r.jenisPS, r.lamaSewa);
}

/** Tagihan penyewa yang belum bayar (sewa + ongkir). 0 bila baris sudah dibayar. */
export const tagihanBelumBayar = (r: Baris | null | undefined, sewaTable: SewaTable) =>
  r?.isPaid === "TIDAK" ? hargaDasarSewa(r, sewaTable) + ongkirBaris(r) : 0;

/**
 * Kolom "Harga" baris sewa sesudah jenis / lama / harga isi sendiri / ongkir / status bayar diubah:
 * harga dasar + ongkir; belum dibayar = 0; hanya ongkir = ongkir.
 * `dasarLama` = harga dasar sebelumnya, dipakai bila unit + durasi tidak ada di tabel harga
 * (mis. baris pelunasan) saat hanya ongkirnya yang diubah.
 */
export function hargaKolomSewa(r: Baris, sewaTable: SewaTable, dasarLama?: number): number {
  if (r.isPaid === "TIDAK") return 0;
  if (isHanyaOngkir(r)) return toInt(r._ongkir);
  const dasar = hargaDasarSewa(r, sewaTable);
  return (dasar > 0 || r.lamaSewa === "Isi Sendiri" ? dasar : dasarLama ?? 0) + ongkirBaris(r);
}

/** Harga dasar baris saat ini (harga kolom tanpa ongkir) — untuk `dasarLama`. */
export const dasarDariHarga = (r: Baris) => Math.max(0, toInt(r.harga) - ongkirBaris(r));

// ---------- Ongkir pengantar (bagi hasil) ----------
/** Ongkir bagi hasil berlaku untuk pembukuan mulai tanggal ini (sebelumnya: sistem lama). */
export const ONGKIR_BAGI_HASIL_SEJAK = "2026-04-29";
/** Persen default bagi pengantar bila pengaturan belum terbaca. */
export const PERSEN_PENGANTAR_BAWAAN = 70;

/**
 * Bagian pengantar dari ongkir baris yang SUDAH tersimpan (dipakai gaji & analitik).
 * null = sistem lama (ongkir penuh hanya ditampilkan, tidak masuk gaji).
 */
export function ongkirPengantarTersimpan(r: Baris | null | undefined): number | null {
  if (!r?._isNewOngkirSystem) return null;
  if (typeof r._ongkirPegawaiNominal === "number") return r._ongkirPegawaiNominal;
  return Math.round((toInt(r._ongkir) * (r._ongkirPegawaiPersen ?? PERSEN_PENGANTAR_BAWAAN)) / 100);
}

/** Persen bagian pengantar untuk baris di form: persen yang sudah tersimpan, atau pengaturan saat ini. */
const persenPengantar = (r: Baris, persenSekarang: number) =>
  r._isNewOngkirSystem && typeof r._ongkirPegawaiPersen === "number" ? r._ongkirPegawaiPersen : persenSekarang;

/** Bagian pengantar dari ongkir baris di form (dihitung ulang dari nominal ongkir sekarang). */
export const ongkirPengantar = (r: Baris, persenSekarang: number) => Math.round((ongkirBaris(r) * persenPengantar(r, persenSekarang)) / 100);

/**
 * Baris sewa siap disimpan: ongkir bagi hasil dicatat (persen, nominal pengantar & owner).
 * Baris sistem lama (sebelum ONGKIR_BAGI_HASIL_SEJAK) tidak diubah.
 */
export function siapkanOngkirSimpan<T extends Baris>(r: T, tanggal: string, cfg: { pegawaiPersen: number; masukGaji: boolean }): T {
  const ongkir = ongkirBaris(r);
  if (ongkir <= 0) return r;
  if (!r._isNewOngkirSystem && tanggal < ONGKIR_BAGI_HASIL_SEJAK) return r;
  const persen = persenPengantar(r, cfg.pegawaiPersen);
  const pegawai = Math.round((ongkir * persen) / 100);
  return {
    ...r,
    _isNewOngkirSystem: true,
    _ongkirPegawaiPersen: persen,
    _ongkirMasukGaji: r._isNewOngkirSystem && typeof r._ongkirMasukGaji === "boolean" ? r._ongkirMasukGaji : cfg.masukGaji,
    _ongkirPegawaiNominal: pegawai,
    _ongkirOwnerNominal: ongkir - pegawai,
  };
}

// ---------- Unit yang sedang / pernah disewa ----------
export type SewaBerjalan = {
  /** Kunci unik: jenis-jam-penyewa-tanggal#urutan (2 unit identik tetap 2 baris) */
  uid: string;
  jenis: string;
  namaPenyewa: string;
  tanggal: string;
  /** Jam ambil (teks di tabel) */
  start: string;
  mulaiMs: number | null;
  endMs: number | null;
  durasiJam: number | null;
  isDone: boolean;
  isVerified: boolean;
  addedBy?: string;
  isPaid: string;
  isOngkir: string;
  diantarOleh: string;
  waPenyewa: string;
  diingatkan: { ts: number; oleh: string }[];
  /** Sumber baris: form aktif (index) atau dokumen history */
  isLive: boolean;
  sourceIdx?: number;
  historyId?: string;
  _rawRow: Baris;
};

/** Baris sewa yang menghitung satu unit keluar. */
const barisUnit = (r: Baris) =>
  !tanpaUnitKeluar(r) && !!r.jenisPS && !!r.jamMasukSewa && !!r.lamaSewa && (toInt(r.harga) > 0 || r.isPaid === "TIDAK");

/**
 * Unit sewa yang masih jalan atau belum dikonfirmasi kembali — dari history 31 hari terakhir
 * dan form aktif. Baris form aktif menggantikan baris history yang sama (tanggal yang sedang diedit).
 */
export function daftarSewaBerjalan(o: { history?: HistoryItem[]; rowsSewa?: Baris[]; activeDate?: string; now: number }): SewaBerjalan[] {
  const peta = new Map<string, SewaBerjalan>();
  const tambah = (r: Baris, tanggal: string, seen: Map<string, number>, sumber: { isLive: boolean; sourceIdx?: number; historyId?: string }) => {
    const base = `${String(r.jenisPS).trim()}-${String(r.jamMasukSewa).trim()}-${String(r.ket || "").trim()}-${tanggal}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    const uid = `${base}#${n}`;
    const w = waktuSewa(r, tanggal);
    peta.set(uid, {
      uid,
      jenis: String(r.jenisPS),
      namaPenyewa: String(r.ket || "").trim() || "Tanpa Nama",
      tanggal,
      start: String(r.jamMasukSewa),
      mulaiMs: w?.mulai ?? null,
      endMs: w?.selesai ?? null,
      durasiJam: w?.jam ?? null,
      isDone: !!w && o.now >= w.selesai,
      isVerified: !!r._verifiedReturn,
      addedBy: r._addedBy,
      isPaid: String(r.isPaid || ""),
      isOngkir: String(r.isOngkir || ""),
      diantarOleh: String(r.diantarOleh || ""),
      waPenyewa: waBaris(r),
      diingatkan: Array.isArray(r._diingatkan) ? r._diingatkan : [],
      ...sumber,
      _rawRow: r,
    });
  };

  const histSeen = new Map<string, number>();
  (o.history || []).forEach((h) => {
    if ((o.now - new Date(h.tanggal).getTime()) / 86400000 > 31) return;
    (h.rowsSewa || []).forEach((r: Baris) => { if (barisUnit(r)) tambah(r, h.tanggal, histSeen, { isLive: false, historyId: h.id }); });
  });
  const liveSeen = new Map<string, number>();
  const tglForm = o.activeDate || toLocalYmd(new Date(o.now));
  (o.rowsSewa || []).forEach((r, idx) => { if (barisUnit(r)) tambah(r, tglForm, liveSeen, { isLive: true, sourceIdx: idx }); });

  // Unit yang belum dikonfirmasi kembali tetap dihitung jalan (tidak otomatis READY)
  return Array.from(peta.values()).filter((u) => !u.isDone || !u.isVerified);
}

/** Peringatan "waktu sewa habis" untuk admin yang mencatat sewanya (maks. 2,5 hari sesudah habis). */
export const perluKonfirmasiKembali = (u: SewaBerjalan, email: string | null | undefined, now: number) =>
  !!email && u.addedBy === email && u.isDone && !u.isVerified && u.endMs !== null && now - u.endMs <= 2.5 * 86400000;

/** Index baris sewa di history yang dimaksud (pakai _rowId; bila tidak ada, baris cocok pertama yang belum dikonfirmasi). */
export function cariBarisSewa(rows: Baris[], target: Baris | null | undefined): number {
  const t = target || {};
  if (t._rowId) {
    const i = rows.findIndex((r) => r?._rowId === t._rowId);
    if (i >= 0) return i;
  }
  const sama = (r: Baris) => r?.jenisPS === t.jenisPS && r?.jamMasukSewa === t.jamMasukSewa && String(r?.ket || "") === String(t.ket || "");
  const belum = rows.findIndex((r) => sama(r) && !r._verifiedReturn);
  return belum >= 0 ? belum : rows.findIndex(sama);
}

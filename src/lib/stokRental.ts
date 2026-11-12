/**
 * STOK RENTAL — aturan bersama halaman Stok (Page Owner › Stok & Update Stok admin).
 *
 * - Kategori "UPDATE STIK / KONSOL / DEVICE" dihitung otomatis dari Monitoring (stiker perangkat).
 * - Kategori lain (mis. JAJANAN) diisi manual dan tersimpan langsung.
 * - "UPDATE STOK KEBUTUHAN" sudah dihapus dari stok rental.
 * - JAJANAN ikut pengaturan "Tampilkan Tabel di Usaha Rental › Pemasukan Jajanan".
 */
import type { StokItemValue, StokKategori } from "../hooks/useStokData";

/** Kategori yang dihitung otomatis dari Monitoring (read-only di halaman stok). */
export const KATEGORI_MONITORING = [
  "UPDATE KONSOL - PLAYSTATION 3",
  "UPDATE KONSOL - PLAYSTATION 4",
  "UPDATE STIK - STIK PS3",
  "UPDATE STIK - STIK PS3 ORI MESIN",
  "UPDATE STIK - STIK PS4",
  "UPDATE STIK - STIK PS4 ORI MESIN",
  "UPDATE DEVICE - TV MONITOR",
  "UPDATE DEVICE - PLAYBOX / PORTABEL",
];

/** Kategori rental yang sudah tidak dipakai (tidak ditampilkan walau masih ada di data lama). */
export const KATEGORI_RENTAL_DIHAPUS = ["UPDATE STOK KEBUTUHAN"];

const up = (s: string) => String(s || "").trim().toUpperCase();
export const isKategoriMonitoring = (k: string) => KATEGORI_MONITORING.some((m) => m === up(k));
export const isKategoriDihapus = (k: string) => KATEGORI_RENTAL_DIHAPUS.some((m) => m === up(k));
export const isKategoriJajanan = (k: string) => /JAJANAN/.test(up(k));

/** Nama tampilan kategori rental: "UPDATE STIK - STIK PS3" -> "STIK PS3", "UPDATE JAJANAN" -> "JAJANAN". */
export function labelKategoriRental(k: string): string {
  const s = up(k).replace(/^UPDATE\s+/, "");
  const i = s.indexOf(" - ");
  return i >= 0 ? s.slice(i + 3) : s;
}

export type GrupPerangkat = "KONSOL" | "STIK" | "PERANGKAT";
export const grupPerangkat = (k: string): GrupPerangkat => (/KONSOL/.test(up(k)) ? "KONSOL" : /STIK/.test(up(k)) ? "STIK" : "PERANGKAT");
export const LABEL_GRUP: Record<GrupPerangkat, string> = { KONSOL: "Konsol", STIK: "Stik", PERANGKAT: "TV & Playbox" };

/** Kategori barang rental yang boleh tampil (bukan monitoring, bukan yang dihapus, jajanan sesuai pengaturan). */
export function kategoriBarangRental(master: StokKategori[] | undefined, tampilJajanan: boolean): StokKategori[] {
  return (Array.isArray(master) ? master : []).filter(
    (c) => c && !isKategoriMonitoring(c.kategori) && !isKategoriDihapus(c.kategori) && (tampilJajanan || !isKategoriJajanan(c.kategori))
  );
}

export type BarisPerangkat = { kategori: string; grup: GrupPerangkat; label: string; bagus: number; rusak: number; lastTs: number | null };

/** Jumlah bagus / rusak per kategori perangkat dari data stok rental (hasil sinkron Monitoring). */
export function barisPerangkat(
  master: StokKategori[] | undefined,
  rental: Record<string, Record<string, StokItemValue>> | undefined,
  parseTs: (v?: StokItemValue) => number | null
): BarisPerangkat[] {
  const list = (Array.isArray(master) ? master : []).filter((c) => c && isKategoriMonitoring(c.kategori));
  const urut = (k: string) => KATEGORI_MONITORING.indexOf(up(k));
  return list
    .sort((a, b) => urut(a.kategori) - urut(b.kategori))
    .map((c) => {
      const data = rental?.[c.kategori] || {};
      const ambil = (jenis: "bagus" | "rusak") => {
        const key = Object.keys(data).find((x) => x.toLowerCase() === jenis);
        return key ? data[key] : undefined;
      };
      const b = ambil("bagus"), r = ambil("rusak");
      const ts = [parseTs(b), parseTs(r)].filter((x): x is number => typeof x === "number");
      return {
        kategori: c.kategori,
        grup: grupPerangkat(c.kategori),
        label: labelKategoriRental(c.kategori),
        bagus: Math.max(0, Math.round(Number(b?.jumlah) || 0)),
        rusak: Math.max(0, Math.round(Number(r?.jumlah) || 0)),
        lastTs: ts.length ? Math.max(...ts) : null,
      };
    });
}

// ============================================================
// Buka halaman Stok dari tempat lain (mis. sebelum kirim laporan PDF)
// ============================================================
export type JenisStok = "RENTAL" | "JUALAN";
export const EVENT_BUKA_STOK = "urban:buka-stok";
let permintaan: JenisStok | null = null;

/** Minta halaman Stok terbuka di sub halaman tertentu (dipakai Page Owner & Update Stok admin). */
export function bukaHalamanStok(tab: JenisStok = "RENTAL") {
  permintaan = tab;
  window.dispatchEvent(new CustomEvent(EVENT_BUKA_STOK, { detail: tab }));
}
export const adaPermintaanStok = () => permintaan !== null;
/** Ambil (dan hapus) permintaan sub halaman yang tertunda. */
export function ambilPermintaanStok(): JenisStok | null {
  const t = permintaan;
  permintaan = null;
  return t;
}

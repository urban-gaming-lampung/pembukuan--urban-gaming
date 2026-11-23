/**
 * Tabel rincian yang dinonaktifkan owner (Pengaturan › Tampilkan Tabel di Pembukuan)
 * ikut disembunyikan di ringkasan lain: Rekap pemasukan, Riwayat pembukuan, PDF.
 * Pengecualian: kategori yang ternyata punya nilai (data lama) tetap tampil supaya total tetap cocok.
 */
import { useSyncExternalStore } from "react";

export type KunciRincian = "harian" | "jajanan" | "jasaAks" | "sewa" | "pengeluaran" | "setoran";
type Vis = Partial<Record<KunciRincian, boolean>>;

let vis: Vis = {};
const pendengar = new Set<() => void>();

export function setTampilRincian(v: Vis) {
  vis = { ...v };
  pendengar.forEach((f) => f());
}

const langganan = (cb: () => void) => {
  pendengar.add(cb);
  return () => { pendengar.delete(cb); };
};

/** `tampil(kunci, nilai)` → true bila tabel aktif, atau nilainya bukan 0. */
export function useTampilRincian() {
  const v = useSyncExternalStore(langganan, () => vis, () => vis);
  return (kunci: KunciRincian, nilai = 0) => v[kunci] !== false || (Number(nilai) || 0) !== 0;
}

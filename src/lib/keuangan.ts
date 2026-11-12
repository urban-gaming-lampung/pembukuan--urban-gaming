/**
 * KEUANGAN OWNER — satu sumber (SSOT) untuk transaksi uang owner:
 * - PENGELUARAN  -> koleksi `owner_expenses`
 * - PEMASUKAN    -> koleksi `owner_incomes` (modal masuk, suntikan dana, pemasukan lain)
 * Setiap transaksi milik salah satu model usaha: RENTAL atau USAHA (toko / jualan).
 */
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { resolveMonthYear } from "./dateLocal";
import type { HistoryItem } from "./types";

export type JenisTransaksi = "PENGELUARAN" | "PEMASUKAN";
export type Bisnis = "RENTAL" | "USAHA";
export const BISNIS_LABEL: Record<Bisnis, string> = { RENTAL: "Rental", USAHA: "Usaha" };
export const KOLEKSI: Record<JenisTransaksi, string> = { PENGELUARAN: "owner_expenses", PEMASUKAN: "owner_incomes" };

export type TransaksiOwner = {
  id: string;
  nama: string;
  harga: number;
  kategori: string;
  tanggal: string; // YYYY-MM-DD
  timestamp?: number;
  bisnis?: Bisnis;
  /** "input_stok" = dibuat otomatis dari stok masuk (diubah lewat Input › Stok Jualan) */
  sumber?: string;
  produkId?: string;
  stokMasukId?: string;
};

/** Pengeluaran belanja stok barang jualan (dibuat otomatis dari Input › Stok Jualan, atau kategori "Stok Jualan"). */
export const isBelanjaStok = (o: Pick<TransaksiOwner, "sumber" | "kategori">) => o.sumber === "input_stok" || o.kategori === "Stok Jualan";

/** Model usaha sebuah transaksi. Data lama tanpa field `bisnis`: stok jualan = USAHA, sisanya RENTAL. */
export const bisnisOf = (o: Pick<TransaksiOwner, "bisnis" | "sumber" | "kategori">): Bisnis =>
  o.bisnis === "USAHA" || o.bisnis === "RENTAL" ? o.bisnis : o.sumber === "input_stok" || o.kategori === "Stok Jualan" ? "USAHA" : "RENTAL";

/** Transaksi owner (realtime) sesuai filter analitik (data diambil sedikit lebih luas, lalu disaring). */
export function useTransaksiOwner(jenis: JenisTransaksi, mode: string, month: number, rangeStart: string, rangeEnd: string): TransaksiOwner[] {
  const [items, setItems] = useState<TransaksiOwner[]>([]);
  useEffect(() => {
    const base = collection(db, KOLEKSI[jenis]);
    let q;
    if (mode === "Semua Bulan") q = query(base, orderBy("tanggal", "desc"));
    else if (mode === "Pilih Bulan") {
      const yyyy = resolveMonthYear(month);
      const mm = String(month).padStart(2, "0");
      q = query(base, where("tanggal", ">=", `${yyyy}-${mm}-01`), where("tanggal", "<=", `${yyyy}-${mm}-31`), orderBy("tanggal", "desc"));
    } else if (mode === "Rentang" && rangeStart && rangeEnd) {
      const [a, b] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
      q = query(base, where("tanggal", ">=", a), where("tanggal", "<=", b), orderBy("tanggal", "desc"));
    } else {
      const c = new Date();
      c.setDate(c.getDate() - 60);
      const ymd = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
      q = query(base, where("tanggal", ">=", ymd), orderBy("tanggal", "desc"));
    }
    return onSnapshot(
      q,
      (snap) => {
        const res: TransaksiOwner[] = [];
        snap.forEach((d) => {
          const x = d.data() as any;
          res.push({ id: d.id, ...x, harga: Number(x.harga) || 0 });
        });
        setItems(res.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      },
      (e) => console.warn(KOLEKSI[jenis] + ":", e)
    );
  }, [jenis, mode, month, rangeStart, rangeEnd]);
  return items;
}

/** Saring transaksi dengan aturan periode yang sama dengan pembukuan rental. */
export function saringPeriode<T extends { tanggal: string }>(items: T[], mode: string, month: number, rangeStart: string, rangeEnd: string): T[] {
  const now = new Date();
  const d = (s: string) => new Date(s);
  if (mode === "Bulan Ini") return items.filter((o) => d(o.tanggal).getMonth() === now.getMonth() && d(o.tanggal).getFullYear() === now.getFullYear());
  if (mode === "7 Hari Terakhir") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6); // hari ini + 6 hari sebelumnya
    cutoff.setHours(0, 0, 0, 0);
    return items.filter((o) => { const x = d(o.tanggal); x.setHours(0, 0, 0, 0); return x >= cutoff; });
  }
  if (mode === "Semua Bulan") return items;
  if (mode === "Pilih Bulan") return items.filter((o) => d(o.tanggal).getMonth() + 1 === Number(month) && d(o.tanggal).getFullYear() === resolveMonthYear(month));
  if (mode === "Rentang" && rangeStart && rangeEnd) {
    const [a, b] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    const s = d(a); s.setHours(0, 0, 0, 0);
    const e = d(b); e.setHours(23, 59, 59, 999);
    return items.filter((o) => { const x = d(o.tanggal); return x >= s && x <= e; });
  }
  return items;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const parseYmd = (s: string) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

/** Rentang waktu (ms) dari filter analitik — dipakai Analitik Usaha & Keseluruhan (POS memakai timestamp). */
export function periodRange(mode: string, month: number, rs: string, re: string): { from: number; to: number; label: string } {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  if (mode === "Bulan Ini") return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: eod(now), label: `${BULAN[now.getMonth()]} ${now.getFullYear()}` };
  if (mode === "7 Hari Terakhir") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { from: sod(s), to: eod(now), label: "7 hari terakhir" };
  }
  if (mode === "Pilih Bulan") {
    const y = resolveMonthYear(month);
    const m = Math.min(12, Math.max(1, Number(month) || 1)) - 1;
    return { from: new Date(y, m, 1).getTime(), to: new Date(y, m + 1, 0, 23, 59, 59, 999).getTime(), label: `${BULAN[m]} ${y}` };
  }
  if (mode === "Rentang") {
    let a = parseYmd(rs), b = parseYmd(re);
    if (a && b) {
      if (a > b) [a, b] = [b, a];
      const f = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return { from: sod(a), to: eod(b), label: `${f(a)} – ${f(b)}` };
    }
    // Tanggal rentang belum lengkap -> sama dengan pembukuan rental: tampilkan semua
    return { from: 0, to: eod(now), label: "semua waktu" };
  }
  if (mode === "Semua Bulan") return { from: 0, to: eod(now), label: "semua waktu" };
  return { from: sod(now), to: eod(now), label: "hari ini" };
}

const toNum = (v: unknown) => {
  const n = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Pemasukan RENTAL satu hari pembukuan: harian + jajanan + sewa.
 * Rincian Pemasukan Usaha (isi game, HEN, servis, aksesoris) adalah pemasukan USAHA —
 * dihitung di Analitik › Usaha (lib/pemasukanUsaha), walau uangnya ikut kas harian.
 */
export const pemasukanRental = (h: HistoryItem) => toNum(h.totalHarian) + toNum(h.totalJajanan) + toNum(h.totalSewa);

/** Pengeluaran yang dicatat admin di pembukuan rental harian (termasuk ongkir). */
export function pengeluaranAdminRental(h: HistoryItem): { nama: string; harga: number; tanggal: string }[] {
  const rows = (h as any).rowsPengeluaran;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: any) => ({ nama: r.ket || "Tanpa Ket", harga: toNum(r.harga || r.nominal), tanggal: r.tanggal || h.tanggal }))
    .filter((r: { harga: number }) => r.harga > 0);
}

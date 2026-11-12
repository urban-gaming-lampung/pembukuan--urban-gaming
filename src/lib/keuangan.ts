/**
 * KEUANGAN OWNER — satu sumber (SSOT) untuk transaksi uang owner:
 * - PENGELUARAN  -> koleksi `owner_expenses`
 * - PEMASUKAN    -> koleksi `owner_incomes` (modal masuk, suntikan dana, pemasukan lain)
 * Setiap transaksi milik salah satu model usaha: RENTAL atau USAHA (toko / jualan).
 */
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { dariYmd, rentangHariKerja, resolveMonthYear, tanggalHariKerja, toLocalYmd } from "./dateLocal";
import { toInt } from "./format";
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
  /** "input_stok" = dibuat otomatis dari stok masuk (diubah lewat Input › Atur Stok) */
  sumber?: string;
  produkId?: string;
  stokMasukId?: string;
};

/** Pengeluaran belanja stok barang jualan (dibuat otomatis dari Input › Atur Stok, atau kategori "Stok Jualan"). */
export const isBelanjaStok = (o: Pick<TransaksiOwner, "sumber" | "kategori">) => o.sumber === "input_stok" || o.kategori === "Stok Jualan";

/** Model usaha sebuah transaksi. Data lama tanpa field `bisnis`: stok jualan = USAHA, sisanya RENTAL. */
export const bisnisOf = (o: Pick<TransaksiOwner, "bisnis" | "sumber" | "kategori">): Bisnis =>
  o.bisnis === "USAHA" || o.bisnis === "RENTAL" ? o.bisnis : o.sumber === "input_stok" || o.kategori === "Stok Jualan" ? "USAHA" : "RENTAL";

// ============================================================
// Periode filter (Bulan Ini / 7 Hari / Pilih Bulan / Rentang / Semua) — SSOT
// ============================================================

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export type Periode = {
  /** Tanggal pembukuan awal & akhir (YYYY-MM-DD, inklusif). dari "" = sejak awal. */
  dari: string;
  sampai: string;
  /** Rentang waktu hari kerja (ms) untuk data bertimestamp (nota POS): dari 06:00 tanggal awal s.d. 05:59 sesudah tanggal akhir. */
  from: number;
  to: number;
  label: string;
};

/**
 * Periode dari filter analitik / pembukuan. Satu aturan untuk pembukuan (per tanggal) dan
 * nota POS (per waktu hari kerja), jadi nota dini hari ikut hari kerja yang sama dengan pembukuannya.
 * "Hari ini" = hari kerja berjalan (pukul 01:00 masih hari kerja kemarin).
 */
export function periodRange(mode: string, month: number, rs: string, re: string, now: Date = dariYmd(tanggalHariKerja())!): Periode {
  const hari = (d: Date) => toLocalYmd(d);
  const buat = (dari: string, sampai: string, label: string): Periode => ({
    dari,
    sampai,
    from: dari ? rentangHariKerja(dari)!.from : 0,
    to: rentangHariKerja(sampai)!.to,
    label,
  });
  const hariIni = hari(now);
  if (mode === "Bulan Ini") {
    const y = now.getFullYear(), m = now.getMonth();
    return buat(hari(new Date(y, m, 1)), hari(new Date(y, m + 1, 0)), `${BULAN[m]} ${y}`);
  }
  if (mode === "7 Hari Terakhir") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6); // hari ini + 6 hari sebelumnya
    return buat(hari(s), hariIni, "7 hari terakhir");
  }
  if (mode === "Pilih Bulan") {
    const y = resolveMonthYear(month, now);
    const m = Math.min(12, Math.max(1, Number(month) || 1)) - 1;
    return buat(hari(new Date(y, m, 1)), hari(new Date(y, m + 1, 0)), `${BULAN[m]} ${y}`);
  }
  if (mode === "Rentang") {
    const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (ok(rs) && ok(re)) {
      const [a, b] = rs <= re ? [rs, re] : [re, rs];
      const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return buat(a, b, `${f(a)} – ${f(b)}`);
    }
    // Tanggal rentang belum lengkap -> tampilkan semua (sama dengan pembukuan)
    return buat("", hariIni, "semua waktu");
  }
  if (mode === "Semua Bulan") return buat("", hariIni, "semua waktu");
  return buat(hariIni, hariIni, "hari ini");
}

/** Saring data bertanggal (pembukuan, transaksi owner) dengan periode filter yang sama. */
export function saringPeriode<T extends { tanggal: string }>(items: T[], mode: string, month: number, rangeStart: string, rangeEnd: string): T[] {
  if (mode === "Semua Bulan") return items;
  const p = periodRange(mode, month, rangeStart, rangeEnd);
  if (!p.dari) return items;
  return items.filter((o) => {
    const t = String(o.tanggal || "").slice(0, 10);
    return t >= p.dari && t <= p.sampai;
  });
}

/**
 * Transaksi owner (realtime). Bulan Ini / 7 Hari mengambil 60 hari terakhir (daftar di
 * Input › Transaksi ikut menampilkan bulan lalu); analitik menyaringnya dengan `saringPeriode`.
 */
export function useTransaksiOwner(jenis: JenisTransaksi, mode: string, month: number, rangeStart: string, rangeEnd: string): TransaksiOwner[] {
  const [items, setItems] = useState<TransaksiOwner[]>([]);
  // Ganti hari kerja -> jendela data ikut bergeser
  const hariKerja = tanggalHariKerja();
  useEffect(() => {
    const base = collection(db, KOLEKSI[jenis]);
    const p = periodRange(mode, month, rangeStart, rangeEnd);
    let q;
    if (mode === "Pilih Bulan" || (mode === "Rentang" && p.dari)) {
      q = query(base, where("tanggal", ">=", p.dari), where("tanggal", "<=", p.sampai), orderBy("tanggal", "desc"));
    } else if (mode === "Semua Bulan" || mode === "Rentang") {
      q = query(base, orderBy("tanggal", "desc"));
    } else {
      const c = new Date();
      c.setDate(c.getDate() - 60);
      q = query(base, where("tanggal", ">=", toLocalYmd(c)), orderBy("tanggal", "desc"));
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
  }, [jenis, mode, month, rangeStart, rangeEnd, hariKerja]);
  return items;
}

// ============================================================
// Uang pembukuan harian — SSOT
// ============================================================

const normBayar = (v: unknown) => String(v ?? "").trim().toLowerCase();
/** Metode bayar sebuah baris pembukuan: tunai. */
export const bayarCash = (v: unknown) => { const s = normBayar(v); return s.includes("cash") || s.includes("tunai"); };
/** Metode bayar sebuah baris pembukuan: transfer / QRIS. */
export const bayarTransfer = (v: unknown) => { const s = normBayar(v); return s.includes("transfer") || s.includes("tf") || s.includes("trx") || s.includes("qris"); };

/** Total, tunai & transfer dari sekumpulan baris pembukuan (kolom harga + bayar). */
export function totalBaris(rows: any[] | undefined): { total: number; cash: number; transfer: number } {
  let total = 0, cash = 0, transfer = 0;
  (rows || []).forEach((r) => {
    const h = toInt(r?.harga);
    total += h;
    if (bayarCash(r?.bayar)) cash += h;
    else if (bayarTransfer(r?.bayar)) transfer += h;
  });
  return { total, cash, transfer };
}

/**
 * Pemasukan RENTAL satu hari pembukuan: harian + jajanan + sewa.
 * Rincian Pemasukan Usaha (isi game, HEN, servis, aksesoris) adalah pemasukan USAHA —
 * dihitung di Analitik › Usaha (lib/pemasukanUsaha), walau uangnya ikut kas harian.
 */
export const pemasukanRental = (h: Pick<HistoryItem, "totalHarian" | "totalJajanan" | "totalSewa">) =>
  toInt(h.totalHarian) + toInt(h.totalJajanan) + toInt(h.totalSewa);

/** Seluruh pemasukan satu hari pembukuan (rental + rincian usaha) = uang yang masuk kas harian. */
export const totalPemasukanHarian = (h: Pick<HistoryItem, "totalHarian" | "totalJajanan" | "totalJasaAks" | "totalSewa">) =>
  pemasukanRental(h) + toInt(h.totalJasaAks);

/** Pengeluaran yang dicatat admin di pembukuan rental harian (termasuk ongkir). */
export function pengeluaranAdminRental(h: HistoryItem): { nama: string; harga: number; tanggal: string }[] {
  const rows = (h as any).rowsPengeluaran;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: any) => ({ nama: r.ket || "Tanpa Ket", harga: toInt(r.harga || r.nominal), tanggal: r.tanggal || h.tanggal }))
    .filter((r: { harga: number }) => r.harga > 0);
}

/** Ringkasan uang satu dokumen pembukuan (log aktivitas & request edit). */
export const ringkasPembukuan = (d: any) => ({
  income: totalPemasukanHarian(d || {}),
  cash: toInt(d?.totalCash),
  transfer: toInt(d?.totalTransfer),
  expense: (Array.isArray(d?.rowsPengeluaran) ? d.rowsPengeluaran : []).reduce((a: number, r: any) => a + toInt(r?.harga), 0),
});

/** Catat aktivitas simpan / ubah / hapus pembukuan ke `pembukuan_logs` (tidak menggagalkan proses utama). */
export async function catatLogPembukuan(action: "CREATE" | "UPDATE" | "DELETE", targetDate: string, targetDay: string, recordData: any, emailCadangan?: string | null) {
  try {
    const email = auth.currentUser?.email || emailCadangan;
    if (!email) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).slice(2);
    const r = ringkasPembukuan(recordData);
    await setDoc(doc(db, "pembukuan_logs", id), {
      id,
      email,
      action,
      targetDate,
      targetDay,
      timestamp: new Date().toISOString(),
      details: { totalIncome: r.income, totalCash: r.cash, totalTransfer: r.transfer, totalPengeluaran: r.expense },
    });
  } catch (err) {
    console.error("logActivity error:", err);
  }
}

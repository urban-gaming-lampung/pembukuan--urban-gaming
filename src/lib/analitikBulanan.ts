/**
 * ANALITIK BULANAN KESELURUHAN (Rental + Usaha) — satu sumber (SSOT) untuk Laporan Bulanan PDF.
 *
 * Rumus identik dengan `src/components/AnalitikKeseluruhan.tsx` & `src/components/PageOwner.tsx`:
 * - RENTAL : pembukuan harian (`pemasukanRental`) + pemasukan owner Rental − (pengeluaran admin harian + pengeluaran owner Rental)
 * - USAHA  : penjualan POS lunas (`arusKasNota`) + rincian usaha manual pembukuan (`barisUsahaManual`) + DP POS (berjalan/hangus)
 *            + pemasukan owner Usaha − (biaya operasional Usaha + belanja stok + selisih tukar tambah kas keluar)
 * - TOTAL  : gabungan Rental + Usaha (laba kotor, total pengeluaran, laba bersih, serta hasil tanpa belanja stok).
 */
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { dariYmd, rentangHariKerja } from "./dateLocal";
import { toInt } from "./format";
import {
  bisnisOf,
  isBelanjaStok,
  KOLEKSI,
  pemasukanRental,
  pengeluaranAdminRental,
  type Bisnis,
  type TransaksiOwner,
} from "./keuangan";
import { arusKasNota } from "./akuntansiUsaha";
import { barisUsahaManual } from "./pemasukanUsaha";
import { dpHangus, gabungNota, isDpTerbuka, terjualDalam, totalDibayar, type PosSale } from "./posSales";
import type { HistoryItem } from "./types";

export type DataAnalitikBulananRaw = {
  awalBulan: string;
  akhirTanggal: string;
  fromTs: number;
  toTs: number;
  posSales: PosSale[];
  posSalesLunas: PosSale[];
  ownerExpenses: TransaksiOwner[];
  ownerIncomes: TransaksiOwner[];
  /** True bila data transaksi owner (owner_expenses & owner_incomes) ikut dimuat (khusus Owner / Super Admin). */
  termasukTransaksiOwner: boolean;
};

export type BarisTransaksiOwnerRingkas = {
  tanggal: string;
  bisnis: Bisnis;
  kategori: string;
  nama: string;
  harga: number;
  belanjaStok?: boolean;
};

export type RekapAnalitikBulanan = {
  termasukTransaksiOwner: boolean;
  rental: {
    buku: number;
    lain: number;
    masuk: number;
    admin: number;
    adminN: number;
    owner: number;
    ownerN: number;
    keluar: number;
    bersih: number;
  };
  usaha: {
    pos: number;
    nota: number;
    dpLama: number;
    buku: number;
    bukuN: number;
    dp: number;
    dpN: number;
    lain: number;
    masuk: number;
    ops: number;
    opsN: number;
    stok: number;
    stokN: number;
    tukarKeluar: number;
    keluar: number;
    bersih: number;
    bersihTanpaStok: number;
  };
  total: {
    masuk: number;
    keluar: number;
    bersih: number;
    tanpaStok: number;
  };
  listOwnerExpenses: BarisTransaksiOwnerRingkas[];
  listOwnerIncomes: BarisTransaksiOwnerRingkas[];
};

/** Hitung batas tanggal awal bulan & rentang hari kerja (06:00 WIB) s.d. `tanggal` terpilih. */
export function rentangBulanSampai(tanggal: string): {
  awalBulan: string;
  akhirTanggal: string;
  fromTs: number;
  toTs: number;
} {
  const anchor = dariYmd(tanggal) || new Date();
  const y = anchor.getFullYear();
  const m = String(anchor.getMonth() + 1).padStart(2, "0");
  const d = String(anchor.getDate()).padStart(2, "0");
  const awalBulan = `${y}-${m}-01`;
  const akhirTanggal = `${y}-${m}-${d}`;
  const fromTs = rentangHariKerja(awalBulan)?.from ?? 0;
  const toTs = rentangHariKerja(akhirTanggal)?.to ?? Date.now();
  return { awalBulan, akhirTanggal, fromTs, toTs };
}

/**
 * Ambil snapshot satu kali (one-shot) dari Firestore untuk periode `awalBulan .. tanggal`:
 * - `pos_transaksi` (bisa dibaca semua staf URBAN)
 * - `owner_expenses` & `owner_incomes` (hanya bila `includeOwnerCollections` = true, sesuai firestore.rules)
 */
export async function ambilDataAnalitikBulanan(
  tanggal: string,
  includeOwnerCollections: boolean
): Promise<DataAnalitikBulananRaw> {
  const { awalBulan, akhirTanggal, fromTs, toTs } = rentangBulanSampai(tanggal);

  const bacaPosCreated = getDocs(
    query(
      collection(db, "pos_transaksi"),
      where("ts", ">=", fromTs),
      where("ts", "<=", toTs),
      orderBy("ts", "desc"),
      limit(4000)
    )
  )
    .then((snap) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })))
    .catch((err) => {
      console.warn("[analitikBulanan] Gagal memuat pos_transaksi:", err);
      return [] as PosSale[];
    });

  const bacaPosLunas = getDocs(
    query(
      collection(db, "pos_transaksi"),
      where("lunasTs", ">=", Math.max(1, fromTs)),
      where("lunasTs", "<=", toTs)
    )
  )
    .then((snap) =>
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as PosSale) }))
        .filter((x) => (x.lunasTs || 0) >= fromTs && (x.lunasTs || 0) <= toTs)
    )
    .catch((err) => {
      console.warn("[analitikBulanan] Gagal memuat pos_transaksi (lunas):", err);
      return [] as PosSale[];
    });

  let ownerOk = includeOwnerCollections;

  const bacaOwner = (jenis: "PENGELUARAN" | "PEMASUKAN"): Promise<TransaksiOwner[]> => {
    if (!includeOwnerCollections) return Promise.resolve([]);
    return getDocs(
      query(
        collection(db, KOLEKSI[jenis]),
        where("tanggal", ">=", awalBulan),
        where("tanggal", "<=", akhirTanggal),
        orderBy("tanggal", "desc")
      )
    )
      .then((snap) => {
        const res: TransaksiOwner[] = [];
        snap.forEach((docSnap) => {
          const x = docSnap.data() as any;
          res.push({ id: docSnap.id, ...x, harga: toInt(x.harga) });
        });
        return res;
      })
      .catch((err) => {
        console.warn(`[analitikBulanan] Gagal memuat ${KOLEKSI[jenis]}:`, err);
        ownerOk = false;
        return [] as TransaksiOwner[];
      });
  };

  const [posSales, posSalesLunas, ownerExpenses, ownerIncomes] = await Promise.all([
    bacaPosCreated,
    bacaPosLunas,
    bacaOwner("PENGELUARAN"),
    bacaOwner("PEMASUKAN"),
  ]);

  return {
    awalBulan,
    akhirTanggal,
    fromTs,
    toTs,
    posSales,
    posSalesLunas,
    ownerExpenses,
    ownerIncomes,
    termasukTransaksiOwner: ownerOk,
  };
}

/**
 * Hitung rekap bulanan Rental + Usaha (fungsi murni — 100% identik dengan AnalitikKeseluruhan.tsx).
 */
export function hitungRekapBulananKeseluruhan(params: {
  monthHistory: HistoryItem[];
  awalBulan: string;
  akhirTanggal: string;
  fromTs: number;
  toTs: number;
  posSales?: PosSale[];
  posSalesLunas?: PosSale[];
  ownerExpenses?: TransaksiOwner[];
  ownerIncomes?: TransaksiOwner[];
  termasukTransaksiOwner?: boolean;
}): RekapAnalitikBulanan {
  const {
    monthHistory,
    awalBulan,
    akhirTanggal,
    fromTs,
    toTs,
    posSales = [],
    posSalesLunas = [],
    ownerExpenses = [],
    ownerIncomes = [],
    termasukTransaksiOwner = false,
  } = params;

  const r = { buku: 0, lain: 0, admin: 0, adminN: 0, owner: 0, ownerN: 0 };
  const u = { pos: 0, nota: 0, dpLama: 0, buku: 0, bukuN: 0, dp: 0, dpN: 0, lain: 0, ops: 0, opsN: 0, stok: 0, stokN: 0, tukarKeluar: 0 };
  const listOwnerExpenses: BarisTransaksiOwnerRingkas[] = [];
  const listOwnerIncomes: BarisTransaksiOwnerRingkas[] = [];

  // 1. Pembukuan harian (Rental + Rincian Usaha manual + Pengeluaran Admin)
  (monthHistory || []).forEach((h) => {
    const t = String(h?.tanggal || "").slice(0, 10);
    if (t < awalBulan || t > akhirTanggal) return;
    r.buku += pemasukanRental(h);
    barisUsahaManual(h).forEach((x) => {
      u.buku += x.harga;
      u.bukuN++;
    });
    pengeluaranAdminRental(h).forEach((x) => {
      r.admin += x.harga;
      r.adminN++;
    });
  });

  // 2. Penjualan POS lunas (uang nyata masuk & kas keluar tukar tambah)
  const posTerjual = gabungNota(posSales, posSalesLunas).filter((s) => terjualDalam(s, fromTs, toTs));
  posTerjual.forEach((s) => {
    const kas = arusKasNota(s);
    if (kas.kasMasuk > 0) u.pos += kas.kasMasuk;
    if (kas.dpSudahDiSaldo > 0) u.dpLama += kas.dpSudahDiSaldo;
    u.nota++;
    if (kas.kasKeluar > 0) {
      u.stok += kas.kasKeluar;
      u.tukarKeluar += kas.kasKeluar;
    }
  });

  // 3. DP POS berjalan / hangus (nota yang dibuat dalam periode)
  const posDibuat = posSales.filter((s) => s.ts >= fromTs && s.ts <= toTs);
  posDibuat.forEach((s) => {
    const v = isDpTerbuka(s) ? totalDibayar(s) : dpHangus(s);
    if (!v) return;
    u.dp += v;
    u.dpN++;
  });

  // 4. Transaksi owner (Lainnya › Transaksi)
  ownerIncomes.forEach((o) => {
    const t = String(o?.tanggal || "").slice(0, 10);
    if (t < awalBulan || t > akhirTanggal) return;
    const harga = toInt(o.harga);
    if (harga <= 0) return;
    const b = bisnisOf(o);
    if (b === "RENTAL") r.lain += harga;
    else u.lain += harga;
    listOwnerIncomes.push({
      tanggal: t,
      bisnis: b,
      kategori: o.kategori || "Pemasukan lain",
      nama: o.nama || "Pemasukan owner",
      harga,
    });
  });

  ownerExpenses.forEach((o) => {
    const t = String(o?.tanggal || "").slice(0, 10);
    if (t < awalBulan || t > akhirTanggal) return;
    const harga = toInt(o.harga);
    if (harga <= 0) return;
    const b = bisnisOf(o);
    const belanja = b === "USAHA" && isBelanjaStok(o);
    if (b === "RENTAL") {
      r.owner += harga;
      r.ownerN++;
    } else if (belanja) {
      u.stok += harga;
      u.stokN++;
    } else {
      u.ops += harga;
      u.opsN++;
    }
    listOwnerExpenses.push({
      tanggal: t,
      bisnis: b,
      kategori: belanja ? "Belanja stok jualan" : o.kategori || "Lainnya",
      nama: o.nama || "Pengeluaran owner",
      harga,
      belanjaStok: belanja,
    });
  });

  // Urutkan kronologis (tanggal naik) supaya rapi saat dicetak sebagai riwayat bulanan
  listOwnerExpenses.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  listOwnerIncomes.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const rentalMasuk = r.buku + r.lain;
  const rentalKeluar = r.admin + r.owner;
  const rentalBersih = rentalMasuk - rentalKeluar;

  const usahaMasuk = u.pos + u.buku + u.dp + u.lain;
  const usahaKeluar = u.ops + u.stok;
  const usahaBersih = usahaMasuk - usahaKeluar;
  const usahaBersihTanpaStok = usahaBersih + u.stok;

  const totalMasuk = rentalMasuk + usahaMasuk;
  const totalKeluar = rentalKeluar + usahaKeluar;
  const totalBersih = totalMasuk - totalKeluar;
  const totalTanpaStok = totalBersih + u.stok;

  return {
    termasukTransaksiOwner,
    rental: {
      buku: r.buku,
      lain: r.lain,
      masuk: rentalMasuk,
      admin: r.admin,
      adminN: r.adminN,
      owner: r.owner,
      ownerN: r.ownerN,
      keluar: rentalKeluar,
      bersih: rentalBersih,
    },
    usaha: {
      pos: u.pos,
      nota: u.nota,
      dpLama: u.dpLama,
      buku: u.buku,
      bukuN: u.bukuN,
      dp: u.dp,
      dpN: u.dpN,
      lain: u.lain,
      masuk: usahaMasuk,
      ops: u.ops,
      opsN: u.opsN,
      stok: u.stok,
      stokN: u.stokN,
      tukarKeluar: u.tukarKeluar,
      keluar: usahaKeluar,
      bersih: usahaBersih,
      bersihTanpaStok: usahaBersihTanpaStok,
    },
    total: {
      masuk: totalMasuk,
      keluar: totalKeluar,
      bersih: totalBersih,
      tanpaStok: totalTanpaStok,
    },
    listOwnerExpenses,
    listOwnerIncomes,
  };
}

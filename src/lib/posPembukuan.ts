/**
 * POS KASIR → PEMBUKUAN HARIAN (Rincian Pemasukan Usaha)
 *
 * Aturan uang URBAN:
 * - JASA (isi game, upgrade HEN, servis) masuk kas harian -> otomatis jadi baris terkunci
 *   di "Rincian Pemasukan Usaha" (ikut disetor saat ruko tutup).
 * - BARANG (unit PS, stik, aksesoris, hardisk, kaset) langsung disetor ke owner -> TIDAK masuk
 *   rincian / kas harian; admin hanya melihat pengingat nomor notanya.
 *
 * Baris POS tidak disimpan di draft bersama (data/draft) agar tidak bentrok antar-HP:
 * baris diturunkan langsung dari koleksi pos_transaksi untuk tanggal pembukuan, lalu ikut
 * disimpan ke history_pembukuan saat pembukuan disimpan. Nota yang dibuat / dibatalkan /
 * dihapus SESUDAH pembukuan disimpan disinkronkan lewat `sinkronNotaKePembukuan`.
 */
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, runTransaction, where } from "firebase/firestore";
import { db } from "./firebase";
import type { PosItem, PosSale } from "./posSales";
import { nilaiTukarNota, pernahDp } from "./posSales";
import { rentangHariKerja, tanggalHariKerja } from "./dateLocal";
import { toInt } from "./format";
import { totalBaris } from "./keuangan";

/** Baris rincian yang berasal dari nota POS (terkunci, tidak bisa diubah di form). */
export type BarisNota = {
  tipe: string;
  ket: string;
  harga: number;
  bayar: "Cash" | "Transfer";
  buktiTransfer?: string;
  _nota: string;
  _notaId: string;
  _ts: number;
};
export const isBarisNota = (r: any): r is BarisNota => !!(r && r._nota);

/** "HEN", "GoldHEN", "Jasa HEN PS4 VUE" — bukan kata lain yang kebetulan berakhiran "hen". */
export const sebutHen = (s: unknown) => /(^|[^a-z])(gold)?hen\b/i.test(String(s || ""));
const isHen = (it: PosItem) => sebutHen(it.nama);
/** Kelompok jasa sebuah barang POS (null = barang jualan / bukan jasa). */
export function tipeJasaPos(it: PosItem): "Isi Game" | "Upgrade HEN" | "Servis" | null {
  if (it.kategori === "ISI GAME") return "Isi Game";
  if (it.kategori === "SERVIS") return isHen(it) ? "Upgrade HEN" : "Servis";
  return null;
}

const namaItem = (it: PosItem) => {
  const nama = String(it.nama || "").trim();
  const plat = it.kategori === "ISI GAME" && it.platform ? ` (${it.platform})` : "";
  return `${it.qty > 1 ? `${it.qty}× ` : ""}${nama}${plat}`;
};

/**
 * Baris rincian JASA dari satu nota: satu baris per tipe (Isi Game / Upgrade HEN / Servis).
 * Diskon promo hanya berlaku untuk isi game, jadi dipotong dari baris Isi Game.
 */
export function barisJasaDariNota(s: PosSale): BarisNota[] {
  // Nota DP (DP & pelunasan) uangnya langsung ke owner, tidak lewat kas harian
  if (!s || s.batal || pernahDp(s)) return [];
  const grup = new Map<string, PosItem[]>();
  (s.items || []).forEach((it) => {
    const t = tipeJasaPos(it);
    if (!t) return;
    grup.set(t, [...(grup.get(t) || []), it]);
  });
  const out: BarisNota[] = [];
  const urutan = ["Isi Game", "Upgrade HEN", "Servis"];
  urutan.forEach((tipe) => {
    const items = grup.get(tipe);
    if (!items?.length) return;
    let harga = items.reduce((a, it) => a + (Number(it.subtotal) || 0), 0);
    if (tipe === "Isi Game") harga -= Number(s.diskon) || 0;
    harga = Math.max(0, Math.round(harga));
    const pembeli = String(s.pembeli || "").trim();
    out.push({
      tipe,
      ket: `${items.map(namaItem).join(", ")}${pembeli ? ` · ${pembeli}` : ""} · ${s.noNota}`,
      harga,
      bayar: s.metode === "TRANSFER" ? "Transfer" : "Cash",
      ...(s.metode === "TRANSFER" && s.buktiTransfer ? { buktiTransfer: s.buktiTransfer } : {}),
      _nota: s.noNota,
      _notaId: s.id || s.noNota,
      _ts: s.ts,
    });
  });
  return out;
}

/** Uang yang disetor langsung ke owner (tidak masuk kas harian): nota BARANG, DP & pelunasan. */
/**
 * Uang barang yang disetor ke owner. `total` bisa NEGATIF pada nota tukar tambah yang nilai
 * barang masuknya lebih besar (URBAN membayar ke pembeli).
 */
export type NotaBarang = { noNota: string; id: string; ts: number; pembeli: string; metode: PosSale["metode"]; total: number; jumlah: number; label?: "DP" | "Pelunasan" | "Tukar tambah" };
export function notaBarang(s: PosSale, from = 0, to = Infinity): NotaBarang[] {
  if (!s) return [];
  if (pernahDp(s)) {
    // Dibatalkan URBAN (DP dikembalikan) atau dibatalkan sesudah lunas (uang dikembalikan): tidak ada setoran.
    // Dibatalkan pembeli: DP hangus tetap disetor.
    if (s.batal && s.status !== "BATAL_PEMBELI") return [];
    return (s.pembayaran || [])
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.ts >= from && p.ts <= to)
      .map(({ p, i }) => ({
        noNota: s.noNota,
        id: `${s.id || s.noNota}#${i}`,
        ts: p.ts,
        pembeli: String(s.pembeli || ""),
        metode: p.metode,
        total: Number(p.jumlah) || 0,
        jumlah: (s.items || []).reduce((a, it) => a + (Number(it.qty) || 0), 0),
        label: p.jenis === "DP" ? ("DP" as const) : ("Pelunasan" as const),
      }));
  }
  if (s.batal || s.ts < from || s.ts > to) return [];
  const items = (s.items || []).filter((it) => !tipeJasaPos(it));
  const tukar = nilaiTukarNota(s);
  // Hanya barang berbayar (barang bonus Rp 0 tidak perlu disetor) — kecuali ada tukar tambah
  if (!tukar && (!items.length || !items.some((it) => (Number(it.subtotal) || 0) > 0))) return [];
  return [{
    noNota: s.noNota,
    id: s.id || s.noNota,
    ts: s.ts,
    pembeli: String(s.pembeli || ""),
    metode: s.metode,
    // Nilai barang tukar tambah memotong uang barang (jasa tetap utuh di kas harian)
    total: items.reduce((a, it) => a + (Number(it.subtotal) || 0), 0) - tukar,
    jumlah: items.reduce((a, it) => a + (Number(it.qty) || 0), 0),
    ...(tukar ? { label: "Tukar tambah" as const } : {}),
  }];
}

/** Nota POS satu hari kerja (realtime) -> baris jasa untuk rincian + pengingat nota barang. */
export function useNotaHariKerja(tanggal: string): { baris: BarisNota[]; barang: NotaBarang[]; loading: boolean } {
  const [sales, setSales] = useState<PosSale[]>([]);
  // Nota DP dari hari lain yang DILUNASI hari ini (pengingat setor pelunasan)
  const [lunas, setLunas] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const r = rentangHariKerja(tanggal);
  const from = r?.from ?? 0;
  const to = r?.to ?? 0;
  useEffect(() => {
    // Tanggal berganti: jangan sampai nota hari kerja sebelumnya ikut terhitung sebelum data baru tiba
    setSales([]);
    setLunas([]);
    if (!from) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, "pos_transaksi"), where("ts", ">=", from), where("ts", "<=", to), orderBy("ts", "asc"));
    const u1 = onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })).filter((s) => s.ts >= from && s.ts <= to).sort((a, b) => a.ts - b.ts));
        setLoading(false);
      },
      (e) => { console.warn("pos_transaksi (pembukuan):", e); setSales([]); setLoading(false); }
    );
    const u2 = onSnapshot(
      query(collection(db, "pos_transaksi"), where("lunasTs", ">=", from), where("lunasTs", "<=", to)),
      (snap) => setLunas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })).filter((s) => (s.lunasTs || 0) >= from && (s.lunasTs || 0) <= to)),
      (e) => { console.warn("pos_transaksi (pelunasan):", e); setLunas([]); }
    );
    return () => { u1(); u2(); };
  }, [from, to]);
  const baris = useMemo(() => sales.flatMap(barisJasaDariNota), [sales]);
  const barang = useMemo(() => {
    const semua = new Map<string, PosSale>();
    [...sales, ...lunas].forEach((s) => semua.set(s.id || s.noNota, s));
    return Array.from(semua.values()).flatMap((s) => notaBarang(s, from, to)).sort((a, b) => a.ts - b.ts);
  }, [sales, lunas, from, to]);
  return { baris, barang, loading };
}

const tandaBaris = (rows: any[]) => JSON.stringify((rows || []).map((r) => [r._nota, r.tipe, toInt(r.harga), r.bayar, r.ket]));

/**
 * Hitung ulang rincian usaha sebuah dokumen pembukuan dengan baris nota terbaru.
 * Mengembalikan patch (atau null bila tidak ada perubahan). Total kas diubah sebesar selisihnya saja,
 * sehingga angka lain di dokumen tidak tersentuh.
 */
export function patchPembukuanDenganNota(data: any, barisBaru: BarisNota[]): Record<string, any> | null {
  const semua = Array.isArray(data?.rowsJasaAks) ? data.rowsJasaAks : [];
  const manual = semua.filter((r: any) => !isBarisNota(r));
  const lama = semua.filter(isBarisNota);
  if (tandaBaris(lama) === tandaBaris(barisBaru)) return null;
  const a = totalBaris(lama);
  const b = totalBaris(barisBaru);
  return {
    rowsJasaAks: JSON.parse(JSON.stringify([...manual, ...barisBaru])),
    totalJasaAks: Math.max(0, toInt(data?.totalJasaAks) - a.total + b.total),
    totalCash: Math.max(0, toInt(data?.totalCash) - a.cash + b.cash),
    totalTransfer: Math.max(0, toInt(data?.totalTransfer) - a.transfer + b.transfer),
  };
}

/**
 * Nota dibuat / dibatalkan / dihapus sesudah pembukuan hari itu disimpan -> perbarui
 * baris POS di history_pembukuan hari kerja tersebut. Pembukuan yang belum disimpan
 * tidak perlu disentuh (form membaca nota secara realtime).
 */
export async function sinkronNotaKePembukuan(tanggal: string): Promise<void> {
  const r = rentangHariKerja(tanggal);
  if (!r) return;
  const hist = await getDocs(query(collection(db, "history_pembukuan"), where("tanggal", "==", tanggal)));
  if (hist.empty) return;
  const salesSnap = await getDocs(query(collection(db, "pos_transaksi"), where("ts", ">=", r.from), where("ts", "<=", r.to)));
  const baris = salesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as PosSale) }))
    .filter((s) => s.ts >= r.from && s.ts <= r.to)
    .sort((a, b) => a.ts - b.ts)
    .flatMap(barisJasaDariNota);
  await Promise.all(
    hist.docs.map((h) =>
      runTransaction(db, async (tx) => {
        const snap = await tx.get(h.ref);
        if (!snap.exists()) return;
        const patch = patchPembukuanDenganNota(snap.data(), baris);
        if (patch) tx.update(h.ref, patch);
      })
    )
  );
}

/** Jalankan sinkron tanpa mengganggu alur kasir (kesalahan cukup dicatat di konsol). */
export function sinkronNotaDiam(ts: number) {
  sinkronNotaKePembukuan(tanggalHariKerja(ts)).catch((e) => console.warn("Sinkron nota ke pembukuan:", e));
}

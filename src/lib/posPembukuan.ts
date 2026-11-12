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

/** Nota sebelum jam ini (dini hari) masih milik hari kerja sebelumnya — ruko bisa tutup lewat tengah malam. */
export const JAM_GANTI_HARI = 3;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Tanggal hari kerja (YYYY-MM-DD) sebuah waktu: 00:00–02:59 ikut hari sebelumnya. */
export const tanggalHariKerja = (ts: number) => ymd(new Date(ts - JAM_GANTI_HARI * 3600000));

/** Rentang waktu satu hari kerja: tanggal 03:00 s.d. besoknya 02:59:59. */
export function rentangHariKerja(tanggal: string): { from: number; to: number } | null {
  const [y, m, d] = String(tanggal || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return {
    from: new Date(y, m - 1, d, JAM_GANTI_HARI, 0, 0, 0).getTime(),
    to: new Date(y, m - 1, d + 1, JAM_GANTI_HARI - 1, 59, 59, 999).getTime(),
  };
}

const toNum = (v: unknown) => {
  const n = parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const bayarCash = (v: unknown) => { const s = norm(v); return s.includes("cash") || s.includes("tunai"); };
export const bayarTransfer = (v: unknown) => { const s = norm(v); return s.includes("transfer") || s.includes("tf") || s.includes("trx"); };

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
  if (!s || s.batal) return [];
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

/** Ringkas nota BARANG (setor langsung ke owner) — tidak masuk kas harian. */
export type NotaBarang = { noNota: string; id: string; ts: number; pembeli: string; metode: PosSale["metode"]; total: number; jumlah: number };
export function notaBarang(s: PosSale): NotaBarang | null {
  if (!s || s.batal) return null;
  const items = (s.items || []).filter((it) => !tipeJasaPos(it));
  if (!items.length) return null;
  return {
    noNota: s.noNota,
    id: s.id || s.noNota,
    ts: s.ts,
    pembeli: String(s.pembeli || ""),
    metode: s.metode,
    total: items.reduce((a, it) => a + (Number(it.subtotal) || 0), 0),
    jumlah: items.reduce((a, it) => a + (Number(it.qty) || 0), 0),
  };
}

/** Nota POS satu hari kerja (realtime) -> baris jasa untuk rincian + pengingat nota barang. */
export function useNotaHariKerja(tanggal: string): { baris: BarisNota[]; barang: NotaBarang[]; loading: boolean } {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const r = rentangHariKerja(tanggal);
  const from = r?.from ?? 0;
  const to = r?.to ?? 0;
  useEffect(() => {
    if (!from) { setSales([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, "pos_transaksi"), where("ts", ">=", from), where("ts", "<=", to), orderBy("ts", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })).filter((s) => s.ts >= from && s.ts <= to).sort((a, b) => a.ts - b.ts));
        setLoading(false);
      },
      (e) => { console.warn("pos_transaksi (pembukuan):", e); setSales([]); setLoading(false); }
    );
  }, [from, to]);
  const baris = useMemo(() => sales.flatMap(barisJasaDariNota), [sales]);
  const barang = useMemo(() => sales.map(notaBarang).filter((x): x is NotaBarang => !!x), [sales]);
  return { baris, barang, loading };
}

/** Total kas (cash / transfer / semua) dari sekumpulan baris rincian. */
export function totalBaris(rows: any[]): { total: number; cash: number; transfer: number } {
  let total = 0, cash = 0, transfer = 0;
  (rows || []).forEach((r) => {
    const h = toNum(r?.harga);
    total += h;
    if (bayarCash(r?.bayar)) cash += h;
    else if (bayarTransfer(r?.bayar)) transfer += h;
  });
  return { total, cash, transfer };
}

const tandaBaris = (rows: any[]) => JSON.stringify((rows || []).map((r) => [r._nota, r.tipe, toNum(r.harga), r.bayar, r.ket]));

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
    totalJasaAks: Math.max(0, toNum(data?.totalJasaAks) - a.total + b.total),
    totalCash: Math.max(0, toNum(data?.totalCash) - a.cash + b.cash),
    totalTransfer: Math.max(0, toNum(data?.totalTransfer) - a.transfer + b.transfer),
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

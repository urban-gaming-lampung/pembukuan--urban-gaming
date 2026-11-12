/**
 * PENJUALAN POS ↔ STOK JUALAN
 *
 * - Produk POS dihubungkan ke barang stok lewat field `stokRef` di dokumen products.
 *   `item: "*"` = barang dipilih kasir saat checkout (mis. "Stik PS4 - Semua Warna").
 * - Saat nota dibuat, dalam SATU transaksi: nomor nota (urut per hari), dokumen
 *   pos_transaksi, pengurangan stok jualan, dan riwayat stok "Terjual".
 */
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { prepareStokWrites, writeStokInTx, StokChange } from "./stokJualan";

export type StokRef = { kategori: string; item: string }; // item "*" = pilih saat checkout
export const PILIH_SAAT_CHECKOUT = "*";

export type PosItem = {
  id: string;
  nama: string;
  kategori: string; // JUALAN | SERVIS | RENTAL | ISI GAME
  subkategori?: string | null;
  platform?: string | null;
  harga: number;
  qty: number;
  subtotal: number;
  stokRef?: StokRef | null; // barang stok yang benar-benar dikurangi
};

export type PosSale = {
  id?: string;
  noNota: string;
  ts: number;
  tanggal: string; // YYYY-MM-DD (WIB)
  kasir: string; // email
  kasirNama: string;
  pembeli: string;
  pembeliWa?: string;
  metode: "CASH" | "TRANSFER";
  items: PosItem[];
  subtotal: number;
  diskonPersen: number;
  diskon: number;
  total: number;
  stokKurang?: { kategori: string; item: string; diminta: number; tersedia: number }[];
  /** Nota dibatalkan owner: stok dikembalikan & tidak dihitung di analitik. */
  batal?: boolean;
  batalOleh?: string;
  batalTs?: number;
  batalAlasan?: string | null;
  /** Hanya di hasil commitPosSale (tidak disimpan): sisa stok sesudah transaksi per "kategori||item". */
  stokSesudah?: Record<string, number>;
};

// ============================================================
// Pencocokan nama produk POS -> barang stok
// ============================================================

const STOP = new Set(["DENGAN", "TANPA", "BOX", "DAN", "UNIT", "KONSOL", "AKSESORIS", "THE", "OF", "EDITION"]);
const HINTS = ["BARU", "SEKEN"] as const;

function normText(s: string): string {
  return String(s || "")
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[–—]/g, " ")
    .replace(/\bPS\s+(\d)\b/g, "PS$1")
    .replace(/(\d+)\s*(GB|TB)\b/g, "$1$2")
    .replace(/\bEXTERNAL\b/g, "EKSTERNAL")
    .replace(/\bORIGINAL\b/g, "ORI")
    .replace(/\b(BEKAS|SECOND|LIKE NEW)\b/g, "SEKEN");
}

export function tokenize(s: string): string[] {
  return normText(s).split(/[^A-Z0-9]+/).filter((t) => t && !STOP.has(t));
}

const hintOf = (tokens: string[]) => HINTS.find((h) => tokens.includes(h)) || null;

export type StokSuggestion = { ref: StokRef; yakin: boolean } | null;

/**
 * Sarankan barang stok untuk nama produk. Mengembalikan:
 * - barang tertentu bila satu kandidat jelas paling cocok,
 * - `{kategori, item:"*"}` bila beberapa varian di kategori yang sama sama cocoknya (mis. warna),
 * - null bila tidak ada yang meyakinkan.
 */
export function suggestStokRef(productName: string, categories: StokKategori[]): StokSuggestion {
  const pTok = tokenize(productName);
  const pSet = new Set(pTok);
  const pHint = hintOf(pTok);
  type Cand = { ref: StokRef; recall: number; matched: number };
  const cands: Cand[] = [];
  categories.forEach((c) => {
    const katTok = tokenize(c.kategori);
    const cHint = hintOf(katTok);
    const katCore = katTok.filter((t) => !HINTS.includes(t as any));
    c.items.forEach((item) => {
      const sTok = Array.from(new Set([...katCore, ...tokenize(item)])).filter((t) => !HINTS.includes(t as any));
      if (!sTok.length) return;
      const matched = sTok.filter((t) => pSet.has(t)).length;
      let recall = matched / sTok.length;
      if (cHint && pHint) recall += cHint === pHint ? 0.15 : -0.35;
      cands.push({ ref: { kategori: c.kategori, item }, recall, matched });
    });
  });
  cands.sort((a, b) => b.recall - a.recall || b.matched - a.matched);
  const top = cands[0];
  // Nama kategori (mis. "STIK PS4") disebut lengkap tapi variannya tidak ("Semua Warna") -> pilih saat checkout
  const kategoriSaja = (): StokSuggestion => {
    const hit = categories.filter((c) => {
      const core = tokenize(c.kategori).filter((t) => !HINTS.includes(t as any));
      return core.length > 0 && core.every((t) => pSet.has(t));
    });
    return hit.length === 1 ? { ref: { kategori: hit[0].kategori, item: PILIH_SAAT_CHECKOUT }, yakin: false } : null;
  };
  if (!top || top.recall < 0.75 || top.matched < 1) return kategoriSaja();
  const ties = cands.filter((c) => Math.abs(c.recall - top.recall) < 1e-9 && c.matched === top.matched);
  // "yakin" hanya bila semua kata barang stok ada di nama produk DAN minimal 2 kata cocok
  if (ties.length === 1) return { ref: top.ref, yakin: top.recall >= 0.99 && top.matched >= 2 };
  if (ties.every((t) => t.ref.kategori === top.ref.kategori)) {
    return { ref: { kategori: top.ref.kategori, item: PILIH_SAAT_CHECKOUT }, yakin: false };
  }
  return null;
}

export const stokRefLabel = (r?: StokRef | null) =>
  !r ? "Tidak dihubungkan" : r.item === PILIH_SAAT_CHECKOUT ? `${r.kategori} › pilih saat checkout` : `${r.kategori} › ${r.item}`;

// ============================================================
// Simpan penjualan
// ============================================================

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function commitPosSale(
  input: Omit<PosSale, "noNota" | "ts" | "tanggal" | "kasir" | "stokKurang">
): Promise<PosSale> {
  const kasir = auth.currentUser?.email || "admin";
  const now = Date.now();
  const d = new Date(now);
  const tanggal = ymdLocal(d);
  const dayKey = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const counterRef = doc(db, "data", "pos_counter");
  const stokRef = doc(db, "data", "stok");
  const saleRef = doc(collection(db, "pos_transaksi"));

  for (const it of input.items) {
    if (it.stokRef?.item === PILIH_SAAT_CHECKOUT) throw new Error(`Pilih varian stok untuk "${it.nama}" dulu.`);
  }

  return runTransaction(db, async (tx) => {
    const [cSnap, sSnap] = await Promise.all([tx.get(counterRef), tx.get(stokRef)]);
    const c = cSnap.data() || {};
    const seq = c.day === dayKey ? (Number(c.seq) || 0) + 1 : 1;
    const noNota = `URB-${dayKey}-${pad(seq, 3)}`;

    const jualan = (sSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const need = new Map<string, { kategori: string; item: string; qty: number }>();
    input.items.forEach((it) => {
      if (!it.stokRef) return;
      const k = `${it.stokRef.kategori}||${it.stokRef.item}`;
      const cur = need.get(k) || { ...it.stokRef, qty: 0 };
      cur.qty += it.qty;
      need.set(k, cur);
    });
    const stokKurang: NonNullable<PosSale["stokKurang"]> = [];
    const changes: StokChange[] = [];
    need.forEach((n) => {
      const tersedia = Math.max(0, Math.round(Number(jualan?.[n.kategori]?.[n.item]?.jumlah) || 0));
      if (tersedia < n.qty) stokKurang.push({ kategori: n.kategori, item: n.item, diminta: n.qty, tersedia });
      changes.push({ kategori: n.kategori, item: n.item, delta: -n.qty });
    });

    const w = prepareStokWrites(jualan, changes, "terjual", `Nota ${noNota}${input.pembeli ? ` · ${input.pembeli}` : ""}`, kasir, now);
    writeStokInTx(tx, w, { noNota });

    const sale: PosSale = { ...input, noNota, ts: now, tanggal, kasir, stokKurang };
    const stokSesudah = Object.fromEntries(w.logs.map((l) => [`${l.kategori}||${l.item}`, l.sesudah]));
    tx.set(counterRef, { day: dayKey, seq }, { merge: true });
    // Firestore menolak nilai undefined -> bersihkan dulu (data polos, aman di-JSON)
    tx.set(saleRef, { ...JSON.parse(JSON.stringify(sale)), waktu: serverTimestamp() });
    return { ...sale, id: saleRef.id, stokSesudah };
  });
}

/**
 * Batalkan nota (owner / super admin): stok yang benar-benar terpotong dikembalikan
 * dan nota ditandai batal (tetap tersimpan untuk jejak audit).
 */
export async function cancelPosSale(sale: PosSale, alasan = ""): Promise<void> {
  if (!sale.id) throw new Error("ID nota tidak ditemukan.");
  const oleh = auth.currentUser?.email || "admin";
  const now = Date.now();
  const saleRef = doc(db, "pos_transaksi", sale.id);
  const stokDoc = doc(db, "data", "stok");
  await runTransaction(db, async (tx) => {
    const [sSnap, stSnap] = await Promise.all([tx.get(saleRef), tx.get(stokDoc)]);
    if (!sSnap.exists()) throw new Error("Nota tidak ditemukan.");
    const cur = sSnap.data() as PosSale;
    if (cur.batal) throw new Error("Nota ini sudah dibatalkan.");
    const jualan = (stSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    // Jumlah yang benar-benar terpotong (stok tidak pernah di bawah 0)
    const need = new Map<string, { kategori: string; item: string; qty: number }>();
    (cur.items || []).forEach((it) => {
      if (!it.stokRef || it.stokRef.item === PILIH_SAAT_CHECKOUT) return;
      const k = `${it.stokRef.kategori}||${it.stokRef.item}`;
      const n = need.get(k) || { ...it.stokRef, qty: 0 };
      n.qty += it.qty;
      need.set(k, n);
    });
    const changes: StokChange[] = [];
    need.forEach((n) => {
      const kurang = (cur.stokKurang || []).find((k) => k.kategori === n.kategori && k.item === n.item);
      const terpotong = kurang ? Math.max(0, kurang.tersedia) : n.qty;
      if (terpotong > 0) changes.push({ kategori: n.kategori, item: n.item, delta: terpotong });
    });
    const w = prepareStokWrites(jualan, changes, "koreksi", `Batal nota ${cur.noNota}${alasan.trim() ? ` · ${alasan.trim()}` : ""}`, oleh, now);
    writeStokInTx(tx, w, { noNota: cur.noNota });
    tx.update(saleRef, { batal: true, batalOleh: oleh, batalTs: now, batalAlasan: alasan.trim() || null });
  });
}

// ============================================================
// Baca penjualan (Analitik Usaha & riwayat nota)
// ============================================================

export function usePosSales(fromTs: number, toTs: number, max = 3000): { sales: PosSale[]; loading: boolean; error: string | null } {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "pos_transaksi"),
      where("ts", ">=", fromTs),
      where("ts", "<=", toTs),
      orderBy("ts", "desc"),
      limit(max)
    );
    return onSnapshot(
      q,
      (s) => {
        setSales(s.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })));
        setLoading(false);
        setError(null);
      },
      (e) => {
        console.warn("pos_transaksi:", e);
        setError(e?.message || String(e));
        setLoading(false);
      }
    );
  }, [fromTs, toTs, max]);
  return { sales, loading, error };
}

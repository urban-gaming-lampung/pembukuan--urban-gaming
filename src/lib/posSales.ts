/**
 * PENJUALAN POS ↔ STOK JUALAN
 *
 * - Produk POS dihubungkan ke barang stok lewat field `stokRef` di dokumen products.
 *   `item: "*"` = barang dipilih kasir saat checkout (mis. "Stik PS4 - Semua Warna").
 * - Saat nota dibuat, dalam SATU transaksi: nomor nota (urut per hari), dokumen
 *   pos_transaksi, pengurangan stok jualan, dan riwayat stok "Terjual".
 */
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { applyMasterChanges, prepareStokWrites, removeJualanItem, writeStokInTx, StokChange } from "./stokJualan";
import { sinkronNotaDiam } from "./posPembukuan";

export type StokRef = { kategori: string; item: string }; // item "*" = pilih saat checkout
export const PILIH_SAAT_CHECKOUT = "*";

export type PosItem = {
  id: string;
  nama: string;
  kategori: string; // JUALAN | SERVIS | RENTAL | ISI GAME
  subkategori?: string | null;
  platform?: string | null;
  harga: number; // harga satuan AKHIR (sesudah nego kasir) — dipakai semua analitik
  /** Harga satuan normal bila kasir mengubah harga (nego). Tidak ada = harga tidak diubah. */
  hargaNormal?: number;
  qty: number;
  subtotal: number;
  stokRef?: StokRef | null; // barang stok yang benar-benar dikurangi
  kondisi?: Kondisi; // khusus JUALAN: BARU / SEKEN
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
  /** Foto bukti transfer (wajib bila metode TRANSFER) — sama dengan bukti transfer pembukuan rental */
  buktiTransfer?: string;
  /** Link PDF nota (Firebase Storage) untuk dikirim ke WhatsApp pembeli */
  notaUrl?: string;
  items: PosItem[];
  /** Jumlah harga barang SESUDAH nego, sebelum diskon promo */
  subtotal: number;
  /** Total selisih nego kasir: Σ (harga normal − harga akhir) × qty. Positif = potongan untuk pembeli. */
  nego?: number;
  /** Nama kasir yang mengubah harga */
  negoOleh?: string;
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
  /**
   * Nota SEWA dari Rincian Pemasukan SEWA PS (bukan penjualan POS, tidak disimpan di pos_transaksi):
   * judul "NOTA SEWA", info unit / durasi / jam, dan ketentuan sewa menggantikan kotak garansi.
   */
  jenisNota?: "SEWA";
  /** Baris info tambahan di bawah data pembeli (mis. Unit, Durasi, Jam ambil, Jam kembali). */
  infoNota?: { l: string; r: string }[];
  /** Kotak ketentuan pengganti kotak garansi. */
  syaratNota?: { judul: string; isi: string[] };
  /** Status pembayaran nota sewa (bawaan: LUNAS). */
  statusBayar?: "LUNAS" | "BELUM DIBAYAR";

  // ---------- DP (bayar sebagian) ----------
  /**
   * Status nota. Tidak ada = LUNAS (nota biasa).
   * DP            : baru dibayar sebagian — stok BELUM berkurang (barang "dipesan").
   * LUNAS         : lunas (nota DP yang sudah dilunasi juga LUNAS + lunasTs).
   * BATAL_PEMBELI : DP dibatalkan pembeli — DP hangus (pemasukan usaha).
   * BATAL_URBAN   : DP dibatalkan URBAN — DP dikembalikan penuh (bukan pemasukan).
   */
  status?: StatusNota;
  /** Nominal DP awal */
  dp?: number;
  /** Jatuh tempo pelunasan (YYYY-MM-DD) */
  jatuhTempo?: string;
  /** Riwayat pembayaran nota DP (DP lalu pelunasan) */
  pembayaran?: PembayaranNota[];
  /** Waktu pelunasan — penjualan nota DP dihitung pada waktu ini */
  lunasTs?: number;
  lunasOleh?: string;
};

export type StatusNota = "DP" | "LUNAS" | "BATAL_PEMBELI" | "BATAL_URBAN";
export type PembayaranNota = {
  jenis: "DP" | "PELUNASAN";
  jumlah: number;
  metode: "CASH" | "TRANSFER";
  buktiTransfer?: string;
  ts: number;
  oleh: string;
  olehNama?: string;
};

// ============================================================
// DP — SSOT status & angka (dipakai nota, POS, pembukuan & analitik)
// ============================================================

/** Nota DP yang masih menunggu pelunasan. */
export const isDpTerbuka = (s: Pick<PosSale, "status" | "batal">) => s.status === "DP" && !s.batal;
/** Nota yang memakai DP (masih DP, sudah lunas, atau dibatalkan). */
export const pernahDp = (s: Pick<PosSale, "pembayaran" | "dp">) =>
  typeof s.dp === "number" || (s.pembayaran || []).some((p) => p.jenis === "DP");
/** Jumlah uang yang sudah diterima untuk nota ini. */
export const totalDibayar = (s: Pick<PosSale, "pembayaran" | "status" | "dp" | "total">) =>
  s.pembayaran?.length ? s.pembayaran.reduce((a, p) => a + (Number(p.jumlah) || 0), 0) : s.status === "DP" ? Number(s.dp) || 0 : Number(s.total) || 0;
export const sisaBayar = (s: Pick<PosSale, "pembayaran" | "status" | "dp" | "total">) => Math.max(0, (Number(s.total) || 0) - totalDibayar(s));
/** Nota yang dihitung sebagai PENJUALAN (bukan batal, bukan DP yang belum lunas). */
export const dihitungPenjualan = (s: Pick<PosSale, "batal" | "status">) => !s.batal && s.status !== "DP";
/** Waktu penjualan: nota DP dihitung saat lunas (barang diserahkan & stok berkurang). */
export const waktuPenjualan = (s: Pick<PosSale, "lunasTs" | "ts">) => Number(s.lunasTs) || s.ts;
/** DP yang hangus karena dibatalkan pembeli (pemasukan usaha). */
export const dpHangus = (s: Pick<PosSale, "status" | "pembayaran" | "dp" | "total">) => (s.status === "BATAL_PEMBELI" ? totalDibayar(s) : 0);
/** Selisih hari ke jatuh tempo (negatif = sudah lewat). */
export function hariKeJatuhTempo(jatuhTempo: string | undefined, now = Date.now()): number | null {
  const [y, m, d] = String(jatuhTempo || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - a.getTime()) / 86400000);
}
/** Barang yang sedang dipesan lewat nota DP: "kategori||item" -> jumlah. */
export function dipesanDari(notaDp: PosSale[]): Map<string, number> {
  const m = new Map<string, number>();
  notaDp.forEach((s) => {
    if (!isDpTerbuka(s)) return;
    (s.items || []).forEach((it) => {
      if (!it.stokRef || it.stokRef.item === PILIH_SAAT_CHECKOUT) return;
      const k = `${it.stokRef.kategori}||${it.stokRef.item}`;
      m.set(k, (m.get(k) || 0) + (Number(it.qty) || 0));
    });
  });
  return m;
}

// ============================================================
// Nego harga oleh kasir — SSOT untuk checkout, nota (layar / PDF / thermal / WA) & analitik
// ============================================================

/** Selisih nego per SATUAN barang (positif = lebih murah dari harga normal). 0 = harga tidak diubah. */
export const negoSatuan = (it: Pick<PosItem, "harga" | "hargaNormal">) =>
  typeof it.hargaNormal === "number" && it.hargaNormal !== it.harga ? it.hargaNormal - it.harga : 0;

/** Barang bonus / paket: harga jualnya memang Rp 0 (mis. stik bonus pembelian PS), bukan hasil nego. Stok tetap berkurang. */
export const isBonus = (it: Pick<PosItem, "harga" | "hargaNormal">) => !(Number(it.harga) > 0) && negoSatuan(it) === 0;

/** Ringkasan nego satu nota (dihitung dari barang, aman untuk nota lama tanpa field `nego`). */
export function infoNego(s: Pick<PosSale, "items" | "subtotal" | "negoOleh" | "kasirNama" | "kasir">) {
  const barang = (s.items || []).filter((it) => negoSatuan(it) !== 0);
  const total = barang.reduce((a, it) => a + negoSatuan(it) * it.qty, 0);
  const oleh = s.negoOleh || s.kasirNama || String(s.kasir || "").split("@")[0] || "kasir";
  return {
    ada: barang.length > 0,
    jumlahBarang: barang.length,
    /** positif = potongan, negatif = harga dinaikkan */
    total,
    oleh,
    /** jumlah harga normal sebelum nego */
    hargaNormal: (s.subtotal || 0) + total,
    labelBaris: total >= 0 ? "Potongan nego kasir" : "Penyesuaian harga kasir",
    catatan: `Harga ${barang.length} jenis barang diubah oleh kasir ${oleh} (nego) · ${total >= 0 ? "potongan" : "tambahan"} Rp ${Math.abs(Math.round(total)).toLocaleString("id-ID")}`,
  };
}

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
  // Unit tanpa keterangan Baru/Seken dianggap baru (seken selalu ditulis "Seken" di katalog)
  type Cand = { ref: StokRef; recall: number; matched: number; full: boolean };
  const cands: Cand[] = [];
  categories.forEach((c) => {
    const katTok = tokenize(c.kategori);
    const cHint = hintOf(katTok);
    const katCore = katTok.filter((t) => !HINTS.includes(t as any));
    c.items.forEach((item) => {
      const sTok = Array.from(new Set([...katCore, ...tokenize(item)])).filter((t) => !HINTS.includes(t as any));
      if (!sTok.length) return;
      const matched = sTok.filter((t) => pSet.has(t)).length;
      const full = matched === sTok.length; // semua kata barang stok ada di nama produk
      let recall = matched / sTok.length;
      if (cHint && pHint) recall += cHint === pHint ? 0.15 : -0.35;
      else if (cHint && !pHint && cHint === "BARU") recall += 0.05;
      cands.push({ ref: { kategori: c.kategori, item }, recall, matched, full });
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
  if (ties.length === 1) return { ref: top.ref, yakin: top.full && top.matched >= 2 && top.recall >= 0.99 };
  if (ties.every((t) => t.ref.kategori === top.ref.kategori)) {
    return { ref: { kategori: top.ref.kategori, item: PILIH_SAAT_CHECKOUT }, yakin: false };
  }
  return null;
}

// ============================================================
// Sinkron otomatis Produk POS <-> Stok Jualan
// ============================================================

export type Kondisi = "BARU" | "SEKEN";
export const KONDISI_LABEL: Record<Kondisi, string> = { BARU: "Baru", SEKEN: "Seken" };
export type ProdukSync = { id: string; name: string; category: string; subcategory?: string | null; stokRef?: StokRef | null; stokAuto?: boolean; kondisi?: Kondisi | null };

const RE_SEKEN = /\b(SEKEN|SECOND|BEKAS)\b|LIKE NEW/i;
/** Kondisi barang jualan: dari field `kondisi`; bila belum diisi, ditebak dari kategori stok / nama. */
export function kondisiProduk(p: { name: string; kondisi?: Kondisi | null; stokRef?: StokRef | null }): Kondisi {
  if (p.kondisi === "BARU" || p.kondisi === "SEKEN") return p.kondisi;
  if (/SEKEN/i.test(p.stokRef?.kategori || "")) return "SEKEN";
  if (/BARU/i.test(p.stokRef?.kategori || "")) return "BARU";
  return RE_SEKEN.test(p.name || "") ? "SEKEN" : "BARU";
}
/** Kondisi barang stok: dari nama kategori (UNIT KONSOL BARU/SEKEN), produk yang memakainya, atau namanya. */
export function kondisiStok(kategori: string, item: string, products: ProdukSync[]): Kondisi {
  if (/SEKEN/i.test(kategori)) return "SEKEN";
  if (/BARU/i.test(kategori)) return "BARU";
  const pakai = products.filter((p) => p.stokRef && p.stokRef.kategori === kategori && (p.stokRef.item === item || p.stokRef.item === PILIH_SAAT_CHECKOUT));
  if (pakai.length) return pakai.every((p) => kondisiProduk(p) === "SEKEN") ? "SEKEN" : "BARU";
  return RE_SEKEN.test(item) ? "SEKEN" : "BARU";
}
export type SubKategoriJualan = "Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD";

/** Sub-kategori produk jualan dari namanya (sama dengan katalog POS). */
export function produkSubKategori(name: string): SubKategoriJualan {
  const lower = String(name || "").toLowerCase();
  if (lower.startsWith("bd ") || lower.includes(" bd ") || lower.includes("kaset") || lower.includes("blu-ray")) return "BD";
  if (lower.includes("hdd") || lower.includes("hardisk") || lower.includes("hard disk") || lower.includes("external")) return "Hardisk";
  if (
    (lower.startsWith("ps3") || lower.startsWith("ps4") || lower.startsWith("ps5") || lower.startsWith("playstation") || lower.startsWith("konsol") || lower.startsWith("nintendo")) &&
    !lower.includes("kabel") && !lower.includes("charger") && !lower.includes("kaset") && !lower.includes("servis")
  ) return "Unit PS";
  if (lower.includes("stik") || lower.includes("controller")) return "Stik";
  return "Aksesoris";
}

export const KATEGORI_KASET_BD = "KASET BD";

/** Nama barang jualan & barang stok jualan selalu HURUF BESAR (mudah dibaca, konsisten). */
export const namaJualan = (s: string) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();

/** Kategori & nama barang stok baru untuk produk yang belum punya padanan di stok. */
export function stokBaruUntukProduk(p: Pick<ProdukSync, "name" | "subcategory"> & { kondisi?: Kondisi | null }): StokRef {
  const name = namaJualan(p.name);
  const seken = kondisiProduk({ name, kondisi: p.kondisi }) === "SEKEN";
  const sub = (p.subcategory as SubKategoriJualan) || produkSubKategori(name);
  const tok = tokenize(name);
  const clean =
    name
      .replace(/\s*\((?:baru|seken|second|bekas)[^)]*\)\s*$/i, "")
      .replace(/\s+(?:baru|seken)\s*$/i, "")
      .trim() || name;
  if (sub === "BD") return { kategori: KATEGORI_KASET_BD, item: clean.replace(/^(?:kaset\s+)?bd\s+/i, "").trim() || clean };
  if (sub === "Unit PS") return { kategori: seken ? "UNIT KONSOL SEKEN" : "UNIT KONSOL BARU", item: clean };
  if (sub === "Stik") return { kategori: tok.includes("PS4") ? "STIK PS4" : tok.includes("PS3") ? "STIK PS3" : "STIK LAINNYA", item: clean };
  return { kategori: "AKSESORIS", item: clean };
}

/**
 * Rencana sinkron untuk produk JUALAN yang belum pernah diatur (stokRef belum ada):
 * - cocok jelas dengan barang stok -> dihubungkan,
 * - tidak ada padanannya -> barang stok baru dibuat (stokAuto) lalu dihubungkan.
 * Produk yang sengaja di-set "Tidak dihubungkan" (null) tidak disentuh.
 */
export function planStokSync(products: ProdukSync[], master: StokKategori[]) {
  const nk = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cats = master.map((c) => ({ kategori: c.kategori, items: [...(c.items || [])] }));
  const links: { id: string; ref: StokRef; baru: boolean }[] = [];
  const add: Record<string, string[]> = {};
  products
    .filter((p) => p.category === "JUALAN" && p.stokRef === undefined)
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
    .forEach((p) => {
      // Kondisi ikut dipakai untuk memilih Unit Baru / Unit Seken
      const k = kondisiProduk(p);
      const s = suggestStokRef(RE_SEKEN.test(p.name) || /\bBARU\b/i.test(p.name) ? p.name : `${p.name} ${k}`, cats);
      if (s && (s.yakin || s.ref.item === PILIH_SAAT_CHECKOUT)) {
        links.push({ id: p.id, ref: s.ref, baru: false });
        return;
      }
      const want = stokBaruUntukProduk(p);
      let cat = cats.find((c) => nk(c.kategori) === nk(want.kategori));
      if (!cat) { cat = { kategori: want.kategori, items: [] }; cats.push(cat); }
      const exist = cat.items.find((i) => nk(i) === nk(want.item));
      const item = exist || want.item;
      if (!exist) { cat.items.push(item); (add[cat.kategori] ||= []).push(item); }
      links.push({ id: p.id, ref: { kategori: cat.kategori, item }, baru: !exist });
    });
  return { links, add };
}

/** Jalankan sinkron (owner / super admin). Master dibaca langsung dari server. */
export async function syncProdukKeStok(products: ProdukSync[]): Promise<{ linked: number; created: number; items: StokRef[] }> {
  if (!products.some((p) => p.category === "JUALAN" && p.stokRef === undefined)) return { linked: 0, created: 0, items: [] };
  const snap = await getDoc(doc(db, "data", "master_stok_categories"));
  const raw = snap.data()?.jualan;
  if (!Array.isArray(raw)) throw new Error("Master stok belum terbaca.");
  const plan = planStokSync(products, raw as StokKategori[]);
  if (!plan.links.length) return { linked: 0, created: 0, items: [] };
  await applyMasterChanges(plan.add);
  for (let i = 0; i < plan.links.length; i += 400) {
    const b = writeBatch(db);
    plan.links.slice(i, i + 400).forEach((l) => b.set(doc(db, "products", l.id), { stokRef: l.ref, stokAuto: l.baru }, { merge: true }));
    await b.commit();
  }
  const baru = plan.links.filter((l) => l.baru);
  return { linked: plan.links.length - baru.length, created: baru.length, items: baru.map((l) => l.ref) };
}

/** Barang stok yang dibuat otomatis untuk sebuah produk ikut dihapus bila tak dipakai produk lain & jumlahnya 0. */
export async function hapusStokOtomatisBilaYatim(ref: StokRef, produkLain: ProdukSync[], jumlah: number | undefined): Promise<boolean> {
  if (!ref || ref.item === PILIH_SAAT_CHECKOUT) return false;
  const dipakai = produkLain.some((p) => p.stokRef && p.stokRef.kategori === ref.kategori && p.stokRef.item === ref.item);
  if (dipakai || (Number(jumlah) || 0) > 0) return false;
  await removeJualanItem(ref.kategori, ref.item);
  return true;
}

export const stokRefLabel = (r?: StokRef | null) =>
  !r ? "Tidak dihubungkan" : r.item === PILIH_SAAT_CHECKOUT ? `${r.kategori} › pilih saat checkout` : `${r.kategori} › ${r.item}`;

// ============================================================
// Simpan penjualan
// ============================================================

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function commitPosSale(
  input: Omit<PosSale, "noNota" | "ts" | "tanggal" | "kasir" | "stokKurang">,
  /** Bayar DP: stok belum berkurang sampai pelunasan. */
  opsi: { dp?: { jumlah: number; jatuhTempo: string } } = {}
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
  if (input.metode === "TRANSFER" && !input.buktiTransfer) throw new Error("Bukti transfer wajib diupload.");
  const dp = opsi.dp ? Math.round(Number(opsi.dp.jumlah) || 0) : null;
  if (opsi.dp) {
    if (!(dp! > 0) || dp! >= input.total) throw new Error("Nominal DP harus lebih dari 0 dan kurang dari total.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(opsi.dp.jatuhTempo || ""))) throw new Error("Isi tanggal jatuh tempo pelunasan.");
  }

  const hasil = await runTransaction(db, async (tx) => {
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

    // Nota DP: stok baru dipotong saat pelunasan (barang berstatus "dipesan")
    const w = dp ? { patch: {}, logs: [] as any[] } : prepareStokWrites(jualan, changes, "terjual", `Nota ${noNota}${input.pembeli ? ` · ${input.pembeli}` : ""}`, kasir, now);
    if (!dp) writeStokInTx(tx, w as any, { noNota });

    const sale: PosSale = dp
      ? {
          ...input, noNota, ts: now, tanggal, kasir, stokKurang: [],
          status: "DP", dp, jatuhTempo: opsi.dp!.jatuhTempo,
          pembayaran: [{ jenis: "DP", jumlah: dp, metode: input.metode, ...(input.buktiTransfer ? { buktiTransfer: input.buktiTransfer } : {}), ts: now, oleh: kasir, olehNama: input.kasirNama }],
        }
      : { ...input, noNota, ts: now, tanggal, kasir, stokKurang };
    const stokSesudah = Object.fromEntries((w.logs as any[]).map((l) => [`${l.kategori}||${l.item}`, l.sesudah]));
    tx.set(counterRef, { day: dayKey, seq }, { merge: true });
    // Firestore menolak nilai undefined -> bersihkan dulu (data polos, aman di-JSON)
    tx.set(saleRef, { ...JSON.parse(JSON.stringify(sale)), waktu: serverTimestamp() });
    return { ...sale, id: saleRef.id, stokSesudah };
  });
  // Jasa (isi game / HEN / servis) ikut rincian pembukuan hari itu bila sudah disimpan
  sinkronNotaDiam(now);
  return hasil;
}

/** Stok yang benar-benar terpotong oleh nota (stok tidak pernah di bawah 0) -> perubahan untuk mengembalikannya. */
function restoreChanges(sale: PosSale): StokChange[] {
  const need = new Map<string, { kategori: string; item: string; qty: number }>();
  (sale.items || []).forEach((it) => {
    if (!it.stokRef || it.stokRef.item === PILIH_SAAT_CHECKOUT) return;
    const k = `${it.stokRef.kategori}||${it.stokRef.item}`;
    const n = need.get(k) || { ...it.stokRef, qty: 0 };
    n.qty += it.qty;
    need.set(k, n);
  });
  const changes: StokChange[] = [];
  need.forEach((n) => {
    const kurang = (sale.stokKurang || []).find((k) => k.kategori === n.kategori && k.item === n.item);
    const terpotong = kurang ? Math.max(0, Math.min(n.qty, kurang.tersedia)) : n.qty;
    if (terpotong > 0) changes.push({ kategori: n.kategori, item: n.item, delta: terpotong });
  });
  return changes;
}

/**
 * Hapus nota permanen (owner / super admin, untuk data uji / salah input).
 * Bila nota belum dibatalkan, stok yang terpotong dikembalikan. Riwayat stok milik
 * nota ini ikut dihapus, sehingga tidak meninggalkan jejak di Stok & Analitik.
 */
export async function deletePosSale(sale: PosSale): Promise<void> {
  if (!sale.id) throw new Error("ID nota tidak ditemukan.");
  const oleh = auth.currentUser?.email || "admin";
  const now = Date.now();
  const saleRef = doc(db, "pos_transaksi", sale.id);
  const stokDoc = doc(db, "data", "stok");
  const logs = await getDocs(query(collection(db, "stok_log"), where("noNota", "==", sale.noNota)));
  await runTransaction(db, async (tx) => {
    const [sSnap, stSnap] = await Promise.all([tx.get(saleRef), tx.get(stokDoc)]);
    if (!sSnap.exists()) throw new Error("Nota sudah tidak ada.");
    const cur = sSnap.data() as PosSale;
    // Nota DP yang belum lunas tidak pernah memotong stok
    if (!cur.batal && cur.status !== "DP") {
      const jualan = (stSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
      const w = prepareStokWrites(jualan, restoreChanges(cur), "koreksi", "", oleh, now);
      if (Object.keys(w.patch).length) tx.set(stokDoc, { jualan: w.patch }, { merge: true }); // tanpa log: riwayatnya ikut dihapus
    }
    logs.docs.forEach((d) => tx.delete(d.ref));
    tx.delete(saleRef);
  });
  sinkronNotaDiam(sale.ts);
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
    if (cur.status === "DP") throw new Error("Nota DP dibatalkan lewat pilihan Dibatalkan pembeli / Dibatalkan URBAN.");
    const jualan = (stSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const changes = restoreChanges(cur);
    const w = prepareStokWrites(jualan, changes, "koreksi", `Batal nota ${cur.noNota}${alasan.trim() ? ` · ${alasan.trim()}` : ""}`, oleh, now);
    writeStokInTx(tx, w, { noNota: cur.noNota });
    tx.update(saleRef, { batal: true, batalOleh: oleh, batalTs: now, batalAlasan: alasan.trim() || null });
  });
  sinkronNotaDiam(sale.ts);
}

/**
 * PELUNASAN nota DP (kasir boleh): sisa tagihan dibayar, stok barang baru dipotong,
 * nota berubah menjadi LUNAS dengan riwayat pembayaran.
 */
export async function lunasiNotaDp(
  sale: PosSale,
  bayar: { metode: "CASH" | "TRANSFER"; buktiTransfer?: string; kasirNama: string }
): Promise<PosSale> {
  if (!sale.id) throw new Error("ID nota tidak ditemukan.");
  if (bayar.metode === "TRANSFER" && !bayar.buktiTransfer) throw new Error("Bukti transfer wajib diupload.");
  const oleh = auth.currentUser?.email || "admin";
  const now = Date.now();
  const saleRef = doc(db, "pos_transaksi", sale.id);
  const stokDoc = doc(db, "data", "stok");
  return runTransaction(db, async (tx) => {
    const [sSnap, stSnap] = await Promise.all([tx.get(saleRef), tx.get(stokDoc)]);
    if (!sSnap.exists()) throw new Error("Nota tidak ditemukan.");
    const cur = { ...(sSnap.data() as PosSale), id: sale.id };
    if (cur.batal || cur.status !== "DP") throw new Error("Nota ini sudah tidak menunggu pelunasan.");
    const sisa = sisaBayar(cur);
    const jualan = (stSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const need = new Map<string, { kategori: string; item: string; qty: number }>();
    (cur.items || []).forEach((it) => {
      if (!it.stokRef || it.stokRef.item === PILIH_SAAT_CHECKOUT) return;
      const k = `${it.stokRef.kategori}||${it.stokRef.item}`;
      const n = need.get(k) || { ...it.stokRef, qty: 0 };
      n.qty += it.qty;
      need.set(k, n);
    });
    const stokKurang: NonNullable<PosSale["stokKurang"]> = [];
    const changes: StokChange[] = [];
    need.forEach((n) => {
      const tersedia = Math.max(0, Math.round(Number(jualan?.[n.kategori]?.[n.item]?.jumlah) || 0));
      if (tersedia < n.qty) stokKurang.push({ kategori: n.kategori, item: n.item, diminta: n.qty, tersedia });
      changes.push({ kategori: n.kategori, item: n.item, delta: -n.qty });
    });
    const w = prepareStokWrites(jualan, changes, "terjual", `Pelunasan nota ${cur.noNota}${cur.pembeli ? ` · ${cur.pembeli}` : ""}`, oleh, now);
    writeStokInTx(tx, w, { noNota: cur.noNota });
    const pembayaran: PembayaranNota[] = [
      ...(cur.pembayaran || []),
      { jenis: "PELUNASAN", jumlah: sisa, metode: bayar.metode, ...(bayar.buktiTransfer ? { buktiTransfer: bayar.buktiTransfer } : {}), ts: now, oleh, olehNama: bayar.kasirNama },
    ];
    const patch = { status: "LUNAS" as StatusNota, lunasTs: now, lunasOleh: oleh, pembayaran, stokKurang };
    tx.update(saleRef, JSON.parse(JSON.stringify(patch)));
    const stokSesudah = Object.fromEntries(w.logs.map((l) => [`${l.kategori}||${l.item}`, l.sesudah]));
    return { ...cur, ...patch, stokSesudah };
  });
}

/**
 * Batalkan nota DP (owner / super admin). Stok tidak berubah (belum pernah dipotong).
 * PEMBELI = DP hangus (dicatat sebagai pemasukan usaha); URBAN = DP dikembalikan penuh.
 */
export async function batalkanNotaDp(sale: PosSale, pihak: "PEMBELI" | "URBAN", alasan = ""): Promise<PosSale> {
  if (!sale.id) throw new Error("ID nota tidak ditemukan.");
  const oleh = auth.currentUser?.email || "admin";
  const now = Date.now();
  const saleRef = doc(db, "pos_transaksi", sale.id);
  return runTransaction(db, async (tx) => {
    const sSnap = await tx.get(saleRef);
    if (!sSnap.exists()) throw new Error("Nota tidak ditemukan.");
    const cur = { ...(sSnap.data() as PosSale), id: sale.id };
    if (cur.batal || cur.status !== "DP") throw new Error("Nota ini bukan DP yang masih berjalan.");
    const patch = {
      batal: true,
      status: (pihak === "PEMBELI" ? "BATAL_PEMBELI" : "BATAL_URBAN") as StatusNota,
      batalOleh: oleh,
      batalTs: now,
      batalAlasan: alasan.trim() || null,
    };
    tx.update(saleRef, patch);
    return { ...cur, ...patch };
  });
}

/** Nota DP yang masih menunggu pelunasan (realtime), urut jatuh tempo terdekat. */
export function useNotaDp(): { list: PosSale[]; loading: boolean } {
  const [list, setList] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "pos_transaksi"), where("status", "==", "DP")),
        (s) => {
          setList(
            s.docs
              .map((d) => ({ id: d.id, ...(d.data() as PosSale) }))
              .filter(isDpTerbuka)
              .sort((a, b) => String(a.jatuhTempo || "").localeCompare(String(b.jatuhTempo || "")) || a.ts - b.ts)
          );
          setLoading(false);
        },
        (e) => { console.warn("nota DP:", e); setLoading(false); }
      ),
    []
  );
  return { list, loading };
}

/** Unggah PDF nota ke Storage (link untuk WhatsApp pembeli) & simpan link-nya di transaksi. */
export async function simpanNotaOnline(sale: PosSale, file: File): Promise<string> {
  const d = new Date(sale.ts);
  const bulan = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const r = storageRef(storage, `nota/${bulan}/${sale.noNota}_${Date.now()}.pdf`);
  await uploadBytes(r, file, { contentType: "application/pdf" });
  const url = await getDownloadURL(r);
  if (sale.id) await updateDoc(doc(db, "pos_transaksi", sale.id), { notaUrl: url }).catch((e) => console.warn("notaUrl:", e));
  return url;
}

// ============================================================
// Baca penjualan (Analitik Usaha & riwayat nota)
// ============================================================

/** Nota DP yang DILUNASI pada rentang waktu (penjualannya dihitung saat lunas). */
export function usePosSalesLunas(fromTs: number, toTs: number): { sales: PosSale[]; loading: boolean } {
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "pos_transaksi"), where("lunasTs", ">=", Math.max(1, fromTs)), where("lunasTs", "<=", toTs));
    return onSnapshot(
      q,
      (s) => {
        setSales(s.docs.map((d) => ({ id: d.id, ...(d.data() as PosSale) })).filter((x) => (x.lunasTs || 0) >= fromTs && (x.lunasTs || 0) <= toTs));
        setLoading(false);
      },
      (e) => { console.warn("pos_transaksi (lunas):", e); setSales([]); setLoading(false); }
    );
  }, [fromTs, toTs]);
  return { sales, loading };
}

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

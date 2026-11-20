/**
 * STOK JUALAN — logika bersama untuk input pegawai (Update Stok) dan halaman owner.
 *
 * Data Firestore:
 * - data/stok                 → { jualan: { [kategori]: { [item]: { jumlah, lastEditTs, ... } } } }
 * - data/stok_config          → { minStok: { [kategori]: { [item]: number } } }
 * - stok_log/{auto}           → riwayat setiap perubahan (masuk / terjual / rusak / koreksi)
 *
 * Semua perubahan jumlah memakai TRANSAKSI berbasis selisih (delta), jadi dua HP yang
 * mengubah stok bersamaan tidak saling menimpa.
 */
import { useEffect, useState } from "react";
import { collection, deleteField, doc, FieldPath, getDocFromServer, getDocs, getDocsFromServer, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, type Transaction, where, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";

export type StokStatus = "habis" | "menipis" | "aman";

/** Kunci satu barang stok: "KATEGORI||ITEM" (dipakai semua peta stok). */
export const kunciStok = (r: { kategori: string; item: string }) => `${r.kategori}||${r.item}`;
export type StokAlasan = "masuk" | "terjual" | "rusak" | "koreksi";

export const ALASAN_LABEL: Record<StokAlasan, string> = {
  masuk: "Barang masuk / restock",
  terjual: "Terjual",
  rusak: "Rusak / retur",
  koreksi: "Koreksi hitung stok",
};

export const ALASAN_SHORT: Record<StokAlasan, string> = { masuk: "Masuk", terjual: "Terjual", rusak: "Rusak/retur", koreksi: "Koreksi" };

/** Master Inventaris WAJIB berupa array; bila tidak terbaca, batalkan (jangan menimpa daftar dengan kosong). */
function readMasterJualan(raw: unknown): StokKategori[] {
  if (!Array.isArray(raw)) throw new Error("Master Inventaris tidak terbaca. Muat ulang halaman lalu coba lagi.");
  return (raw as StokKategori[]).map((c) => ({ ...c, items: Array.isArray(c?.items) ? [...c.items] : [] }));
}

export type StokLog = {
  id: string;
  kategori: string;
  item: string;
  delta: number;
  sebelum: number;
  sesudah: number;
  alasan: StokAlasan;
  catatan?: string;
  oleh: string;
  ts: number;
  /** Stok masuk yang sudah dibatalkan lewat "Urungkan" */
  diurungkan?: boolean;
};

export type StokRow = {
  kategori: string;
  item: string;
  jumlah: number;
  min: number;
  status: StokStatus;
  kurang: number; // berapa lagi untuk mencapai stok minimum
  lastTs: number | null;
  lastBy?: string;
  lastDelta?: number;
};

export type MinStokMap = Record<string, Record<string, number>>;

/** Stok minimum bawaan bila owner belum mengatur: unit konsol 1, barang lain 3. */
export const defaultMinStok = (kategori: string) => (/unit|konsol|kaset bd/i.test(kategori) ? 1 : 3);

export const getMinStok = (map: MinStokMap | undefined, kategori: string, item: string) => {
  const v = map?.[kategori]?.[item];
  return typeof v === "number" && v >= 0 ? v : defaultMinStok(kategori);
};

export const statusOf = (jumlah: number, min: number): StokStatus =>
  jumlah <= 0 ? "habis" : jumlah < min ? "menipis" : "aman";

/**
 * Waktu update terakhir. Data lama menyimpan teks id-ID "08/11/2026, 07.05" / "08/11/2026 07:05"
 * (hari/bulan/tahun) — `new Date()` membacanya sebagai bulan/hari, jadi diurai manual.
 */
export function parseLastEdit(v?: StokItemValue & { lastEditTs?: number }): number | null {
  if (!v) return null;
  if (typeof v.lastEditTs === "number" && v.lastEditTs > 0) return v.lastEditTs;
  const s = String(v.lastEditDate || "");
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2})[.:](\d{2})/) || s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  return isNaN(d.getTime()) ? null : d.getTime();
}

export function buildStokRows(
  categories: StokKategori[] | undefined,
  jualan: Record<string, Record<string, StokItemValue>> | undefined,
  minMap: MinStokMap | undefined
): StokRow[] {
  const rows: StokRow[] = [];
  (categories || []).forEach((cat) => {
    (cat.items || []).forEach((item) => {
      const v = jualan?.[cat.kategori]?.[item];
      const jumlah = Math.max(0, Math.round(Number(v?.jumlah) || 0));
      const min = getMinStok(minMap, cat.kategori, item);
      rows.push({
        kategori: cat.kategori,
        item,
        jumlah,
        min,
        status: statusOf(jumlah, min),
        kurang: Math.max(0, min - jumlah),
        lastTs: parseLastEdit(v),
        lastBy: v?.lastEditBy,
        lastDelta: v?.lastEditDelta,
      });
    });
  });
  return rows;
}

export const shortName = (s?: string) => String(s || "").split("@")[0] || "-";

export function fmtWaktu(ts: number | null | undefined): string {
  if (!ts) return "Belum pernah diisi";
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  if (diffDays <= 0 && new Date().getDate() === d.getDate()) return `Hari ini ${jam}`;
  if (diffDays <= 1) return `Kemarin ${jam}`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Barang dianggap "perlu dicek" bila jumlahnya tidak diperbarui lebih dari N hari. */
export const STALE_DAYS = 14;
export const isStale = (ts: number | null) => !ts || Date.now() - ts > STALE_DAYS * 86400000;

export function restockText(rows: StokRow[]): string {
  const need = rows.filter((r) => r.status !== "aman");
  const lines = [
    "*DAFTAR BELANJA STOK URBAN*",
    new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    "",
  ];
  const byCat = new Map<string, StokRow[]>();
  need.forEach((r) => byCat.set(r.kategori, [...(byCat.get(r.kategori) || []), r]));
  byCat.forEach((list, kat) => {
    lines.push(`*${kat}*`);
    list
      .sort((a, b) => a.jumlah - b.jumlah)
      .forEach((r) => lines.push(`- ${r.item}: sisa ${r.jumlah}${r.status === "habis" ? " (HABIS)" : ""} → beli ${Math.max(1, r.kurang)}`));
    lines.push("");
  });
  if (need.length === 0) lines.push("Semua stok aman ✅");
  return lines.join("\n").trim();
}

// ============================================================
// Firestore
// ============================================================

/**
 * catatan: undefined = tidak diubah, "" = dihapus.
 * touch: tandai "sudah dicek" (waktu update) walau jumlah tidak berubah — dipakai saat stok opname.
 */
export type StokChange = { kategori: string; item: string; delta?: number; setTo?: number; catatan?: string; touch?: boolean };

export type StokPatch = Record<string, Record<string, Partial<StokItemValue> & { lastEditTs?: number; catatan?: string }>>;

/**
 * Hitung perubahan stok dari data server terbaru (MURNI, tanpa Firebase) — dipakai di dalam
 * transaksi oleh Atur Stok (stok masuk / koreksi) dan POS supaya aturannya satu.
 * Delta dihitung dari angka server, jadi perubahan dari HP lain tidak tertimpa.
 */
export function prepareStokWrites(
  jualan: Record<string, Record<string, StokItemValue>>,
  changes: StokChange[],
  alasan: StokAlasan,
  catatan: string,
  oleh: string,
  now: number
): { patch: StokPatch; logs: Omit<StokLog, "id">[]; touched: number } {
  const tz = new Date(now).toLocaleString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":");
  const patch: StokPatch = {};
  const logs: Omit<StokLog, "id">[] = [];
  let touched = 0;
  // Gabungkan perubahan untuk barang yang sama (mis. 2 baris POS ke barang stok yang sama)
  const merged = new Map<string, StokChange>();
  for (const c of changes) {
    const k = kunciStok(c);
    const prev = merged.get(k);
    if (prev && typeof prev.setTo !== "number" && typeof c.setTo !== "number") {
      merged.set(k, { ...prev, delta: (prev.delta || 0) + (c.delta || 0), catatan: c.catatan ?? prev.catatan, touch: prev.touch || c.touch });
    } else merged.set(k, c);
  }
  for (const c of merged.values()) {
    if (!(typeof c.setTo === "number" || (c.delta || 0) !== 0 || typeof c.catatan === "string" || c.touch)) continue;
    const cur = jualan?.[c.kategori]?.[c.item] as (StokItemValue & { catatan?: string }) | undefined;
    const sebelum = Math.max(0, Math.round(Number(cur?.jumlah) || 0));
    const sesudah = Math.max(0, typeof c.setTo === "number" ? Math.round(c.setTo) : sebelum + Math.round(c.delta || 0));
    const delta = sesudah - sebelum;
    const noteChanged = typeof c.catatan === "string" && c.catatan.trim() !== String(cur?.catatan || "");
    if (delta === 0 && !noteChanged && !c.touch) continue;
    const p: Partial<StokItemValue> & { lastEditTs?: number; catatan?: string } = {};
    if (noteChanged) p.catatan = (c.catatan as string).trim();
    if (delta !== 0) Object.assign(p, { jumlah: sesudah, lastEditDate: tz, lastEditDelta: delta, lastEditBy: oleh, lastEditTs: now });
    else if (c.touch) Object.assign(p, { jumlah: sesudah, lastEditDate: tz, lastEditBy: oleh, lastEditTs: now });
    (patch[c.kategori] ||= {})[c.item] = p;
    touched++;
    if (delta !== 0) logs.push({ kategori: c.kategori, item: c.item, delta, sebelum, sesudah, alasan, catatan: catatan.trim(), oleh, ts: now });
  }
  return { patch, logs, touched };
}

/** Tulis hasil prepareStokWrites di dalam transaksi Firestore yang sedang berjalan. */
export function writeStokInTx(tx: Transaction, w: { patch: StokPatch; logs: Omit<StokLog, "id">[] }, extra: Record<string, unknown> = {}) {
  if (Object.keys(w.patch).length) tx.set(doc(db, "data", "stok"), { jualan: w.patch }, { merge: true });
  w.logs.forEach((l) => tx.set(doc(collection(db, "stok_log")), { ...l, ...extra, tipe: "jualan", waktu: serverTimestamp() }));
}

/**
 * Simpan beberapa perubahan sekaligus dalam SATU transaksi:
 * jumlah dihitung dari angka terbaru di server + delta, dan setiap perubahan dicatat di stok_log.
 */
export async function commitStokChanges(changes: StokChange[], alasan: StokAlasan, catatan = ""): Promise<number> {
  if (!changes.length) return 0;
  const oleh = auth.currentUser?.email || "admin";
  const now = Date.now();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, "data", "stok"));
    const w = prepareStokWrites((snap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>, changes, alasan, catatan, oleh, now);
    if (!w.touched) return 0;
    writeStokInTx(tx, w);
    return w.touched;
  });
}

/** Tambah / hapus barang di Master Inventaris jualan dalam satu transaksi. */
export async function applyMasterChanges(add: Record<string, string[]>, remove: Record<string, string[]> = {}) {
  const hasWork = Object.values(add).some((l) => l.length) || Object.values(remove).some((l) => l.length);
  if (!hasWork) return;
  const ref = doc(db, "data", "master_stok_categories");
  const nk = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const jualan = readMasterJualan(snap.data()?.jualan);
    Object.entries(remove).forEach(([kat, items]) => {
      const c = jualan.find((x) => x.kategori === kat);
      if (c) c.items = c.items.filter((i) => !items.includes(i));
    });
    Object.entries(add).forEach(([kat, items]) => {
      let c = jualan.find((x) => nk(x.kategori) === nk(kat));
      if (!c) { c = { kategori: kat.toUpperCase(), items: [] }; jualan.push(c); }
      items.forEach((i) => { if (!c!.items.some((x) => nk(x) === nk(i))) c!.items.push(i); });
    });
    tx.set(ref, { jualan }, { merge: true });
  });
}

export async function saveMinStok(kategori: string, item: string, min: number) {
  const n = Math.max(0, Math.min(999, Math.round(Number(min) || 0)));
  await setDoc(doc(db, "data", "stok_config"), { minStok: { [kategori]: { [item]: n } } }, { merge: true });
}

/** Hapus barang dari Master Inventaris jualan (data jumlah & riwayat tetap tersimpan). */
export async function removeJualanItem(kategori: string, item: string) {
  const ref = doc(db, "data", "master_stok_categories");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const jualan = readMasterJualan(snap.data()?.jualan)
      .map((c) => (c.kategori === kategori ? { ...c, items: c.items.filter((i) => i !== item) } : c));
    tx.set(ref, { jualan }, { merge: true });
  });
  // Sinkron ke POS: produk yang memakai barang ini jadi "tidak dihubungkan" (tidak dibuat ulang otomatis)
  try {
    const snap = await getDocs(collection(db, "products"));
    const hit = snap.docs.filter((d) => {
      const r = d.data()?.stokRef;
      return r && r.kategori === kategori && r.item === item;
    });
    if (hit.length) {
      const b = writeBatch(db);
      hit.forEach((d) => b.set(d.ref, { stokRef: null, stokAuto: false }, { merge: true }));
      await b.commit();
    }
  } catch (e) {
    console.warn("Lepas hubungan produk POS gagal:", e);
  }
}

/**
 * Ganti nama barang stok jualan. Semua rujukannya ikut (lihat pindahStok), jadi riwayat stok masuk,
 * modal, dan nota tetap nyambung. Mengembalikan nama baru, atau null bila tidak ada perubahan.
 */
export async function renameJualanItem(kategori: string, lama: string, baru: string): Promise<string | null> {
  const nama = rapikanNamaStok(baru);
  if (!nama || nama === lama) return null;
  const [hasil] = await pindahStok([{ dari: { kategori, item: lama }, ke: { kategori, item: nama } }]);
  return hasil ? hasil.item : null;
}

// ============================================================
// Pindah barang ke kategori lain & ganti nama kategori (Owner › Stok › Stok Jualan)
// ============================================================

type RefStok = { kategori: string; item: string };
const nkStok = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Nama kategori / barang stok: spasi dirapikan, HURUF BESAR (sama dengan nama barang jualan). */
export const rapikanNamaStok = (s: string) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();

/**
 * Pindahkan / ganti nama barang stok jualan dalam SATU transaksi. Semua yang merujuk barang itu
 * ikut pindah supaya jumlah, modal (HPP FIFO), dan nota tetap nyambung: master, jumlah, stok minimum,
 * produk, catatan stok masuk, pengeluaran stok, batch bonus PS Baru, tukar tambah, dan nota POS.
 * Riwayat stok ikut sesudahnya (hanya sejarah, gagal = tidak fatal).
 * `gantiKategori` = seluruh kategori ganti nama: produk "pilih varian saat checkout" ikut.
 * Kategori yang jadi kosong karena perpindahan ini dihapus dari master.
 */
async function pindahStok(daftar: { dari: RefStok; ke: RefStok }[], gantiKategori?: { lama: string; baru: string }): Promise<RefStok[]> {
  const mRef = doc(db, "data", "master_stok_categories");
  const sRef = doc(db, "data", "stok");
  const cRef = doc(db, "data", "stok_config");
  const fRef = doc(db, "data", "ps_bonus_fifo");
  const kunci = (r: RefStok) => `${r.kategori}||${r.item}`;

  // 0. Rapikan nama tujuan: kategori yang sudah ada dipakai persis namanya
  const master0 = readMasterJualan((await getDocFromServer(mRef)).data()?.jualan);
  const namaKategori = (s: string) => master0.find((c) => nkStok(c.kategori) === nkStok(s))?.kategori || rapikanNamaStok(s);
  const moves = daftar
    .map((m) => ({ dari: m.dari, ke: { kategori: namaKategori(m.ke.kategori), item: rapikanNamaStok(m.ke.item) } }))
    .filter((m) => m.ke.kategori && m.ke.item && kunci(m.dari) !== kunci(m.ke));
  const ganti = gantiKategori ? { lama: gantiKategori.lama, baru: rapikanNamaStok(gantiKategori.baru) } : undefined;
  if (!moves.length && !ganti) return [];
  const peta = new Map(moves.map((m) => [kunci(m.dari), m.ke]));
  const tujuanDari = (r?: { kategori?: string; item?: string } | null): RefStok | null => {
    if (!r || !r.kategori || !r.item) return null;
    const hit = peta.get(kunci(r as RefStok));
    if (hit) return hit;
    if (ganti && r.kategori === ganti.lama) return { kategori: ganti.baru, item: r.item }; // "*" varian
    return null;
  };
  const katAsal = [...new Set(moves.map((m) => m.dari.kategori))];

  // 1. Dokumen yang merujuk (dibaca ulang di dalam transaksi)
  const [prodSnap, ttSnap, posSnap, ...masukSnaps] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "tukar_tambah")),
    getDocs(collection(db, "pos_transaksi")),
    ...katAsal.map((kat) => getDocs(query(collection(db, "stok_masuk"), where("kategori", "==", kat)))),
  ]);
  const expSnap = await getDocs(query(collection(db, "owner_expenses"), where("kategori", "==", "Stok Jualan"))).catch(() => null);
  type Jenis = "produk" | "tt" | "pos" | "exp" | "masuk";
  const target: { jenis: Jenis; ref: any }[] = [
    ...prodSnap.docs.filter((d) => tujuanDari(d.data()?.stokRef)).map((d) => ({ jenis: "produk" as Jenis, ref: d.ref })),
    ...ttSnap.docs.filter((d) => tujuanDari(d.data()?.stokRef)).map((d) => ({ jenis: "tt" as Jenis, ref: d.ref })),
    ...posSnap.docs
      .filter((d) => {
        const s = d.data() as any;
        return (s?.items || []).some((it: any) => tujuanDari(it?.stokRef)) || (s?.stokKurang || []).some((x: any) => tujuanDari(x));
      })
      .map((d) => ({ jenis: "pos" as Jenis, ref: d.ref })),
    ...(expSnap?.docs || []).filter((d) => tujuanDari(d.data()?.stok)).map((d) => ({ jenis: "exp" as Jenis, ref: d.ref })),
    ...masukSnaps.flatMap((s) => s.docs.filter((d) => peta.has(kunci(d.data() as RefStok))).map((d) => ({ jenis: "masuk" as Jenis, ref: d.ref }))),
  ];
  if (target.length > 420) throw new Error("Data yang merujuk barang ini terlalu banyak untuk dipindah sekaligus.");

  await runTransaction(db, async (tx) => {
    const [m, s, c, f] = await Promise.all([tx.get(mRef), tx.get(sRef), tx.get(cRef), tx.get(fRef)]);
    const snaps = await Promise.all(target.map((t) => tx.get(t.ref)));

    // Master: keluarkan dari kategori asal, masukkan ke tujuan (kategori baru di posisi kategori asal)
    const jualan = readMasterJualan(m.data()?.jualan);
    moves.forEach((mv) => {
      const asal = jualan.find((x) => x.kategori === mv.dari.kategori);
      if (!asal || !asal.items.includes(mv.dari.item)) throw new Error(`"${mv.dari.item}" sudah tidak ada di ${mv.dari.kategori}. Muat ulang halaman.`);
    });
    const keluar = new Set(moves.map((mv) => kunci(mv.dari)));
    jualan.forEach((cat) => { cat.items = cat.items.filter((i) => !keluar.has(`${cat.kategori}||${i}`)); });
    moves.forEach((mv) => {
      let tujuan = jualan.find((x) => x.kategori === mv.ke.kategori);
      if (!tujuan) {
        tujuan = { kategori: mv.ke.kategori, items: [] };
        const posAsal = jualan.findIndex((x) => x.kategori === mv.dari.kategori);
        jualan.splice(posAsal >= 0 ? posAsal + 1 : jualan.length, 0, tujuan);
      }
      if (tujuan.items.some((i) => nkStok(i) === nkStok(mv.ke.item))) throw new Error(`"${mv.ke.item}" sudah ada di ${tujuan.kategori}.`);
      tujuan.items.push(mv.ke.item);
    });
    let masterBaru = jualan.filter((cat) => cat.items.length > 0 || !katAsal.includes(cat.kategori));
    if (ganti) {
      // Kategori kosong yang diganti namanya tetap ada dengan nama baru
      masterBaru = masterBaru.map((cat) => (cat.kategori === ganti.lama ? { ...cat, kategori: ganti.baru } : cat));
    }
    tx.set(mRef, { jualan: masterBaru }, { merge: true });

    // Jumlah & stok minimum: tulis ulang per kategori yang terkena (path tidak saling tumpang)
    const pindahPeta = (asal: Record<string, Record<string, unknown>> | undefined) => {
      const out: Record<string, Record<string, unknown>> = {};
      const ambil = (kat: string) => (out[kat] ||= { ...((asal || {})[kat] || {}) });
      let ada = false;
      moves.forEach((mv) => {
        const dari = ambil(mv.dari.kategori);
        const val = dari[mv.dari.item];
        delete dari[mv.dari.item];
        if (val !== undefined) { ambil(mv.ke.kategori)[mv.ke.item] = val; ada = true; }
      });
      return ada ? out : null;
    };
    const tulisPeta = (ref: typeof sRef, akar: string, out: Record<string, Record<string, unknown>> | null) => {
      if (!out) return;
      const args: unknown[] = [];
      Object.entries(out).forEach(([kat, isi]) => args.push(new FieldPath(akar, kat), Object.keys(isi).length ? isi : deleteField()));
      if (args.length) tx.update(ref, args[0] as FieldPath, args[1], ...args.slice(2));
    };
    if (s.exists()) tulisPeta(sRef, "jualan", pindahPeta(s.data()?.jualan));
    if (c.exists()) tulisPeta(cRef, "minStok", pindahPeta(c.data()?.minStok));

    // Batch bonus PS Baru
    const batches = f.exists() && Array.isArray((f.data() as any)?.batches) ? ((f.data() as any).batches as RefStok[]) : [];
    if (batches.some((b) => peta.has(kunci(b)))) {
      tx.set(fRef, { batches: batches.map((b) => { const ke = peta.get(kunci(b)); return ke ? { ...b, kategori: ke.kategori, item: ke.item } : b; }) }, { merge: true });
    }

    // Rujukan lain
    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      const t = target[i];
      if (t.jenis === "produk" || t.jenis === "tt") {
        const ke = tujuanDari(d.stokRef);
        if (ke) tx.update(t.ref, { stokRef: ke });
      } else if (t.jenis === "pos") {
        const items = (d.items || []).map((it: any) => { const ke = tujuanDari(it?.stokRef); return ke ? { ...it, stokRef: ke } : it; });
        const kurang = Array.isArray(d.stokKurang) ? d.stokKurang.map((x: any) => { const ke = tujuanDari(x); return ke ? { ...x, kategori: ke.kategori, item: ke.item } : x; }) : undefined;
        tx.update(t.ref, kurang ? { items, stokKurang: kurang } : { items });
      } else if (t.jenis === "exp") {
        const ke = tujuanDari(d.stok);
        if (ke) tx.update(t.ref, { stok: ke, nama: String(d.nama || "").replace(` (${d.stok.item}) ×`, ` (${ke.item}) ×`) });
      } else {
        const ke = peta.get(kunci(d));
        if (ke) tx.update(t.ref, { kategori: ke.kategori, item: ke.item });
      }
    });
  });

  // Riwayat stok ikut pindah supaya riwayat & "laku 30 hari" tetap utuh
  try {
    for (const kat of katAsal) {
      const snap = await getDocs(query(collection(db, "stok_log"), where("kategori", "==", kat)));
      const kena = snap.docs.filter((d) => peta.has(kunci(d.data() as RefStok)));
      for (let i = 0; i < kena.length; i += 400) {
        const b = writeBatch(db);
        kena.slice(i, i + 400).forEach((d) => { const ke = peta.get(kunci(d.data() as RefStok))!; b.update(d.ref, { kategori: ke.kategori, item: ke.item }); });
        await b.commit();
      }
    }
  } catch (e) {
    console.warn("Pindah riwayat stok gagal:", e);
  }
  return moves.map((m) => m.ke);
}

/** Pindahkan satu barang stok ke kategori lain (nama barang boleh ikut diganti). Mengembalikan rujukan barunya. */
export async function pindahBarangStok(dari: RefStok, ke: RefStok): Promise<RefStok | null> {
  const [hasil] = await pindahStok([{ dari, ke }]);
  return hasil || null;
}

/** Ganti nama kategori stok jualan: semua barangnya (dan produk "pilih varian saat checkout") ikut. */
export async function gantiNamaKategoriStok(lama: string, baru: string, items: string[]): Promise<string> {
  const nama = rapikanNamaStok(baru);
  if (!nama) throw new Error("Nama kategori wajib diisi.");
  if (nama === lama) return lama;
  if (nkStok(nama) === nkStok(lama)) throw new Error("Nama baru terlalu mirip dengan nama lama.");
  const master = readMasterJualan((await getDocFromServer(doc(db, "data", "master_stok_categories"))).data()?.jualan);
  if (master.some((c) => c.kategori !== lama && nkStok(c.kategori) === nkStok(nama))) {
    throw new Error(`Kategori "${nama}" sudah ada. Pindahkan barangnya satu per satu bila ingin digabung.`);
  }
  await pindahStok(items.map((item) => ({ dari: { kategori: lama, item }, ke: { kategori: nama, item } })), { lama, baru: nama });
  return nama;
}

export function useMinStok(): MinStokMap {
  const [map, setMap] = useState<MinStokMap>({});
  useEffect(
    () =>
      onSnapshot(
        doc(db, "data", "stok_config"),
        (s) => setMap((s.data()?.minStok as MinStokMap) || {}),
        (e) => console.warn("stok_config:", e)
      ),
    []
  );
  return map;
}

export function useStokLog(max = 300): { logs: StokLog[]; loading: boolean } {
  const [logs, setLogs] = useState<StokLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "stok_log"), orderBy("ts", "desc"), limit(max)),
        (s) => {
          setLogs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StokLog, "id">) })));
          setLoading(false);
        },
        (e) => {
          console.warn("stok_log:", e);
          setLoading(false);
        }
      ),
    [max]
  );
  return { logs, loading };
}

/** Jumlah terjual per barang dalam N hari terakhir (dari riwayat). */
export function soldMap(logs: StokLog[], days = 30): Map<string, number> {
  const since = Date.now() - days * 86400000;
  const m = new Map<string, number>();
  logs.forEach((l) => {
    if (l.alasan !== "terjual" || l.ts < since || l.delta >= 0) return;
    const k = kunciStok(l);
    m.set(k, (m.get(k) || 0) - l.delta);
  });
  return m;
}

type RecoveryProduct = { id: string; stokRef?: { kategori: string; item: string } | null };
let _recoveryRun: Promise<{ restoredItems: number; totalUnits: number }> | null = null;

/**
 * Memulihkan peta stok jualan (`data/stok.jualan`) dan item master dari riwayat `stok_log`,
 * pencocokan rename di `stok_masuk`, serta pelunasan nota POS (`pos_transaksi`) yang terjadi
 * ketika `data/stok.jualan` sempat kosong. Bersifat idempoten: hanya menulis ke server bila
 * field `jualan` di `data/stok` benar-benar masih kosong.
 */
export function pulihkanStokJualanDariRiwayat(
  products?: RecoveryProduct[]
): Promise<{ restoredItems: number; totalUnits: number }> {
  if (_recoveryRun) return _recoveryRun;
  _recoveryRun = (async () => {
    const stokDocRef = doc(db, "data", "stok");
    const masterDocRef = doc(db, "data", "master_stok_categories");
    const curSnap = await getDocFromServer(stokDocRef);
    const existingJualan = (curSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    if (Object.keys(existingJualan).length > 0) {
      return { restoredItems: 0, totalUnits: 0 };
    }

    const [logsSnap, masukSnap, resolvedProducts] = await Promise.all([
      getDocsFromServer(query(collection(db, "stok_log"), orderBy("ts", "desc"))),
      getDocsFromServer(collection(db, "stok_masuk")).catch(() => null),
      products && products.length
        ? Promise.resolve(products)
        : getDocsFromServer(query(collection(db, "products"), where("category", "==", "JUALAN"))).then((s) =>
            s.docs.map((d) => ({ id: d.id, ...(d.data() as { stokRef?: { kategori: string; item: string } | null }) }))
          ),
    ]);

  if (logsSnap.empty) return { restoredItems: 0, totalUnits: 0 };

  type Rec = { jumlah: number; ts: number; oleh: string; delta: number };
  const latestMap = new Map<string, Rec>();
  let latestLogTs = 0;

  logsSnap.docs.forEach((d) => {
    const l = d.data() as StokLog & { tipe?: string };
    if (l.tipe && l.tipe !== "jualan") return;
    const kat = String(l.kategori || "").trim();
    const item = String(l.item || "").trim();
    if (!kat || !item) return;
    const ts = Number(l.ts) || 0;
    if (ts > latestLogTs) latestLogTs = ts;
    const k = kunciStok({ kategori: kat, item });
    if (!latestMap.has(k)) {
      latestMap.set(k, {
        jumlah: Math.max(0, Math.round(Number(l.sesudah) || 0)),
        ts,
        oleh: String(l.oleh || "admin"),
        delta: Number(l.delta) || 0,
      });
    }
  });

  const [posTsSnap, posLunasSnap] = await Promise.all([
    getDocsFromServer(query(collection(db, "pos_transaksi"), where("ts", ">=", latestLogTs))),
    getDocsFromServer(query(collection(db, "pos_transaksi"), where("lunasTs", ">=", latestLogTs))),
  ]);
  const posDocs = new Map<string, any>();
  posTsSnap.docs.forEach((d) => posDocs.set(d.id, d.data()));
  posLunasSnap.docs.forEach((d) => posDocs.set(d.id, d.data()));

  // Rekonsiliasi item yang di-rename: stok_log lama masih memakai nama lama sementara
  // stok_masuk & products sudah memakai nama baru (mis. KABEL CHARGER PS4 -> KABEL CHARGER PS4 PREMIUM).
  const productKeys = new Set<string>();
  resolvedProducts.forEach((p) => {
    if (p.stokRef?.kategori && p.stokRef?.item && p.stokRef.item !== "*") {
      productKeys.add(kunciStok({ kategori: p.stokRef.kategori, item: p.stokRef.item }));
    }
  });
  masukSnap?.docs.forEach((d) => {
    const m = d.data() as { kategori?: string; item?: string; produkId?: string; qty?: number };
    if (!m.kategori || !m.item) return;
    const mk = kunciStok({ kategori: m.kategori, item: m.item });
    if (latestMap.has(mk)) return;
    const prod = resolvedProducts.find((p) => p.id === m.produkId);
    const targetRef =
      prod?.stokRef?.kategori && prod.stokRef.item && prod.stokRef.item !== "*"
        ? prod.stokRef
        : { kategori: m.kategori, item: m.item };
    const tk = kunciStok(targetRef);
    if (latestMap.has(tk)) return;
    for (const [lk, rec] of latestMap.entries()) {
      const [lKat] = lk.split("||");
      if (lKat === targetRef.kategori && !productKeys.has(lk) && rec.jumlah > 0 && rec.jumlah === Number(m.qty)) {
        latestMap.set(tk, rec);
        latestMap.delete(lk);
        break;
      }
    }
  });

  // Kurangi penjualan POS yang memotong 0 unit (tersedia === 0 di stokKurang) saat data/stok sempat kosong.
  posDocs.forEach((sale) => {
    if (sale.batal || sale.status === "DP") return;
    const effectiveTs = Number(sale.lunasTs || sale.ts || 0);
    if (!(effectiveTs > latestLogTs)) return;
    const kurangList: Array<{ kategori?: string; item?: string; tersedia?: number }> = Array.isArray(sale.stokKurang)
      ? sale.stokKurang
      : [];
    const items: Array<{ qty?: number; stokRef?: { kategori: string; item: string } | null }> = Array.isArray(sale.items)
      ? sale.items
      : [];
    items.forEach((it) => {
      if (!it.stokRef?.kategori || !it.stokRef?.item || it.stokRef.item === "*") return;
      const k = kunciStok(it.stokRef);
      const rec = latestMap.get(k);
      if (!rec || rec.jumlah <= 0) return;
      const kurang = kurangList.find((x) => x.kategori === it.stokRef!.kategori && x.item === it.stokRef!.item);
      if (kurang && Number(kurang.tersedia) === 0 && rec.ts < effectiveTs) {
        const q = Math.max(1, Math.round(Number(it.qty) || 1));
        rec.jumlah = Math.max(0, rec.jumlah - q);
        rec.ts = effectiveTs;
        rec.oleh = String(sale.lunasOleh || sale.kasir || "kasir");
        rec.delta = -q;
      }
    });
  });

  const jualanPatch: Record<string, Record<string, StokItemValue>> = {};
  let restoredItems = 0;
  let totalUnits = 0;
  latestMap.forEach((rec, k) => {
    const [kat, item] = k.split("||");
    if (rec.jumlah === 0 && !productKeys.has(k)) return;
    const ts = rec.ts || Date.now();
    const tz = new Date(ts)
      .toLocaleString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .replace(/\./g, ":");
    (jualanPatch[kat] ||= {})[item] = {
      jumlah: rec.jumlah,
      lastEditTs: ts,
      lastEditDate: tz,
      lastEditDelta: rec.delta,
      lastEditBy: rec.oleh,
    };
    restoredItems++;
    totalUnits += rec.jumlah;
  });

  if (restoredItems === 0) return { restoredItems: 0, totalUnits: 0 };

  let applied = false;
  await runTransaction(db, async (tx) => {
    const [sSnap, mSnap] = await Promise.all([tx.get(stokDocRef), tx.get(masterDocRef)]);
    const curServerJualan = (sSnap.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    if (Object.keys(curServerJualan).length > 0) return;

    tx.set(stokDocRef, { jualan: jualanPatch }, { merge: true });

    if (mSnap.exists()) {
      const curMaster = Array.isArray(mSnap.data()?.jualan)
        ? (mSnap.data()!.jualan as StokKategori[]).map((c) => ({ kategori: c.kategori, items: [...(c.items || [])] }))
        : [];
      let masterChanged = false;
      Object.entries(jualanPatch).forEach(([kat, itemsMap]) => {
        let cat = curMaster.find((c) => c.kategori === kat);
        if (!cat) {
          cat = { kategori: kat, items: [] };
          curMaster.push(cat);
          masterChanged = true;
        }
        Object.keys(itemsMap).forEach((item) => {
          if (!cat!.items.includes(item)) {
            cat!.items.push(item);
            masterChanged = true;
          }
        });
      });
      if (masterChanged) {
        tx.set(masterDocRef, { jualan: curMaster }, { merge: true });
      }
    }
    applied = true;
  });

    return applied ? { restoredItems, totalUnits } : { restoredItems: 0, totalUnits: 0 };
  })().finally(() => {
    _recoveryRun = null;
  });
  return _recoveryRun;
}

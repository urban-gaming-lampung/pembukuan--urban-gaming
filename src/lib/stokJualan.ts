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
import { collection, deleteField, doc, FieldPath, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, type Transaction, writeBatch } from "firebase/firestore";
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
 * transaksi oleh Update Stok, Tempel Laporan, dan POS supaya aturannya satu.
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
 * Ganti nama barang stok jualan (master, jumlah, & stok minimum ikut pindah).
 * Riwayat lama tetap memakai nama lama. Mengembalikan nama baru, atau null bila tidak ada perubahan.
 */
export async function renameJualanItem(kategori: string, lama: string, baru: string): Promise<string | null> {
  const nama = String(baru || "").replace(/\s+/g, " ").trim();
  if (!nama || nama === lama) return null;
  const nk = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mRef = doc(db, "data", "master_stok_categories");
  const sRef = doc(db, "data", "stok");
  const cRef = doc(db, "data", "stok_config");
  return runTransaction(db, async (tx) => {
    const [m, s, c] = await Promise.all([tx.get(mRef), tx.get(sRef), tx.get(cRef)]);
    const jualan = readMasterJualan(m.data()?.jualan);
    const cat = jualan.find((x) => x.kategori === kategori);
    if (!cat || !cat.items.includes(lama)) return null;
    if (cat.items.some((i) => i !== lama && nk(i) === nk(nama))) throw new Error(`"${nama}" sudah ada di ${kategori}.`);
    cat.items = cat.items.map((i) => (i === lama ? nama : i));
    tx.set(mRef, { jualan }, { merge: true });
    const val = s.data()?.jualan?.[kategori]?.[lama];
    if (val !== undefined) tx.update(sRef, new FieldPath("jualan", kategori, nama), val, new FieldPath("jualan", kategori, lama), deleteField());
    const min = c.data()?.minStok?.[kategori]?.[lama];
    if (min !== undefined) tx.update(cRef, new FieldPath("minStok", kategori, nama), min, new FieldPath("minStok", kategori, lama), deleteField());
    return nama;
  });
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

/**
 * PEMASUKAN USAHA DARI PEMBUKUAN HARIAN
 *
 * "Rincian Pemasukan Usaha" (dulu: Jasa & Aksesoris) adalah pemasukan USAHA, bukan rental.
 * Baris yang diketik admin (bukan dari nota POS) ikut dihitung di Analitik › Usaha & Keseluruhan,
 * termasuk seluruh riwayat lama. Baris dari nota POS (`_nota`) sudah terhitung lewat pos_transaksi,
 * jadi diabaikan di sini agar tidak dobel.
 *
 * Baris barang lama (stik, kabel, dll.) diberi PERKIRAAN modal dari harga modal barang jualan saat ini.
 */
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { HistoryItem } from "./types";
import { isBarisNota, bayarCash, bayarTransfer, sebutHen } from "./posPembukuan";
import { modalPada, ModalMap, ProdukJualan } from "./barangJualan";
import { kondisiProduk, Kondisi } from "./posSales";

export type KategoriUsaha = "Isi Game" | "Servis" | "Stik" | "Aksesoris" | "Lainnya";

export type BarisUsahaManual = {
  id: string;
  tanggal: string;
  /** Pukul 12:00 hari itu (jam asli tidak dicatat di pembukuan) */
  ts: number;
  tipe: string;
  ket: string;
  harga: number;
  metode: "CASH" | "TRANSFER";
  kategori: KategoriUsaha;
  /** true = barang (stik / aksesoris) — punya modal; false = jasa */
  barang: boolean;
};

const toNum = (v: unknown) => {
  const n = parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/** Kelompok baris rincian usaha dari tipe + keterangan yang diketik admin. */
export function kategoriBarisUsaha(tipe: string, ket: string): { kategori: KategoriUsaha; barang: boolean } {
  const t = String(tipe || "").toLowerCase();
  const k = String(ket || "").toLowerCase();
  if (t === "isi game") return { kategori: "Isi Game", barang: false };
  if (/servi[sc]e?|ganti|pasta|padta|garansi|downgrade|perbaik/.test(k) || t === "servis") return { kategori: "Servis", barang: false };
  if (t === "upgrade hen" || sebutHen(k)) return { kategori: "Servis", barang: false };
  if (/sti(c)?k|stick|controller/.test(k)) return { kategori: "Stik", barang: true };
  if (/kabel|hdmi|charger|casan|power|converter|dongle|capture|hdd|hardisk|cover|adaptor/.test(k)) return { kategori: "Aksesoris", barang: true };
  if (/game|pes|bola|gta|bitbox|gembox|gamebox|fc ?2\d|patch/.test(k)) return { kategori: "Isi Game", barang: false };
  if (t.includes("stik")) return { kategori: "Stik", barang: true };
  if (t.includes("aksesoris")) return { kategori: "Aksesoris", barang: true };
  return { kategori: "Lainnya", barang: false };
}

const tsSiang = (tanggal: string) => {
  const [y, m, d] = String(tanggal || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d, 12, 0, 0, 0).getTime() : 0;
};

/** Baris manual Rincian Pemasukan Usaha satu hari pembukuan (tanpa baris nota POS). */
export function barisUsahaManual(h: HistoryItem): BarisUsahaManual[] {
  const rows = Array.isArray(h?.rowsJasaAks) ? h.rowsJasaAks : [];
  const ts = tsSiang(h.tanggal);
  const out: BarisUsahaManual[] = [];
  rows.forEach((r: any, i: number) => {
    if (isBarisNota(r)) return;
    const harga = toNum(r?.harga);
    if (harga <= 0) return;
    const { kategori, barang } = kategoriBarisUsaha(r.tipe, r.ket);
    out.push({
      id: `${h.id || h.tanggal}#${i}`,
      tanggal: h.tanggal,
      ts,
      tipe: String(r.tipe || ""),
      ket: String(r.ket || ""),
      harga,
      metode: bayarTransfer(r.bayar) ? "TRANSFER" : "CASH",
      kategori,
      barang,
    });
  });
  return out;
}

// ---------- Perkiraan modal barang lama ----------
const SINONIM: Record<string, string> = { casan: "charger", cas: "charger", stick: "stik", controller: "stik", padta: "pasta" };
const ABAI = new Set(["baru", "dengan", "tanpa", "semua", "warna", "box", "kotak", "dan", "seken", "paket", "jualan", "standar", "premium", "pcs", "buah"]);
const token = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/ps\s*([2345])/g, "ps$1")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((t) => SINONIM[t] || t);
const platform = (ts: string[]) => ts.find((t) => /^ps[2345]$/.test(t)) || null;

export type TebakanModal = { modal: number; qty: number; produk: ProdukJualan; kondisi: Kondisi };

/** Tebak barang jualan yang cocok untuk baris barang lama, lalu pakai harga modal SAAT INI. */
export function tebakModalBaris(row: BarisUsahaManual, products: ProdukJualan[], modalMap: ModalMap): TebakanModal | null {
  if (!row.barang) return null;
  const rt = token(row.ket).filter((t) => !ABAI.has(t) && !/^\d+$/.test(t));
  const rPlat = platform(rt);
  const subOk = (sub?: string | null) =>
    row.kategori === "Stik" ? sub === "Stik" : sub === "Aksesoris" || sub === "Hardisk";
  let best: { p: ProdukJualan; qty: number; score: number } | null = null;
  products.forEach((p) => {
    const price = Number(p.price) || 0;
    if (price <= 0 || !subOk(p.subcategory)) return;
    const pt = new Set(token(p.name));
    const pPlat = platform(Array.from(pt));
    if (rPlat && pPlat && rPlat !== pPlat) return;
    const overlap = rt.filter((t) => pt.has(t)).length;
    if (overlap < 1) return;
    const qty = Math.max(1, Math.round(row.harga / price));
    const err = Math.abs(row.harga / qty - price) / price;
    const score = overlap * 10 - err * 5 - (qty - 1) * 2;
    if (!best || score > best.score) best = { p, qty, score };
  });
  if (!best) return null;
  const b = best as { p: ProdukJualan; qty: number; score: number };
  const m = modalPada(modalMap[b.p.id], Date.now());
  if (!m || !(m.modal > 0)) return null;
  return { modal: m.modal * b.qty, qty: b.qty, produk: b.p, kondisi: kondisiProduk(b.p) };
}

// ---------- Data ----------
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Baris manual rincian usaha dari history_pembukuan pada rentang waktu (realtime). */
export function useBarisUsahaManual(fromTs: number, toTs: number): { rows: BarisUsahaManual[]; loading: boolean } {
  const [rows, setRows] = useState<BarisUsahaManual[]>([]);
  const [loading, setLoading] = useState(true);
  const a = fromTs > 0 ? ymd(new Date(fromTs)) : "";
  const b = ymd(new Date(toTs || Date.now()));
  useEffect(() => {
    setLoading(true);
    const base = collection(db, "history_pembukuan");
    const q = a
      ? query(base, where("tanggal", ">=", a), where("tanggal", "<=", b), orderBy("tanggal", "desc"))
      : query(base, where("tanggal", "<=", b), orderBy("tanggal", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const out: BarisUsahaManual[] = [];
        snap.forEach((d) => out.push(...barisUsahaManual({ id: d.id, ...(d.data() as any) } as HistoryItem)));
        setRows(out);
        setLoading(false);
      },
      (e) => { console.warn("history_pembukuan (usaha):", e); setRows([]); setLoading(false); }
    );
  }, [a, b]);
  return { rows, loading };
}

/** Kas jasa & barang usaha di satu hari pembukuan (semua baris rincian usaha, termasuk dari POS). */
export function kasUsahaHarian(h: HistoryItem): { total: number; cash: number; transfer: number } {
  let total = 0, cash = 0, transfer = 0;
  (Array.isArray(h?.rowsJasaAks) ? h.rowsJasaAks : []).forEach((r: any) => {
    const v = toNum(r?.harga);
    if (v <= 0) return;
    total += v;
    if (bayarCash(r?.bayar)) cash += v;
    else if (bayarTransfer(r?.bayar)) transfer += v;
  });
  return { total, cash, transfer };
}

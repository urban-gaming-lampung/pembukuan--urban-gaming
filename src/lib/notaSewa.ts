/**
 * NOTA SEWA — dibuat dari satu baris "Rincian Pemasukan SEWA PS".
 * Memakai tampilan nota yang sama dengan POS (layar / PDF / thermal / WA), tetapi TIDAK
 * disimpan di pos_transaksi (sewa sudah tercatat di pembukuan harian). Nomor nota
 * SEWA-YYMMDD-### diambil dari penghitung data/sewa_counter dan disimpan di baris (_noNota).
 */
import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";
import { pad, toInt } from "./format";
import { bayarTransfer } from "./keuangan";
import { isHanyaOngkir, isItemTambahan, isPelunasanSewa, labelDurasi, ongkirBaris, waktuSewa } from "./sewa";
import type { PosItem, PosSale } from "./posSales";
import type { RowSewa } from "./types";

export type BarisSewaNota = RowSewa & {
  _customBase?: string | number;
  _noNota?: string;
  _notaTs?: number;
  _waPenyewa?: string;
  waPenyewa?: string;
  diantarOleh?: string;
};

/** Ambil nomor nota sewa berikutnya (urut per hari). */
export async function ambilNomorNotaSewa(): Promise<{ noNota: string; ts: number }> {
  const ts = Date.now();
  const d = new Date(ts);
  const dayKey = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const ref = doc(db, "data", "sewa_counter");
  const seq = await runTransaction(db, async (tx) => {
    const c = (await tx.get(ref)).data() || {};
    const next = c.day === dayKey ? (Number(c.seq) || 0) + 1 : 1;
    tx.set(ref, { day: dayKey, seq: next }, { merge: true });
    return next;
  });
  return { noNota: `SEWA-${dayKey}-${pad(seq, 3)}`, ts };
}

/**
 * Harga sewa tanpa ongkir. `hargaDasar` = harga dari Edit Rincian (dipakai bila baris belum dibayar,
 * karena kolom harga baris "belum dibayar" selalu 0).
 */
export function hargaSewaBaris(r: BarisSewaNota, hargaDasar: number): number {
  if (isPelunasanSewa(r)) return toInt(r.harga);
  if (r.isPaid === "TIDAK") return r.lamaSewa === "Isi Sendiri" ? toInt(r._customBase) : Math.max(0, hargaDasar);
  return Math.max(0, toInt(r.harga) - ongkirBaris(r));
}

/** Baris sudah lengkap untuk dibuatkan nota? */
export function barisSiapNota(r: BarisSewaNota, hargaDasar: number): boolean {
  if (!r || isHanyaOngkir(r)) return false;
  const nama = String(r.ket || "").trim();
  if (!nama) return false;
  const bayarOk = r.isPaid === "TIDAK" || !!String(r.bayar || "").trim();
  if (isPelunasanSewa(r)) return toInt(r.harga) > 0 && !!String(r.bayar || "").trim();
  if (isItemTambahan(r)) return !!r.jenisPS && hargaSewaBaris(r, hargaDasar) > 0 && bayarOk;
  return (
    !!r.jenisPS &&
    !!labelDurasi(r) &&
    !!String(r.jamMasukSewa || "").trim() &&
    (r.isPaid === "YA" || r.isPaid === "TIDAK") &&
    hargaSewaBaris(r, hargaDasar) > 0 &&
    bayarOk
  );
}

const fmtKembali = (d: Date) =>
  `${d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Jam kembali = jam ambil (hari kerja tanggal pembukuan) + lama sewa. */
export function jamKembali(r: BarisSewaNota, tanggal: string): string | null {
  const w = waktuSewa(r, tanggal);
  return w ? fmtKembali(new Date(w.selesai)) : null;
}

const KETENTUAN_SEWA = (r: BarisSewaNota) => {
  const konsol = /ps\s?[2345]|playstation|playbox|switch|steam|konsol|console/i.test(String(r.jenisPS || ""));
  const tv = /tv|monitor/i.test(String(r.jenisPS || ""));
  const isi = [
    "Jaminan: KTP + SIM / STNK, dikembalikan saat unit kembali.",
    ...(konsol ? [`Isi paket: 3 stik (1 cadangan), kabel lengkap${tv ? ", remot TV" : ""}. Cek saat terima.`] : tv ? ["Isi paket: TV, remot & kabel lengkap. Cek saat terima."] : []),
    "Tunjukkan nota ini saat pengembalian unit.",
  ];
  return { judul: "KETENTUAN SEWA", isi };
};

/** Susun nota sewa (bentuk PosSale) dari satu baris rincian sewa. */
export function notaSewaDariBaris(
  r: BarisSewaNota,
  o: { noNota: string; ts: number; tanggal: string; hargaDasar: number; kasir?: string; kasirNama?: string; wa?: string }
): PosSale {
  const items: PosItem[] = [];
  const item = (id: string, nama: string, harga: number): PosItem => ({ id, nama, kategori: "RENTAL", harga, qty: 1, subtotal: harga });
  const harga = hargaSewaBaris(r, o.hargaDasar);
  const ongkir = isPelunasanSewa(r) ? 0 : ongkirBaris(r);
  const info: { l: string; r: string }[] = [];

  if (isPelunasanSewa(r)) {
    items.push(item("pelunasan", `Pelunasan sewa${r.jenisPS ? ` ${r.jenisPS}` : ""}`, harga));
  } else if (isItemTambahan(r)) {
    items.push(item("tambahan", String(r.jenisPS), harga));
  } else {
    const durasi = labelDurasi(r);
    items.push(item("sewa", `Sewa ${r.jenisPS}${durasi ? ` - ${durasi}` : ""}`, harga));
    info.push({ l: "Unit", r: String(r.jenisPS) });
    if (durasi) info.push({ l: "Durasi", r: durasi });
    if (r.jamMasukSewa) info.push({ l: "Jam ambil", r: String(r.jamMasukSewa).replace(".", ":") });
    const kembali = jamKembali(r, o.tanggal);
    if (kembali) info.push({ l: "Kembali", r: kembali });
  }
  if (ongkir > 0) {
    items.push(item("ongkir", "Ongkir antar", ongkir));
    if (r.diantarOleh) info.push({ l: "Diantar", r: String(r.diantarOleh).split("@")[0] });
  }

  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const kasir = o.kasir || auth.currentUser?.email || "admin";
  return {
    noNota: o.noNota,
    ts: o.ts,
    tanggal: o.tanggal,
    kasir,
    kasirNama: o.kasirNama || kasir.split("@")[0],
    pembeli: String(r.ket || "").trim() || "Pelanggan",
    ...(o.wa ? { pembeliWa: o.wa } : {}),
    metode: bayarTransfer(r.bayar) ? "TRANSFER" : "CASH",
    items,
    subtotal: total,
    diskonPersen: 0,
    diskon: 0,
    total,
    jenisNota: "SEWA",
    infoNota: info,
    syaratNota: isPelunasanSewa(r) ? { judul: "BUKTI PELUNASAN SEWA", isi: ["Simpan nota ini sebagai bukti pelunasan."] } : KETENTUAN_SEWA(r),
    statusBayar: r.isPaid === "TIDAK" && !isPelunasanSewa(r) ? "BELUM DIBAYAR" : "LUNAS",
  };
}

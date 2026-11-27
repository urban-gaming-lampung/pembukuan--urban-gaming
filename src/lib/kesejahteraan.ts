/**
 * INDEKS KESEJAHTERAAN KARYAWAN (IKU) — tunjangan yang naik-turun mengikuti laba URBAN 6 bulan terakhir.
 *
 * - Laba bulanan = Rental + Usaha (usaha mulai 2026-11) − gaji pegawai. Ambilan owner & belanja aset tidak dihitung;
 *   barang jualan dihitung untungnya (harga jual − modal FIFO), bukan belanja stoknya.
 * - Skor 0–60  : laba rata-rata Rp0 → ambang aman (tanpa tunjangan).
 *   Skor 60–100: ambang aman → batas atas (tunjangan 0 → persenMaks × gaji pokok).
 * - Disiplin: tiap telat absen (denda otomatis yang tidak dicoret) −10%, paling rendah 50%.
 * - Rem kas : bulan terakhir rugi → tunjangan bulan ini ditahan.
 * Nominal laba & pengaturan hanya untuk owner (koleksi `pengaturan_owner`); karyawan hanya menerima skor.
 */
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { toInt } from "./format";
import { rentangHariKerja, tanggalHariKerja } from "./dateLocal";
import { bisnisOf, isBelanjaStok, pemasukanRental, pengeluaranAdminRental, type TransaksiOwner } from "./keuangan";
import { barisUsahaManual, tebakModalBaris } from "./pemasukanUsaha";
import { gabungNota, terjualDalam, type PosSale } from "./posSales";
import { hitungFifoHppPenjualan } from "./akuntansiUsaha";
import type { ModalMap, ProdukJualan, StokMasuk } from "./barangJualan";
import { normalizeBulanTahun } from "./absenPeriod";
import { runSalaryTransaction } from "./salaryPersistence";
import { GAJI_SATU_JALUR_SEJAK, SUMBER_GAJI, hitungGaji, isKategoriGajiPegawai, statusGaji, urutBulan } from "./gajiBuku";

export type KonfigIku = { ambang: number; atas: number; persenMaks: number };
export const KONFIG_IKU_DEFAULT: KonfigIku = { ambang: 10_000_000, atas: 30_000_000, persenMaks: 30 };
export const IKU_BATAS = 60;
/** Tunjangan mulai dibayarkan pada gaji bulan ini. */
export const IKU_SEJAK = "12/26";
/** Data usaha di aplikasi ini lengkap mulai bulan ini (sebelumnya memakai aplikasi lain). */
export const USAHA_IKU_SEJAK = "2026-11";
export const JUMLAH_BULAN_IKU = 6;
const POTONG_PER_TELAT = 0.1;
const DISIPLIN_MIN = 0.5;
export const ID_TUNJANGAN_IKU = "iku";
const EMAIL_OWNER = "owner@gmail.com";

// ---------- bulan ----------
export const ymDariBt = (bt: string) => { const [m, y] = normalizeBulanTahun(bt).split("/"); return `20${y}-${m}`; };
export const btDariYm = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(2, 4)}`;
export function geserYm(ym: string, delta: number) {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const labelYm = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });

// ---------- skor & tunjangan ----------
const batas01 = (v: number) => Math.max(0, Math.min(1, v));

export function skorDariLaba(laba: number, k: KonfigIku): number {
  if (!(laba > 0)) return 0;
  const s = laba < k.ambang
    ? (IKU_BATAS * laba) / k.ambang
    : IKU_BATAS + (100 - IKU_BATAS) * batas01((laba - k.ambang) / Math.max(1, k.atas - k.ambang));
  return Math.round(s * 10) / 10;
}
export const fraksiTunjangan = (skor: number) => batas01((skor - IKU_BATAS) / (100 - IKU_BATAS));

export const jumlahTelat = (r: any) =>
  (Array.isArray(r?.gajiPengurangan) ? r.gajiPengurangan : []).filter((x: any) => x?._isAutoSistem && !x.isDibatalkan && toInt(x.nominal) > 0).length;
export const faktorDisiplin = (r: any) => Math.max(DISIPLIN_MIN, 1 - POTONG_PER_TELAT * jumlahTelat(r));

export type IkuBulan = { skor: number; persenMaks: number; ditahan?: boolean; ts: number };
export type IkuRingkas = IkuBulan & { bulan: string; progres: number };

export const tunjanganMaks = (r: any) => Math.floor((toInt(r?.gajiPokok) * (Number(r?.iku?.persenMaks) || 0)) / 100 / 1000) * 1000;

/** Tunjangan satu bulan gaji dari snapshot skor di record (berubah bila gaji pokok / telat absen berubah). */
export function nominalTunjangan(r: any): number {
  const iku: IkuBulan | undefined = r?.iku;
  if (!iku || iku.ditahan) return 0;
  const v = fraksiTunjangan(iku.skor) * (iku.persenMaks / 100) * toInt(r.gajiPokok) * faktorDisiplin(r);
  return Math.floor(v / 1000) * 1000;
}
export const isTunjanganIku = (t: any) => t?.id === ID_TUNJANGAN_IKU || !!t?._iku;

/** Pasang / perbarui / lepas baris tunjangan di Gaji Tambahan (hanya bulan yang masih terbuka). */
export function terapkanTunjangan(r: any): any {
  if (!r || statusGaji(r) !== "terbuka") return r;
  const lain = (Array.isArray(r.gajiTambahan) ? r.gajiTambahan : []).filter((t: any) => !isTunjanganIku(t));
  const nominal = nominalTunjangan(r);
  if (nominal > 0) lain.push({ id: ID_TUNJANGAN_IKU, nominal, ket: `Tunjangan kesejahteraan · skor ${Math.floor(r.iku.skor)}`, status: "belum", _iku: true });
  return { ...r, gajiTambahan: lain };
}

// ---------- laba bulanan ----------
export type DataIku = {
  history: any[];
  expenses: TransaksiOwner[];
  incomes: TransaksiOwner[];
  pos: PosSale[];
  posLunas: PosSale[];
  stokMasuk: StokMasuk[];
  modalMap: ModalMap;
  produk: ProdukJualan[];
  gaji: { id: string; records?: any[] }[];
};
export type LabaBulan = { ym: string; rental: number; usaha: number; gaji: number; total: number };

/** Ambilan owner & belanja aset (unit, alat, game) — bukan biaya operasional. */
const KECUALI = /gaji diri sendiri|kebutuhan owner|self reward|prive|^(barang|alat) rental ps$|^beli ga[mn]e$/i;
export const dikecualikanIku = (o: Pick<TransaksiOwner, "kategori">) => KECUALI.test(String(o?.kategori || "").trim());

const akhirBulan = (ym: string) => `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;

export function hitungLabaBulan(ym: string, d: DataIku, hpp: ReturnType<typeof hitungFifoHppPenjualan>): LabaBulan {
  const pakaiUsaha = ym >= USAHA_IKU_SEJAK;
  const diBulan = (t: unknown) => String(t || "").slice(0, 7) === ym;
  let rental = 0, usaha = 0, gaji = 0;

  d.history.forEach((h) => {
    if (!diBulan(h?.tanggal)) return;
    rental += pemasukanRental(h);
    pengeluaranAdminRental(h).forEach((x) => (rental -= x.harga));
    if (!pakaiUsaha) return;
    barisUsahaManual(h).forEach((row) => {
      if (!row.barang) { usaha += row.harga; return; }
      const t = tebakModalBaris(row, d.produk, d.modalMap);
      if (t) usaha += row.harga - t.modal; // barang tanpa modal tercatat tidak dianggap untung
    });
  });

  d.incomes.forEach((o) => {
    const v = toInt(o.harga);
    if (!diBulan(o.tanggal) || v <= 0) return;
    if (bisnisOf(o) === "RENTAL") rental += v;
    else if (pakaiUsaha) usaha += v;
  });
  d.expenses.forEach((o) => {
    const v = toInt(o.harga);
    if (!diBulan(o.tanggal) || v <= 0 || dikecualikanIku(o) || o.sumber === SUMBER_GAJI) return;
    if (isKategoriGajiPegawai(o.kategori)) gaji += v; // gaji lama (sebelum satu jalur) dicatat manual di Transaksi
    else if (bisnisOf(o) === "RENTAL") rental -= v;
    else if (pakaiUsaha && !isBelanjaStok(o)) usaha -= v;
  });

  if (pakaiUsaha) {
    const from = rentangHariKerja(`${ym}-01`)?.from ?? 0;
    const to = rentangHariKerja(akhirBulan(ym))?.to ?? 0;
    gabungNota(d.pos, d.posLunas).filter((s) => terjualDalam(s, from, to)).forEach((s) => {
      const h = hpp.get(s.id || s.noNota);
      (s.items || []).forEach((it, idx) => {
        if (it.kategori !== "JUALAN") { usaha += toInt(it.subtotal); return; }
        const hi = h?.items.find((x) => x.itemIndex === idx);
        if (hi && hi.qtyDenganModal > 0) usaha += hi.subtotalDenganModal - hi.hpp;
      });
      usaha -= toInt(s.diskon);
    });
  }

  // Gaji dari menu Gaji (satu jalur) dihitung pada bulan gajinya, bukan tanggal dibayar.
  const bt = btDariYm(ym);
  if (urutBulan(bt) >= urutBulan(GAJI_SATU_JALUR_SEJAK)) {
    d.gaji.filter((g) => String(g.id).toLowerCase() !== EMAIL_OWNER).forEach((g) => (g.records || []).forEach((r: any) => {
      if (normalizeBulanTahun(r?.bulanTahun) !== bt) return;
      const tb = r.tutupBuku;
      gaji += tb ? toInt(tb.dicatat ?? toInt(tb.bersih) - toInt(tb.ongkir)) : hitungGaji(r).dicatat;
      (r.gajiTambahan || []).forEach((t: any) => { if (t?.status === "sudah") gaji += toInt(t.nominal); });
    }));
  }
  return { ym, rental, usaha, gaji, total: rental + usaha - gaji };
}

export type HasilIku = {
  bulan: string; // MM/YY gaji yang memakai skor ini
  skor: number;
  rataRata: number;
  perBulan: LabaBulan[];
  berjalan: LabaBulan;
  progres: number;
  ditahan: boolean;
  konfig: KonfigIku;
};

/** Skor bulan `ymTarget` = rata-rata laba 6 bulan penuh sebelumnya. */
export function hitungIku(d: DataIku, k: KonfigIku, ymTarget: string): HasilIku {
  const hpp = hitungFifoHppPenjualan(gabungNota(d.pos, d.posLunas), d.stokMasuk, d.modalMap);
  const perBulan = Array.from({ length: JUMLAH_BULAN_IKU }, (_, i) => hitungLabaBulan(geserYm(ymTarget, i - JUMLAH_BULAN_IKU), d, hpp));
  const rataRata = Math.round(perBulan.reduce((a, x) => a + x.total, 0) / JUMLAH_BULAN_IKU);
  const berjalan = hitungLabaBulan(ymTarget, d, hpp);
  // Skor bulan depan naik bila bulan berjalan melampaui bulan yang akan keluar dari hitungan.
  const keluar = perBulan[0].total;
  const progres = keluar > 0 ? Math.max(0, berjalan.total) / keluar : berjalan.total > 0 ? 1 : 0;
  return {
    bulan: btDariYm(ymTarget),
    skor: skorDariLaba(rataRata, k),
    rataRata,
    perBulan,
    berjalan,
    progres: Math.round(progres * 100) / 100,
    ditahan: perBulan[JUMLAH_BULAN_IKU - 1].total < 0,
    konfig: k,
  };
}

// ---------- Firestore (khusus owner) ----------
const refKonfig = () => doc(db, "pengaturan_owner", "iku");

/** null = tidak boleh membaca (bukan owner) → jangan menghitung. */
export async function bacaKonfigIku(): Promise<KonfigIku | null> {
  try {
    const s = await getDoc(refKonfig());
    const x = s.exists() ? (s.data() as any) : {};
    const k = { ...KONFIG_IKU_DEFAULT };
    (Object.keys(k) as (keyof KonfigIku)[]).forEach((key) => { if (Number(x[key]) > 0) k[key] = Number(x[key]); });
    return k;
  } catch (e) {
    console.warn("[iku] konfigurasi tidak bisa dibaca:", e);
    return null;
  }
}
export async function simpanKonfigIku(k: KonfigIku) {
  if (!(k.ambang > 0) || !(k.atas > k.ambang) || !(k.persenMaks > 0) || k.persenMaks > 100) throw new Error("Angka belum valid: batas atas harus lebih besar dari ambang aman.");
  await setDoc(refKonfig(), { ...k, updatedAt: Date.now() }, { merge: true });
}

async function muatDataIku(awalYm: string): Promise<DataIku> {
  const awal = `${awalYm}-01`;
  const fromTs = rentangHariKerja(awal)?.from ?? 0;
  const semua = async <T,>(q: any): Promise<T[]> => (await getDocs(q)).docs.map((x: any) => ({ id: x.id, ...(x.data() as any) }));
  const [history, expenses, incomes, pos, posLunas, stokMasuk, costs, produk, gaji] = await Promise.all([
    semua<any>(query(collection(db, "history_pembukuan"), where("tanggal", ">=", awal))),
    semua<TransaksiOwner>(query(collection(db, "owner_expenses"), where("tanggal", ">=", awal))),
    semua<TransaksiOwner>(query(collection(db, "owner_incomes"), where("tanggal", ">=", awal))),
    semua<PosSale>(query(collection(db, "pos_transaksi"), where("ts", ">=", fromTs))),
    semua<PosSale>(query(collection(db, "pos_transaksi"), where("lunasTs", ">=", Math.max(1, fromTs)))),
    semua<StokMasuk>(collection(db, "stok_masuk")),
    semua<any>(collection(db, "product_costs")),
    semua<ProdukJualan>(query(collection(db, "products"), where("category", "==", "JUALAN"))),
    semua<any>(collection(db, "gaji_pegawai")),
  ]);
  const modalMap: ModalMap = {};
  costs.forEach((x: any) => {
    modalMap[x.id] = {
      hargaModal: typeof x.hargaModal === "number" ? x.hargaModal : null,
      riwayat: Array.isArray(x.riwayat) ? x.riwayat.filter((r: any) => typeof r?.modal === "number" && typeof r?.dari === "number") : [],
    };
  });
  return {
    history,
    expenses: expenses.map((o) => ({ ...o, harga: toInt(o.harga) })),
    incomes: incomes.map((o) => ({ ...o, harga: toInt(o.harga) })),
    pos, posLunas, stokMasuk, modalMap, produk, gaji,
  };
}

let terakhir: { ts: number; hasil: HasilIku } | null = null;

/**
 * Hitung skor (owner) lalu simpan HANYA skor ke dokumen gaji tiap pegawai + pasang baris tunjangan
 * di bulan gaji berjalan. Aman dipanggil berkali-kali (dibatasi 10 menit kecuali `paksa`).
 */
let berjalanIku: Promise<HasilIku | null> | null = null;
export function sinkronIku(paksa = false): Promise<HasilIku | null> {
  if (!paksa && terakhir && Date.now() - terakhir.ts < 10 * 60000) return Promise.resolve(terakhir.hasil);
  if (berjalanIku) return paksa ? berjalanIku.then(() => sinkronIku(true)) : berjalanIku;
  berjalanIku = jalankanSinkronIku().finally(() => { berjalanIku = null; });
  return berjalanIku;
}

async function jalankanSinkronIku(): Promise<HasilIku | null> {
  const k = await bacaKonfigIku();
  if (!k) return null;
  const ymTarget = tanggalHariKerja().slice(0, 7);
  const data = await muatDataIku(geserYm(ymTarget, -JUMLAH_BULAN_IKU));
  const hasil = hitungIku(data, k, ymTarget);
  terakhir = { ts: Date.now(), hasil };

  const bt = hasil.bulan;
  const berlaku = urutBulan(bt) >= urutBulan(IKU_SEJAK);
  const now = Date.now();
  const ringkas: IkuRingkas = { bulan: bt, skor: hasil.skor, progres: hasil.progres, persenMaks: k.persenMaks, ...(hasil.ditahan ? { ditahan: true } : {}), ts: now };
  const snapBulan: IkuBulan = { skor: hasil.skor, persenMaks: k.persenMaks, ...(hasil.ditahan ? { ditahan: true } : {}), ts: now };
  const tanpaTs = (x: any) => JSON.stringify({ ...(x || {}), ts: 0 });

  for (const g of data.gaji) {
    const ref = doc(db, "gaji_pegawai", g.id);
    try {
      await runSalaryTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists()) return;
        const x = s.data() as any;
        const records = (Array.isArray(x.records) ? x.records : []).map((r: any) => ({ ...r }));
        let ubah = tanpaTs(x.iku) !== tanpaTs(ringkas);
        const i = records.findIndex((r: any) => normalizeBulanTahun(r.bulanTahun) === bt);
        if (berlaku && i >= 0 && statusGaji(records[i]) === "terbuka") {
          const baru = terapkanTunjangan({ ...records[i], iku: snapBulan });
          if (tanpaTs(records[i].iku) !== tanpaTs(snapBulan) || JSON.stringify(records[i].gajiTambahan || []) !== JSON.stringify(baru.gajiTambahan)) {
            records[i] = { ...baru, iku: tanpaTs(records[i].iku) === tanpaTs(snapBulan) ? records[i].iku : snapBulan };
            ubah = true;
          }
        }
        if (!ubah) return;
        tx.set(ref, { iku: ringkas, records, salaryRevision: (Number(x.salaryRevision) || 0) + 1, updatedAt: now }, { merge: true });
      });
    } catch (e) {
      console.warn("[iku] gagal memperbarui " + g.id, e);
    }
  }
  return hasil;
}

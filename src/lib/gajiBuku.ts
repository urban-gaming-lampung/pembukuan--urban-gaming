/**
 * GAJI PEGAWAI — satu jalur ke Analitik (SSOT).
 *
 * - Mulai bulan gaji `GAJI_SATU_JALUR_SEJAK`, uang keluar gaji pegawai HANYA berasal dari menu Gaji:
 *   · gaji tambahan berstatus "Sudah Dibayar" -> uang keluar pada tanggal ditandai dibayar
 *   · bulan gaji yang ditutup buku -> uang keluar = pokok + tambahan belum dibayar − potongan
 *     (ongkir pengantar TIDAK ikut: sudah tercatat di pengeluaran admin harian)
 *   Keduanya ditulis otomatis ke `owner_expenses` (sumber "gaji", terkunci di Transaksi), jadi
 *   Analitik, posisi dana & PDF memakai jalur yang sama dengan pengeluaran lain.
 * - Bulan gaji sebelum `GAJI_SATU_JALUR_SEJAK` = arsip (hanya baca); uang keluarnya tetap dari
 *   catatan "Gaji Pegawai" lama di Transaksi.
 * - Bulan yang ditutup buku (manual, atau otomatis `HARI_TENGGANG_TUTUP` hari sesudah siklus selesai)
 *   hanya baca; angkanya dibekukan (snapshot) sehingga perubahan pengaturan ongkir tidak mengubahnya.
 */
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { getCycleInfoFromBulanTahun, normalizeBulanTahun } from "./absenPeriod";
import { tanggalHariKerja, toLocalYmd } from "./dateLocal";

export const GAJI_SATU_JALUR_SEJAK = "11/26";
export const KATEGORI_GAJI_PEGAWAI = "Gaji Pegawai";
export const SUMBER_GAJI = "gaji";
export const HARI_TENGGANG_TUTUP = 7;

const urutBulan = (bt: string) => {
  const [m, y] = normalizeBulanTahun(String(bt || "")).split("/").map((x) => parseInt(x, 10));
  return (y || 0) * 100 + (m || 0);
};
/** Bulan gaji sebelum jalur tunggal: arsip, hanya baca, tidak dihitung dari menu Gaji. */
export const isArsipGaji = (bulanTahun: string) => urutBulan(bulanTahun) < urutBulan(GAJI_SATU_JALUR_SEJAK);
/** Kategori transaksi owner yang kini hanya boleh lahir dari menu Gaji. */
export const isKategoriGajiPegawai = (k: unknown) => String(k ?? "").trim().toLowerCase() === KATEGORI_GAJI_PEGAWAI.toLowerCase();

const n = (v: unknown) => Number(v) || 0;

export type TutupBuku = {
  tanggal: string; // YYYY-MM-DD tanggal lunas / tutup buku
  ts: number;
  oleh: string;
  otomatis?: boolean;
  pokok: number;
  tambahanBelum: number;
  potongan: number;
  ongkir: number;
  /** Total yang ditransfer ke pegawai (termasuk ongkir masuk gaji). */
  bersih: number;
  /** Uang keluar yang dicatat ke Analitik (tanpa ongkir). */
  dicatat: number;
};

/** Rincian gaji satu bulan dari data hidup (belum dibekukan). */
export function hitungGaji(r: any) {
  const tb = Array.isArray(r?.gajiTambahan) ? r.gajiTambahan : [];
  const pg = Array.isArray(r?.gajiPengurangan) ? r.gajiPengurangan : [];
  const pokok = n(r?.gajiPokok);
  const tambahanBelum = tb.filter((t: any) => t.status !== "sudah").reduce((a: number, t: any) => a + n(t.nominal), 0);
  const potongan = pg.filter((x: any) => !x.isDibatalkan).reduce((a: number, x: any) => a + n(x.nominal), 0);
  const ongkir = n(r?.ongkirMasukGajiBulanIni);
  const bersih = Math.max(0, pokok + tambahanBelum + ongkir - potongan);
  return { pokok, tambahanBelum, potongan, ongkir, bersih, dicatat: Math.max(0, bersih - ongkir) };
}

/** Gaji yang harus dibayar satu bulan. Bulan yang sudah ditutup memakai angka yang dibekukan. */
export const gajiBersih = (r: any) => (r?.tutupBuku ? n(r.tutupBuku.bersih) : hitungGaji(r).bersih);

export const buatTutupBuku = (r: any, oleh: string, otomatis = false, tanggal = tanggalHariKerja()): TutupBuku => ({
  tanggal,
  ts: Date.now(),
  oleh,
  ...(otomatis ? { otomatis: true } : {}),
  ...hitungGaji(r),
});

/** Tanggal akhir siklus gaji satu bulan (YYYY-MM-DD). */
export const akhirSiklus = (bulanTahun: string, cutoffDay: number) => toLocalYmd(getCycleInfoFromBulanTahun(normalizeBulanTahun(bulanTahun), cutoffDay).endDate);

/** Tanggal bulan gaji yang lupa ditutup akan terkunci otomatis. */
export function tanggalTutupOtomatis(bulanTahun: string, cutoffDay: number): string {
  const d = getCycleInfoFromBulanTahun(normalizeBulanTahun(bulanTahun), cutoffDay).endDate;
  const x = new Date(d);
  x.setDate(x.getDate() + HARI_TENGGANG_TUTUP);
  return toLocalYmd(x);
}

export type StatusGaji = "arsip" | "tutup" | "terbuka";
export const statusGaji = (r: any): StatusGaji => (isArsipGaji(r?.bulanTahun) ? "arsip" : r?.tutupBuku ? "tutup" : "terbuka");
/** Bulan gaji boleh diubah? (bulan berjalan / belum ditutup buku) */
export const gajiTerkunci = (r: any) => statusGaji(r) !== "terbuka";

const aman = (s: string) => String(s || "").replace(/[\/\s#?\[\]]+/g, "-");

/**
 * Tulis ulang catatan pengeluaran gaji satu pegawai di `owner_expenses` sesuai data menu Gaji.
 * Idempoten: ID dokumen tetap, catatan yang sudah tidak berlaku (status dikembalikan, buka kunci) dihapus.
 */
export async function sinkronGajiKeTransaksi(email: string, records: any[]): Promise<void> {
  const em = String(email || "").toLowerCase().trim();
  if (!em) return;
  const nama = em.split("@")[0];
  const namaCap = nama.charAt(0).toUpperCase() + nama.slice(1);
  const col = collection(db, "owner_expenses");
  const lama = await getDocs(query(col, where("gajiEmail", "==", em)));
  const lamaMap = new Map(lama.docs.map((d) => [d.id, d.data() as any]));
  const hariIni = tanggalHariKerja();
  const mau = new Map<string, any>();
  const dasar = { kategori: KATEGORI_GAJI_PEGAWAI, bisnis: "RENTAL", metode: "TRANSFER", sumber: SUMBER_GAJI, gajiEmail: em };

  (records || []).forEach((r) => {
    const bt = normalizeBulanTahun(r?.bulanTahun);
    if (!bt || isArsipGaji(bt)) return;
    (r.gajiTambahan || []).forEach((t: any) => {
      if (t?.status !== "sudah" || n(t.nominal) <= 0) return;
      const id = `gaji-tb_${aman(em)}_${aman(String(t._idempKey || t.id || ""))}`;
      mau.set(id, {
        ...dasar,
        nama: `Gaji tambahan ${namaCap} (${bt})${t.ket ? ": " + String(t.ket).trim() : ""}`,
        harga: n(t.nominal),
        tanggal: t.tglDibayar || lamaMap.get(id)?.tanggal || hariIni,
        gajiBulan: bt,
      });
    });
    if (r.tutupBuku && n(r.tutupBuku.dicatat) > 0) {
      const id = `gaji_${aman(em)}_${aman(bt)}`;
      mau.set(id, {
        ...dasar,
        nama: `Gaji ${namaCap} ${bt}`,
        harga: n(r.tutupBuku.dicatat),
        tanggal: r.tutupBuku.tanggal || hariIni,
        gajiBulan: bt,
      });
    }
  });

  const tugas: Promise<unknown>[] = [];
  lamaMap.forEach((v, id) => {
    if (v?.sumber === SUMBER_GAJI && !mau.has(id)) tugas.push(deleteDoc(doc(col, id)));
  });
  mau.forEach((v, id) => {
    const cur = lamaMap.get(id);
    const sama = cur && ["nama", "harga", "tanggal", "kategori", "bisnis", "metode"].every((k) => cur[k] === v[k]);
    if (!sama) tugas.push(setDoc(doc(col, id), { ...v, timestamp: cur?.timestamp || Date.now() }));
  });
  await Promise.all(tugas);
}

/**
 * TUKAR TAMBAH — barang milik pembeli yang masuk ke toko sebagai potongan nota POS.
 *
 * Alur:
 *  1. Kasir menambah "barang masuk" di checkout → commitPosSale menyimpan nota + dokumen
 *     `tukar_tambah/{id}` berstatus MENUNGGU (satu transaksi). Nilai barang memotong uang
 *     yang dibayar (bayarNota) dan dihitung sebagai belanja stok pada tanggal nota.
 *  2. Owner / super admin membuka Atur Stok › Konfirmasi stok: menentukan produk (cocok
 *     otomatis / produk baru), harga jual, dan harga modal (otomatis = nilai tukar, bisa diubah).
 *     Stok bertambah + catatan stok masuk (tanpa pengeluaran, karena uangnya sudah di nota).
 *  3. Nota dibatalkan / dihapus → barang yang belum dikonfirmasi ikut batal; yang sudah masuk
 *     stok ditarik lagi (lihat posSales.cancelPosSale / deletePosSale).
 */
import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { prepareStokWrites, writeStokInTx } from "./stokJualan";
import { kompresFoto, ModalMap, pratinjauOtomatis, ProdukJualan, simpanBarangJualan } from "./barangJualan";
import { kondisiProduk, namaJualan, PILIH_SAAT_CHECKOUT, produkSubKategori, StokRef, SubKategoriJualan, tokenize } from "./posSales";
import { tanggalHariKerja } from "./dateLocal";
import { rupiah } from "./format";

export type StatusTukarTambah = "MENUNGGU" | "DIKONFIRMASI" | "BATAL";

export type TukarTambah = {
  id: string;
  status: StatusTukarTambah;
  noNota: string;
  saleId: string;
  ts: number;
  tanggal: string;
  kasir: string;
  kasirNama?: string;
  pembeli?: string;
  pembeliWa?: string;
  nama: string;
  qty: number;
  /** Nilai per barang (potongan nota = nilai × qty) */
  nilai: number;
  sn: string;
  fotoSn: string;
  fotoBarang: string;
  catatan?: string;
  // Diisi saat dikonfirmasi
  produkId?: string;
  stokRef?: StokRef;
  stokMasukId?: string;
  hargaJual?: number;
  modalSatuan?: number;
  konfirmasiOleh?: string;
  konfirmasiTs?: number;
};

/** Sub-kategori barang tukar tambah: konsol Switch / Xbox juga dihitung unit (bukan aksesorisnya). */
const RE_UNIT_LAIN = /^(?:NINTENDO\s+)?SWITCH\b|^XBOX\b/i;
const RE_BUKAN_UNIT = /\b(?:CONTROLLER|STIK|JOY-?CON|CASE|KABEL|CHARGER|DOCK|GRIP|POUCH|TAS|KASET|SERVIS|PRO\s+CONTROLLER)\b/i;
export function subKategoriTukar(nama: string): SubKategoriJualan {
  const n = namaJualan(nama);
  if (RE_UNIT_LAIN.test(n) && !RE_BUKAN_UNIT.test(n)) return "Unit PS";
  return produkSubKategori(n);
}

const tokenInti = (s: string) => tokenize(s).filter((t) => t !== "SEKEN" && t !== "BARU");

export type KandidatProduk = { produk: ProdukJualan; skor: number; yakin: boolean };

/**
 * Produk jualan SEKEN yang paling mirip dengan nama barang tukar tambah (MURNI).
 * `yakin` = cukup jelas untuk dipilih otomatis (nama sama / semua kata produk ada di nama barang).
 */
export function cocokProdukSeken(nama: string, products: ProdukJualan[]): KandidatProduk[] {
  const t = new Set(tokenInti(nama));
  if (!t.size) return [];
  const out: KandidatProduk[] = [];
  products.forEach((p) => {
    if (kondisiProduk(p) !== "SEKEN") return;
    const pt = Array.from(new Set(tokenInti(p.name)));
    if (!pt.length) return;
    const sama = pt.filter((x) => t.has(x)).length;
    if (!sama) return;
    const gabung = new Set([...pt, ...t]).size;
    const skor = sama / gabung;
    const semuaKataProduk = sama === pt.length;
    const yakin = skor >= 0.999 || (semuaKataProduk && skor >= 0.6);
    if (skor >= 0.34 || semuaKataProduk) out.push({ produk: p, skor, yakin });
  });
  out.sort((a, b) => Number(b.yakin) - Number(a.yakin) || b.skor - a.skor || a.produk.name.localeCompare(b.produk.name, "id"));
  // Hanya satu yang boleh "yakin": bila dua sama kuat, biarkan owner memilih
  if (out.length > 1 && out[0].yakin && out[1].yakin && Math.abs(out[0].skor - out[1].skor) < 1e-9) out.forEach((k) => (k.yakin = false));
  return out.slice(0, 4);
}

/** Barang stok yang akan dipakai bila dibuat sebagai produk baru (SEKEN). */
export function tujuanStokBaru(nama: string, master: StokKategori[]) {
  return pratinjauOtomatis(nama, subKategoriTukar(nama), "SEKEN", master);
}

/** Unggah foto tukar tambah (kompres 1280 px). Disimpan di folder bukti transfer (boleh semua staf). */
export async function uploadFotoTukarTambah(file: File, jenis: "sn" | "barang"): Promise<string> {
  const blob = await kompresFoto(file, 1280);
  const tgl = tanggalHariKerja(Date.now());
  const r = storageRef(storage, `bukti_transfer/${tgl}/tt_${jenis}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
  await uploadBytes(r, blob, { contentType: "image/jpeg" });
  return getDownloadURL(r);
}

/** Antrean tukar tambah berdasarkan status (owner / super admin; staf boleh baca). */
export function useTukarTambah(status: StatusTukarTambah = "MENUNGGU", enabled = true): { list: TukarTambah[]; loading: boolean } {
  const [list, setList] = useState<TukarTambah[]>([]);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) { setList([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(collection(db, "tukar_tambah"), where("status", "==", status)),
      (s) => {
        setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TukarTambah, "id">) })).sort((a, b) => b.ts - a.ts));
        setLoading(false);
      },
      (e) => { console.warn("tukar_tambah:", e); setLoading(false); }
    );
  }, [status, enabled]);
  return { list, loading };
}

export type KonfirmasiInput = {
  /** Produk yang sudah ada (null = buat produk baru) */
  produk: ProdukJualan | null;
  /** Nama produk baru (dipakai bila produk null) */
  namaBaru: string;
  hargaJual: number;
  /** Harga modal per barang (otomatis = nilai tukar) */
  modalSatuan: number;
  /** Varian stok bila produk memakai "pilih saat checkout" */
  varian?: string;
};

/**
 * Konfirmasi barang tukar tambah masuk stok (owner / super admin):
 * produk dibuat / diperbarui (harga jual + harga modal), stok bertambah, catatan stok masuk dibuat
 * TANPA pengeluaran (nilainya sudah tercatat di nota), status tukar tambah → DIKONFIRMASI.
 */
export async function konfirmasiTukarTambah(
  tt: TukarTambah,
  input: KonfirmasiInput,
  semuaProduk: ProdukJualan[],
  modal: ModalMap,
  jumlahStok: (r: StokRef) => number | undefined
): Promise<{ produkId: string; stokRef: StokRef }> {
  const hargaJual = Math.round(Number(input.hargaJual) || 0);
  const modalSatuan = Math.round(Number(input.modalSatuan) || 0);
  if (!(hargaJual > 0)) throw new Error("Isi harga jual dulu.");
  if (!(modalSatuan >= 0)) throw new Error("Harga modal tidak valid.");
  const ttRef = doc(db, "tukar_tambah", tt.id);
  const cek = await getDoc(ttRef);
  if (!cek.exists() || cek.data()?.status !== "MENUNGGU") throw new Error("Barang ini sudah dikonfirmasi / dibatalkan.");

  // 1. Produk + harga jual + harga modal (+ barang stok otomatis untuk produk baru)
  const p = input.produk;
  const nama = namaJualan(p ? p.name : input.namaBaru || tt.nama);
  if (!nama) throw new Error("Nama produk wajib diisi.");
  const simpan = await simpanBarangJualan(
    {
      id: p?.id,
      nama,
      subkategori: (p?.subcategory as SubKategoriJualan) || subKategoriTukar(nama),
      kondisi: "SEKEN",
      hargaJual,
      hargaModal: modalSatuan,
      imageUrl: p?.imageUrl || tt.fotoBarang || "",
      // Produk lama tetap memakai hubungan stoknya; belum terhubung / baru → otomatis
      stokRef: p?.stokRef ? p.stokRef : undefined,
    },
    p,
    semuaProduk,
    p ? modal[p.id]?.hargaModal ?? null : null,
    jumlahStok
  );
  let target = simpan.stokRef;
  if (!target) throw new Error("Produk belum terhubung ke stok.");
  if (target.item === PILIH_SAAT_CHECKOUT) {
    if (!input.varian) throw new Error("Pilih varian stok untuk barang ini.");
    target = { kategori: target.kategori, item: input.varian };
  }

  // 2. Stok masuk + status — satu transaksi
  const oleh = auth.currentUser?.email || "owner";
  const now = Date.now();
  const stokDoc = doc(db, "data", "stok");
  const masukRef = doc(collection(db, "stok_masuk"));
  const saleRef = doc(db, "pos_transaksi", tt.saleId);
  const qty = Math.max(1, Math.round(Number(tt.qty) || 1));
  await runTransaction(db, async (tx) => {
    const [t, s, sale] = await Promise.all([tx.get(ttRef), tx.get(stokDoc), tx.get(saleRef)]);
    if (!t.exists() || t.data()?.status !== "MENUNGGU") throw new Error("Barang ini sudah dikonfirmasi / dibatalkan.");
    if (!sale.exists() || sale.data()?.batal) throw new Error(`Nota ${tt.noNota} sudah dibatalkan / dihapus.`);
    const jualan = (s.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const w = prepareStokWrites(
      jualan,
      [{ ...target!, delta: qty }],
      "masuk",
      `Tukar tambah · ${tt.noNota} · ${nama}${modalSatuan > 0 ? ` · modal ${rupiah(modalSatuan)}/pcs` : ""}`,
      oleh,
      now
    );
    writeStokInTx(tx, w, { produkId: simpan.id, stokMasukId: masukRef.id, noNota: tt.noNota });
    tx.set(masukRef, {
      produkId: simpan.id, produkNama: nama, kategori: target!.kategori, item: target!.item,
      qty, modalSatuan, tanggal: tt.tanggal, catatPengeluaran: false, expenseId: null, ts: now, oleh,
      sumber: "TUKAR_TAMBAH", noNota: tt.noNota, tukarTambahId: tt.id,
    });
    tx.update(ttRef, {
      status: "DIKONFIRMASI", produkId: simpan.id, stokRef: target, stokMasukId: masukRef.id,
      hargaJual, modalSatuan, konfirmasiOleh: oleh, konfirmasiTs: now,
    });
  });
  return { produkId: simpan.id, stokRef: target };
}

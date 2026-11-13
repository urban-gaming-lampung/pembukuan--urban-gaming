/**
 * BARANG JUALAN — satu pintu (Owner › Input › Atur Stok).
 *
 * Produk jualan (nama, foto, sub-kategori, harga jual) ada di `products`, jumlahnya dihitung
 * di stok jualan (`data/stok` + master), dan harga modal disimpan TERPISAH di
 * `product_costs/{productId}` (hanya owner / super admin) karena `products` dibaca publik.
 * Riwayat harga modal disimpan supaya laba bulan lalu tetap akurat walau modal berubah.
 */
import { useEffect, useState } from "react";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import type { StokKategori } from "../hooks/useStokData";
import { applyMasterChanges, commitStokChanges, prepareStokWrites, renameJualanItem, writeStokInTx, kunciStok } from "./stokJualan";
import type { StokItemValue } from "../hooks/useStokData";
import { rupiah } from "./format";
import {
  hapusStokOtomatisBilaYatim, Kondisi, namaJualan, PILIH_SAAT_CHECKOUT, planStokSync, ProdukSync, StokRef, stokBaruUntukProduk, SubKategoriJualan,
} from "./posSales";

export const KATEGORI_PENGELUARAN_STOK = "Stok Jualan";

export type ProdukJualan = ProdukSync & { price: number; imageUrl?: string; subcategory?: SubKategoriJualan | null };
export type ModalInfo = { hargaModal: number | null; riwayat: { dari: number; modal: number }[] };
export type ModalMap = Record<string, ModalInfo>;

const sameRef = (a?: StokRef | null, b?: StokRef | null) => (a ? kunciStok(a) : "") === (b ? kunciStok(b) : "");

/** Semua produk JUALAN (realtime) — dipakai Input Stok, menu Stok, & analitik. */
export function useProdukJualan(): { products: ProdukJualan[]; loaded: boolean } {
  const [products, setProducts] = useState<ProdukJualan[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "products"),
        (s) => {
          setProducts(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => p.category === "JUALAN"));
          setLoaded(true);
        },
        (e) => { console.warn("products:", e); setLoaded(true); }
      ),
    []
  );
  return { products, loaded };
}

/** Harga modal semua produk (owner / super admin). */
export function useModalProduk(enabled = true): { map: ModalMap; loaded: boolean } {
  const [map, setMap] = useState<ModalMap>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, "product_costs"),
      (s) => {
        const m: ModalMap = {};
        s.docs.forEach((d) => {
          const x = d.data() as any;
          m[d.id] = {
            hargaModal: typeof x.hargaModal === "number" ? x.hargaModal : null,
            riwayat: Array.isArray(x.riwayat) ? x.riwayat.filter((r: any) => typeof r?.modal === "number" && typeof r?.dari === "number") : [],
          };
        });
        setMap(m);
        setLoaded(true);
      },
      (e) => { console.warn("product_costs:", e); setLoaded(true); }
    );
  }, [enabled]);
  return { map, loaded };
}

/** Harga modal yang berlaku saat transaksi `ts` (perkiraan = memakai harga modal sesudahnya). */
export function modalPada(info: ModalInfo | undefined, ts: number): { modal: number; perkiraan: boolean } | null {
  const r = [...(info?.riwayat || [])].sort((a, b) => a.dari - b.dari);
  if (!r.length) return typeof info?.hargaModal === "number" ? { modal: info.hargaModal, perkiraan: true } : null;
  let pick: { dari: number; modal: number } | null = null;
  for (const x of r) if (x.dari <= ts) pick = x;
  return pick ? { modal: pick.modal, perkiraan: false } : { modal: r[0].modal, perkiraan: true };
}

/** Kompres foto (sisi terpanjang maks `maksPx`, JPEG) — dipakai foto produk & tukar tambah. */
export async function kompresFoto(file: File, maksPx = 1000): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Foto tidak bisa dibaca."));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Foto tidak bisa dibuka."));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maksPx / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Kompres foto gagal."))), "image/jpeg", 0.82));
}

/** Kompres foto (maks 1000 px, JPEG) lalu unggah ke folder products/. */
export async function uploadFotoProduk(file: File): Promise<string> {
  const blob = await kompresFoto(file, 1000);
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40) || "foto";
  const r = storageRef(storage, `products/${Date.now()}_${safe}.jpg`);
  await uploadBytes(r, blob, { contentType: "image/jpeg" });
  return getDownloadURL(r);
}

/** Pratinjau: barang stok mana yang akan dipakai bila "Otomatis". */
export function pratinjauOtomatis(nama: string, sub: SubKategoriJualan, kondisi: Kondisi, master: StokKategori[]): { ref: StokRef; baru: boolean } | null {
  if (!nama.trim()) return null;
  const plan = planStokSync([{ id: "_", name: namaJualan(nama), category: "JUALAN", subcategory: sub, kondisi, stokRef: undefined }], master);
  return plan.links[0] ? { ref: plan.links[0].ref, baru: plan.links[0].baru } : null;
}

export type BarangJualanInput = {
  id?: string;
  nama: string;
  subkategori: SubKategoriJualan;
  kondisi: Kondisi;
  hargaJual: number;
  hargaModal: number | null;
  imageUrl: string;
  /** undefined = Otomatis, null = tidak dihubungkan */
  stokRef: StokRef | null | undefined;
};
export type StokMasukInput = { qty: number; modalSatuan: number; tanggal: string; catatPengeluaran: boolean; varian?: string };

/**
 * Simpan barang jualan + hubungan stok + harga modal + (opsional) stok masuk & pengeluaran.
 * `sebelum` = data produk sebelum diedit (null untuk barang baru).
 */
export async function simpanBarangJualan(
  input: BarangJualanInput,
  sebelum: ProdukJualan | null,
  semuaProduk: ProdukJualan[],
  modalSebelum: number | null,
  jumlahStok: (r: StokRef) => number | undefined,
  masuk?: StokMasukInput
): Promise<{ id: string; stokRef: StokRef | null; dibuat: boolean }> {
  const nama = namaJualan(input.nama);
  if (!nama) throw new Error("Nama barang wajib diisi.");
  // Rp 0 = barang bonus / paket (mis. stik bonus pembelian PS): gratis di nota, stok tetap berkurang
  if (!Number.isFinite(input.hargaJual) || input.hargaJual < 0) throw new Error("Harga jual tidak valid.");
  const lain = semuaProduk.filter((p) => p.id !== input.id);

  // 1. Tentukan barang stok
  let ref: StokRef | null = input.stokRef === undefined ? null : input.stokRef;
  let auto = false;
  let dibuat = false;
  let bersihkan: StokRef | null = null;
  if (input.stokRef === undefined) {
    const snap = await getDoc(doc(db, "data", "master_stok_categories"));
    const master = snap.data()?.jualan;
    if (!Array.isArray(master)) throw new Error("Master stok belum terbaca, coba lagi.");
    const plan = planStokSync([{ id: "_", name: nama, category: "JUALAN", subcategory: input.subkategori, kondisi: input.kondisi, stokRef: undefined }], master as StokKategori[]);
    const l = plan.links[0];
    ref = l.ref;
    dibuat = l.baru;
    auto = l.baru || (!!sebelum?.stokAuto && sameRef(sebelum.stokRef, l.ref));
    if (l.baru) await applyMasterChanges(plan.add);
    if (sebelum?.stokAuto && sebelum.stokRef && !sameRef(sebelum.stokRef, ref)) bersihkan = sebelum.stokRef;
  } else if (sebelum) {
    const tetap = sameRef(ref, sebelum.stokRef ?? null);
    if (tetap) {
      auto = !!sebelum.stokAuto;
      // Barang stok yang dibuat khusus untuk produk ini ikut ganti nama
      const dipakaiLain = !!ref && lain.some((p) => sameRef(p.stokRef, ref));
      if (ref && auto && !dipakaiLain && nama !== sebelum.name && ref.item !== PILIH_SAAT_CHECKOUT) {
        const target = stokBaruUntukProduk({ name: nama, subcategory: input.subkategori, kondisi: input.kondisi }).item;
        try {
          const renamed = await renameJualanItem(ref.kategori, ref.item, target);
          if (renamed) ref = { kategori: ref.kategori, item: renamed };
        } catch (e) {
          console.warn("Ganti nama barang stok gagal:", e);
        }
      }
    } else if (sebelum.stokAuto && sebelum.stokRef) {
      bersihkan = sebelum.stokRef;
    }
  }

  // 2. Produk (publik: tanpa harga modal)
  const data: Record<string, unknown> = {
    name: nama,
    price: Math.round(input.hargaJual),
    category: "JUALAN",
    subcategory: input.subkategori,
    kondisi: input.kondisi,
    imageUrl: input.imageUrl || "",
    stokRef: ref,
    stokAuto: auto,
  };
  let id = input.id;
  if (id) await setDoc(doc(db, "products", id), data, { merge: true });
  else id = (await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() })).id;

  // 3. Harga modal (privat) + riwayat
  if (input.hargaModal !== modalSebelum) {
    const now = Date.now();
    await setDoc(
      doc(db, "product_costs", id),
      typeof input.hargaModal === "number"
        ? { hargaModal: Math.round(input.hargaModal), updatedAt: now, riwayat: arrayUnion({ dari: now, modal: Math.round(input.hargaModal) }) }
        : { hargaModal: null, updatedAt: now },
      { merge: true }
    );
  }

  // 4. Stok masuk (+ pengeluaran)
  if (masuk && masuk.qty > 0) {
    if (!ref) throw new Error("Hubungkan barang ke stok dulu untuk menambah stok.");
    const target = ref.item === PILIH_SAAT_CHECKOUT ? (masuk.varian ? { kategori: ref.kategori, item: masuk.varian } : null) : ref;
    if (!target) throw new Error("Pilih varian untuk stok masuk.");
    await tambahStokMasuk({ id: id!, nama }, target, {
      qty: Math.round(masuk.qty),
      modalSatuan: Math.round(masuk.modalSatuan || 0),
      tanggal: masuk.tanggal,
      catatPengeluaran: masuk.catatPengeluaran,
    });
  }

  // 5. Barang stok otomatis lama yang ditinggalkan
  if (bersihkan) {
    await hapusStokOtomatisBilaYatim(bersihkan, lain.map((p) => (p.id === id ? { ...p, stokRef: ref } : p)), jumlahStok(bersihkan)).catch(() => false);
  }
  return { id, stokRef: ref, dibuat };
}

/** Awalan catatan riwayat untuk stok masuk dari Input Stok. */
export const catatanStokMasuk = (nama: string) => `Input Stok · ${nama}`;

// ============================================================
// Catatan STOK MASUK (bisa dilihat & diedit; stok & pengeluaran ikut menyesuaikan)
// ============================================================

/** Satu kali barang datang / dibeli. Jumlah stok & pengeluaran diturunkan dari catatan ini. */
export type StokMasuk = {
  id: string;
  produkId: string;
  produkNama: string;
  kategori: string;
  item: string;
  qty: number;
  modalSatuan: number;
  tanggal: string; // YYYY-MM-DD (tanggal beli)
  catatPengeluaran: boolean;
  expenseId: string | null;
  ts: number;
  oleh: string;
  updatedAt?: number;
  /** Barang dari tukar tambah: nilainya sudah tercatat di nota POS (bukan pengeluaran). */
  sumber?: "TUKAR_TAMBAH";
  noNota?: string;
  tukarTambahId?: string;
};
/** Catatan stok masuk dari tukar tambah — dikelola lewat notanya, bukan diedit manual. */
export const dariTukarTambah = (r: Pick<StokMasuk, "sumber">) => r.sumber === "TUKAR_TAMBAH";
export type StokMasukData = { qty: number; modalSatuan: number; tanggal: string; catatPengeluaran: boolean };

const tglLabel = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ymd;
};
const namaPengeluaran = (nama: string, item: string, qty: number) => `Stok jualan: ${nama}${item !== nama ? ` (${item})` : ""} × ${qty}`;

/** Urutan riwayat stok masuk: tanggal beli terbaru dulu. */
const urutTerbaru = (l: StokMasuk[]) => [...l].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.ts - a.ts);

/**
 * Riwayat stok masuk sebuah BARANG STOK (owner / super admin). Catatan menempel pada barang
 * stoknya, jadi catatan dari produk lain yang memakai stok yang sama — termasuk produk yang
 * sudah dihapus — tetap terlihat & bisa diubah. `stok.item` "*" = semua varian kategori itu.
 * Tanpa barang stok: catatan milik produk ini saja.
 */
export function useStokMasuk(produkId: string | undefined, stok: StokRef | null | undefined): { list: StokMasuk[]; loading: boolean } {
  const [list, setList] = useState<StokMasuk[]>([]);
  const [loading, setLoading] = useState(!!(produkId || stok));
  const kat = stok?.kategori || "";
  const item = stok?.item || "";
  useEffect(() => {
    if (!kat && !produkId) { setList([]); setLoading(false); return; }
    setLoading(true);
    const q = kat ? query(collection(db, "stok_masuk"), where("kategori", "==", kat)) : query(collection(db, "stok_masuk"), where("produkId", "==", produkId));
    return onSnapshot(
      q,
      (s) => {
        const l = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StokMasuk, "id">) }));
        setList(urutTerbaru(kat && item !== PILIH_SAAT_CHECKOUT ? l.filter((r) => r.item === item) : l));
        setLoading(false);
      },
      (e) => { console.warn("stok_masuk:", e); setLoading(false); }
    );
  }, [produkId, kat, item]);
  return { list, loading };
}

/** Satu catatan stok masuk (mis. dibuka dari histori pengeluaran). null bila sudah tidak ada. */
export async function ambilStokMasuk(id: string): Promise<StokMasuk | null> {
  const d = await getDoc(doc(db, "stok_masuk", id));
  return d.exists() ? ({ id: d.id, ...(d.data() as Omit<StokMasuk, "id">) }) : null;
}

/**
 * Rencana "stok berkurang karena salah input stok masuk" (MURNI): kurangi catatan stok masuk
 * TERBARU lebih dulu sebanyak `kurang`. `sisa` 0 = catatan dihapus. `rupiah` = pengeluaran yang
 * ikut berkurang. Bila catatan tidak cukup, sisanya (`tanpaCatatan`) hanya mengurangi stok.
 */
export function rencanaKurangiStokMasuk(list: StokMasuk[], kurang: number) {
  let butuh = Math.max(0, Math.round(kurang));
  const langkah: { rec: StokMasuk; ambil: number; sisa: number }[] = [];
  let rupiahTurun = 0;
  for (const rec of urutTerbaru(list)) {
    if (butuh <= 0) break;
    const ambil = Math.min(rec.qty, butuh);
    if (ambil <= 0) continue;
    langkah.push({ rec, ambil, sisa: rec.qty - ambil });
    if (rec.catatPengeluaran && rec.expenseId) rupiahTurun += ambil * (rec.modalSatuan || 0);
    butuh -= ambil;
  }
  return { langkah, rupiah: Math.round(rupiahTurun), tanpaCatatan: butuh };
}

/** Catat barang masuk: stok bertambah, riwayat stok, catatan stok masuk & (opsional) pengeluaran — satu transaksi. */
export async function tambahStokMasuk(p: { id: string; nama: string }, target: StokRef, d: StokMasukData): Promise<string> {
  if (!(d.qty > 0)) throw new Error("Jumlah stok masuk harus lebih dari 0.");
  const oleh = auth.currentUser?.email || "owner";
  const now = Date.now();
  const stokDoc = doc(db, "data", "stok");
  const masukRef = doc(collection(db, "stok_masuk"));
  const pakaiPengeluaran = d.catatPengeluaran && d.modalSatuan > 0;
  const expRef = pakaiPengeluaran ? doc(collection(db, "owner_expenses")) : null;
  await runTransaction(db, async (tx) => {
    const s = await tx.get(stokDoc);
    const jualan = (s.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const w = prepareStokWrites(jualan, [{ ...target, delta: d.qty }], "masuk", `${catatanStokMasuk(p.nama)}${d.modalSatuan > 0 ? ` · modal ${rupiah(d.modalSatuan)}/pcs` : ""}`, oleh, now);
    writeStokInTx(tx, w, { produkId: p.id, stokMasukId: masukRef.id });
    if (expRef) {
      tx.set(expRef, {
        nama: namaPengeluaran(p.nama, target.item, d.qty),
        harga: Math.round(d.modalSatuan * d.qty),
        kategori: KATEGORI_PENGELUARAN_STOK,
        bisnis: "USAHA", // belanja stok jualan = pengeluaran model usaha (toko)
        tanggal: d.tanggal,
        timestamp: now,
        sumber: "input_stok",
        produkId: p.id,
        stokMasukId: masukRef.id,
        stok: target,
        qty: d.qty,
        modalSatuan: d.modalSatuan,
      });
    }
    tx.set(masukRef, {
      produkId: p.id, produkNama: p.nama, kategori: target.kategori, item: target.item,
      qty: d.qty, modalSatuan: d.modalSatuan, tanggal: d.tanggal, catatPengeluaran: !!expRef,
      expenseId: expRef ? expRef.id : null, ts: now, oleh,
    });
  });
  return masukRef.id;
}

/**
 * Ubah catatan stok masuk: pengeluaran ikut diperbarui. Selisih jumlah disesuaikan ke stok,
 * kecuali `ikutStok` false (jumlah stok sudah dikoreksi sendiri).
 */
export async function ubahStokMasuk(rec: StokMasuk, d: StokMasukData, produkNama: string, ikutStok = true): Promise<{ selisih: number }> {
  if (!(d.qty > 0)) throw new Error("Jumlah harus lebih dari 0. Untuk membatalkan, pakai Hapus.");
  const oleh = auth.currentUser?.email || "owner";
  const now = Date.now();
  const stokDoc = doc(db, "data", "stok");
  const recRef = doc(db, "stok_masuk", rec.id);
  const selisih = Math.round(d.qty) - rec.qty;
  await runTransaction(db, async (tx) => {
    const [s, r, e] = await Promise.all([
      tx.get(stokDoc),
      tx.get(recRef),
      rec.expenseId ? tx.get(doc(db, "owner_expenses", rec.expenseId)) : Promise.resolve(null),
    ]);
    if (!r.exists()) throw new Error("Catatan stok masuk sudah tidak ada.");
    if (selisih !== 0 && ikutStok) {
      const jualan = (s.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
      const w = prepareStokWrites(jualan, [{ kategori: rec.kategori, item: rec.item, delta: selisih }], "koreksi", `Edit stok masuk ${tglLabel(rec.tanggal)}: ${rec.qty} → ${d.qty}`, oleh, now);
      writeStokInTx(tx, w, { produkId: rec.produkId, stokMasukId: rec.id });
    }
    const mau = d.catatPengeluaran && d.modalSatuan > 0;
    let expenseId: string | null = e && e.exists() ? rec.expenseId : null;
    const dataExp = {
      nama: namaPengeluaran(produkNama, rec.item, d.qty),
      harga: Math.round(d.modalSatuan * d.qty),
      tanggal: d.tanggal,
      qty: d.qty,
      modalSatuan: d.modalSatuan,
    };
    if (mau && expenseId) tx.update(doc(db, "owner_expenses", expenseId), dataExp);
    else if (mau) {
      const ref = doc(collection(db, "owner_expenses"));
      tx.set(ref, { ...dataExp, kategori: KATEGORI_PENGELUARAN_STOK, bisnis: "USAHA", timestamp: now, sumber: "input_stok", produkId: rec.produkId, stokMasukId: rec.id, stok: { kategori: rec.kategori, item: rec.item } });
      expenseId = ref.id;
    } else if (expenseId) {
      tx.delete(doc(db, "owner_expenses", expenseId));
      expenseId = null;
    }
    tx.update(recRef, { qty: d.qty, modalSatuan: d.modalSatuan, tanggal: d.tanggal, catatPengeluaran: mau, expenseId, produkNama, updatedAt: now });
  });
  return { selisih: ikutStok ? selisih : 0 };
}

/**
 * Hapus catatan stok masuk (salah input): pengeluarannya dihapus, stok dikurangi lagi —
 * kecuali `ikutStok` false (jumlah stok sudah dikoreksi sendiri).
 */
export async function hapusStokMasuk(rec: StokMasuk, ikutStok = true): Promise<void> {
  const oleh = auth.currentUser?.email || "owner";
  const now = Date.now();
  const stokDoc = doc(db, "data", "stok");
  const recRef = doc(db, "stok_masuk", rec.id);
  await runTransaction(db, async (tx) => {
    const [s, r, e] = await Promise.all([
      tx.get(stokDoc),
      tx.get(recRef),
      rec.expenseId ? tx.get(doc(db, "owner_expenses", rec.expenseId)) : Promise.resolve(null),
    ]);
    if (!r.exists()) throw new Error("Catatan stok masuk sudah tidak ada.");
    if (ikutStok) {
      const jualan = (s.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
      const w = prepareStokWrites(jualan, [{ kategori: rec.kategori, item: rec.item, delta: -rec.qty }], "koreksi", `Hapus stok masuk ${tglLabel(rec.tanggal)} (+${rec.qty})`, oleh, now);
      writeStokInTx(tx, w, { produkId: rec.produkId, stokMasukId: rec.id });
    }
    if (e && e.exists()) tx.delete(e.ref);
    tx.delete(recRef);
  });
}

/**
 * Stok berkurang karena SALAH INPUT stok masuk (mis. barang yang sama tercatat dua kali):
 * stok dikurangi `kurang`, catatan stok masuk terbaru barang itu & pengeluarannya ikut
 * dikurangi / dihapus — satu transaksi, jadi stok & pengeluaran tetap sinkron.
 */
export async function kurangiStokMasukSalahInput(ref: StokRef, kurang: number, nama: string): Promise<{ rupiah: number }> {
  if (ref.item === PILIH_SAAT_CHECKOUT) throw new Error("Pilih varian stok dulu.");
  const n = Math.round(kurang);
  if (!(n > 0)) throw new Error("Jumlah yang dikurangi harus lebih dari 0.");
  const snap = await getDocs(query(collection(db, "stok_masuk"), where("kategori", "==", ref.kategori)));
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StokMasuk, "id">) })).filter((r) => r.item === ref.item && !dariTukarTambah(r)); // barang tukar tambah dikelola lewat notanya
  const rencana = rencanaKurangiStokMasuk(list, n);
  const oleh = auth.currentUser?.email || "owner";
  const now = Date.now();
  const stokDoc = doc(db, "data", "stok");
  await runTransaction(db, async (tx) => {
    const s = await tx.get(stokDoc);
    const cek = await Promise.all(
      rencana.langkah.map(async (l) => ({
        l,
        r: await tx.get(doc(db, "stok_masuk", l.rec.id)),
        e: l.rec.expenseId ? await tx.get(doc(db, "owner_expenses", l.rec.expenseId)) : null,
      }))
    );
    cek.forEach(({ l, r }) => {
      if (!r.exists() || Number(r.data()?.qty) !== l.rec.qty) throw new Error("Catatan stok masuk baru saja berubah. Coba lagi.");
    });
    const jualan = (s.data()?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
    const w = prepareStokWrites(jualan, [{ kategori: ref.kategori, item: ref.item, delta: -n }], "koreksi", `Salah input stok masuk · ${nama}`, oleh, now);
    writeStokInTx(tx, w);
    cek.forEach(({ l, r, e }) => {
      if (l.sisa <= 0) {
        if (e && e.exists()) tx.delete(e.ref);
        tx.delete(r.ref);
        return;
      }
      tx.update(r.ref, { qty: l.sisa, updatedAt: now });
      if (e && e.exists()) tx.update(e.ref, { qty: l.sisa, harga: Math.round(l.sisa * (l.rec.modalSatuan || 0)), nama: namaPengeluaran(l.rec.produkNama, l.rec.item, l.sisa) });
    });
  });
  return { rupiah: rencana.rupiah };
}

/** Samakan jumlah stok dengan hitungan fisik (koreksi). */
export async function koreksiJumlahStok(ref: StokRef, jumlah: number, nama: string): Promise<void> {
  if (ref.item === PILIH_SAAT_CHECKOUT) throw new Error("Atur jumlah per varian di menu Stok.");
  await commitStokChanges([{ kategori: ref.kategori, item: ref.item, setTo: Math.max(0, Math.round(jumlah)), touch: true }], "koreksi", `Koreksi lewat Input Stok · ${nama}`);
}

/** Hapus barang jualan (riwayat modal tetap disimpan untuk laporan laba). */
export async function hapusBarangJualan(p: ProdukJualan, semuaProduk: ProdukJualan[], jumlahStok: (r: StokRef) => number | undefined) {
  await deleteDoc(doc(db, "products", p.id));
  if (p.stokAuto && p.stokRef) {
    await hapusStokOtomatisBilaYatim(p.stokRef, semuaProduk.filter((x) => x.id !== p.id), jumlahStok(p.stokRef)).catch(() => false);
  }
}

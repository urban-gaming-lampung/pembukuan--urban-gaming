/**
 * BARANG JUALAN — satu pintu (Owner › Input › Stok Jualan).
 *
 * Produk jualan (nama, foto, sub-kategori, harga jual) ada di `products`, jumlahnya dihitung
 * di stok jualan (`data/stok` + master), dan harga modal disimpan TERPISAH di
 * `product_costs/{productId}` (hanya owner / super admin) karena `products` dibaca publik.
 * Riwayat harga modal disimpan supaya laba bulan lalu tetap akurat walau modal berubah.
 */
import { useEffect, useState } from "react";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import type { StokKategori } from "../hooks/useStokData";
import { applyMasterChanges, commitStokChanges, renameJualanItem } from "./stokJualan";
import {
  hapusStokOtomatisBilaYatim, PILIH_SAAT_CHECKOUT, planStokSync, ProdukSync, StokRef, stokBaruUntukProduk, SubKategoriJualan,
} from "./posSales";

export const KATEGORI_PENGELUARAN_STOK = "Stok Jualan";

export type ProdukJualan = ProdukSync & { price: number; imageUrl?: string; subcategory?: SubKategoriJualan | null };
export type ModalInfo = { hargaModal: number | null; riwayat: { dari: number; modal: number }[] };
export type ModalMap = Record<string, ModalInfo>;

const sameRef = (a?: StokRef | null, b?: StokRef | null) => (a ? `${a.kategori}||${a.item}` : "") === (b ? `${b.kategori}||${b.item}` : "");
const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

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

/** Kompres foto (maks 1000 px, JPEG) lalu unggah ke folder products/. */
export async function uploadFotoProduk(file: File): Promise<string> {
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
  const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Kompres foto gagal."))), "image/jpeg", 0.82));
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40) || "foto";
  const r = storageRef(storage, `products/${Date.now()}_${safe}.jpg`);
  await uploadBytes(r, blob, { contentType: "image/jpeg" });
  return getDownloadURL(r);
}

/** Pratinjau: barang stok mana yang akan dipakai bila "Otomatis". */
export function pratinjauOtomatis(nama: string, sub: SubKategoriJualan, master: StokKategori[]): { ref: StokRef; baru: boolean } | null {
  if (!nama.trim()) return null;
  const plan = planStokSync([{ id: "_", name: nama.trim(), category: "JUALAN", subcategory: sub, stokRef: undefined }], master);
  return plan.links[0] ? { ref: plan.links[0].ref, baru: plan.links[0].baru } : null;
}

export type BarangJualanInput = {
  id?: string;
  nama: string;
  subkategori: SubKategoriJualan;
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
  const nama = input.nama.replace(/\s+/g, " ").trim();
  if (!nama) throw new Error("Nama barang wajib diisi.");
  if (!(input.hargaJual > 0)) throw new Error("Harga jual wajib diisi.");
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
    const plan = planStokSync([{ id: "_", name: nama, category: "JUALAN", subcategory: input.subkategori, stokRef: undefined }], master as StokKategori[]);
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
        const target = stokBaruUntukProduk({ name: nama, subcategory: input.subkategori }).item;
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
    const qty = Math.round(masuk.qty);
    await commitStokChanges([{ kategori: target.kategori, item: target.item, delta: qty }], "masuk", `Input Stok · ${nama}${masuk.modalSatuan > 0 ? ` · modal ${rp(masuk.modalSatuan)}/pcs` : ""}`);
    if (masuk.catatPengeluaran && masuk.modalSatuan > 0) {
      await addDoc(collection(db, "owner_expenses"), {
        nama: `Stok jualan: ${nama}${target.item !== nama ? ` (${target.item})` : ""} × ${qty}`,
        harga: Math.round(masuk.modalSatuan * qty),
        kategori: KATEGORI_PENGELUARAN_STOK,
        tanggal: masuk.tanggal,
        timestamp: Date.now(),
        sumber: "input_stok",
        produkId: id,
        stok: target,
        qty,
        modalSatuan: Math.round(masuk.modalSatuan),
      });
    }
  }

  // 5. Barang stok otomatis lama yang ditinggalkan
  if (bersihkan) {
    await hapusStokOtomatisBilaYatim(bersihkan, lain.map((p) => (p.id === id ? { ...p, stokRef: ref } : p)), jumlahStok(bersihkan)).catch(() => false);
  }
  return { id, stokRef: ref, dibuat };
}

/** Hapus barang jualan (riwayat modal tetap disimpan untuk laporan laba). */
export async function hapusBarangJualan(p: ProdukJualan, semuaProduk: ProdukJualan[], jumlahStok: (r: StokRef) => number | undefined) {
  await deleteDoc(doc(db, "products", p.id));
  if (p.stokAuto && p.stokRef) {
    await hapusStokOtomatisBilaYatim(p.stokRef, semuaProduk.filter((x) => x.id !== p.id), jumlahStok(p.stokRef)).catch(() => false);
  }
}

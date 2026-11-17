/**
 * AKUNTANSI USAHA — fungsi murni (pure functions, bebas Firebase) sebagai SSOT:
 * 1. Arus kas nyata vs potongan tukar tambah di nota POS.
 * 2. Penilaian HPP FIFO berbasis batch `stok_masuk` (jatuh ke `product_costs` bila tidak ada batch).
 * 3. Penilaian modal stok aktif berbasis batch terbaru (sisa stok = pembelian terbaru).
 * 4. Perhitungan "Modal Sisa Tertahan" (Opsi A) & alokasi penyesuaian laba tukar tambah.
 */
import { tanggalHariKerja } from "./dateLocal";
import type { ModalInfo, ModalMap, ProdukJualan, StokMasuk } from "./barangJualan";
import type { PosItem, PosSale } from "./posSales";
import type { TukarTambah } from "./tukarTambah";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";

const STOK_VARIAN_SEMUA = "*";
const kunci = (kategori: string, item: string) => `${kategori}||${item}`;

export const nilaiTukarPos = (s: Pick<PosSale, "nilaiTukar">) => Math.max(0, Math.round(Number(s.nilaiTukar) || 0));
export const adaTukarPos = (s: Pick<PosSale, "nilaiTukar" | "tukarTambah">) => nilaiTukarPos(s) > 0 || !!s.tukarTambah?.length;
/** Uang bersih dari nota: positif = diterima URBAN, negatif = dibayar URBAN ke pembeli. */
export const bayarNotaPos = (s: Pick<PosSale, "total" | "nilaiTukar">) => (Number(s.total) || 0) - nilaiTukarPos(s);

/** Pecahan arus kas nyata satu nota lunas: kas masuk, kas keluar (bila URBAN nombok), dan split Tunai / Transfer. */
export function arusKasNota(s: Pick<PosSale, "total" | "nilaiTukar" | "metode" | "pembayaran" | "tukarTambah">) {
  const bayar = bayarNotaPos(s);
  const kasMasuk = Math.max(0, bayar);
  const kasKeluar = Math.max(0, -bayar);
  const tukar = adaTukarPos(s);
  let cash = 0;
  let transfer = 0;
  let cashN = 0;
  let transferN = 0;

  if (s.pembayaran?.length) {
    s.pembayaran.forEach((p) => {
      const j = Number(p.jumlah) || 0;
      if (p.metode === "TRANSFER") transfer += j;
      else cash += j;
    });
    // Pengaman bila ada nota lama dengan nilaiTukar + pembayaran
    const sum = cash + transfer;
    if (sum > kasMasuk && sum > 0) {
      const scale = kasMasuk / sum;
      cash = Math.round(cash * scale);
      transfer = kasMasuk - cash;
    }
    if (kasMasuk > 0) {
      if (s.pembayaran[s.pembayaran.length - 1].metode === "TRANSFER") transferN = 1;
      else cashN = 1;
    }
  } else if (bayar > 0) {
    if (s.metode === "TRANSFER") {
      transfer = kasMasuk;
      transferN = 1;
    } else {
      cash = kasMasuk;
      cashN = 1;
    }
  }

  return {
    bayar,
    kasMasuk,
    kasKeluar,
    cash,
    transfer,
    cashN,
    transferN,
    tukar,
    nilaiTukar: nilaiTukarPos(s),
  };
}

/** Versi murni dari `modalPada` agar modul akuntansi tetap bebas ketergantungan Firebase. */
export function modalDariInfo(info: ModalInfo | undefined, ts: number): { modal: number; perkiraan: boolean } | null {
  const r = [...(info?.riwayat || [])].sort((a, b) => a.dari - b.dari);
  if (!r.length) return typeof info?.hargaModal === "number" ? { modal: info.hargaModal, perkiraan: true } : null;
  let pick: { dari: number; modal: number } | null = null;
  for (const x of r) if (x.dari <= ts) pick = x;
  return pick ? { modal: pick.modal, perkiraan: false } : { modal: r[0].modal, perkiraan: true };
}

function tanggalBatch(b: Pick<StokMasuk, "tanggal" | "ts">): string {
  return String(b.tanggal || "").trim() || tanggalHariKerja(Number(b.ts) || 0);
}

/** Urutkan batch stok masuk dari paling lama -> paling baru (urutan FIFO). */
export function urutkanStokMasukFifo<T extends Pick<StokMasuk, "id" | "tanggal" | "ts">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const da = tanggalBatch(a);
    const db = tanggalBatch(b);
    if (da !== db) return da.localeCompare(db);
    const ta = Number(a.ts) || 0;
    const tb = Number(b.ts) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export type HasilHppItem = {
  itemIndex: number;
  id: string;
  nama: string;
  qty: number;
  qtyDenganModal: number;
  qtyTanpaModal: number;
  subtotalDenganModal: number;
  subtotalTanpaModal: number;
  hpp: number;
  perkiraan: boolean;
  pakaiBatch: boolean;
};

export type HasilHppNota = {
  saleKey: string;
  hppTotal: number;
  hppLengkap: boolean;
  penjualanTanpaModal: number;
  qtyTanpaModal: number;
  perkiraan: number;
  items: HasilHppItem[];
};

type BatchNode = {
  id: string;
  produkId: string;
  stokKey: string;
  modal: number;
  rem: number;
  tanggal: string;
  ts: number;
  isTukar: boolean;
  noNota?: string;
  originTs: number;
};

/**
 * Hitung HPP (COGS) seluruh penjualan POS secara kronologis (FIFO) dari `stok_masuk`.
 * Setiap batch di `stok_masuk` dikonsumsi satu kali secara urut tanggal/waktu pembelian;
 * jika batch `stok_masuk` untuk suatu item tidak mencukupi / belum tercatat, jatuh ke `product_costs`.
 */
export function hitungFifoHppPenjualan(
  salesAll: PosSale[],
  stokMasukList: StokMasuk[],
  modalMap: ModalMap
): Map<string, HasilHppNota> {
  const validSales = salesAll
    .filter((s) => !s.batal && s.status !== "DP")
    .sort((a, b) => (Number(a.lunasTs) || a.ts) - (Number(b.lunasTs) || b.ts));

  const saleTsByNota = new Map<string, number>();
  validSales.forEach((s) => {
    if (s.noNota) saleTsByNota.set(s.noNota, Number(s.lunasTs) || s.ts);
  });

  const orderedBatches = urutkanStokMasukFifo(
    stokMasukList.filter((b) => (Number(b.qty) || 0) > 0 && Number.isFinite(Number(b.modalSatuan)) && Number(b.modalSatuan) >= 0)
  );

  const byProduk = new Map<string, BatchNode[]>();
  const byStok = new Map<string, BatchNode[]>();

  orderedBatches.forEach((b) => {
    const node: BatchNode = {
      id: b.id,
      produkId: b.produkId,
      stokKey: kunci(b.kategori, b.item),
      modal: Math.round(Number(b.modalSatuan) || 0),
      rem: Math.max(0, Math.round(Number(b.qty) || 0)),
      tanggal: tanggalBatch(b),
      ts: Number(b.ts) || 0,
      isTukar: b.sumber === "TUKAR_TAMBAH",
      noNota: b.noNota,
      originTs: b.sumber === "TUKAR_TAMBAH" ? (saleTsByNota.get(b.noNota || "") ?? (Number(b.ts) || 0)) : (Number(b.ts) || 0),
    };
    const arrP = byProduk.get(node.produkId) || [];
    arrP.push(node);
    byProduk.set(node.produkId, arrP);
    if (node.stokKey !== "||") {
      const arrS = byStok.get(node.stokKey) || [];
      arrS.push(node);
      byStok.set(node.stokKey, arrS);
    }
  });

  const out = new Map<string, HasilHppNota>();

  validSales.forEach((s) => {
    const saleTs = Number(s.lunasTs) || s.ts;
    const saleDay = tanggalHariKerja(saleTs);
    const saleKey = s.id || s.noNota;
    let hppTotal = 0;
    let penjualanTanpaModal = 0;
    let qtyTanpaModal = 0;
    let perkiraan = 0;
    let hppLengkap = true;
    const itemResults: HasilHppItem[] = [];

    const bisaDipakai = (b: BatchNode) => {
      if (b.rem <= 0) return false;
      if (b.isTukar) {
        if (b.noNota && b.noNota === s.noNota) return false;
        return saleTs >= b.originTs;
      }
      return b.tanggal <= saleDay;
    };

    (s.items || []).forEach((it, idx) => {
      if (it.kategori !== "JUALAN") return;
      const qty = Math.max(0, Math.round(Number(it.qty) || 0));
      const subtotal = Number(it.subtotal) || 0;
      if (qty <= 0) return;

      let need = qty;
      let hppItem = 0;
      let pakaiBatch = false;
      let itemPerkiraan = false;

      const listP = byProduk.get(it.id) || [];
      for (const b of listP) {
        if (!need) break;
        if (!bisaDipakai(b)) continue;
        const take = Math.min(need, b.rem);
        b.rem -= take;
        need -= take;
        hppItem += take * b.modal;
        pakaiBatch = true;
      }

      if (need > 0 && it.stokRef && it.stokRef.item !== STOK_VARIAN_SEMUA) {
        const listS = byStok.get(kunci(it.stokRef.kategori, it.stokRef.item)) || [];
        for (const b of listS) {
          if (!need) break;
          if (!bisaDipakai(b)) continue;
          const take = Math.min(need, b.rem);
          b.rem -= take;
          need -= take;
          hppItem += take * b.modal;
          pakaiBatch = true;
        }
      }

      let qtyTanpa = 0;
      if (need > 0) {
        const m = modalDariInfo(modalMap[it.id], saleTs);
        if (!m) {
          qtyTanpa = need;
          hppLengkap = false;
        } else {
          hppItem += need * m.modal;
          if (m.perkiraan) {
            perkiraan += need;
            itemPerkiraan = true;
          }
          need = 0;
        }
      }

      const qtyDengan = qty - qtyTanpa;
      const subtotalTanpa = qty > 0 && qtyTanpa > 0 ? Math.round((subtotal * qtyTanpa) / qty) : 0;
      const subtotalDengan = subtotal - subtotalTanpa;

      hppTotal += hppItem;
      penjualanTanpaModal += subtotalTanpa;
      qtyTanpaModal += qtyTanpa;

      itemResults.push({
        itemIndex: idx,
        id: it.id,
        nama: it.nama,
        qty,
        qtyDenganModal: qtyDengan,
        qtyTanpaModal: qtyTanpa,
        subtotalDenganModal: subtotalDengan,
        subtotalTanpaModal: subtotalTanpa,
        hpp: hppItem,
        perkiraan: itemPerkiraan,
        pakaiBatch,
      });
    });

    out.set(saleKey, {
      saleKey,
      hppTotal,
      hppLengkap,
      penjualanTanpaModal,
      qtyTanpaModal,
      perkiraan,
      items: itemResults,
    });
  });

  return out;
}

export type RingkasanBatchAktif = {
  modalSatuan: number; // rata-rata tertimbang stok aktif atau batch terbaru bila stok 0
  totalNilai: number;
  qtyTerhitung: number;
  batches: { modal: number; qty: number; tanggal: string; sumber?: string }[];
};

/**
 * Ringkas modal aktif satu produk / stokRef dari `stok_masuk` (diambil dari pembelian TERBARU
 * sebanyak `jumlahStok` yang masih tersisa di gudang — konsisten dengan FIFO).
 * Jika `jumlahStok === 0`, mengembalikan batch terakhir sebagai referensi harga modal terbaru.
 */
export function ringkasanModalAktifProduk(
  produkId: string,
  stokMasukList: StokMasuk[],
  jumlahStok?: number | null,
  fallbackModal?: number | null
): RingkasanBatchAktif | null {
  const newestFirst = urutkanStokMasukFifo(
    stokMasukList.filter((b) => b.produkId === produkId && (Number(b.qty) || 0) > 0 && Number.isFinite(Number(b.modalSatuan)) && Number(b.modalSatuan) >= 0)
  ).reverse();

  if (!newestFirst.length) {
    if (typeof fallbackModal === "number" && fallbackModal >= 0) {
      const n = typeof jumlahStok === "number" ? Math.max(0, Math.round(jumlahStok)) : 0;
      return {
        modalSatuan: Math.round(fallbackModal),
        totalNilai: Math.round(fallbackModal) * n,
        qtyTerhitung: n,
        batches: [],
      };
    }
    return null;
  }

  // Jika stok fisik 0 atau tidak diketahui, tampilkan modal pembelian paling akhir
  if (jumlahStok === undefined || jumlahStok === null || jumlahStok <= 0) {
    const latest = newestFirst[0];
    return {
      modalSatuan: Math.round(Number(latest.modalSatuan) || 0),
      totalNilai: 0,
      qtyTerhitung: 0,
      batches: [{ modal: Math.round(Number(latest.modalSatuan) || 0), qty: Math.round(Number(latest.qty) || 0), tanggal: tanggalBatch(latest), sumber: latest.sumber }],
    };
  }

  let need = Math.max(0, Math.round(jumlahStok));
  let totalNilai = 0;
  let qtyBatch = 0;
  const batches: RingkasanBatchAktif["batches"] = [];

  for (const b of newestFirst) {
    if (!need) break;
    const take = Math.min(need, Math.max(0, Math.round(Number(b.qty) || 0)));
    if (take <= 0) continue;
    const modal = Math.round(Number(b.modalSatuan) || 0);
    totalNilai += take * modal;
    qtyBatch += take;
    need -= take;
    batches.push({ modal, qty: take, tanggal: tanggalBatch(b), sumber: b.sumber });
  }

  if (need > 0 && typeof fallbackModal === "number" && fallbackModal >= 0) {
    totalNilai += need * Math.round(fallbackModal);
    qtyBatch += need;
  }

  const modalSatuan = qtyBatch > 0 ? Math.round(totalNilai / qtyBatch) : Math.round(Number(newestFirst[0].modalSatuan) || 0);
  return { modalSatuan, totalNilai, qtyTerhitung: qtyBatch, batches };
}

/**
 * Hitung total nilai modal seluruh stok fisik di gudang menggunakan batch terbaru per `(kategori, item)`,
 * jatuh ke rata-rata `modalMap` produk yang terhubung bila stok fisik melebihi total catatan `stok_masuk`.
 */
export function hitungNilaiStokBatch(
  semuaProduk: ProdukJualan[],
  cats: StokKategori[],
  data: Record<string, Record<string, StokItemValue>> | undefined,
  modalMap: ModalMap,
  stokMasukList: StokMasuk[]
): number {
  const modalFallbackPerKey = new Map<string, number[]>();
  semuaProduk.forEach((p) => {
    const info = modalMap[p.id];
    const m = typeof info?.hargaModal === "number" ? info.hargaModal : null;
    const r = p.stokRef;
    if (m === null || !r) return;
    const items = r.item === STOK_VARIAN_SEMUA ? cats.find((c) => c.kategori === r.kategori)?.items || [] : [r.item];
    items.forEach((it) => {
      const k = kunci(r.kategori, it);
      modalFallbackPerKey.set(k, [...(modalFallbackPerKey.get(k) || []), m]);
    });
  });

  // Semua item fisik yang punya stok di `data` atau minimal ada di `modalFallbackPerKey` / `stokMasukList`
  const allKeys = new Set<string>(modalFallbackPerKey.keys());
  Object.entries(data || {}).forEach(([kat, items]) => {
    Object.keys(items || {}).forEach((it) => allKeys.add(kunci(kat, it)));
  });

  const batchesByKey = new Map<string, StokMasuk[]>();
  urutkanStokMasukFifo(
    stokMasukList.filter((b) => (Number(b.qty) || 0) > 0 && Number.isFinite(Number(b.modalSatuan)) && Number(b.modalSatuan) >= 0)
  )
    .reverse()
    .forEach((b) => {
      const k = kunci(b.kategori, b.item);
      batchesByKey.set(k, [...(batchesByKey.get(k) || []), b]);
    });

  let total = 0;
  allKeys.forEach((k) => {
    const [kat, it] = k.split("||");
    let need = Math.max(0, Math.round(Number(data?.[kat]?.[it]?.jumlah) || 0));
    if (need <= 0) return;

    const batches = batchesByKey.get(k) || [];
    for (const b of batches) {
      if (!need) break;
      const take = Math.min(need, Math.max(0, Math.round(Number(b.qty) || 0)));
      if (take <= 0) continue;
      total += take * Math.round(Number(b.modalSatuan) || 0);
      need -= take;
    }

    if (need > 0) {
      const ms = modalFallbackPerKey.get(k);
      if (ms?.length) {
        total += need * (ms.reduce((a, b) => a + b, 0) / ms.length);
      }
    }
  });

  return Math.round(total);
}

/** Opsi A: modal sisa tertahan = max(0, Total HPP Barang Keluar - Uang Dibayar Pembeli). */
export const hitungModalTertahan = (hppNota: number, bayarKas: number) => Math.max(0, Math.round(hppNota - bayarKas));

export type RingkasanTukarNota = {
  nilaiTukar: number;
  kas: number;
  modalTertahanDefault: number;
  modalDiakui: number;
  /** Penyesuaian atas nilai tukar nota untuk hitungan laba (negatif bila modal diakui < potongan nota). */
  penyesuaianLaba: number;
  adaKonfirmasi: boolean;
  semuaDikonfirmasi: boolean;
};

/**
 * Hitung nilai barang masuk tukar tambah yang diakui sebagai pengganti omzet dalam perhitungan Laba:
 * - Jika `tukar_tambah` sudah `DIKONFIRMASI`: pakai `modalSatuan * qty` hasil konfirmasi owner.
 * - Jika masih `MENUNGGU`: otomatis pakai Opsi A (`max(0, HPP keluar - kas)`) bila HPP nota lengkap; bila belum lengkap jatuh ke `nilaiTukar`.
 */
export function ringkasanTukarUntukLaba(
  s: Pick<PosSale, "total" | "nilaiTukar" | "tukarTambah">,
  hppNota: number,
  hppLengkap: boolean,
  ttById?: Map<string, TukarTambah>
): RingkasanTukarNota {
  const nilaiTukar = nilaiTukarPos(s);
  const kas = (Number(s.total) || 0) - nilaiTukar;
  if (!adaTukarPos(s)) {
    return { nilaiTukar: 0, kas, modalTertahanDefault: 0, modalDiakui: 0, penyesuaianLaba: 0, adaKonfirmasi: false, semuaDikonfirmasi: false };
  }

  const modalTertahanDefault = hppLengkap ? hitungModalTertahan(hppNota, kas) : nilaiTukar;
  const list = s.tukarTambah || [];
  if (!list.length) {
    const diakui = hppLengkap ? modalTertahanDefault : nilaiTukar;
    return {
      nilaiTukar,
      kas,
      modalTertahanDefault,
      modalDiakui: diakui,
      penyesuaianLaba: hppLengkap ? diakui - nilaiTukar : 0,
      adaKonfirmasi: false,
      semuaDikonfirmasi: false,
    };
  }

  const sumNilaiList = list.reduce((a, x) => a + Math.max(0, Number(x.nilai) || 0) * Math.max(1, Number(x.qty) || 1), 0);
  let modalDiakui = 0;
  let adaKonfirmasi = false;
  let semuaDikonfirmasi = true;

  list.forEach((t, idx) => {
    const qty = Math.max(1, Math.round(Number(t.qty) || 1));
    const itemNilai = Math.max(0, Math.round(Number(t.nilai) || 0)) * qty;
    const doc = ttById?.get(t.id);
    if (doc && doc.status === "DIKONFIRMASI" && typeof doc.modalSatuan === "number" && doc.modalSatuan >= 0) {
      adaKonfirmasi = true;
      modalDiakui += Math.round(doc.modalSatuan) * qty;
    } else {
      semuaDikonfirmasi = false;
      if (hppLengkap) {
        const share = sumNilaiList > 0 ? itemNilai / sumNilaiList : 1 / list.length;
        // Untuk 1 barang tukar tambah (99% kasus), nilainya persis modalTertahanDefault tanpa pembulatan ulang
        modalDiakui += list.length === 1 ? modalTertahanDefault : Math.round(modalTertahanDefault * share);
      } else {
        modalDiakui += itemNilai;
      }
    }
    void idx;
  });

  // Bila ada item yang belum punya modal sama sekali dan tukar tambah belum dikonfirmasi, jangan paksa penyesuaian
  const terpakaiPenyesuaian = hppLengkap || adaKonfirmasi;
  const finalDiakui = terpakaiPenyesuaian ? modalDiakui : nilaiTukar;

  return {
    nilaiTukar,
    kas,
    modalTertahanDefault,
    modalDiakui: finalDiakui,
    penyesuaianLaba: terpakaiPenyesuaian ? finalDiakui - nilaiTukar : 0,
    adaKonfirmasi,
    semuaDikonfirmasi,
  };
}

/** Alokasikan bilangan bulat `totalDelta` secara proporsional ke tiap `weights` agar jumlahnya tetap persis `totalDelta`. */
export function alokasiProporsional(weights: number[], totalDelta: number): number[] {
  if (!weights.length || totalDelta === 0) return weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) {
    const out = weights.map(() => 0);
    out[0] = totalDelta;
    return out;
  }
  const out = new Array<number>(weights.length).fill(0);
  let assigned = 0;
  let lastPositive = -1;
  weights.forEach((w, i) => {
    if (w > 0) lastPositive = i;
  });
  weights.forEach((w, i) => {
    if (i === lastPositive) return;
    const part = Math.round((totalDelta * Math.max(0, w)) / sum);
    out[i] = part;
    assigned += part;
  });
  if (lastPositive >= 0) out[lastPositive] = totalDelta - assigned;
  return out;
}

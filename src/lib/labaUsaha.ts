/**
 * LABA USAHA — satu sumber untuk Analitik › Usaha dan Analitik › Keseluruhan.
 * Laba kotor = penjualan − modal barang terjual (FIFO); jasa tanpa modal barang.
 * Laba bersih = laba kotor + pemasukan lain usaha − biaya operasional (belanja stok BUKAN biaya).
 */
import { useMemo } from "react";
import { gabungNota, kondisiProduk, ringkasanDp, terjualDalam, usePosSales, usePosSalesLunas, type Kondisi, type PosSale } from "./posSales";
import { alokasiProporsional, hitungFifoHppPenjualan, ringkasanTukarUntukLaba } from "./akuntansiUsaha";
import { tebakModalBaris, useBarisUsahaManual, type BarisUsahaManual } from "./pemasukanUsaha";
import { useModalProduk, useProdukJualan, useSemuaStokMasuk, type ModalMap, type ProdukJualan } from "./barangJualan";
import { useSemuaTukarTambah, type TukarTambah } from "./tukarTambah";
import { isBelanjaStok, type TransaksiOwner } from "./keuangan";

type InputLaba = {
  cur: PosSale[];
  manualCur: BarisUsahaManual[];
  hppMap: ReturnType<typeof hitungFifoHppPenjualan>;
  ttById: Map<string, TukarTambah>;
  produkJualan: ProdukJualan[];
  modalMap: ModalMap;
};

/** Rincian laba barang (penjualan, modal, per produk, per kondisi). */
export function hitungLabaBarang({ cur, manualCur, hppMap, ttById, produkJualan, modalMap }: InputLaba) {
  let penjualan = 0, denganModal = 0, hpp = 0, qtyTanpa = 0, perkiraan = 0, penjualanTanpaModal = 0, penyesuaianTukar = 0, nilaiTukarTotal = 0, modalTukarMasuk = 0;
  const perProduk = new Map<string, number>();
  const perKondisi: Record<Kondisi, { penjualan: number; laba: number; qty: number }> = { BARU: { penjualan: 0, laba: 0, qty: 0 }, SEKEN: { penjualan: 0, laba: 0, qty: 0 } };
  const byId = new Map(produkJualan.map((p) => [p.id, p]));
  cur.forEach((s) => {
    const h = hppMap.get(s.id || s.noNota);
    const hppLengkapNota = h ? h.hppLengkap : true;
    const tRing = ringkasanTukarUntukLaba(s, h?.hppTotal || 0, hppLengkapNota, ttById);
    nilaiTukarTotal += tRing.nilaiTukar;
    modalTukarMasuk += tRing.modalDiakui;
    const deltaNota = hppLengkapNota ? tRing.penyesuaianLaba : 0;
    penyesuaianTukar += deltaNota;

    const jualanEntries = (s.items || [])
      .map((it, idx) => ({ it, hItem: h?.items.find((x) => x.itemIndex === idx) }))
      .filter((x) => x.it.kategori === "JUALAN" && (Number(x.it.qty) || 0) > 0);
    const modalWeights = jualanEntries.map((x) => x.hItem?.subtotalDenganModal ?? 0);
    const allocWeights = modalWeights.some((w) => w > 0) ? modalWeights : jualanEntries.map((x) => Number(x.it.subtotal) || 0);
    const penyesuaianPerItem = alokasiProporsional(allocWeights, deltaNota);

    jualanEntries.forEach(({ it, hItem }, jIdx) => {
      const deltaTukar = penyesuaianPerItem[jIdx] || 0;
      const subtotalEfektif = (Number(it.subtotal) || 0) + deltaTukar;
      penjualan += subtotalEfektif;
      const prod = byId.get(it.id);
      const kd: Kondisi = it.kondisi || (prod ? kondisiProduk(prod) : kondisiProduk({ name: it.nama, stokRef: it.stokRef }));
      perKondisi[kd].penjualan += subtotalEfektif;
      perKondisi[kd].qty += it.qty;
      if (!hItem || hItem.qtyDenganModal <= 0) {
        qtyTanpa += it.qty;
        penjualanTanpaModal += Number(it.subtotal) || 0;
        return;
      }
      if (hItem.qtyTanpaModal > 0) {
        qtyTanpa += hItem.qtyTanpaModal;
        penjualanTanpaModal += hItem.subtotalTanpaModal;
      }
      if (hItem.perkiraan) perkiraan += hItem.qtyDenganModal;
      const itemDenganModalEfektif = hItem.subtotalDenganModal + deltaTukar;
      denganModal += itemDenganModalEfektif;
      hpp += hItem.hpp;
      const key = String(it.bonusUntukNama || it.nama || "").toUpperCase();
      perProduk.set(key, (perProduk.get(key) || 0) + itemDenganModalEfektif - hItem.hpp);
      perKondisi[kd].laba += itemDenganModalEfektif - hItem.hpp;
    });
  });
  // Barang dari pembukuan harian (stik, kabel, dll.): perkiraan modal dari harga modal barang saat ini
  let manualBarang = 0;
  manualCur.forEach((r) => {
    if (!r.barang) return;
    manualBarang++;
    penjualan += r.harga;
    const t = tebakModalBaris(r, produkJualan, modalMap);
    const kd: Kondisi = t?.kondisi || "BARU";
    perKondisi[kd].penjualan += r.harga;
    perKondisi[kd].qty += t?.qty || 1;
    if (!t) { qtyTanpa += 1; penjualanTanpaModal += r.harga; return; }
    perkiraan += t.qty;
    denganModal += r.harga;
    hpp += t.modal;
    const key = String(t.produk.name || "").toUpperCase();
    perProduk.set(key, (perProduk.get(key) || 0) + r.harga - t.modal);
    perKondisi[kd].laba += r.harga - t.modal;
  });
  const kotor = denganModal - hpp;
  return { penjualan, denganModal, hpp, kotor, margin: denganModal > 0 ? (kotor / denganModal) * 100 : 0, qtyTanpa, perkiraan, perProduk, perKondisi, penjualanTanpaModal, manualBarang, penyesuaianTukar, nilaiTukarTotal, modalTukarMasuk };
}

/** Laba usaha periode: omzet terhitung → laba kotor → laba bersih. */
export function hitungUntungUsaha(a: {
  omzet: number;
  laba: ReturnType<typeof hitungLabaBarang>;
  dpHangus: number;
  pengeluaran: TransaksiOwner[];
  pemasukan: TransaksiOwner[];
}) {
  const operasional = a.pengeluaran.filter((e) => !isBelanjaStok(e)).reduce((s, e) => s + (Number(e.harga) || 0), 0);
  const lain = a.pemasukan.reduce((s, e) => s + (Number(e.harga) || 0), 0);
  const terhitung = Math.max(0, a.omzet + a.laba.penyesuaianTukar - a.laba.penjualanTanpaModal) + a.dpHangus;
  const kotor = terhitung - a.laba.hpp;
  const bersih = kotor + lain - operasional;
  return {
    terhitung, kotor, lain, operasional, bersih,
    marginKotor: terhitung > 0 ? (kotor / terhitung) * 100 : 0,
    marginBersih: terhitung > 0 ? (bersih / terhitung) * 100 : 0,
  };
}

/** Muat data & hitung laba usaha periode (dipakai Analitik › Keseluruhan). */
export function useLabaUsaha(from: number, to: number, pengeluaran: TransaksiOwner[], pemasukan: TransaksiOwner[]) {
  const { sales: raw, loading: l1 } = usePosSales(0, to, 5000);
  const { sales: lunasRaw, loading: l2 } = usePosSalesLunas(0, to);
  const { rows: manualRaw, loading: l3 } = useBarisUsahaManual(from, to);
  const { list: stokMasukList, loading: l4 } = useSemuaStokMasuk();
  const { list: tukarList, loading: l5 } = useSemuaTukarTambah();
  const { map: modalMap } = useModalProduk();
  const { products: produkJualan } = useProdukJualan();
  return useMemo(() => {
    const semua = gabungNota(raw, lunasRaw);
    const cur = semua.filter((s) => terjualDalam(s, from, to));
    const manualCur = manualRaw.filter((r) => r.ts >= from && r.ts <= to);
    const hppMap = hitungFifoHppPenjualan(semua, stokMasukList, modalMap);
    const ttById = new Map(tukarList.map((t) => [t.id, t]));
    const laba = hitungLabaBarang({ cur, manualCur, hppMap, ttById, produkJualan, modalMap });
    const omzet = cur.reduce((s, x) => s + (Number(x.total) || 0), 0) + manualCur.reduce((s, r) => s + r.harga, 0);
    const dp = ringkasanDp(raw.filter((s) => s.ts >= from && s.ts <= to));
    const untung = hitungUntungUsaha({ omzet, laba, dpHangus: dp.hangus, pengeluaran, pemasukan });
    return { loading: l1 || l2 || l3 || l4 || l5, omzet, hpp: laba.hpp, ...untung };
  }, [raw, lunasRaw, manualRaw, stokMasukList, tukarList, modalMap, produkJualan, from, to, pengeluaran, pemasukan, l1, l2, l3, l4, l5]);
}

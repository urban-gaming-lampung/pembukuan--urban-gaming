/**
 * BONUS STIK FIFO (PS BARU) — logika murni bebas Firebase.
 *
 * Menjaga antrean FIFO unit PS Baru (dari `stok_masuk`) beserta aturan bonus stik etalase-nya
 * agar:
 * 1. Saat PS Baru dijual di POS, bonus stik otomatis keluar sesuai batch PS tertua (FIFO).
 * 2. Stok unit PS dan stok stik etalase berkurang bersamaan saat nota lunas.
 * 3. HPP FIFO unit PS dan HPP FIFO stik (yang bisa dibeli di tanggal berbeda) tetap sinkron
 *    di Analitik Usaha.
 */

export const PILIH_VARIAN_STIK = "*";

export type BonusStikRef = {
  kategori: string;
  item: string;
};

export type BonusStikSpec = {
  produkId: string;
  produkNama: string;
  /** Jumlah stik bonus untuk setiap 1 unit PS pada batch ini */
  qty: number;
  stokRef: BonusStikRef | null;
};

export type PsBonusBatch = {
  id: string;
  produkId: string;
  kategori: string;
  item: string;
  tanggal: string;
  ts: number;
  qtyAwal: number;
  rem: number;
  bonusStik?: BonusStikSpec | null;
};

export type PsBonusBatchUsed = {
  batchId: string;
  qty: number;
};

export type PsBonusFifoDoc = {
  batches: PsBonusBatch[];
  usedBySale?: Record<string, PsBonusBatchUsed[]>;
};

const kunci = (kategori: string, item: string) => `${kategori}||${item}`;

export const isUnitPsBaruRef = (ref?: BonusStikRef | null) =>
  !!ref && /BARU/i.test(ref.kategori) && /KONSOL|UNIT/i.test(ref.kategori);

export function sameBonusStik(a?: BonusStikSpec | null, b?: BonusStikSpec | null): boolean {
  const na = a && a.qty > 0 ? a : null;
  const nb = b && b.qty > 0 ? b : null;
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return (
    na.produkId === nb.produkId &&
    na.qty === nb.qty &&
    (na.stokRef ? kunci(na.stokRef.kategori, na.stokRef.item) : "") ===
      (nb.stokRef ? kunci(nb.stokRef.kategori, nb.stokRef.item) : "")
  );
}

/** Urutkan batch FIFO: tanggal beli terlama -> timestamp -> id. */
export function urutBatchBonusFifo<T extends Pick<PsBonusBatch, "id" | "tanggal" | "ts">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const da = String(a.tanggal || "");
    const db = String(b.tanggal || "");
    if (da !== db) return da.localeCompare(db);
    const ta = Number(a.ts) || 0;
    const tb = Number(b.ts) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export type BonusAlokasiItemInput = {
  id: string;
  nama: string;
  kategori: string;
  subkategori?: string | null;
  kondisi?: "BARU" | "SEKEN" | null;
  harga: number;
  hargaNormal?: number;
  qty: number;
  stokRef?: BonusStikRef | null;
  bonusUntukProdukId?: string;
};

export type BonusAlokasiSlot = {
  key: string;
  parentIndex: number;
  parentId: string;
  parentNama: string;
  batchId: string;
  batchTanggal: string;
  unitQty: number;
  bonusStik: BonusStikSpec;
  perUnitQty: number;
  totalStikQty: number;
};

export type HasilAlokasiBonusPs = {
  slots: BonusAlokasiSlot[];
  batchUsed: PsBonusBatchUsed[];
  nextBatches: PsBonusBatch[];
};

const isAutoBonusLine = (it: BonusAlokasiItemInput) => {
  if (it.bonusUntukProdukId) return true;
  const nego = typeof it.hargaNormal === "number" && it.hargaNormal !== it.harga ? it.hargaNormal - it.harga : 0;
  return !(Number(it.harga) > 0) && nego === 0;
};

/**
 * Alokasikan batch PS Baru secara FIFO terhadap item keranjang / nota POS.
 * Dipakai untuk pratinjau checkout di POS maupun pengurangan batch atomik saat transaksi lunas.
 */
export function alokasiBonusPsFifo(
  items: BonusAlokasiItemInput[],
  batches: PsBonusBatch[]
): HasilAlokasiBonusPs {
  const working = urutBatchBonusFifo(batches || []).map((b) => ({
    ...b,
    rem: Math.max(0, Math.round(Number(b.rem) || 0)),
  }));
  const usedMap = new Map<string, number>();
  const slots: BonusAlokasiSlot[] = [];

  (items || []).forEach((it, idx) => {
    if (it.kategori !== "JUALAN" || isAutoBonusLine(it)) return;
    if (it.kondisi === "SEKEN") return;
    const qty = Math.max(0, Math.round(Number(it.qty) || 0));
    if (qty <= 0) return;

    const psBaruRef = isUnitPsBaruRef(it.stokRef);
    const hasBatchById = working.some((b) => b.produkId === it.id && isUnitPsBaruRef({ kategori: b.kategori, item: b.item }));
    const mungkinPsBaru = it.kondisi === "BARU" ? it.subkategori === "Unit PS" || psBaruRef || hasBatchById : psBaruRef || hasBatchById;
    if (!mungkinPsBaru) return;

    let need = qty;
    const slices: { batch: PsBonusBatch; take: number }[] = [];

    for (const b of working) {
      if (!need) break;
      if (b.rem <= 0) continue;
      if (b.produkId !== it.id || !isUnitPsBaruRef({ kategori: b.kategori, item: b.item })) continue;
      const take = Math.min(need, b.rem);
      b.rem -= take;
      need -= take;
      slices.push({ batch: b, take });
    }

    if (need > 0 && it.stokRef && it.stokRef.item !== PILIH_VARIAN_STIK && psBaruRef) {
      for (const b of working) {
        if (!need) break;
        if (b.rem <= 0) continue;
        if (b.kategori !== it.stokRef.kategori || b.item !== it.stokRef.item) continue;
        const take = Math.min(need, b.rem);
        b.rem -= take;
        need -= take;
        slices.push({ batch: b, take });
      }
    }

    slices.forEach(({ batch, take }) => {
      usedMap.set(batch.id, (usedMap.get(batch.id) || 0) + take);
      const spec = batch.bonusStik;
      if (spec && spec.qty > 0 && spec.produkId) {
        slots.push({
          key: `${idx}::${batch.id}`,
          parentIndex: idx,
          parentId: it.id,
          parentNama: it.nama,
          batchId: batch.id,
          batchTanggal: batch.tanggal,
          unitQty: take,
          bonusStik: spec,
          perUnitQty: spec.qty,
          totalStikQty: take * spec.qty,
        });
      }
    });
  });

  return {
    slots,
    batchUsed: Array.from(usedMap.entries()).map(([batchId, qty]) => ({ batchId, qty })),
    nextBatches: working,
  };
}

/** Tambah batch baru ke antrean FIFO (saat stok masuk baru dicatat). */
export function tambahPsBonusBatch(batches: PsBonusBatch[], baru: Omit<PsBonusBatch, "rem"> & { rem?: number }): PsBonusBatch[] {
  const next: PsBonusBatch = {
    id: baru.id,
    produkId: baru.produkId,
    kategori: baru.kategori,
    item: baru.item,
    tanggal: baru.tanggal,
    ts: baru.ts,
    qtyAwal: Math.max(0, Math.round(baru.qtyAwal)),
    rem: Math.max(0, Math.round(baru.rem ?? baru.qtyAwal)),
    bonusStik: baru.bonusStik && baru.bonusStik.qty > 0 ? baru.bonusStik : null,
  };
  return urutBatchBonusFifo([...(batches || []).filter((b) => b.id !== baru.id), next]);
}

/**
 * Perbarui batch yang sudah ada (atau sisipkan batch lama yang baru pertama kali diedit).
 * Sisa `rem` mempertahankan unit yang sudah terjual agar FIFO tetap akurat.
 */
export function ubahPsBonusBatch(
  batches: PsBonusBatch[],
  edit: Omit<PsBonusBatch, "rem">,
  fisikSesudahEdit?: number
): PsBonusBatch[] {
  const list = batches || [];
  const cur = list.find((b) => b.id === edit.id);
  const qtyAwal = Math.max(0, Math.round(edit.qtyAwal));
  let rem: number;
  if (cur) {
    const terjual = Math.max(0, Math.round(cur.qtyAwal) - Math.round(cur.rem));
    rem = Math.max(0, Math.min(qtyAwal, qtyAwal - terjual));
  } else if (typeof fisikSesudahEdit === "number") {
    const remLain = list
      .filter((b) => b.kategori === edit.kategori && b.item === edit.item)
      .reduce((s, b) => s + Math.max(0, Math.round(b.rem)), 0);
    rem = Math.min(qtyAwal, Math.max(0, Math.round(fisikSesudahEdit) - remLain));
  } else {
    rem = qtyAwal;
  }
  const next: PsBonusBatch = {
    id: edit.id,
    produkId: edit.produkId,
    kategori: edit.kategori,
    item: edit.item,
    tanggal: edit.tanggal,
    ts: edit.ts,
    qtyAwal,
    rem,
    bonusStik: edit.bonusStik && edit.bonusStik.qty > 0 ? edit.bonusStik : null,
  };
  return urutBatchBonusFifo([...list.filter((b) => b.id !== edit.id), next]);
}

/** Kurangi qtyAwal / hapus batch (mis. saat catatan stok masuk dihapus atau salah input). */
export function sesuaikanHapusPsBonusBatch(batches: PsBonusBatch[], batchId: string, sisaQtyBaru = 0): PsBonusBatch[] {
  const list = batches || [];
  if (sisaQtyBaru <= 0) return list.filter((b) => b.id !== batchId);
  return list.map((b) =>
    b.id !== batchId
      ? b
      : {
          ...b,
          qtyAwal: Math.max(0, Math.round(sisaQtyBaru)),
          rem: Math.max(0, Math.min(Math.round(b.rem), Math.round(sisaQtyBaru))),
        }
  );
}

/** Kembalikan `rem` saat nota dibatalkan atau dihapus. */
export function kembalikanBatchFifo(batches: PsBonusBatch[], usedList?: PsBonusBatchUsed[] | null): PsBonusBatch[] {
  if (!usedList?.length) return batches || [];
  const restore = new Map<string, number>();
  usedList.forEach((u) => {
    if (u.batchId && u.qty > 0) restore.set(u.batchId, (restore.get(u.batchId) || 0) + Math.round(u.qty));
  });
  return (batches || []).map((b) => {
    const q = restore.get(b.id) || 0;
    if (!q) return b;
    return { ...b, rem: Math.min(Math.max(0, Math.round(b.qtyAwal)), Math.max(0, Math.round(b.rem)) + q) };
  });
}

/**
 * Isi otomatis batch PS Baru lama dari `stok_masuk` yang belum tercatat di `ps_bonus_fifo`.
 * Sisa stok fisik dialokasikan dari pembelian paling baru ke paling lama (konsisten FIFO).
 */
export function rancangBackfillPsBonusFifo(
  stokMasukPsBaru: Array<{
    id: string;
    produkId: string;
    kategori: string;
    item: string;
    tanggal: string;
    ts: number;
    qty: number;
    bonusStik?: BonusStikSpec | null;
  }>,
  jualanData: Record<string, Record<string, { jumlah?: number }>> | undefined,
  existingBatches: PsBonusBatch[]
): { changed: boolean; nextBatches: PsBonusBatch[] } {
  const existing = existingBatches || [];
  const existingIds = new Set(existing.map((b) => b.id));
  const missingByKey = new Map<string, typeof stokMasukPsBaru>();

  stokMasukPsBaru.forEach((b) => {
    if (!(b.qty > 0) || existingIds.has(b.id)) return;
    const k = kunci(b.kategori, b.item);
    const arr = missingByKey.get(k) || [];
    arr.push(b);
    missingByKey.set(k, arr);
  });

  if (missingByKey.size === 0) return { changed: false, nextBatches: existing };

  const added: PsBonusBatch[] = [];
  missingByKey.forEach((list, k) => {
    const [kat, item] = k.split("||");
    const fisik = Math.max(0, Math.round(Number(jualanData?.[kat]?.[item]?.jumlah) || 0));
    const remTercatat = existing
      .filter((b) => b.kategori === kat && b.item === item)
      .reduce((s, b) => s + Math.max(0, Math.round(b.rem)), 0);
    let sisaUntukBackfill = Math.max(0, fisik - remTercatat);

    const newestFirst = urutBatchBonusFifo(list).reverse();
    newestFirst.forEach((b) => {
      const qtyAwal = Math.max(0, Math.round(b.qty));
      const rem = Math.min(qtyAwal, sisaUntukBackfill);
      sisaUntukBackfill -= rem;
      added.push({
        id: b.id,
        produkId: b.produkId,
        kategori: b.kategori,
        item: b.item,
        tanggal: b.tanggal,
        ts: b.ts,
        qtyAwal,
        rem,
        bonusStik: b.bonusStik && b.bonusStik.qty > 0 ? b.bonusStik : null,
      });
    });
  });

  return {
    changed: added.length > 0,
    nextBatches: urutBatchBonusFifo([...existing, ...added]),
  };
}

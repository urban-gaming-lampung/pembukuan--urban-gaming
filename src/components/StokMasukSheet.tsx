import React, { useMemo, useState } from "react";
import { Gift, Minus, Plus } from "lucide-react";
import useStokData, { type StokItemValue, type StokKategori } from "../hooks/useStokData";
import {
  BonusStikSpec, dariTukarTambah, hapusStokMasuk, KATEGORI_PENGELUARAN_STOK, ProdukJualan, StokMasuk, ubahStokMasuk, useProdukJualan,
} from "../lib/barangJualan";
import { Kondisi, kondisiProduk, PILIH_SAAT_CHECKOUT, produkSubKategori, StokRef } from "../lib/posSales";
import { isUnitPsBaruRef, sameBonusStik } from "../lib/psBonusFifo";
import { rupiah } from "../lib/format";
import { Button, Card, Footnote, Notice, Sheet, Toggle } from "../ui";

/** Angka saja dari input bebas ("01.500" -> "1500"). */
export const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
/** "1500" -> "1.500" (kosong tetap kosong). */
export const fmtDigits = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");

/** Saklar ala iOS — satu komponen di Design System (src/ui). */
export { Toggle };

export type StikOpsi = {
  id: string;
  name: string;
  kondisi: Kondisi;
  stokRef: StokRef | null;
  stokLabel: string;
  connected: boolean;
};

/** Daftar produk stik berbayar di etalase untuk dipilih sebagai bonus pembelian PS Baru. */
export function buildStikOpsi(
  products: ProdukJualan[],
  cats: StokKategori[],
  data: Record<string, Record<string, StokItemValue>>
): StikOpsi[] {
  return products
    .filter((p) => {
      if (p.category !== "JUALAN" || !(Number(p.price) > 0)) return false;
      const sub = p.subcategory || produkSubKategori(p.name);
      return sub === "Stik";
    })
    .map((p) => {
      const k = kondisiProduk(p);
      const r = p.stokRef ?? null;
      let stokLabel = "belum terhubung stok";
      let connected = false;
      if (r) {
        connected = true;
        if (r.item === PILIH_SAAT_CHECKOUT) {
          const items = cats.find((c) => c.kategori === r.kategori)?.items || [];
          const total = items.reduce((s, it) => s + Math.max(0, Math.round(Number(data?.[r.kategori]?.[it]?.jumlah) || 0)), 0);
          stokLabel = `pilih warna · sisa ${total}`;
        } else {
          const v = data?.[r.kategori]?.[r.item];
          stokLabel = v ? `sisa ${Math.max(0, Math.round(Number(v.jumlah) || 0))}` : "stok ?";
        }
      }
      return { id: p.id, name: p.name, kondisi: k, stokRef: r, stokLabel, connected };
    })
    .sort((a, b) => {
      if (a.kondisi !== b.kondisi) return a.kondisi === "BARU" ? -1 : 1;
      return a.name.localeCompare(b.name, "id");
    });
}

export function resolveBonusStikSpec(
  qty: number,
  stikId: string,
  stikList: StikOpsi[],
  fallback?: BonusStikSpec | null
): BonusStikSpec | null {
  const n = Math.max(0, Math.round(Number(qty) || 0));
  if (n <= 0 || !stikId) return null;
  const found = stikList.find((x) => x.id === stikId);
  if (found) {
    return { produkId: found.id, produkNama: found.name, qty: n, stokRef: found.stokRef };
  }
  if (fallback && fallback.produkId === stikId) {
    return { produkId: fallback.produkId, produkNama: fallback.produkNama, qty: n, stokRef: fallback.stokRef };
  }
  return null;
}

/** Pemilih jumlah & produk stik etalase sebagai bonus paket saat tambah / edit Stok Masuk PS Baru. */
export const BonusStikPicker: React.FC<{
  qty: number;
  onQtyChange: (q: number) => void;
  stikId: string;
  onStikChange: (id: string) => void;
  stikList: StikOpsi[];
  fallback?: BonusStikSpec | null;
  suggestion?: BonusStikSpec | null;
}> = ({ qty, onQtyChange, stikId, onStikChange, stikList, fallback, suggestion }) => {
  const chosen = stikList.find((x) => x.id === stikId);
  const hasFallbackOnly = !chosen && !!fallback && fallback.produkId === stikId;
  const field = "w-full h-11 px-3.5 py-0 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35";

  return (
    <div className="border-t border-sep pt-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-subhead font-semibold text-label">
            <Gift className="w-4 h-4 text-tint shrink-0" />
            <span>Stik bonus penjualan</span>
          </div>
          <div className="text-caption text-label-2 leading-snug">
            Bonus per 1 unit PS saat terjual di POS
          </div>
        </div>
        <div className="flex items-center gap-1 bg-fill rounded-full p-1 shrink-0">
          <button
            type="button"
            aria-label="Kurangi bonus stik"
            onClick={() => onQtyChange(Math.max(0, qty - 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/60 active:bg-surface transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            inputMode="numeric"
            aria-label="Jumlah stik bonus"
            value={qty || "0"}
            onChange={(e) => onQtyChange(Math.min(10, Number(digits(e.target.value) || 0)))}
            className="w-9 bg-transparent text-center text-headline font-semibold tabular-nums text-label focus:outline-none"
          />
          <button
            type="button"
            aria-label="Tambah bonus stik"
            onClick={() => onQtyChange(Math.min(10, qty + 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/60 active:bg-surface transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {qty === 0 && suggestion && suggestion.qty > 0 && suggestion.produkId && (
        <button
          type="button"
          onClick={() => {
            onQtyChange(suggestion.qty);
            onStikChange(suggestion.produkId);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-tint/10 text-tint px-3 py-1.5 text-caption font-semibold active:opacity-75"
        >
          <Gift className="w-3.5 h-3.5" />
          Pakai sebelumnya: {suggestion.qty}× {suggestion.produkNama}
        </button>
      )}

      {qty > 0 && (
        <div className="space-y-2">
          <div>
            <span className="block text-footnote font-medium text-label-2 mb-1.5 px-0.5">Stik di etalase (otomatis BONUS Rp 0)</span>
            <select
              value={stikId}
              onChange={(e) => onStikChange(e.target.value)}
              className={`${field} ${stikId ? "" : "ring-1 ring-warning"}`}
            >
              <option value="">Pilih produk stik etalase…</option>
              {hasFallbackOnly && fallback && (
                <option value={fallback.produkId}>{fallback.produkNama} (produk sudah dihapus)</option>
              )}
              {stikList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.kondisi === "BARU" ? "Baru" : "Seken"} · {s.stokLabel})
                </option>
              ))}
            </select>
          </div>

          {chosen && !chosen.connected && (
            <Notice tone="warning">
              Produk stik ini belum terhubung ke stok gudang, sehingga stok stik tidak akan berkurang saat PS terjual.
            </Notice>
          )}

          {chosen && (
            <Footnote className="px-0.5 leading-snug">
              Saat 1 unit PS terjual: <b className="text-label">+{qty}× {chosen.name}</b> otomatis ikut ke nota (<b className="text-tint">BONUS · Rp 0</b>),
              {chosen.stokRef?.item === PILIH_SAAT_CHECKOUT
                ? " kasir pilih warna saat checkout,"
                : " tanpa klik kasir,"} stok &amp; modal FIFO stik ikut terpotong. Stok stik etalase tidak ditambah saat ini.
            </Footnote>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Lembar ubah / hapus SATU catatan stok masuk — satu komponen untuk Atur Stok › Edit Barang
 * dan histori Pengeluaran (baris "Dari stok masuk"). Pengeluarannya selalu ikut; jumlah stok
 * ikut disesuaikan kecuali "Stok ikut disesuaikan" dimatikan (stok sudah dikoreksi sendiri).
 */
const StokMasukSheet: React.FC<{
  rec: StokMasuk;
  /** Nama untuk teks pengeluaran (bawaan: nama produk saat stok masuk dicatat) */
  produkNama?: string;
  /** Produk asal catatan ini sudah dihapus */
  produkDihapus?: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ rec, produkNama, produkDihapus, onClose, onDone }) => {
  const { stokState, masterCategories } = useStokData();
  const { products } = useProdukJualan();
  const cats = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const data = (stokState?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
  const stikList = useMemo(() => buildStikOpsi(products, cats, data), [products, cats, data]);
  const prod = products.find((p) => p.id === rec.produkId);
  const isPsBaru =
    isUnitPsBaruRef(rec) ||
    (!!prod && (prod.subcategory || produkSubKategori(prod.name)) === "Unit PS" && kondisiProduk(prod) === "BARU");

  const [qty, setQty] = useState(rec.qty);
  const [modal, setModal] = useState(String(rec.modalSatuan || ""));
  const [tanggal, setTanggal] = useState(rec.tanggal);
  const [catat, setCatat] = useState(rec.catatPengeluaran);
  const [bonusQty, setBonusQty] = useState(rec.bonusStik?.qty || 0);
  const [bonusStikId, setBonusStikId] = useState(rec.bonusStik?.produkId || "");
  const [ikutStok, setIkutStok] = useState(true);
  const [busy, setBusy] = useState<"" | "simpan" | "hapus">("");
  const [err, setErr] = useState("");
  const namaUntukPengeluaran = produkNama || rec.produkNama;
  // Barang tukar tambah: jumlah, stok & nilainya mengikuti nota POS (hanya-baca di sini)
  const dariTukar = dariTukarTambah(rec);
  const modalN = Number(modal || 0);
  const bonusSpec = isPsBaru ? resolveBonusStikSpec(bonusQty, bonusStikId, stikList, rec.bonusStik) : null;
  const selisih = qty - rec.qty;
  const berubah =
    qty !== rec.qty ||
    modalN !== rec.modalSatuan ||
    tanggal !== rec.tanggal ||
    catat !== rec.catatPengeluaran ||
    (isPsBaru && !sameBonusStik(rec.bonusStik, bonusSpec)) ||
    (isPsBaru && bonusQty > 0 && !bonusStikId);
  const stokSekarang = Math.max(0, Math.round(Number(data?.[rec.kategori]?.[rec.item]?.jumlah) || 0));
  const field = "w-full h-11 px-3.5 py-0 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35";

  const simpan = async () => {
    setErr("");
    if (!(qty > 0)) return setErr("Jumlah minimal 1. Untuk membatalkan, pakai Hapus.");
    if (isPsBaru && bonusQty > 0 && !bonusSpec) return setErr("Pilih stik di etalase untuk bonus paket PS Baru.");
    setBusy("simpan");
    try {
      const r = await ubahStokMasuk(
        rec,
        { qty, modalSatuan: modalN, tanggal, catatPengeluaran: catat, bonusStik: isPsBaru ? bonusSpec : undefined },
        namaUntukPengeluaran,
        ikutStok
      );
      onDone(`Stok masuk diperbarui${r.selisih ? ` · stok ${r.selisih > 0 ? "+" : "−"}${Math.abs(r.selisih)}` : ""} ✓`);
    } catch (e: any) { setErr(e?.message || String(e)); setBusy(""); }
  };
  const hapus = async () => {
    const efekStok = ikutStok ? `Stok ${rec.item} berkurang ${rec.qty} (${stokSekarang} → ${Math.max(0, stokSekarang - rec.qty)})` : `Stok ${rec.item} tetap ${stokSekarang}`;
    const efekUang = rec.catatPengeluaran ? `\nPengeluaran ${rupiah(rec.qty * (rec.modalSatuan || 0))} ikut dihapus.` : "";
    if (!confirm(`Hapus stok masuk +${rec.qty} (${rec.item})?\n${efekStok}.${efekUang}`)) return;
    setBusy("hapus"); setErr("");
    try { await hapusStokMasuk(rec, ikutStok); onDone(`Stok masuk dihapus${ikutStok ? ` · stok −${rec.qty}` : ""} ✓`); }
    catch (e: any) { setErr(e?.message || String(e)); setBusy(""); }
  };

  return (
    <Sheet
      open
      onClose={() => !busy && onClose()}
      title="Stok Masuk"
      subtitle={rec.item}
      size="sm"
      variant="grouped"
      zClassName="z-[320]"
      footer={
        !dariTukar ? (
          <div className="space-y-2">
            {err && <Notice tone="negative">{err}</Notice>}
            <Button
              variant="filled"
              size="lg"
              block
              loading={busy === "simpan"}
              disabled={!!busy || !berubah}
              onClick={simpan}
            >
              Simpan perubahan
            </Button>
            <Button
              variant="destructive"
              size="md"
              block
              loading={busy === "hapus"}
              disabled={!!busy}
              onClick={hapus}
            >
              Hapus stok masuk
            </Button>
          </div>
        ) : undefined
      }
    >
      {dariTukar ? (
        <div className="space-y-3">
          <Card flush className="px-4 py-1" bodyClassName="divide-y divide-sep">
            {[
              { l: "Barang stok", r: `${rec.kategori} › ${rec.item}` },
              { l: "Jumlah", r: `+${rec.qty}` },
              { l: "Modal / barang", r: rupiah(rec.modalSatuan || 0) },
              { l: "Tanggal nota", r: rec.tanggal },
              { l: "Nota", r: rec.noNota || "-" },
            ].map((x) => (
              <div key={x.l} className="flex items-center justify-between gap-3 py-2.5 text-subhead">
                <span className="text-label-2 shrink-0">{x.l}</span>
                <span className="text-label font-medium tabular-nums text-right truncate">{x.r}</span>
              </div>
            ))}
          </Card>
          <p className="px-1 text-caption leading-snug text-label-2">
            Barang dari <b className="font-semibold text-label">tukar tambah</b> (bukan pembelian tunai, jadi tidak dicatat sebagai pengeluaran kas). Harga modal menjadi HPP saat barang ini terjual nanti. Jumlahnya mengikuti nota — membatalkan nota menarik barang ini dari stok.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Card bodyClassName="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-subhead font-semibold text-label truncate">{rec.item}</div>
                <div className="text-caption text-label-2 truncate">{rec.kategori}</div>
              </div>
              <div className="flex items-center gap-1 bg-fill rounded-full p-1 shrink-0">
                <button type="button" aria-label="Kurangi" onClick={() => setQty((n) => Math.max(1, n - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/70 transition-colors"><Minus className="w-4 h-4" /></button>
                <input inputMode="numeric" aria-label="Jumlah stok masuk" value={qty || ""} onChange={(e) => setQty(Math.min(9999, Number(digits(e.target.value) || 0)))} className="w-10 bg-transparent text-center text-headline font-semibold tabular-nums text-label focus:outline-none" />
                <button type="button" aria-label="Tambah" onClick={() => setQty((n) => Math.min(9999, n + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/70 transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div>
                <span className="block text-caption font-medium text-label-2 mb-1.5 px-0.5">Modal / barang</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                  <input inputMode="numeric" value={fmtDigits(modal)} onChange={(e) => setModal(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                </div>
              </div>
              <div>
                <span className="block text-caption font-medium text-label-2 mb-1.5 px-0.5">Tanggal beli</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value || rec.tanggal)} className={field} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-subhead text-label">Catat ke Pengeluaran</div>
                <div className="text-caption text-label-2">Kategori “{KATEGORI_PENGELUARAN_STOK}” · {rupiah(modalN * qty)}</div>
              </div>
              <Toggle on={catat} onChange={setCatat} label="Catat ke pengeluaran" />
            </div>
            {isPsBaru && (
              <BonusStikPicker
                qty={bonusQty}
                onQtyChange={setBonusQty}
                stikId={bonusStikId}
                onStikChange={setBonusStikId}
                stikList={stikList}
                fallback={rec.bonusStik}
              />
            )}
          </Card>

          {/* Stok ikut disesuaikan saat jumlah diubah / catatan dihapus */}
          <Card bodyClassName="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-subhead text-label">Stok ikut disesuaikan</div>
              <div className="text-caption text-label-2 leading-snug">
                {!ikutStok
                  ? <>Stok {rec.item} tetap <b className="text-label tabular-nums">{stokSekarang}</b>. Pilih ini bila jumlah stok sudah dikoreksi.</>
                  : selisih !== 0
                    ? <>Stok {rec.item}: <b className="text-label tabular-nums">{stokSekarang} → {Math.max(0, stokSekarang + selisih)}</b></>
                    : <>Saat jumlah diubah atau catatan dihapus · stok sekarang <b className="text-label tabular-nums">{stokSekarang}</b></>}
              </div>
            </div>
            <Toggle on={ikutStok} onChange={setIkutStok} label="Stok ikut disesuaikan" />
          </Card>

          <p className="px-1 text-caption2 text-label-3 leading-snug">
            {rec.produkNama ? <>Produk: {rec.produkNama}{produkDihapus ? " (sudah dihapus)" : ""} · </> : null}
            Dicatat {new Date(rec.ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} oleh {String(rec.oleh || "").split("@")[0]}
            {rec.updatedAt ? ` · diubah ${new Date(rec.updatedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
      )}
    </Sheet>
  );
};

export default StokMasukSheet;

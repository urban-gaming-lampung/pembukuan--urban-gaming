import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, X, ChevronRight, Camera, Package, Sparkles, Trash2, Loader2, AlertTriangle, Link2Off, History, ArrowLeftRight } from "lucide-react";
import useStokData from "../hooks/useStokData";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { toLocalYmd } from "../lib/dateLocal";
import { getMinStok, pulihkanStokJualanDariRiwayat, removeJualanItem, statusOf, StokLog, useMinStok, useStokLog, kunciStok } from "../lib/stokJualan";
import { ambilSeri, Kondisi, kondisiProduk, kondisiStok, lepasSeri, namaJualan, pasangSeri, PILIH_SAAT_CHECKOUT, produkPakaiSeri, produkSubKategori, rapikanSeri, stokBeririsan, StokRef, SubKategoriJualan, syncProdukKeStok } from "../lib/posSales";
import KondisiSwitch from "./KondisiSwitch";
import {
  bersihkanProdukBonusLama, hapusBarangJualan, KATEGORI_PENGELUARAN_STOK, koreksiJumlahStok, kurangiStokMasukSalahInput, ModalMap, pratinjauOtomatis, ProdukJualan, PsBonusBatch, rencanaKurangiStokMasuk,
  simpanBarangJualan, sinkronBackfillPsBonusFifo, StokMasuk, uploadFotoProduk, useModalProduk, useProdukJualan, usePsBonusFifo, useSemuaStokMasuk, useStokMasuk,
} from "../lib/barangJualan";
import { hitungNilaiStokBatch, ringkasanModalAktifProduk } from "../lib/akuntansiUsaha";
import { isUnitPsBaruRef } from "../lib/psBonusFifo";
import StokMasukSheet, { BonusStikPicker, buildStikOpsi, digits, fmtDigits, resolveBonusStikSpec } from "./StokMasukSheet";
import { refAda, StokRefSelect } from "./StokRefSelect";
import { rupiah } from "../lib/format";
import { TukarTambah, useTukarTambah } from "../lib/tukarTambah";
import { DaftarKonfirmasiTukar, KonfirmasiTukarSheet } from "./KonfirmasiTukarSheet";
import { AlertDialog, Button, Card, EmptyState, Eyebrow, Footnote, Notice, Pill, SearchField, Sheet, Toast, Toggle } from "../ui";

const SUBS: { key: SubKategoriJualan; label: string }[] = [
  { key: "Unit PS", label: "Unit PS" },
  { key: "Stik", label: "Stik" },
  { key: "Hardisk", label: "Hardisk" },
  { key: "Aksesoris", label: "Aksesoris" },
  { key: "BD", label: "Kaset BD" },
];
const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e6) return `Rp ${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return rupiah(n);
};
const subOf = (p: ProdukJualan): SubKategoriJualan => (p.subcategory as SubKategoriJualan) || produkSubKategori(p.name);
const subDariKategori = (kat: string, item: string): SubKategoriJualan =>
  /konsol|unit/i.test(kat) ? "Unit PS" : /stik/i.test(kat) ? "Stik" : /bd/i.test(kat) ? "BD" : produkSubKategori(item);

type Data = Record<string, Record<string, StokItemValue>>;
type StokView = { n: number | null; tone: "habis" | "menipis" | "aman" | "belum" | "none" };

function stokView(r: StokRef | null | undefined, cats: StokKategori[], data: Data, minMap: Record<string, Record<string, number>>): StokView {
  if (!r || !refAda(r, cats)) return { n: null, tone: "none" };
  if (r.item === PILIH_SAAT_CHECKOUT) {
    const items = cats.find((c) => c.kategori === r.kategori)?.items || [];
    if (!items.some((it) => data?.[r.kategori]?.[it])) return { n: null, tone: "belum" };
    const n = items.reduce((s, it) => s + Math.max(0, Math.round(Number(data?.[r.kategori]?.[it]?.jumlah) || 0)), 0);
    return { n, tone: n > 0 ? "aman" : "habis" };
  }
  const v = data?.[r.kategori]?.[r.item];
  if (!v) return { n: null, tone: "belum" };
  const n = Math.max(0, Math.round(Number(v.jumlah) || 0));
  return { n, tone: statusOf(n, getMinStok(minMap, r.kategori, r.item)) };
}

const StokPill: React.FC<{ v: StokView }> = ({ v }) => {
  if (v.tone === "none") return <Pill tone="neutral" icon={<Link2Off className="w-3 h-3" />}>Tanpa stok</Pill>;
  if (v.tone === "belum") return <Pill tone="neutral">Stok ?</Pill>;
  const tone = v.tone === "habis" ? "negative" : v.tone === "menipis" ? "warning" : "neutral";
  return <Pill tone={tone} className="tabular-nums">{v.n === 0 ? "Habis" : `Stok ${v.n}`}</Pill>;
};

const Thumb: React.FC<{ url?: string; size?: number }> = ({ url, size = 44 }) => (
  <div className="shrink-0 rounded-field bg-fill border border-sep overflow-hidden flex items-center justify-center" style={{ width: size, height: size }}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Package className="w-5 h-5 text-label-3" />}
  </div>
);

type Filter = "semua" | SubKategoriJualan | "tanpaModal" | "konfirmasi" | "yatim";
type EditorInit = { produk: ProdukJualan | null; nama?: string; stokRef?: StokRef | null; sub?: SubKategoriJualan; kondisi?: Kondisi };

export default function InputStokJualan() {
  const { products: semuaProduk, loaded } = useProdukJualan();
  const [kondisi, setKondisi] = useState<Kondisi>("BARU");
  const kondisiCount = {
    BARU: semuaProduk.filter((p) => kondisiProduk(p) === "BARU").length,
    SEKEN: semuaProduk.filter((p) => kondisiProduk(p) === "SEKEN").length,
  };
  // Halaman Baru / Seken: semua ringkasan & daftar mengikuti kondisi terpilih
  const products = useMemo(() => semuaProduk.filter((p) => kondisiProduk(p) === kondisi), [semuaProduk, kondisi]);
  const { map: modalMap } = useModalProduk();
  const { list: stokMasukList, loading: loadingMasuk } = useSemuaStokMasuk();
  const { batches: psBonusBatches, loaded: fifoLoaded } = usePsBonusFifo();
  const { stokState, stokLoaded, masterLoaded, masterCategories } = useStokData();
  const minMap = useMinStok();
  const cats: StokKategori[] = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const data = (stokState?.jualan || {}) as Data;

  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");
  const [editor, setEditor] = useState<EditorInit | null>(null);
  // Barang tukar tambah dari POS yang menunggu konfirmasi stok
  const { list: menunggu, loading: loadingTukar } = useTukarTambah("MENUNGGU");
  const [konfirmasi, setKonfirmasi] = useState<TukarTambah | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  // Pulihkan otomatis peta jumlah stok jualan jika dokumen data/stok.jualan di server sempat kosong
  const [recoveryInfo, setRecoveryInfo] = useState<{ restoredItems: number; totalUnits: number } | null>(null);
  const recoveryTried = useRef(false);
  useEffect(() => {
    if (!loaded || !stokLoaded || !masterLoaded || recoveryTried.current || Object.keys(data).length > 0 || !semuaProduk.length) return;
    recoveryTried.current = true;
    pulihkanStokJualanDariRiwayat(semuaProduk)
      .then((r) => {
        if (r.restoredItems > 0) setRecoveryInfo(r);
      })
      .catch((e) => console.warn("Pemulihan stok dari riwayat gagal:", e));
  }, [loaded, stokLoaded, masterLoaded, data, semuaProduk]);

  // Produk lama yang belum pernah dihubungkan -> disinkron otomatis sekali
  const [syncInfo, setSyncInfo] = useState<{ linked: number; created: number } | null>(null);
  const syncTried = useRef(false);
  useEffect(() => {
    if (!loaded || !masterLoaded || syncTried.current || !semuaProduk.some((p) => p.stokRef === undefined)) return;
    syncTried.current = true;
    syncProdukKeStok(semuaProduk)
      .then((r) => { if (r.linked || r.created) setSyncInfo(r); })
      .catch((e) => console.warn("Sinkron produk ke stok gagal:", e));
  }, [loaded, masterLoaded, semuaProduk]);

  // Bersihkan produk "stik bonus Rp 0" lama dari katalog tanpa menyentuh stok fisik & riwayat nota
  const bonusCleanupTried = useRef(false);
  useEffect(() => {
    if (!loaded || bonusCleanupTried.current) return;
    if (!semuaProduk.some((p) => p.category === "JUALAN" && !(Number(p.price) > 0))) return;
    bonusCleanupTried.current = true;
    bersihkanProdukBonusLama(semuaProduk)
      .then((n) => {
        if (n > 0) showToast(`${n} produk bonus Rp 0 lama dibersihkan (stok & nota tetap utuh)`);
      })
      .catch((e) => console.warn("Bersihkan produk bonus Rp 0 gagal:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, semuaProduk]);

  // Seed batch PS Baru lama di stok_masuk yang belum tercatat ke data/ps_bonus_fifo
  const lastBackfillSig = useRef("");
  useEffect(() => {
    if (loadingMasuk || !stokLoaded || !fifoLoaded) return;
    const existingIds = new Set(psBonusBatches.map((b) => b.id));
    const missing = stokMasukList.filter((r) => r.qty > 0 && isUnitPsBaruRef(r) && !existingIds.has(r.id));
    if (!missing.length) return;
    const sig = missing.map((m) => `${m.id}:${m.qty}`).sort().join("|");
    if (sig === lastBackfillSig.current) return;
    lastBackfillSig.current = sig;
    sinkronBackfillPsBonusFifo(stokMasukList, data).catch((e) => console.warn("Backfill PS bonus FIFO gagal:", e));
  }, [loadingMasuk, stokLoaded, fifoLoaded, stokMasukList, psBonusBatches, data]);

  const modalOf = (id: string) => modalMap[id]?.hargaModal ?? null;

  // Barang di stok yang belum dipakai produk mana pun
  const yatim = useMemo(() => {
    if (!loaded || !masterLoaded) return [];
    const dipakai = new Set<string>();
    semuaProduk.forEach((p) => {
      const r = p.stokRef;
      if (!r) return;
      if (r.item === PILIH_SAAT_CHECKOUT) (cats.find((c) => c.kategori === r.kategori)?.items || []).forEach((it) => dipakai.add(`${r.kategori}||${it}`));
      else dipakai.add(kunciStok(r));
    });
    const out: StokRef[] = [];
    cats.forEach((c) => c.items.forEach((it) => {
      if (!dipakai.has(`${c.kategori}||${it}`) && kondisiStok(c.kategori, it, semuaProduk) === kondisi) out.push({ kategori: c.kategori, item: it });
    }));
    return out;
  }, [loaded, masterLoaded, semuaProduk, cats, kondisi]);

  // Nilai stok (modal) SELURUH barang jualan (baru + seken): dihitung dari batch pembelian terbaru per barang stok
  const nilaiStok = useMemo(
    () => hitungNilaiStokBatch(semuaProduk, cats, data, modalMap, stokMasukList),
    [semuaProduk, cats, data, modalMap, stokMasukList]
  );

  const tanpaModal = products.filter((p) => modalOf(p.id) === null);
  const tanpaModalSemua = semuaProduk.filter((p) => modalOf(p.id) === null);
  const stokBelum = useMemo(
    () =>
      products
        .filter((p) => stokView(p.stokRef, cats, data, minMap).tone === "belum")
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    [products, cats, data, minMap]
  );
  const lihatTanpaModal = () => {
    // Halaman ini kosong tapi halaman lain punya barang tanpa modal -> pindah ke sana
    if (!tanpaModal.length) {
      const lain: Kondisi = kondisi === "BARU" ? "SEKEN" : "BARU";
      if (tanpaModalSemua.some((p) => kondisiProduk(p) === lain)) setKondisi(lain);
    }
    setFilter("tanpaModal");
  };
  const q = cari.trim().toLowerCase();
  const list = useMemo(() => {
    let l = products;
    if (filter === "tanpaModal") l = tanpaModal;
    else if (filter !== "semua" && filter !== "yatim" && filter !== "konfirmasi") l = products.filter((p) => subOf(p) === filter);
    if (q) l = l.filter((p) => p.name.toLowerCase().includes(q));
    return [...l].sort((a, b) => a.name.localeCompare(b.name, "id"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, q, modalMap]);
  const grouped = useMemo(() => {
    if (filter !== "semua") return [{ key: "", items: list }];
    return SUBS.map((s) => ({ key: s.label, items: list.filter((p) => subOf(p) === s.key) })).filter((g) => g.items.length);
  }, [list, filter]);
  const yatimShown = yatim.filter((r) => !q || `${r.kategori} ${r.item}`.toLowerCase().includes(q));
  const menungguShown = menunggu.filter((t) => !q || `${t.nama} ${t.sn} ${t.noNota}`.toLowerCase().includes(q));
  const stokBelumShown = q ? stokBelum.filter((p) => p.name.toLowerCase().includes(q)) : stokBelum;
  const konfirmasiCount = menunggu.length + stokBelum.length;

  const chips: { key: Filter; label: string; n?: number; warn?: boolean }[] = [
    { key: "semua", label: "Semua", n: products.length },
    ...SUBS.map((s) => ({ key: s.key as Filter, label: s.label, n: products.filter((p) => subOf(p) === s.key).length })).filter((c) => c.n > 0 || filter === c.key),
    { key: "tanpaModal", label: "Tanpa modal", n: tanpaModal.length, warn: tanpaModal.length > 0 },
    { key: "konfirmasi", label: "Konfirmasi stok", n: konfirmasiCount, warn: konfirmasiCount > 0 },
    { key: "yatim", label: "Stok tanpa produk", n: yatim.length, warn: yatim.length > 0 },
  ];

  const renderProdukRow = (p: ProdukJualan) => {
    const stokQty =
      p.stokRef && p.stokRef.item !== PILIH_SAAT_CHECKOUT
        ? Math.max(0, Math.round(Number(data?.[p.stokRef.kategori]?.[p.stokRef.item]?.jumlah) || 0))
        : undefined;
    const ringModal = ringkasanModalAktifProduk(p.id, stokMasukList, stokQty, modalOf(p.id));
    const m = ringModal ? ringModal.modalSatuan : modalOf(p.id);
    const batchN = ringModal && ringModal.batches.length > 1 ? ringModal.batches.length : 0;
    const untung = m !== null ? p.price - m : null;
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => setEditor({ produk: p })}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-fill/40 active:bg-fill/70"
      >
        <Thumb url={p.imageUrl} />
        <div className="flex-1 min-w-0">
          <div className="text-subhead font-semibold text-label leading-snug line-clamp-2">{p.name}</div>
          <div className="text-footnote text-label-2 mt-0.5 flex flex-wrap gap-x-1.5 tabular-nums">
            <span>{rupiah(p.price)}</span>
            {m !== null ? (
              <>
                <span>· modal {batchN ? `rata ` : ""}{rupiah(m)}{batchN ? ` (${batchN} batch)` : ""}</span>
                <span className={untung! >= 0 ? "text-positive" : "text-negative"}>· {untung! >= 0 ? "+" : ""}{p.price > 0 ? Math.round((untung! / p.price) * 100) : 0}%</span>
              </>
            ) : (
              <span className="text-warning">· modal belum diisi</span>
            )}
          </div>
        </div>
        <StokPill v={stokView(p.stokRef, cats, data, minMap)} />
        <ChevronRight className="w-4 h-4 text-label-3 shrink-0" />
      </button>
    );
  };

  const [yatimTarget, setYatimTarget] = useState<StokRef | null>(null);
  const [yatimBusy, setYatimBusy] = useState(false);

  const hapusYatim = (r: StokRef) => setYatimTarget(r);
  const konfirmasiHapusYatim = async () => {
    if (!yatimTarget) return;
    setYatimBusy(true);
    try {
      await removeJualanItem(yatimTarget.kategori, yatimTarget.item);
      showToast("Barang dihapus dari stok");
      setYatimTarget(null);
    } catch (e: any) {
      showToast("Gagal menghapus: " + (e?.message || e));
    } finally {
      setYatimBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ringkasan seluruh barang jualan (baru + seken) */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { l: "Barang", v: String(semuaProduk.length), on: undefined },
          { l: "Nilai stok", v: rpShort(nilaiStok), on: undefined },
          { l: "Tanpa modal", v: String(tanpaModalSemua.length), on: tanpaModalSemua.length ? lihatTanpaModal : undefined, warn: tanpaModalSemua.length > 0 },
        ].map((x) => (
          <button
            key={x.l}
            type="button"
            onClick={x.on}
            disabled={!x.on}
            className={`rounded-tile apple-card ring-1 ring-edge shadow-card px-3.5 py-3 text-left transition disabled:cursor-default ${
              x.on ? "apple-tile-interactive active:scale-[0.98]" : ""
            }`}
          >
            <div className={`text-headline font-bold tabular-nums leading-none ${x.warn ? "text-warning" : "text-label"}`}>{x.v}</div>
            <div className="text-caption text-label-2 mt-1.5">{x.l}</div>
          </button>
        ))}
      </div>

      {/* Halaman Baru / Seken */}
      <KondisiSwitch value={kondisi} onChange={(k) => { setKondisi(k); setFilter("semua"); }} counts={kondisiCount} />

      {recoveryInfo && (
        <Notice tone="info">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 text-footnote leading-snug">
              Stok jualan berhasil dipulihkan dari riwayat log stok: {recoveryInfo.restoredItems} barang ({recoveryInfo.totalUnits} unit). Nilai stok &amp; hitungan fisik kembali sinkron.
            </p>
            <button type="button" onClick={() => setRecoveryInfo(null)} aria-label="Tutup" className="text-tint/70 hover:text-tint shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </Notice>
      )}

      {syncInfo && (
        <Notice tone="info">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 text-footnote leading-snug">
              Sinkron otomatis selesai: {syncInfo.linked} produk dihubungkan ke stok yang sudah ada{syncInfo.created ? `, ${syncInfo.created} barang baru ditambahkan ke stok (jumlahnya belum dihitung)` : ""}.
            </p>
            <button type="button" onClick={() => setSyncInfo(null)} aria-label="Tutup" className="text-tint/70 hover:text-tint shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </Notice>
      )}

      {menunggu.length > 0 && filter !== "konfirmasi" && (
        <button
          type="button"
          onClick={() => setFilter("konfirmasi")}
          className="w-full rounded-tile bg-tint/10 border border-tint/20 px-4 py-3 flex items-center gap-3 text-left transition-opacity active:opacity-75"
        >
          <ArrowLeftRight className="w-4 h-4 text-tint shrink-0" />
          <p className="flex-1 text-footnote leading-snug text-label">
            <b className="font-semibold">{menunggu.length} barang tukar tambah</b> menunggu konfirmasi stok
          </p>
          <ChevronRight className="w-4 h-4 text-tint/70 shrink-0" />
        </button>
      )}

      {/* Cari + tambah */}
      <div className="flex items-center gap-2">
        <SearchField value={cari} onChange={setCari} placeholder="Cari barang jualan" className="flex-1 min-w-0" />
        <Button variant="filled" size="md" icon={<Plus className="w-4 h-4" />} onClick={() => setEditor({ produk: null, kondisi })} className="shrink-0">
          Barang
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => {
          const aktif = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`shrink-0 hit-44 h-9 px-3.5 rounded-full text-footnote font-semibold border transition-colors ${
                aktif
                  ? "bg-action text-action-label border-action"
                  : "bg-surface text-label-2 hover:text-label border-sep"
              }`}
            >
              {c.label}
              {typeof c.n === "number" && (
                <span className={`ml-1.5 tabular-nums ${aktif ? "opacity-70" : c.warn ? "text-warning font-bold" : "text-label-3"}`}>{c.n}</span>
              )}
            </button>
          );
        })}
      </div>

      {!loaded || !stokLoaded || !masterLoaded ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-label-3" /></div>
      ) : filter === "konfirmasi" ? (
        <div className="space-y-4">
          {!loadingTukar && menungguShown.length === 0 && stokBelumShown.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title={q ? "Tidak ditemukan." : "Semua stok & tukar tambah sudah dikonfirmasi"}
            />
          ) : (
            <>
              {(loadingTukar || menungguShown.length > 0) && (
                <div className="space-y-1.5">
                  {stokBelumShown.length > 0 && (
                    <div className="px-2">
                      <Eyebrow>Tukar tambah dari kasir POS</Eyebrow>
                    </div>
                  )}
                  <DaftarKonfirmasiTukar list={menungguShown} loading={loadingTukar} onPilih={setKonfirmasi} />
                </div>
              )}

              {stokBelumShown.length > 0 && (
                <section className="space-y-1.5">
                  <div className="px-2">
                    <Eyebrow>Jumlah stok belum dihitung (Stok ?)</Eyebrow>
                  </div>
                  <Footnote className="px-1">
                    Produk ini sudah terhubung ke stok, tetapi jumlah fisiknya belum pernah dimasukkan. Ketuk produk untuk mengisi stok.
                  </Footnote>
                  <Card flush>
                    <div className="divide-y divide-sep">
                      {stokBelumShown.map(renderProdukRow)}
                    </div>
                  </Card>
                </section>
              )}
            </>
          )}
        </div>
      ) : filter === "yatim" ? (
        <section>
          <Footnote className="px-1 pb-2">Barang ini ada di stok tapi belum dijual di POS. Jadikan produk supaya punya harga &amp; muncul di kasir, atau hapus bila sudah tidak dipakai.</Footnote>
          <Card flush>
            {yatimShown.length === 0 ? (
              <EmptyState title="Semua barang stok sudah punya produk" />
            ) : (
              <div className="divide-y divide-sep">
                {yatimShown.map((r) => (
                  <div key={kunciStok(r)} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-subhead font-semibold text-label leading-snug">{r.item}</div>
                        <div className="text-caption text-label-2">{r.kategori}</div>
                      </div>
                      <StokPill v={stokView(r, cats, data, minMap)} />
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <Button
                        variant="tinted"
                        size="sm"
                        onClick={() => setEditor({ produk: null, nama: r.item, stokRef: r, sub: subDariKategori(r.kategori, r.item), kondisi: kondisiStok(r.kategori, r.item, semuaProduk) })}
                      >
                        Jadikan produk
                      </Button>
                      <Button variant="destructive" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => hapusYatim(r)}>
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={q ? "Tidak ditemukan." : filter === "tanpaModal" ? "Semua barang sudah punya harga modal" : "Belum ada barang."}
        />
      ) : (
        grouped.map((g) => (
          <section key={g.key || "list"}>
            {g.key && (
              <div className="px-2 pb-1.5">
                <Eyebrow>{g.key}</Eyebrow>
              </div>
            )}
            <Card flush>
              <div className="divide-y divide-sep">
                {g.items.map(renderProdukRow)}
              </div>
            </Card>
          </section>
        ))
      )}

      <Footnote className="px-1">
        Ini satu-satunya tempat menambah barang &amp; mengubah jumlah stok jualan. POS hanya menjual, menu Stok untuk memantau &amp; mengatur kategori. Harga modal hanya terlihat oleh owner &amp; super admin.
      </Footnote>

      <AlertDialog
        open={!!yatimTarget}
        onClose={() => !yatimBusy && setYatimTarget(null)}
        title={`Hapus "${yatimTarget?.item ?? ""}"?`}
        description={
          yatimTarget
            ? (() => {
                const n = Math.max(0, Math.round(Number(data?.[yatimTarget.kategori]?.[yatimTarget.item]?.jumlah) || 0));
                return `Akan dihapus dari stok ${yatimTarget.kategori}.${n > 0 ? ` Masih tercatat ${n} barang.` : ""} Riwayatnya tetap tersimpan.`;
              })()
            : undefined
        }
        icon={<Trash2 />}
        iconColor="red"
        dismissible={!yatimBusy}
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setYatimTarget(null), disabled: yatimBusy },
          { label: yatimBusy ? "Menghapus..." : "Hapus", role: "destructive", onClick: konfirmasiHapusYatim, disabled: yatimBusy },
        ]}
      />

      {editor && (
        <BarangJualanSheet
          init={editor}
          products={semuaProduk}
          modalMap={modalMap}
          psBonusBatches={psBonusBatches}
          cats={cats}
          data={data}
          minMap={minMap}
          onClose={() => setEditor(null)}
          onDone={(m) => { setEditor(null); showToast(m); }}
        />
      )}

      {konfirmasi && (
        <KonfirmasiTukarSheet
          tt={konfirmasi}
          products={semuaProduk}
          modalMap={modalMap}
          stokMasukList={stokMasukList}
          cats={cats}
          data={data}
          onClose={() => setKonfirmasi(null)}
          onDone={(m) => { setKonfirmasi(null); showToast(m); }}
        />
      )}

      <Toast
        open={Boolean(toast)}
        message={toast}
        tone={toast.startsWith("Gagal") ? "negative" : "positive"}
        onClose={() => setToast("")}
        zClassName="z-[400]"
      />
    </div>
  );
}

// ============================================================
// Lembar tambah / edit barang jualan
// ============================================================
const BarangJualanSheet: React.FC<{
  init: EditorInit;
  products: ProdukJualan[];
  modalMap: ModalMap;
  psBonusBatches: PsBonusBatch[];
  cats: StokKategori[];
  data: Data;
  minMap: Record<string, Record<string, number>>;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ init, products, modalMap, psBonusBatches, cats, data, minMap, onClose, onDone }) => {
  const p = init.produk;
  const modalAwal = p ? modalMap[p.id]?.hargaModal ?? null : null;
  // Unit PlayStation: seri diisi di kolom sendiri lalu otomatis masuk ke judul ("… 500GB SERI 21 - SEKEN")
  const namaAwal = p?.name || init.nama || "";
  const subAwal: SubKategoriJualan = p ? subOf(p) : init.sub || produkSubKategori(namaAwal);
  const seriAwal = produkPakaiSeri(namaAwal, subAwal) ? ambilSeri(namaAwal) : "";
  const [nama, setNama] = useState(seriAwal ? lepasSeri(namaAwal) : namaAwal);
  const [seri, setSeri] = useState(seriAwal);
  const [sub, setSub] = useState<SubKategoriJualan>(subAwal);
  const [subManual, setSubManual] = useState(!!p || !!init.sub);
  const [kondisiB, setKondisiB] = useState<Kondisi>(p ? kondisiProduk(p) : init.kondisi || "BARU");
  const [kondisiManual, setKondisiManual] = useState(!!p);
  const [jual, setJual] = useState(p ? String(p.price ?? "") : "");
  const [modal, setModal] = useState(modalAwal !== null ? String(modalAwal) : "");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>(p?.imageUrl || "");
  const [ref, setRef] = useState<StokRef | null | undefined>(p ? (p.stokRef === undefined ? undefined : p.stokRef) : init.stokRef !== undefined ? init.stokRef : undefined);
  const [qty, setQty] = useState(0);
  const [modalMasuk, setModalMasuk] = useState("");
  const [tanggal, setTanggal] = useState(toLocalYmd());
  const [catat, setCatat] = useState(true);
  const [varian, setVarian] = useState("");
  const [bonusQty, setBonusQty] = useState(0);
  const [bonusStikId, setBonusStikId] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmHapusOpen, setConfirmHapusOpen] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  // Koreksi jumlah (hitung fisik): satu barang stok, atau satu varian bila "pilih varian saat checkout"
  const [ubah, setUbah] = useState<{ item: string; nilai: string } | null>(null);
  const [busyStok, setBusyStok] = useState<string>("");
  const { logs } = useStokLog(300);

  useEffect(() => { if (!subManual) setSub(produkSubKategori(nama)); }, [nama, subManual]);
  // Nama mengandung "SEKEN" -> otomatis Seken (sampai dipilih manual)
  useEffect(() => { if (!kondisiManual && /\b(SEKEN|SECOND|BEKAS)\b|LIKE NEW/i.test(nama)) setKondisiB("SEKEN"); }, [nama, kondisiManual]);
  useEffect(() => () => { if (foto && fotoPreview.startsWith("blob:")) URL.revokeObjectURL(fotoPreview); }, [foto, fotoPreview]);

  const pakaiSeri = produkPakaiSeri(nama, sub);
  const namaFinal = pakaiSeri ? pasangSeri(nama, seri) : namaJualan(nama);
  const jualN = Number(jual || 0);
  const modalN = modal === "" ? null : Number(modal);
  const untung = modalN !== null && jualN > 0 ? jualN - modalN : null;
  const modalMasukN = modalMasuk === "" ? modalN || 0 : Number(modalMasuk);
  // 1 produk = 1 barang stok: barang milik produk lain tidak ikut dipakai / dipilih
  const produkLain = useMemo(() => products.filter((x) => x.id !== p?.id), [products, p?.id]);
  const dipakaiMap = useMemo(() => {
    const m: Record<string, string> = {};
    produkLain.forEach((x) => { if (x.stokRef && x.stokRef.item !== PILIH_SAAT_CHECKOUT) m[kunciStok(x.stokRef)] = x.name; });
    return m;
  }, [produkLain]);
  const preview = useMemo(() => (ref === undefined ? pratinjauOtomatis(namaFinal, sub, kondisiB, cats, produkLain) : null), [ref, namaFinal, sub, kondisiB, cats, produkLain]);
  const efektif = ref === undefined ? preview?.ref || null : ref;
  const isPsBaru = sub === "Unit PS" && kondisiB === "BARU";
  const stikList = useMemo(() => buildStikOpsi(products, cats, data), [products, cats, data]);
  const bonusSpec = isPsBaru && qty > 0 ? resolveBonusStikSpec(bonusQty, bonusStikId, stikList) : null;
  const sv = stokView(efektif, cats, data, minMap);
  const varianList = efektif?.item === PILIH_SAAT_CHECKOUT ? cats.find((c) => c.kategori === efektif.kategori)?.items || [] : [];
  // Produk lain yang menghitung barang stok yang sama (termasuk lewat "pilih varian saat checkout")
  const dipakaiLain = efektif ? produkLain.filter((x) => stokBeririsan(x.stokRef, efektif)) : [];
  // Barang stok yang sama persis dipakai produk lain = stok tercampur (bukan varian)
  const stokTercampur = !!efektif && efektif.item !== PILIH_SAAT_CHECKOUT && dipakaiLain.some((x) => x.stokRef?.item === efektif.item);

  // Riwayat stok masuk (catatan yang bisa diedit) + stok masuk lama dari menu Stok (hanya dilihat)
  // Catatan stok masuk menempel pada barang stoknya (termasuk dari produk lain / yang sudah dihapus)
  const { list: riwayatMasuk } = useStokMasuk(p?.id, p?.stokRef ?? null);
  const [editMasuk, setEditMasuk] = useState<StokMasuk | null>(null);
  const [semuaRiwayat, setSemuaRiwayat] = useState(false);
  const masukLain: StokLog[] =
    p && efektif
      ? logs
          .filter(
            (l) =>
              l.alasan === "masuk" && l.delta > 0 && !(l as any).stokMasukId && !(l.catatan || "").startsWith("Input Stok") &&
              l.kategori === efektif.kategori && (efektif.item === PILIH_SAAT_CHECKOUT || l.item === efektif.item)
          )
          .slice(0, 5)
      : [];
  const perVarian = efektif?.item === PILIH_SAAT_CHECKOUT;
  const barisJumlah = !efektif ? [] : perVarian ? varianList : [efektif.item];
  const jumlahDi = (item: string) => Math.max(0, Math.round(Number(data?.[efektif?.kategori || ""]?.[item]?.jumlah) || 0));
  const bisaUbahJumlah = !!p && !!efektif && ref !== undefined && refAda(efektif, cats) && barisJumlah.length > 0;
  useEffect(() => { setUbah(null); }, [efektif?.kategori, efektif?.item]);

  // Stok dikurangi padahal ada catatan stok masuk -> tanya: salah input (pengeluaran ikut) atau hilang/rusak?
  const [tanyaAlasan, setTanyaAlasan] = useState(false);
  useEffect(() => { setTanyaAlasan(false); }, [ubah?.item, ubah?.nilai]);
  const catatanItem = (item: string) => riwayatMasuk.filter((r) => r.kategori === efektif?.kategori && r.item === item);
  const kurangUbah = ubah ? jumlahDi(ubah.item) - Number(ubah.nilai || 0) : 0;
  const rencanaSalah = ubah && kurangUbah > 0 ? rencanaKurangiStokMasuk(catatanItem(ubah.item), kurangUbah) : null;

  const simpanJumlah = async (alasan?: "salah" | "hilang") => {
    if (!p || !efektif || !ubah) return;
    const target = { kategori: efektif.kategori, item: ubah.item };
    const n = Number(ubah.nilai || 0);
    if (!alasan && rencanaSalah && rencanaSalah.langkah.length) { setTanyaAlasan(true); return; }
    setBusyStok("jumlah"); setErr(""); setInfo("");
    const awal = perVarian ? `${ubah.item}: j` : "J";
    try {
      if (alasan === "salah") {
        const r = await kurangiStokMasukSalahInput(target, kurangUbah, p.name);
        setInfo(`${awal}umlah stok jadi ${n} · catatan stok masuk${r.rupiah ? ` & pengeluaran (−${rupiah(r.rupiah)})` : ""} ikut dikurangi ✓`);
      } else {
        await koreksiJumlahStok(target, n, p.name);
        setInfo(`${awal}umlah stok disamakan jadi ${n} ✓`);
      }
      setUbah(null);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusyStok(""); }
  };

  const pilihFoto = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("File harus berupa gambar."); return; }
    setFoto(f);
    setFotoPreview(URL.createObjectURL(f));
  };

  const simpan = async () => {
    setErr("");
    if (!namaFinal.trim()) return setErr("Nama barang wajib diisi.");
    if (jual === "" || !(jualN > 0)) return setErr("Harga jual wajib lebih dari Rp 0.");
    if (qty > 0 && varianList.length && !varian) return setErr("Pilih varian untuk stok masuk.");
    if (qty > 0 && ref === null) return setErr("Barang tidak dihubungkan ke stok, jadi stok masuk tidak bisa dicatat.");
    if (qty > 0 && isPsBaru && bonusQty > 0 && !bonusSpec) return setErr("Pilih stik di etalase untuk bonus paket PS Baru.");
    setSaving(true);
    try {
      const imageUrl = foto ? await uploadFotoProduk(foto) : p?.imageUrl || "";
      const jumlah = (r: StokRef) => data?.[r.kategori]?.[r.item]?.jumlah;
      const r = await simpanBarangJualan(
        { id: p?.id, nama: namaFinal, subkategori: sub, kondisi: kondisiB, hargaJual: jualN, hargaModal: modalN, imageUrl, stokRef: ref },
        p,
        products,
        modalAwal,
        jumlah,
        qty > 0
          ? { qty, modalSatuan: modalMasukN, tanggal, catatPengeluaran: catat, varian: varian || undefined, bonusStik: isPsBaru ? bonusSpec : undefined }
          : undefined
      );
      onDone(
        `${p ? "Perubahan disimpan" : "Barang ditambahkan"}${r.dibuat ? " · stok baru dibuat" : ""}${qty > 0 ? ` · stok +${qty}${catat && modalMasukN > 0 ? " · pengeluaran dicatat" : ""}` : ""}`
      );
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  const hapus = () => {
    if (!p) return;
    setConfirmHapusOpen(true);
  };

  const konfirmasiHapus = async () => {
    if (!p) return;
    setSaving(true);
    try {
      await hapusBarangJualan(p, products, (r) => data?.[r.kategori]?.[r.item]?.jumlah);
      setConfirmHapusOpen(false);
      onDone("Barang dihapus");
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
      setConfirmHapusOpen(false);
    }
  };

  const field = "w-full h-11 px-3.5 py-0 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35";
  const label = "block text-footnote font-medium text-label-2 mb-1.5 px-0.5";

  return (
    <>
      <Sheet
        open
        onClose={() => { if (!saving && !editMasuk && !confirmHapusOpen) onClose(); }}
        title={p ? "Edit Barang" : "Barang Baru"}
        size="md"
        headerRight={
          <Button variant="plain" size="sm" onClick={simpan} disabled={saving} loading={saving} className="font-semibold">
            Simpan
          </Button>
        }
      >
        <div className="space-y-5 pb-4">
          {/* Foto + nama */}
          <Card>
            <div className="flex gap-4 items-start">
              <label className="relative w-[84px] h-[84px] rounded-tile bg-fill border border-sep overflow-hidden flex items-center justify-center cursor-pointer shrink-0">
                {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-label-3" />}
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-caption2 font-medium text-center py-0.5">{fotoPreview ? "Ganti" : "Foto"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pilihFoto(e.target.files?.[0] || null)} />
              </label>
              <div className="flex-1 min-w-0">
                <span className={label}>Nama barang</span>
                <textarea
                  value={nama}
                  onChange={(e) => setNama(e.target.value.toUpperCase())}
                  rows={2}
                  placeholder="CONTOH: STIK PS4 BARU - HITAM"
                  autoCapitalize="characters"
                  className="w-full px-3 py-2 rounded-field bg-fill text-[16px] sm:text-subhead leading-snug text-label placeholder:text-label-3 resize-none focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
                />
              </div>
            </div>
          </Card>

          {/* Seri (khusus unit PlayStation) */}
          {pakaiSeri && (
            <div>
              <label htmlFor="seri-ps" className={label}>Seri PS</label>
              <input
                id="seri-ps"
                value={seri}
                onChange={(e) => setSeri(rapikanSeri(e.target.value))}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Contoh: 21 · kosongkan bila belum tahu"
                className={field}
              />
              <p className="mt-1.5 px-0.5 text-caption text-label-2 leading-snug">
                {rapikanSeri(seri)
                  ? <>Nama di kasir: <b className="font-semibold text-label">{namaFinal}</b></>
                  : "Seri otomatis masuk ke nama barang. Unit beda seri jadi produk sendiri supaya stoknya tidak tercampur."}
              </p>
            </div>
          )}

          {/* Kondisi */}
          <div>
            <span className={label}>Kondisi</span>
            <KondisiSwitch value={kondisiB} onChange={(k) => { setKondisiB(k); setKondisiManual(true); }} />
          </div>

          {/* Sub-kategori */}
          <div>
            <span className={label}>Kategori di kasir</span>
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
              {SUBS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setSub(s.key); setSubManual(true); }}
                  className={`shrink-0 hit-44 h-9 px-3.5 rounded-full text-footnote font-semibold border transition-colors ${
                    sub === s.key
                      ? "bg-action text-action-label border-action"
                      : "bg-surface text-label-2 hover:text-label border-sep"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harga */}
          <Card>
            <div className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <div>
                  <span className={label}>Harga jual</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                    <input inputMode="numeric" value={fmtDigits(jual)} onChange={(e) => setJual(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                  </div>
                </div>
                <div>
                  <span className={label}>Harga modal</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                    <input inputMode="numeric" value={fmtDigits(modal)} onChange={(e) => setModal(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                  </div>
                </div>
              </div>
              {untung !== null ? (
                <div className={`flex items-center justify-between rounded-field px-3 py-2 text-footnote ${untung >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                  <span>{untung >= 0 ? "Untung per barang" : "Rugi per barang"}</span>
                  <span className="font-semibold tabular-nums">{rupiah(Math.abs(untung))} · {Math.round((untung / jualN) * 100)}%</span>
                </div>
              ) : (
                <Footnote className="px-0.5">Isi harga modal supaya laba &amp; margin terhitung di Analitik Usaha. Harga modal tidak tampil di kasir.</Footnote>
              )}
            </div>
          </Card>

          {/* Barang stok */}
          <Card>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-footnote font-medium text-label-2 px-0.5">Hitungan stok</span>
                <StokPill v={sv} />
              </div>
              <StokRefSelect
                allowAuto
                value={ref}
                onChange={setRef}
                categories={cats}
                data={data}
                dipakai={dipakaiMap}
                className="w-full h-11 px-3 rounded-field bg-fill text-[16px] sm:text-subhead text-label focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
              />
              {ref === undefined && preview && (
                <Footnote className="px-0.5 leading-snug">
                  {preview.baru
                    ? <>Akan dibuat barang stok baru: <b className="text-label">{preview.ref.kategori} › {preview.ref.item}</b></>
                    : <>Akan memakai stok: <b className="text-label">{preview.ref.kategori} › {preview.ref.item === PILIH_SAAT_CHECKOUT ? "pilih varian saat checkout" : preview.ref.item}</b></>}
                </Footnote>
              )}
              {stokTercampur ? (
                <p className="flex items-start gap-1.5 text-caption text-warning px-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Stok ini juga dihitung untuk {dipakaiLain.map((x) => x.name).join(", ")}. Pilih Otomatis supaya produk ini punya stok sendiri.
                </p>
              ) : dipakaiLain.length > 0 ? (
                <Footnote className="px-0.5 leading-snug">Varian di kategori ini juga dijual sebagai: {dipakaiLain.map((x) => x.name).join(", ")}</Footnote>
              ) : null}
              {ref === null && <p className="text-caption text-warning px-0.5">Stok tidak akan berkurang saat barang ini terjual.</p>}
              {efektif && /\b(BARU|SEKEN)\b/.test(efektif.kategori) && !efektif.kategori.includes(kondisiB) && (
                <p className="flex items-start gap-1.5 text-caption text-warning px-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Kondisi {kondisiB === "SEKEN" ? "Seken" : "Baru"}, tapi stoknya dihitung di {efektif.kategori}. Pilih barang stok yang sesuai{ref !== undefined ? " atau pilih Otomatis" : ""}.
                </p>
              )}

              {bisaUbahJumlah && (
                <div className="pt-1">
                  {perVarian && <div className="px-0.5 pb-1.5 text-footnote font-medium text-label-2">Stok per varian</div>}
                  <div className={perVarian ? "rounded-field apple-tile border border-sep px-3 divide-y divide-sep" : ""}>
                    {barisJumlah.map((it) => {
                      const n = jumlahDi(it);
                      if (ubah?.item === it) {
                        return (
                          <div key={it} className={`flex items-center gap-2 ${perVarian ? "py-2" : ""}`}>
                            {perVarian && <span className="max-w-[28%] shrink-0 truncate text-subhead font-medium text-label">{it}</span>}
                            <input
                              autoFocus
                              inputMode="numeric"
                              aria-label={`Jumlah ${it}`}
                              value={ubah.nilai}
                              onChange={(e) => setUbah({ item: it, nilai: digits(e.target.value) })}
                              className={`flex-1 min-w-0 h-11 px-3.5 rounded-field ${perVarian ? "bg-surface border border-sep" : "bg-fill"} text-[16px] sm:text-subhead tabular-nums text-label focus:outline-none focus:ring-2 focus:ring-tint/35`}
                            />
                            <Button variant="gray" size="sm" onClick={() => setUbah(null)} className="shrink-0">Batal</Button>
                            <Button variant="filled" size="sm" disabled={busyStok === "jumlah" || tanyaAlasan} loading={busyStok === "jumlah"} onClick={() => simpanJumlah()} className="shrink-0">
                              Simpan
                            </Button>
                          </div>
                        );
                      }
                      return perVarian ? (
                        <div key={it} className="flex items-center gap-3 py-2.5">
                          <span className="flex-1 min-w-0 truncate text-subhead text-label">{it}</span>
                          <span className={`text-subhead font-semibold tabular-nums ${n > 0 ? "text-label" : "text-label-3"}`}>{n}</span>
                          <Button variant="plain" size="sm" onClick={() => setUbah({ item: it, nilai: String(n) })} className="shrink-0">Ubah</Button>
                        </div>
                      ) : (
                        <div key={it} className="flex items-center justify-between gap-3 px-0.5">
                          <span className="text-subhead text-label-2">Jumlah sekarang <b className="tabular-nums text-label">{n}</b></span>
                          <Button variant="plain" size="sm" onClick={() => setUbah({ item: it, nilai: String(n) })}>Ubah jumlah</Button>
                        </div>
                      );
                    })}
                  </div>
                  {ubah !== null && tanyaAlasan && rencanaSalah && (
                    <div className="mt-2 rounded-field apple-tile border border-sep p-3 space-y-2">
                      <div className="px-0.5 text-footnote font-semibold text-label">Stok {ubah.item} berkurang {kurangUbah}. Kenapa?</div>
                      <button
                        type="button"
                        disabled={busyStok === "jumlah"}
                        onClick={() => simpanJumlah("salah")}
                        className="w-full text-left rounded-field bg-surface border border-sep px-3.5 py-3 active:opacity-75 disabled:opacity-50"
                      >
                        <div className="text-subhead font-semibold text-label">Salah input stok masuk</div>
                        <div className="text-caption text-label-2 leading-snug mt-0.5">
                          Mis. barang yang sama tercatat dua kali. Catatan stok masuk terbaru{rencanaSalah.rupiah ? <> &amp; pengeluaran <b className="text-negative">−{rupiah(rencanaSalah.rupiah)}</b></> : ""} ikut dikurangi.
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busyStok === "jumlah"}
                        onClick={() => simpanJumlah("hilang")}
                        className="w-full text-left rounded-field bg-surface border border-sep px-3.5 py-3 active:opacity-75 disabled:opacity-50"
                      >
                        <div className="text-subhead font-semibold text-label">Hilang, rusak, atau terpakai</div>
                        <div className="text-caption text-label-2 leading-snug mt-0.5">Barangnya memang dibeli. Pengeluaran tetap, hanya jumlah stok yang dikoreksi.</div>
                      </button>
                      {busyStok === "jumlah" && <div className="flex justify-center py-1"><Loader2 className="w-4 h-4 animate-spin text-label-3" /></div>}
                    </div>
                  )}
                  {ubah !== null && !tanyaAlasan && (
                    <Footnote className="mt-1.5 px-0.5">Samakan dengan hitungan fisik. Barang baru dibeli? Pakai “Stok masuk” supaya pengeluarannya tercatat.</Footnote>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Stok masuk */}
          {ref !== null && (
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-subhead font-semibold text-label">Stok masuk</div>
                    <div className="text-caption text-label-2">Barang baru datang / dibeli</div>
                  </div>
                  <div className="flex items-center gap-1 bg-fill rounded-full p-1">
                    <button
                      type="button"
                      aria-label="Kurangi"
                      onClick={() => setQty((n) => Math.max(0, n - 1))}
                      className="w-9 hit-44 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/60 active:bg-surface transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      inputMode="numeric"
                      value={qty || ""}
                      onChange={(e) => setQty(Math.min(9999, Number(digits(e.target.value) || 0)))}
                      placeholder="0"
                      className="w-10 bg-transparent text-center text-headline font-semibold tabular-nums text-label focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Tambah"
                      onClick={() => setQty((n) => Math.min(9999, n + 1))}
                      className="w-9 hit-44 h-9 rounded-full flex items-center justify-center text-label hover:bg-surface/60 active:bg-surface transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {qty > 0 && (
                  <div className="space-y-3 pt-1">
                    {varianList.length > 0 && (
                      <select
                        value={varian}
                        onChange={(e) => setVarian(e.target.value)}
                        className={`${field} ${varian ? "" : "ring-1 ring-warning"}`}
                      >
                        <option value="">Pilih varian…</option>
                        {varianList.map((v) => <option key={v} value={v}>{v} (sisa {Math.max(0, Math.round(Number(data?.[efektif!.kategori]?.[v]?.jumlah) || 0))})</option>)}
                      </select>
                    )}
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <div>
                        <span className={label}>Modal / barang</span>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                          <input inputMode="numeric" value={fmtDigits(modalMasuk === "" ? String(modalN ?? "") : modalMasuk)} onChange={(e) => setModalMasuk(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                        </div>
                      </div>
                      <div>
                        <span className={label}>Tanggal beli</span>
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value || toLocalYmd())} className={`${field} custom-date-input tabular-nums`} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="min-w-0">
                        <div className="text-subhead text-label">Catat ke Pengeluaran</div>
                        <div className="text-caption text-label-2">Kategori “{KATEGORI_PENGELUARAN_STOK}” · {rupiah(modalMasukN * qty)}</div>
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
                        suggestion={riwayatMasuk.find((x) => x.bonusStik && x.bonusStik.qty > 0)?.bonusStik || null}
                      />
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Riwayat stok masuk */}
          {p && (
            <Card
              title="Riwayat stok masuk"
              icon={<History className="w-4 h-4" />}
              iconColor="gray"
              accessory={
                riwayatMasuk.length > 0 ? (
                  <span className="text-caption text-label-2 tabular-nums">
                    {riwayatMasuk.reduce((s, r) => s + r.qty, 0)} barang · {riwayatMasuk.length}×
                  </span>
                ) : undefined
              }
            >
              {riwayatMasuk.length === 0 && masukLain.length === 0 && (
                <Footnote className="py-1">Belum ada stok masuk.</Footnote>
              )}
              <div className="divide-y divide-sep">
                {(semuaRiwayat ? riwayatMasuk : riwayatMasuk.slice(0, 5)).map((r) => {
                  const [y, m, d] = r.tanggal.split("-").map(Number);
                  const tgl = y ? new Date(y, m - 1, d) : new Date(r.ts);
                  const fifoRec = psBonusBatches.find((b) => b.id === r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => setEditMasuk(r)} className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-70">
                      <div className="w-11 shrink-0 rounded-control bg-surface-2 border border-sep py-1.5 text-center leading-none">
                        <div className="text-subhead font-semibold tabular-nums text-label">{tgl.getDate()}</div>
                        <div className="text-caption2 text-label-2 mt-0.5">{tgl.toLocaleDateString("id-ID", { month: "short" })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-subhead text-label"><b className="text-positive tabular-nums">+{r.qty}</b> {r.item}</div>
                        <div className="text-caption text-label-2 truncate">
                          {r.modalSatuan > 0 ? `${rupiah(r.modalSatuan)}/pcs · total ${rupiah(r.modalSatuan * r.qty)}` : "Tanpa harga modal"}
                          {r.catatPengeluaran ? " · masuk pengeluaran" : ""}
                          {r.sumber === "TUKAR_TAMBAH" ? ` · tukar tambah ${r.noNota || ""}` : ""}
                        </div>
                        {(r.bonusStik?.qty || (isUnitPsBaruRef(r) && fifoRec)) && (
                          <div className={`text-caption2 truncate ${r.bonusStik?.qty ? "text-tint font-medium" : "text-label-3"}`}>
                            {r.bonusStik && r.bonusStik.qty > 0
                              ? `Bonus ${r.bonusStik.qty}× ${r.bonusStik.produkNama}`
                              : "Tanpa bonus stik"}
                            {fifoRec ? ` · sisa batch ${fifoRec.rem}/${fifoRec.qtyAwal}` : ""}
                          </div>
                        )}
                        {r.produkId !== p.id && (
                          <div className="text-caption2 text-warning truncate">
                            dari {r.produkNama || "produk lain"}{products.some((x) => x.id === r.produkId) ? "" : " · produk sudah dihapus"}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-label-3 shrink-0" />
                    </button>
                  );
                })}
                {masukLain.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 py-2.5 opacity-75">
                    <div className="w-11 shrink-0 rounded-control bg-surface-2 border border-sep py-1.5 text-center leading-none">
                      <div className="text-subhead font-semibold tabular-nums text-label">{new Date(l.ts).getDate()}</div>
                      <div className="text-caption2 text-label-2 mt-0.5">{new Date(l.ts).toLocaleDateString("id-ID", { month: "short" })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-subhead text-label"><b className="tabular-nums">+{l.delta}</b> {l.item}</div>
                      <div className="text-caption text-label-2 truncate">Dari menu Stok{l.catatan ? ` · ${l.catatan}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
              {riwayatMasuk.length > 5 && (
                <div className="pt-1">
                  <Button variant="plain" size="sm" onClick={() => setSemuaRiwayat((v) => !v)}>
                    {semuaRiwayat ? "Tampilkan lebih sedikit" : `Tampilkan semua (${riwayatMasuk.length})`}
                  </Button>
                </div>
              )}
              {riwayatMasuk.length > 0 && (
                <Footnote className="mt-1">Ketuk untuk mengubah jumlah, modal, tanggal, atau menghapus. Stok &amp; pengeluaran ikut menyesuaikan.</Footnote>
              )}
            </Card>
          )}

          {info && <Notice tone="info">{info}</Notice>}
          {err && <Notice tone="negative">{err}</Notice>}

          <div className="space-y-2 pt-1">
            <Button variant="filled" size="lg" block loading={saving} disabled={saving} onClick={simpan}>
              {p ? "Simpan perubahan" : "Tambah barang"}
            </Button>
            {p && (
              <Button variant="destructive" size="md" block disabled={saving} onClick={hapus}>
                Hapus barang
              </Button>
            )}
          </div>
        </div>
      </Sheet>

      {editMasuk && p && (
        <StokMasukSheet
          rec={editMasuk}
          produkNama={editMasuk.produkId === p.id ? nama.trim() || p.name : editMasuk.produkNama}
          produkDihapus={!products.some((x) => x.id === editMasuk.produkId)}
          onClose={() => setEditMasuk(null)}
          onDone={(m) => { setEditMasuk(null); setErr(""); setInfo(m); }}
        />
      )}

      <AlertDialog
        open={confirmHapusOpen}
        onClose={() => !saving && setConfirmHapusOpen(false)}
        title={`Hapus "${p?.name ?? ""}"?`}
        description="Produk akan hilang dari daftar jualan & POS. Riwayat penjualan & laporan laba tetap tersimpan."
        icon={<Trash2 />}
        iconColor="red"
        dismissible={!saving}
        zClassName="z-[320]"
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setConfirmHapusOpen(false), disabled: saving },
          { label: saving ? "Menghapus..." : "Hapus", role: "destructive", onClick: konfirmasiHapus, disabled: saving },
        ]}
      />
    </>
  );
};

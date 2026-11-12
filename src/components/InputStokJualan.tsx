import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, X, ChevronRight, Camera, Package, Sparkles, Trash2, Loader2, AlertTriangle, Link2Off, RotateCcw } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import useStokData from "../hooks/useStokData";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { toLocalYmd } from "../lib/dateLocal";
import { getMinStok, removeJualanItem, statusOf, StokLog, useMinStok, useStokLog } from "../lib/stokJualan";
import { PILIH_SAAT_CHECKOUT, produkSubKategori, StokRef, SubKategoriJualan, syncProdukKeStok } from "../lib/posSales";
import {
  catatanStokMasuk, hapusBarangJualan, KATEGORI_PENGELUARAN_STOK, koreksiJumlahStok, ModalMap, pratinjauOtomatis, ProdukJualan, simpanBarangJualan,
  uploadFotoProduk, urungkanStokMasuk, useModalProduk,
} from "../lib/barangJualan";
import { refAda, StokRefSelect } from "./StokRefSelect";

const SUBS: { key: SubKategoriJualan; label: string }[] = [
  { key: "Unit PS", label: "Unit PS" },
  { key: "Stik", label: "Stik" },
  { key: "Hardisk", label: "Hardisk" },
  { key: "Aksesoris", label: "Aksesoris" },
  { key: "BD", label: "Kaset BD" },
];
const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e6) return `Rp ${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return rp(n);
};
const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const fmtDigits = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");
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
  if (v.tone === "none") return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-zinc-400"><Link2Off className="w-3.5 h-3.5" />Tanpa stok</span>;
  if (v.tone === "belum") return <span className="px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400">Stok ?</span>;
  const c = v.tone === "habis" ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400" : v.tone === "menipis" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" : "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200";
  return <span className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold tabular-nums ${c}`}>{v.n === 0 ? "Habis" : `Stok ${v.n}`}</span>;
};

const Thumb: React.FC<{ url?: string; size?: number }> = ({ url, size = 44 }) => (
  <div className="shrink-0 rounded-[12px] bg-zinc-100 dark:bg-white/10 overflow-hidden flex items-center justify-center" style={{ width: size, height: size }}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Package className="w-5 h-5 text-zinc-400" />}
  </div>
);

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`relative w-[51px] h-[31px] rounded-full transition-colors shrink-0 ${on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}>
    <span className={`absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
  </button>
);

type Filter = "semua" | SubKategoriJualan | "tanpaModal" | "yatim";
type EditorInit = { produk: ProdukJualan | null; nama?: string; stokRef?: StokRef | null; sub?: SubKategoriJualan };

export default function InputStokJualan() {
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
  const { map: modalMap } = useModalProduk();
  const { stokState, masterCategories } = useStokData();
  const minMap = useMinStok();
  const cats: StokKategori[] = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const data = (stokState?.jualan || {}) as Data;

  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");
  const [editor, setEditor] = useState<EditorInit | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  // Produk lama yang belum pernah dihubungkan -> disinkron otomatis sekali
  const [syncInfo, setSyncInfo] = useState<{ linked: number; created: number } | null>(null);
  const syncTried = useRef(false);
  useEffect(() => {
    if (!loaded || syncTried.current || !products.some((p) => p.stokRef === undefined)) return;
    syncTried.current = true;
    syncProdukKeStok(products)
      .then((r) => { if (r.linked || r.created) setSyncInfo(r); })
      .catch((e) => console.warn("Sinkron produk ke stok gagal:", e));
  }, [loaded, products]);

  const modalOf = (id: string) => modalMap[id]?.hargaModal ?? null;

  // Barang di stok yang belum dipakai produk mana pun
  const yatim = useMemo(() => {
    const dipakai = new Set<string>();
    products.forEach((p) => {
      const r = p.stokRef;
      if (!r) return;
      if (r.item === PILIH_SAAT_CHECKOUT) (cats.find((c) => c.kategori === r.kategori)?.items || []).forEach((it) => dipakai.add(`${r.kategori}||${it}`));
      else dipakai.add(`${r.kategori}||${r.item}`);
    });
    const out: StokRef[] = [];
    cats.forEach((c) => c.items.forEach((it) => { if (!dipakai.has(`${c.kategori}||${it}`)) out.push({ kategori: c.kategori, item: it }); }));
    return out;
  }, [products, cats]);

  // Nilai stok (modal): jumlah barang x rata-rata modal produk yang memakainya
  const nilaiStok = useMemo(() => {
    const per = new Map<string, number[]>();
    products.forEach((p) => {
      const m = modalOf(p.id);
      const r = p.stokRef;
      if (m === null || !r) return;
      const items = r.item === PILIH_SAAT_CHECKOUT ? cats.find((c) => c.kategori === r.kategori)?.items || [] : [r.item];
      items.forEach((it) => per.set(`${r.kategori}||${it}`, [...(per.get(`${r.kategori}||${it}`) || []), m]));
    });
    let total = 0;
    per.forEach((ms, k) => {
      const [kat, it] = k.split("||");
      const n = Math.max(0, Math.round(Number(data?.[kat]?.[it]?.jumlah) || 0));
      total += n * (ms.reduce((a, b) => a + b, 0) / ms.length);
    });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, modalMap, cats, data]);

  const tanpaModal = products.filter((p) => modalOf(p.id) === null);
  const q = cari.trim().toLowerCase();
  const list = useMemo(() => {
    let l = products;
    if (filter === "tanpaModal") l = tanpaModal;
    else if (filter !== "semua" && filter !== "yatim") l = products.filter((p) => subOf(p) === filter);
    if (q) l = l.filter((p) => p.name.toLowerCase().includes(q));
    return [...l].sort((a, b) => a.name.localeCompare(b.name, "id"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, q, modalMap]);
  const grouped = useMemo(() => {
    if (filter !== "semua") return [{ key: "", items: list }];
    return SUBS.map((s) => ({ key: s.label, items: list.filter((p) => subOf(p) === s.key) })).filter((g) => g.items.length);
  }, [list, filter]);
  const yatimShown = yatim.filter((r) => !q || `${r.kategori} ${r.item}`.toLowerCase().includes(q));

  const chips: { key: Filter; label: string; n?: number; warn?: boolean }[] = [
    { key: "semua", label: "Semua", n: products.length },
    ...SUBS.map((s) => ({ key: s.key as Filter, label: s.label, n: products.filter((p) => subOf(p) === s.key).length })),
    { key: "tanpaModal", label: "Tanpa modal", n: tanpaModal.length, warn: tanpaModal.length > 0 },
    { key: "yatim", label: "Stok tanpa produk", n: yatim.length, warn: yatim.length > 0 },
  ];

  const hapusYatim = async (r: StokRef) => {
    const n = Math.max(0, Math.round(Number(data?.[r.kategori]?.[r.item]?.jumlah) || 0));
    if (!confirm(`Hapus "${r.item}" dari stok ${r.kategori}?${n > 0 ? `\nMasih tercatat ${n} barang.` : ""}\nRiwayatnya tetap tersimpan.`)) return;
    try { await removeJualanItem(r.kategori, r.item); showToast("Barang dihapus dari stok"); }
    catch (e: any) { alert("Gagal menghapus: " + (e?.message || e)); }
  };

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Barang", v: String(products.length), on: undefined },
          { l: "Nilai stok", v: rpShort(nilaiStok), on: undefined },
          { l: "Tanpa modal", v: String(tanpaModal.length), on: () => setFilter("tanpaModal"), warn: tanpaModal.length > 0 },
        ].map((x) => (
          <button key={x.l} type="button" onClick={x.on} disabled={!x.on}
            className="rounded-[18px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/70 dark:border-white/5 px-3 py-3 text-left disabled:cursor-default">
            <div className={`text-[17px] font-bold tabular-nums tracking-tight leading-none ${x.warn ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white"}`}>{x.v}</div>
            <div className="text-[11.5px] text-zinc-500 mt-1.5">{x.l}</div>
          </button>
        ))}
      </div>

      {syncInfo && (
        <div className="rounded-[18px] bg-blue-50 dark:bg-blue-500/10 px-4 py-3 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="flex-1 text-[13px] leading-snug text-blue-900 dark:text-blue-100">
            Sinkron otomatis selesai: {syncInfo.linked} produk dihubungkan ke stok yang sudah ada{syncInfo.created ? `, ${syncInfo.created} barang baru ditambahkan ke stok (jumlahnya belum dihitung)` : ""}.
          </p>
          <button type="button" onClick={() => setSyncInfo(null)} aria-label="Tutup" className="text-blue-700/60 dark:text-blue-300/60"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Cari + tambah */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 h-11 px-3.5 rounded-[14px] bg-zinc-200/60 dark:bg-white/10">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang jualan" className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          {cari && <button type="button" onClick={() => setCari("")} aria-label="Hapus pencarian"><X className="w-4 h-4 text-zinc-400" /></button>}
        </div>
        <button type="button" onClick={() => setEditor({ produk: null })}
          className="h-11 pl-3 pr-4 rounded-[14px] bg-blue-600 text-white text-[15px] font-semibold flex items-center gap-1.5 active:opacity-80 shrink-0">
          <Plus className="w-[18px] h-[18px]" />Barang
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => setFilter(c.key)}
            className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-colors ${filter === c.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-[#1c1c1e] text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-white/5"}`}>
            {c.label}
            {typeof c.n === "number" && <span className={`ml-1.5 ${filter === c.key ? "opacity-60" : c.warn ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>{c.n}</span>}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : filter === "yatim" ? (
        <section>
          <p className="px-1 pb-2 text-[12.5px] text-zinc-500 leading-snug">Barang ini ada di stok tapi belum dijual di POS. Jadikan produk supaya punya harga & muncul di kasir, atau hapus bila sudah tidak dipakai.</p>
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/70 dark:border-white/5 overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
            {yatimShown.length === 0 && <div className="py-10 text-center text-[14px] text-zinc-500">Semua barang stok sudah punya produk 👍</div>}
            {yatimShown.map((r) => (
              <div key={`${r.kategori}||${r.item}`} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-snug">{r.item}</div>
                    <div className="text-[12px] text-zinc-500">{r.kategori}</div>
                  </div>
                  <StokPill v={stokView(r, cats, data, minMap)} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => setEditor({ produk: null, nama: r.item, stokRef: r, sub: subDariKategori(r.kategori, r.item) })}
                    className="h-8 px-3.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 text-[13px] font-semibold">Jadikan produk</button>
                  <button type="button" onClick={() => hapusYatim(r)} className="h-8 px-3 rounded-full text-[13px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : list.length === 0 ? (
        <div className="py-14 text-center">
          <Package className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-[14px] text-zinc-500">{q ? "Tidak ditemukan." : filter === "tanpaModal" ? "Semua barang sudah punya harga modal 👍" : "Belum ada barang."}</p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.key || "list"}>
            {g.key && <h3 className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-zinc-500">{g.key}</h3>}
            <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/70 dark:border-white/5 overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
              {g.items.map((p) => {
                const m = modalOf(p.id);
                const untung = m !== null ? p.price - m : null;
                return (
                  <button key={p.id} type="button" onClick={() => setEditor({ produk: p })} className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-zinc-50 dark:active:bg-white/5">
                    <Thumb url={p.imageUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{p.name}</div>
                      <div className="text-[12.5px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-1.5 tabular-nums">
                        <span>{rp(p.price)}</span>
                        {m !== null ? (
                          <>
                            <span>· modal {rp(m)}</span>
                            <span className={untung! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}>· {untung! >= 0 ? "+" : ""}{p.price > 0 ? Math.round((untung! / p.price) * 100) : 0}%</span>
                          </>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">· modal belum diisi</span>
                        )}
                      </div>
                    </div>
                    <StokPill v={stokView(p.stokRef, cats, data, minMap)} />
                    <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      <p className="px-1 text-[12px] text-zinc-400 leading-snug">
        Ini satu-satunya tempat menambah & mengubah barang jualan. POS hanya menjual, menu Stok hanya menghitung jumlah. Harga modal hanya terlihat oleh owner & super admin.
      </p>

      {editor && (
        <BarangJualanSheet
          init={editor}
          products={products}
          modalMap={modalMap}
          cats={cats}
          data={data}
          minMap={minMap}
          onClose={() => setEditor(null)}
          onDone={(m) => { setEditor(null); showToast(m); }}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(24px+env(safe-area-inset-bottom))] z-[400] px-4 py-2.5 rounded-full bg-zinc-900/90 dark:bg-white/90 text-white dark:text-zinc-900 text-[14px] font-medium shadow-lg backdrop-blur max-w-[90vw] text-center">
          {toast}
        </div>
      )}
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
  cats: StokKategori[];
  data: Data;
  minMap: Record<string, Record<string, number>>;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ init, products, modalMap, cats, data, minMap, onClose, onDone }) => {
  useBodyScrollLock(true);
  const p = init.produk;
  const modalAwal = p ? modalMap[p.id]?.hargaModal ?? null : null;
  const [nama, setNama] = useState(p?.name || init.nama || "");
  const [sub, setSub] = useState<SubKategoriJualan>(p ? subOf(p) : init.sub || produkSubKategori(init.nama || ""));
  const [subManual, setSubManual] = useState(!!p || !!init.sub);
  const [jual, setJual] = useState(p ? String(p.price || "") : "");
  const [modal, setModal] = useState(modalAwal !== null ? String(modalAwal) : "");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>(p?.imageUrl || "");
  const [ref, setRef] = useState<StokRef | null | undefined>(p ? (p.stokRef === undefined ? undefined : p.stokRef) : init.stokRef !== undefined ? init.stokRef : undefined);
  const [qty, setQty] = useState(0);
  const [modalMasuk, setModalMasuk] = useState("");
  const [tanggal, setTanggal] = useState(toLocalYmd());
  const [catat, setCatat] = useState(true);
  const [varian, setVarian] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [ubahJumlah, setUbahJumlah] = useState<string | null>(null);
  const [busyStok, setBusyStok] = useState<string>("");
  const { logs } = useStokLog(300);

  useEffect(() => { if (!subManual) setSub(produkSubKategori(nama)); }, [nama, subManual]);
  useEffect(() => () => { if (foto && fotoPreview.startsWith("blob:")) URL.revokeObjectURL(fotoPreview); }, [foto, fotoPreview]);

  const jualN = Number(jual || 0);
  const modalN = modal === "" ? null : Number(modal);
  const untung = modalN !== null && jualN > 0 ? jualN - modalN : null;
  const modalMasukN = modalMasuk === "" ? modalN || 0 : Number(modalMasuk);
  const preview = useMemo(() => (ref === undefined ? pratinjauOtomatis(nama, sub, cats) : null), [ref, nama, sub, cats]);
  const efektif = ref === undefined ? preview?.ref || null : ref;
  const sv = stokView(efektif, cats, data, minMap);
  const varianList = efektif?.item === PILIH_SAAT_CHECKOUT ? cats.find((c) => c.kategori === efektif.kategori)?.items || [] : [];
  const dipakaiLain = efektif && efektif.item !== PILIH_SAAT_CHECKOUT ? products.filter((x) => x.id !== p?.id && x.stokRef && x.stokRef.kategori === efektif.kategori && x.stokRef.item === efektif.item) : [];

  // Stok masuk dari Input Stok untuk barang ini (7 hari terakhir) -> bisa diurungkan
  const masukTerakhir: StokLog[] = p
    ? logs.filter((l) => l.alasan === "masuk" && !l.diurungkan && l.delta > 0 && Date.now() - l.ts < 7 * 86400000 && ((l.catatan || "") === catatanStokMasuk(p.name) || (l.catatan || "").startsWith(catatanStokMasuk(p.name) + " ·"))).slice(0, 5)
    : [];
  const jumlahSekarang = efektif && efektif.item !== PILIH_SAAT_CHECKOUT ? Math.max(0, Math.round(Number(data?.[efektif.kategori]?.[efektif.item]?.jumlah) || 0)) : null;
  const bisaUbahJumlah = !!p && !!efektif && efektif.item !== PILIH_SAAT_CHECKOUT && ref !== undefined;

  const urungkan = async (l: StokLog) => {
    if (!p) return;
    if (!confirm(`Urungkan stok masuk +${l.delta} (${l.item})?\nStok dikurangi lagi & pengeluaran "${KATEGORI_PENGELUARAN_STOK}"-nya ikut dihapus.`)) return;
    setBusyStok(l.id); setErr(""); setInfo("");
    try {
      const r = await urungkanStokMasuk(l, p.id);
      setInfo(`Stok masuk diurungkan (−${l.delta})${r.pengeluaranDihapus ? " & pengeluarannya dihapus" : ""} ✓`);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusyStok(""); }
  };
  const simpanJumlah = async () => {
    if (!p || !efektif || ubahJumlah === null) return;
    setBusyStok("jumlah"); setErr(""); setInfo("");
    try {
      await koreksiJumlahStok(efektif, Number(ubahJumlah || 0), p.name);
      setInfo(`Jumlah stok disamakan jadi ${Number(ubahJumlah || 0)} ✓`);
      setUbahJumlah(null);
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
    if (!nama.trim()) return setErr("Nama barang wajib diisi.");
    if (!(jualN > 0)) return setErr("Harga jual wajib diisi.");
    if (qty > 0 && varianList.length && !varian) return setErr("Pilih varian untuk stok masuk.");
    if (qty > 0 && ref === null) return setErr("Barang tidak dihubungkan ke stok, jadi stok masuk tidak bisa dicatat.");
    setSaving(true);
    try {
      const imageUrl = foto ? await uploadFotoProduk(foto) : p?.imageUrl || "";
      const jumlah = (r: StokRef) => data?.[r.kategori]?.[r.item]?.jumlah;
      const r = await simpanBarangJualan(
        { id: p?.id, nama, subkategori: sub, hargaJual: jualN, hargaModal: modalN, imageUrl, stokRef: ref },
        p,
        products,
        modalAwal,
        jumlah,
        qty > 0 ? { qty, modalSatuan: modalMasukN, tanggal, catatPengeluaran: catat, varian: varian || undefined } : undefined
      );
      onDone(
        `${p ? "Perubahan disimpan" : "Barang ditambahkan"}${r.dibuat ? " · stok baru dibuat" : ""}${qty > 0 ? ` · stok +${qty}${catat && modalMasukN > 0 ? " · pengeluaran dicatat" : ""}` : ""}`
      );
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  const hapus = async () => {
    if (!p) return;
    if (!confirm(`Hapus "${p.name}" dari daftar jualan?\nProduk hilang dari POS. Riwayat penjualan & laporan laba tetap tersimpan.`)) return;
    setSaving(true);
    try {
      await hapusBarangJualan(p, products, (r) => data?.[r.kategori]?.[r.item]?.jumlah);
      onDone("Barang dihapus");
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  const field = "w-full h-12 px-4 rounded-[14px] bg-zinc-100 dark:bg-white/10 text-[16px] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40";
  const label = "block text-[13px] font-medium text-zinc-500 mb-1.5 px-1";

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative w-full sm:max-w-md bg-[#f2f2f7] dark:bg-black rounded-t-[22px] sm:rounded-[22px] h-[94vh] sm:h-[88vh] flex flex-col overflow-hidden">
        <div className="flex justify-center pt-2"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-700" /></div>
        <div className="px-4 pt-1 pb-2 flex items-center justify-between">
          <button type="button" onClick={onClose} disabled={saving} className="text-[16px] text-blue-600 dark:text-blue-400 disabled:opacity-40 min-w-[56px] text-left">Batal</button>
          <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-white">{p ? "Edit Barang" : "Barang Baru"}</h3>
          <button type="button" onClick={simpan} disabled={saving} className="text-[16px] font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40 min-w-[56px] text-right">
            {saving ? <Loader2 className="w-5 h-5 animate-spin ml-auto" /> : "Simpan"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 space-y-5">
          {/* Foto + nama */}
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 flex gap-4 items-start">
            <label className="relative w-[84px] h-[84px] rounded-[18px] bg-zinc-100 dark:bg-white/10 overflow-hidden flex items-center justify-center cursor-pointer shrink-0">
              {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-zinc-400" />}
              <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10.5px] font-medium text-center py-0.5">{fotoPreview ? "Ganti" : "Foto"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pilihFoto(e.target.files?.[0] || null)} />
            </label>
            <div className="flex-1 min-w-0">
              <span className={label}>Nama barang</span>
              <textarea value={nama} onChange={(e) => setNama(e.target.value)} rows={2} placeholder="Contoh: Stik PS4 Baru - Hitam"
                className="w-full px-3 py-2 rounded-[12px] bg-zinc-100 dark:bg-white/10 text-[16px] leading-snug text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>

          {/* Sub-kategori */}
          <div>
            <span className={label}>Kategori di kasir</span>
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
              {SUBS.map((s) => (
                <button key={s.key} type="button" onClick={() => { setSub(s.key); setSubManual(true); }}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-[14px] font-medium ${sub === s.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-[#1c1c1e] text-zinc-700 dark:text-zinc-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harga */}
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div>
                <span className={label}>Harga jual</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-400">Rp</span>
                  <input inputMode="numeric" value={fmtDigits(jual)} onChange={(e) => setJual(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                </div>
              </div>
              <div>
                <span className={label}>Harga modal</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-400">Rp</span>
                  <input inputMode="numeric" value={fmtDigits(modal)} onChange={(e) => setModal(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                </div>
              </div>
            </div>
            {untung !== null ? (
              <div className={`flex items-center justify-between rounded-[12px] px-3 py-2 text-[13.5px] ${untung >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                <span>{untung >= 0 ? "Untung per barang" : "Rugi per barang"}</span>
                <span className="font-semibold tabular-nums">{rp(Math.abs(untung))} · {Math.round((untung / jualN) * 100)}%</span>
              </div>
            ) : (
              <p className="text-[12.5px] text-zinc-500 px-1">Isi harga modal supaya laba & margin terhitung di Analitik Usaha. Harga modal tidak tampil di kasir.</p>
            )}
          </div>

          {/* Barang stok */}
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-zinc-500 px-1">Hitungan stok</span>
              <StokPill v={sv} />
            </div>
            <StokRefSelect allowAuto value={ref} onChange={setRef} categories={cats} data={data}
              className="w-full h-12 px-3 rounded-[14px] bg-zinc-100 dark:bg-white/10 text-[14px] text-zinc-900 dark:text-white" />
            {ref === undefined && preview && (
              <p className="text-[12.5px] text-zinc-500 px-1 leading-snug">
                {preview.baru ? <>Akan dibuat barang stok baru: <b className="text-zinc-700 dark:text-zinc-200">{preview.ref.kategori} › {preview.ref.item}</b></> : <>Akan memakai stok: <b className="text-zinc-700 dark:text-zinc-200">{preview.ref.kategori} › {preview.ref.item === PILIH_SAAT_CHECKOUT ? "pilih varian saat checkout" : preview.ref.item}</b></>}
              </p>
            )}
            {dipakaiLain.length > 0 && (
              <p className="text-[12.5px] text-zinc-500 px-1 leading-snug">Stok ini dipakai bersama: {dipakaiLain.map((x) => x.name).join(", ")}</p>
            )}
            {ref === null && <p className="text-[12.5px] text-amber-600 dark:text-amber-400 px-1">Stok tidak akan berkurang saat barang ini terjual.</p>}

            {bisaUbahJumlah && (
              <div className="pt-1">
                {ubahJumlah === null ? (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[14px] text-zinc-700 dark:text-zinc-200">Jumlah sekarang <b className="tabular-nums">{jumlahSekarang}</b></span>
                    <button type="button" onClick={() => setUbahJumlah(String(jumlahSekarang ?? 0))} className="text-[14px] font-medium text-blue-600 dark:text-blue-400">Ubah jumlah</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input autoFocus inputMode="numeric" value={ubahJumlah} onChange={(e) => setUbahJumlah(digits(e.target.value))}
                      className="flex-1 min-w-0 h-11 px-3.5 rounded-[12px] bg-zinc-100 dark:bg-white/10 text-[16px] tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    <button type="button" onClick={() => setUbahJumlah(null)} className="h-11 px-3 text-[14px] text-zinc-500">Batal</button>
                    <button type="button" disabled={busyStok === "jumlah"} onClick={simpanJumlah} className="h-11 px-4 rounded-[12px] bg-blue-600 text-white text-[14px] font-semibold disabled:opacity-50">
                      {busyStok === "jumlah" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                    </button>
                  </div>
                )}
                {ubahJumlah !== null && <p className="mt-1.5 px-1 text-[12px] text-zinc-500">Samakan dengan hitungan fisik. Tercatat sebagai koreksi, tidak masuk pengeluaran.</p>}
              </div>
            )}

            {masukTerakhir.length > 0 && (
              <div className="pt-2 mt-1 border-t border-zinc-100 dark:border-white/5">
                <div className="px-1 pb-1 text-[12px] font-medium text-zinc-500">Stok masuk terakhir</div>
                {masukTerakhir.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-1 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-zinc-900 dark:text-white"><b className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{l.delta}</b> {l.item}</div>
                      <div className="text-[12px] text-zinc-500">{new Date(l.ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <button type="button" disabled={!!busyStok} onClick={() => urungkan(l)}
                      className="h-8 px-3 rounded-full bg-zinc-100 dark:bg-white/10 text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 disabled:opacity-50">
                      {busyStok === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Urungkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stok masuk */}
          {ref !== null && (
            <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-zinc-900 dark:text-white">Stok masuk</div>
                  <div className="text-[12.5px] text-zinc-500">Barang baru datang / dibeli</div>
                </div>
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/10 rounded-full p-1">
                  <button type="button" aria-label="Kurangi" onClick={() => setQty((n) => Math.max(0, n - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:bg-white dark:active:bg-white/10"><Minus className="w-4 h-4" /></button>
                  <input inputMode="numeric" value={qty || ""} onChange={(e) => setQty(Math.min(9999, Number(digits(e.target.value) || 0)))} placeholder="0" className="w-10 bg-transparent text-center text-[17px] font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none" />
                  <button type="button" aria-label="Tambah" onClick={() => setQty((n) => Math.min(9999, n + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:bg-white dark:active:bg-white/10"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              {qty > 0 && (
                <div className="space-y-3 pt-1">
                  {varianList.length > 0 && (
                    <select value={varian} onChange={(e) => setVarian(e.target.value)} className={`${field} text-[15px] ${varian ? "" : "ring-1 ring-amber-300"}`}>
                      <option value="">Pilih varian…</option>
                      {varianList.map((v) => <option key={v} value={v}>{v} (sisa {Math.max(0, Math.round(Number(data?.[efektif!.kategori]?.[v]?.jumlah) || 0))})</option>)}
                    </select>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <div>
                      <span className={label}>Modal / barang</span>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-400">Rp</span>
                        <input inputMode="numeric" value={fmtDigits(modalMasuk === "" ? String(modalN ?? "") : modalMasuk)} onChange={(e) => setModalMasuk(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                      </div>
                    </div>
                    <div>
                      <span className={label}>Tanggal beli</span>
                      <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value || toLocalYmd())} className={`${field} text-[15px]`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <div className="text-[15px] text-zinc-900 dark:text-white">Catat ke Pengeluaran</div>
                      <div className="text-[12.5px] text-zinc-500">Kategori “{KATEGORI_PENGELUARAN_STOK}” · {rp(modalMasukN * qty)}</div>
                    </div>
                    <Toggle on={catat} onChange={setCatat} label="Catat ke pengeluaran" />
                  </div>
                </div>
              )}
            </div>
          )}

          {info && (
            <div className="rounded-[14px] bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-3 text-[13.5px] text-emerald-700 dark:text-emerald-400">{info}</div>
          )}
          {err && (
            <div className="flex items-start gap-2 rounded-[14px] bg-red-50 dark:bg-red-500/10 px-3.5 py-3 text-[13.5px] text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{err}
            </div>
          )}

          <button type="button" onClick={simpan} disabled={saving}
            className="w-full h-[52px] rounded-[16px] bg-blue-600 text-white text-[17px] font-semibold disabled:opacity-50 active:opacity-80 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}{p ? "Simpan perubahan" : "Tambah barang"}
          </button>
          {p && (
            <button type="button" onClick={hapus} disabled={saving} className="w-full h-11 text-[15px] text-red-600 dark:text-red-400 disabled:opacity-40">
              Hapus barang
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
